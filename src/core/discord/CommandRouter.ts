import { ApplicationCommandDataResolvable, ApplicationCommandOptionType, PermissionResolvable } from "discord.js";

import {
    METAKEY_BOT_PERMISSIONS,
    METAKEY_COMMAND_OPTIONS,
    METAKEY_COMMAND_PROPERTIES,
    METAKEY_GUILD_ONLY,
    METAKEY_MIDDLEWARE_OPTIONS,
    METAKEY_SUBCOMMAND_OPTIONS,
    METAKEY_USER_PERMISSIONS,
} from "../metakeys";
import { TDispatcher, TLogger, TMetrics } from "../types";
import { AbstractCommand } from "./AbstractCommand";
import { CommandContext } from "./context/CommandContext";
import { ICommandOptions, IMiddlewareOptions, IOptionMetadata, ISubcommandOptions } from "../decorators";
import { CommandParser } from "./options/CommandParser";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { AbstractMiddleware } from "./middleware/AbstractMiddleware";
import { Embed } from "./ui/Embed";
import { InteractionProfiler, ProfilerStorage } from "../profiler";

export class CommandRouter {
    /**
     * Slash Command routing.
     */
    private readonly slashRootCommands = new Map<string, AbstractCommand>();
    private readonly slashSubcommands = new Map<string, AbstractCommand>();

    /**
     * Prefix Command routing.
     */
    private readonly prefixCommands = new Map<string, AbstractCommand>();

    /**
     * Middleware that is called before command execution.
     * May interrupt execution or inject data into the command context.
     */
    private readonly middlewares: Array<{ instance: AbstractMiddleware; priority: number }> = [];
    private readonly middlewareDefaultPriority = 50;

    constructor(
        private readonly logger: TLogger,
        private readonly dispatcher: TDispatcher,
        private readonly metrics: TMetrics,
    ) {
        this.logger = this.logger.child({ name: "CommandRouter" });
        this.dispatcher.on("discord", "command", this.handleCommand.bind(this));
    }

    public register(command: AbstractCommand): void {
        const commandOptions: ICommandOptions = Reflect.getMetadata(METAKEY_COMMAND_OPTIONS, command.constructor);
        const subcommandOptions: ISubcommandOptions = Reflect.getMetadata(
            METAKEY_SUBCOMMAND_OPTIONS,
            command.constructor,
        );

        if (subcommandOptions) {
            const key = subcommandOptions.group
                ? `${subcommandOptions.root}:${subcommandOptions.group}:${subcommandOptions.name}`
                : `${subcommandOptions.root}:${subcommandOptions.name}`;

            this.slashSubcommands.set(key.toLowerCase(), command);

            const prefixName =
                `${subcommandOptions.root}${subcommandOptions.group || ""}${subcommandOptions.name}`.toLowerCase();
            this.prefixCommands.set(prefixName, command);

            subcommandOptions.aliases?.forEach((alias) => this.prefixCommands.set(alias.toLowerCase(), command));

            this.logger.debug(`Registered subcommand: ${key}`);
        } else if (commandOptions) {
            if (!commandOptions.prefixOnly) this.slashRootCommands.set(commandOptions.name.toLowerCase(), command);
            this.prefixCommands.set(commandOptions.name.toLowerCase(), command);

            commandOptions.aliases?.forEach((alias) => this.prefixCommands.set(alias.toLowerCase(), command));

            this.logger.debug(`Registered root command: ${commandOptions.name}`);
        } else {
            this.logger.warn(`Tried to register a command ${command.constructor} without metadata.`);
        }
    }

    public registerMiddleware(middleware: AbstractMiddleware): void {
        const options: IMiddlewareOptions =
            Reflect.getMetadata(METAKEY_MIDDLEWARE_OPTIONS, middleware.constructor) || {};
        const priority = options.priority ?? this.middlewareDefaultPriority;

        this.middlewares.push({ instance: middleware, priority });
        this.middlewares.sort((a, b) => a.priority - b.priority);

        this.logger.debug(`Registered middleware: ${middleware.constructor.name} (Priority: ${priority})`);
    }

    public getApplicationCommandData(): Array<ApplicationCommandDataResolvable> {
        const payload = new Map<string, any>();

        for (const [name, command] of this.slashRootCommands.entries()) {
            const options: ICommandOptions = Reflect.getMetadata(METAKEY_COMMAND_OPTIONS, command.constructor);
            const properties: Array<IOptionMetadata> =
                Reflect.getMetadata(METAKEY_COMMAND_PROPERTIES, command.constructor.prototype) || [];

            payload.set(name, {
                name: options.name,
                description: options.description,
                options: properties.map((prop) => CommandParser.mapToDiscordOption(prop)),
            });
        }

        for (const [key, command] of this.slashSubcommands.entries()) {
            const subcommandOptions: ISubcommandOptions = Reflect.getMetadata(
                METAKEY_SUBCOMMAND_OPTIONS,
                command.constructor,
            );
            const subcommandProperties: Array<IOptionMetadata> =
                Reflect.getMetadata(METAKEY_COMMAND_PROPERTIES, command.constructor.prototype) || [];

            const rootPayload = payload.get(subcommandOptions.root.toLowerCase());
            if (!rootPayload) {
                this.logger.warn(
                    `Subcommand '${subcommandOptions.name}' registered for missing root command '${subcommandOptions.root}'.`,
                );
                continue;
            }

            const data = {
                type: ApplicationCommandOptionType.Subcommand,
                name: subcommandOptions.name,
                description: subcommandOptions.description,
                options: subcommandProperties.map((prop) => CommandParser.mapToDiscordOption(prop)),
            };

            if (subcommandOptions.group) {
                let group = rootPayload.options.find(
                    (o: any) =>
                        o.name === subcommandOptions.group && o.type === ApplicationCommandOptionType.SubcommandGroup,
                );
                if (!group) {
                    group = {
                        type: ApplicationCommandOptionType.SubcommandGroup,
                        name: subcommandOptions.group,
                        description: `Group ${subcommandOptions.group}`,
                        options: [],
                    };
                    rootPayload.options.push(group);
                }

                group.options.push(data);
            } else {
                rootPayload.options.push(data);
            }
        }

        return Array.from(payload.values());
    }

    public getCommand(name: string): AbstractCommand | undefined {
        const lower = name.toLowerCase().trim();
        const asSubcommandKey = lower.replace(/\s+/g, ":");

        return (
            this.prefixCommands.get(lower) ||
            this.slashSubcommands.get(asSubcommandKey) ||
            this.slashRootCommands.get(lower)
        );
    }

    public getAllCommandNames(): Array<string> {
        const names = new Set<string>();
        for (const key of this.prefixCommands.keys()) names.add(key);
        for (const key of this.slashRootCommands.keys()) names.add(key);
        for (const key of this.slashSubcommands.keys()) {
            names.add(key.replace(/:/g, " "));
        }
        return Array.from(names);
    }

    public getPrefixCommandEntries(): Array<{ name: string; command: AbstractCommand }> {
        return Array.from(this.prefixCommands.entries())
            .filter(([name, command]) => {
                const aliases = this.getCommandOptions(command)?.aliases ?? [];
                return !aliases.some((alias) => alias.toLowerCase() === name);
            })
            .map(([name, command]) => ({
                name,
                command,
            }));
    }

    public getCommandOptions(command: AbstractCommand): ICommandOptions | ISubcommandOptions | undefined {
        const options: ICommandOptions | ISubcommandOptions | undefined =
            Reflect.getMetadata(METAKEY_SUBCOMMAND_OPTIONS, command.constructor) ||
            Reflect.getMetadata(METAKEY_COMMAND_OPTIONS, command.constructor);

        return options;
    }

    public getCommandProperties(command: AbstractCommand): Array<IOptionMetadata> {
        return Reflect.getMetadata(METAKEY_COMMAND_PROPERTIES, command.constructor.prototype) || [];
    }

    public isCommandGuildOnly(command: AbstractCommand): boolean {
        return Reflect.getMetadata(METAKEY_GUILD_ONLY, command.constructor) || false;
    }

    public getCommandUserPermissions(command: AbstractCommand): Array<PermissionResolvable> {
        return Reflect.getMetadata(METAKEY_USER_PERMISSIONS, command.constructor) || [];
    }

    public getCommandBotPermissions(command: AbstractCommand): Array<PermissionResolvable> {
        return Reflect.getMetadata(METAKEY_BOT_PERMISSIONS, command.constructor) || [];
    }

    private async handleCommand(ctx: CommandContext): Promise<void> {
        let targetCommand: AbstractCommand | undefined;
        let targetCommandName: string;

        // Resolve command
        if (ctx.isSlash) {
            const commandName = ctx.commandName.toLowerCase();
            const groupName = ctx.getSubcommandGroup();
            const subName = ctx.getSubcommand();

            if (groupName && subName) {
                targetCommandName = `${commandName}:${groupName}:${subName}`;
                targetCommand = this.slashSubcommands.get(targetCommandName);
            } else if (subName) {
                targetCommandName = `${commandName}:${subName}`;
                targetCommand = this.slashSubcommands.get(targetCommandName);
            }

            if (!targetCommand) {
                targetCommandName = commandName;
                targetCommand = this.slashRootCommands.get(targetCommandName);
            }
        } else {
            targetCommandName = ctx.commandName.toLowerCase();
            targetCommand = this.prefixCommands.get(targetCommandName);

            // Support index input as part of the command name.
            if (!targetCommand) {
                const match = targetCommandName.match(/^([a-z0-9_-]+?)(\d+)$/i);
                if (match) {
                    const baseCommand = match[1]!;
                    const inlineIndex = parseInt(match[2]!, 10);

                    targetCommand = this.prefixCommands.get(baseCommand);
                    if (targetCommand) {
                        targetCommandName = baseCommand;
                        ctx.state.inlineIndex = inlineIndex;
                    }
                }
            }
        }

        if (!targetCommand) return;

        const options = this.getCommandOptions(targetCommand);
        if (!options) return;

        const guildOnly = this.isCommandGuildOnly(targetCommand);
        const userPermissions = this.getCommandUserPermissions(targetCommand);
        const botPermissions = this.getCommandBotPermissions(targetCommand);

        ctx.metadata = {
            options: options,
            guildOnly: guildOnly,
            userPermissions: userPermissions,
            botPermissions: botPermissions,
        };

        const executeChain = async (
            index: number,
        ): Promise<void> => {
            if (index < this.middlewares.length) {
                const middleware =
                    this.middlewares[index]!.instance;

                const startedAt = performance.now();

                await Promise.resolve(
                    middleware.execute(
                        ctx,
                        () => executeChain(index + 1),
                    ),
                );

                this.logger.info(
                    {
                        middleware:
                            middleware.constructor.name,
                        durationMs:
                            performance.now() - startedAt,
                        command: ctx.commandName,
                    },
                    "Command middleware completed",
                );

                return;
            }

            await this.runCommand(ctx, targetCommand);
        };

        const profiler = new InteractionProfiler();
        const commandType = ctx.isSlash ? "slash" : "prefix";

        await ProfilerStorage.run(profiler, async () => {
            const startTimer = this.metrics.commandHistogram
                .labels(targetCommandName, "success", commandType)
                .startTimer();

            this.logger.debug({ user: ctx.author.id, guild: ctx.guild?.id }, `Executing command "${ctx.commandName}"`);

            try {
                await executeChain(0);
                const stats = profiler.end();
                startTimer();

                this.logger.debug(
                    { performance: stats },
                    `Command "${ctx.commandName}" executed in ${stats.total.toFixed(2)}ms`,
                );
            } catch (error) {
                const stats = profiler.end();
                this.metrics.commandHistogram
                    .labels(targetCommandName, "error", commandType)
                    .observe(stats.total / 1000);

                this.logger.error(
                    { error, performance: stats },
                    `Command "${ctx.commandName}" failed after ${stats.total.toFixed(2)}ms`,
                );
            }
        });
    }

    private async runCommand(ctx: CommandContext, targetCommand: AbstractCommand): Promise<void> {
        const deferStartedAt = performance.now();

        if (ctx.metadata.options.defer !== false) await ctx.defer(ctx.metadata.options.ephemeral).catch(() => {});

        this.logger.info(
            {
                durationMs:
                    performance.now() - deferStartedAt,
                command: ctx.commandName,
                contextType: ctx.isSlash
                    ? "slash"
                    : "prefix",
            },
            "Command defer completed",
        );

        try {
            const properties = this.getCommandProperties(targetCommand);
            const parsedOptions = await CommandParser.parseAndValidate(ctx, properties);

            const commandInstance = Object.create(targetCommand);
            for (const [key, value] of Object.entries(parsedOptions)) {
                commandInstance[key] = value;
            }

            await Promise.resolve(commandInstance.execute(ctx));
        } catch (error) {
            if (error instanceof Exception && error.code !== EApplicationError.INTERNAL_ERROR && error.extra_message) {
                await ctx.respond(Embed.error(error.extra_message));
                return;
            }

            this.logger.error(error, `Error executing command "${ctx.commandName}"`);
            await ctx.respond(Embed.error("Something bad happened.")).catch(() => {});
        }
    }
}
