import {
    ApplicationCommandDataResolvable,
    ApplicationCommandOptionType,
    ApplicationIntegrationType,
    InteractionContextType,
    PermissionResolvable,
} from "discord.js";

import {
    METAKEY_BOT_PERMISSIONS,
    METAKEY_COMMAND_CATEGORY,
    METAKEY_COMMAND_OPTIONS,
    METAKEY_COMMAND_PROPERTIES,
    METAKEY_GUILD_ONLY,
    METAKEY_MIDDLEWARE_OPTIONS,
    METAKEY_NO_USER_INSTALL,
    METAKEY_SUBCOMMAND_OPTIONS,
    METAKEY_USER_PERMISSIONS,
} from "../metakeys";

import { TDispatcher, TLogger, TMetrics } from "../types";
import { AbstractCommand } from "./AbstractCommand";
import { CommandContext } from "./context/CommandContext";
import {
    ICommandOptions,
    IMiddlewareOptions,
    IOptionMetadata,
    ISubcommandGroupOptions,
    ISubcommandOptions,
} from "../decorators";
import { CommandParser } from "./options/CommandParser";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { AbstractMiddleware } from "./middleware/AbstractMiddleware";
import { Embed } from "./ui/Embed";
import { InteractionProfiler, ProfilerStorage } from "../profiler";
import { ECommandCategory } from "@domain/core/Command";
import { AutocompleteContext } from "./context/AutocompleteContext";

export class CommandRouter {
    /**
     * Command registry.
     *
     * These contain every registered command regardless of whether
     * the command is available through slash commands, prefix commands,
     * or both.
     */
    private readonly rootCommands = new Map<string, AbstractCommand>();
    private readonly subcommandGroups = new Map<string, ISubcommandGroupOptions>();
    private readonly subcommands = new Map<string, AbstractCommand>();

    /**
     * Slash command routing.
     *
     * Derived from the command registry.
     */
    private readonly slashRootCommands = new Map<string, AbstractCommand>();
    private readonly slashSubcommands = new Map<string, AbstractCommand>();

    /**
     * Prefix command routing.
     *
     * Derived from the command registry.
     */
    private readonly prefixCommands = new Map<string, AbstractCommand>();

    /**
     * Middleware that is called before command execution.
     * May interrupt execution or inject data into the command context.
     */
    private readonly middlewares: Array<{
        instance: AbstractMiddleware;
        priority: number;
    }> = [];

    private readonly middlewareDefaultPriority = 50;

    constructor(
        private readonly logger: TLogger,
        private readonly dispatcher: TDispatcher,
        private readonly metrics: TMetrics,
    ) {
        this.logger = this.logger.child({
            name: "CommandRouter",
        });

        this.dispatcher.on("discord", "command", this.handleCommand.bind(this));
        this.dispatcher.on("discord", "autocomplete", this.handleAutocomplete.bind(this));
    }

    //#region Registration

    public register(command: AbstractCommand): void {
        const commandOptions: ICommandOptions | undefined = Reflect.getMetadata(
            METAKEY_COMMAND_OPTIONS,
            command.constructor,
        );

        const subcommandOptions: ISubcommandOptions | undefined = Reflect.getMetadata(
            METAKEY_SUBCOMMAND_OPTIONS,
            command.constructor,
        );

        if (subcommandOptions) {
            this.registerSubcommand(command, subcommandOptions);
        } else if (commandOptions) {
            this.registerRootCommand(command, commandOptions);
        } else {
            this.logger.warn(`Tried to register a command ${command.constructor} without metadata.`);

            return;
        }

        this.rebuildRoutes();
    }

    private registerRootCommand(command: AbstractCommand, options: ICommandOptions): void {
        if (options.prefixOnly && options.slashOnly) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `Command '${options.name}' cannot be both prefix-only and slash-only.`,
            );
        }

        const name = options.name.toLowerCase();
        this.rootCommands.set(name, command);
        this.logger.debug(`Registered root command: ${options.name}`);
    }

    private registerSubcommand(command: AbstractCommand, options: ISubcommandOptions): void {
        if (!this.isCommandUserInstallable(command)) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `@NoUserInstall() cannot be applied to subcommand '${options.root}:${options.name}'. Discord installation types are configured on the root command.`,
            );
        }

        const key = this.getSubcommandKey(options);
        this.subcommands.set(key, command);
        this.logger.debug(`Registered subcommand: ${key}`);
    }

    public registerSubcommandGroup(options: ISubcommandGroupOptions): void {
        const key = this.getSubcommandGroupKey(options);
        this.subcommandGroups.set(key, options);
        this.logger.debug(`Registered subcommand group: ${key}`);
    }

    private getSubcommandGroupKey(options: ISubcommandGroupOptions): string {
        return `${options.root}:${options.name}`.toLowerCase();
    }

    /**
     * Rebuilds all transport-specific routing maps from the command registry.
     */
    private rebuildRoutes(): void {
        this.slashRootCommands.clear();
        this.slashSubcommands.clear();
        this.prefixCommands.clear();

        this.buildRootRoutes();
        this.buildSubcommandRoutes();
    }

    private buildRootRoutes(): void {
        for (const [name, command] of this.rootCommands) {
            const options: ICommandOptions | undefined = Reflect.getMetadata(
                METAKEY_COMMAND_OPTIONS,
                command.constructor,
            );

            if (!options) {
                continue;
            }

            if (!options.prefixOnly) {
                this.slashRootCommands.set(name, command);
            }

            if (!options.slashOnly) {
                this.prefixCommands.set(name, command);

                options.aliases?.forEach((alias) => {
                    this.prefixCommands.set(alias.toLowerCase(), command);
                });
            }
        }
    }

    private buildSubcommandRoutes(): void {
        for (const [key, command] of this.subcommands) {
            const options: ISubcommandOptions | undefined = Reflect.getMetadata(
                METAKEY_SUBCOMMAND_OPTIONS,
                command.constructor,
            );

            if (!options) {
                continue;
            }

            /**
             * The root may not have been registered yet due to init order.
             */
            const rootCommand = this.rootCommands.get(options.root.toLowerCase());
            if (!rootCommand) {
                continue;
            }

            const rootOptions: ICommandOptions | undefined = Reflect.getMetadata(
                METAKEY_COMMAND_OPTIONS,
                rootCommand.constructor,
            );

            if (!rootOptions) {
                continue;
            }

            if (rootOptions.slashOnly && options.prefixOnly) {
                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    `Subcommand '${key}' cannot be prefix-only because root command '${rootOptions.name}' is slash-only.`,
                );
            }

            if (!rootOptions.prefixOnly && !options.prefixOnly) {
                this.slashSubcommands.set(key, command);
            }

            if (!rootOptions.slashOnly) {
                const prefixName = `${options.root}${options.group ?? ""}${options.name}`.toLowerCase();
                this.prefixCommands.set(prefixName, command);

                options.aliases?.forEach((alias) => {
                    this.prefixCommands.set(alias.toLowerCase(), command);
                });
            }
        }
    }

    private getSubcommandKey(options: ISubcommandOptions): string {
        return (
            options.group ? `${options.root}:${options.group}:${options.name}` : `${options.root}:${options.name}`
        ).toLowerCase();
    }

    /**
     * Validates relationships that cannot safely be validated while
     * commands are still being registered.
     *
     * This should be called only once registration is expected to be
     * complete.
     */
    private validateCommandGraph(): void {
        for (const [key, groupOptions] of this.subcommandGroups) {
            const rootCommand = this.rootCommands.get(groupOptions.root.toLowerCase());

            if (!rootCommand) {
                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    `Subcommand group '${key}' references missing root command '${groupOptions.root}'.`,
                );
            }

            const rootOptions: ICommandOptions | undefined = Reflect.getMetadata(
                METAKEY_COMMAND_OPTIONS,
                rootCommand.constructor,
            );

            if (!rootOptions) {
                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    `Root command '${groupOptions.root}' has no command metadata.`,
                );
            }

            if (rootOptions.prefixOnly) {
                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    `Subcommand group '${key}' cannot belong to prefix-only root command '${rootOptions.name}'.`,
                );
            }
        }

        for (const [key, command] of this.subcommands) {
            const options: ISubcommandOptions | undefined = Reflect.getMetadata(
                METAKEY_SUBCOMMAND_OPTIONS,
                command.constructor,
            );

            if (!options) {
                continue;
            }

            const rootCommand = this.rootCommands.get(options.root.toLowerCase());

            if (!rootCommand) {
                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    `Subcommand '${key}' references missing root command '${options.root}'.`,
                );
            }

            const rootOptions: ICommandOptions | undefined = Reflect.getMetadata(
                METAKEY_COMMAND_OPTIONS,
                rootCommand.constructor,
            );

            if (!rootOptions) {
                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    `Root command '${options.root}' has no command metadata.`,
                );
            }

            if (options.group) {
                const groupKey = `${options.root}:${options.group}`.toLowerCase();

                if (!this.subcommandGroups.has(groupKey)) {
                    throw new Exception(
                        EApplicationError.INTERNAL_ERROR,
                        `Subcommand '${key}' references missing subcommand group '${groupKey}'.`,
                    );
                }
            }

            if (rootOptions.slashOnly && options.prefixOnly) {
                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    `Subcommand '${key}' cannot be prefix-only because root command '${rootOptions.name}' is slash-only.`,
                );
            }
        }

        for (const command of new Set(this.prefixCommands.values())) {
            this.getCommandCategory(command);
        }
    }

    //#endregion

    //#region Metadata

    public isCommandUserInstallable(command: AbstractCommand): boolean {
        return Reflect.getMetadata(METAKEY_NO_USER_INSTALL, command.constructor) !== true;
    }

    public getCommandOptions(command: AbstractCommand): ICommandOptions | ISubcommandOptions | undefined {
        return (
            Reflect.getMetadata(METAKEY_SUBCOMMAND_OPTIONS, command.constructor) ||
            Reflect.getMetadata(METAKEY_COMMAND_OPTIONS, command.constructor)
        );
    }

    public getCommandProperties(command: AbstractCommand): Array<IOptionMetadata> {
        return Reflect.getMetadata(METAKEY_COMMAND_PROPERTIES, command.constructor.prototype) || [];
    }

    public getCommandCategory(command: AbstractCommand): ECommandCategory {
        const category: ECommandCategory | undefined = Reflect.getMetadata(
            METAKEY_COMMAND_CATEGORY,
            command.constructor,
        );

        if (category) {
            return category;
        }

        const subcommandOptions: ISubcommandOptions | undefined = Reflect.getMetadata(
            METAKEY_SUBCOMMAND_OPTIONS,
            command.constructor,
        );

        if (subcommandOptions) {
            const rootCommand = this.rootCommands.get(subcommandOptions.root.toLowerCase());

            if (rootCommand) {
                const rootCategory: ECommandCategory | undefined = Reflect.getMetadata(
                    METAKEY_COMMAND_CATEGORY,
                    rootCommand.constructor,
                );

                if (rootCategory) {
                    return rootCategory;
                }
            }
        }

        throw new Exception(
            EApplicationError.INTERNAL_ERROR,
            `Command '${this.getCommandDisplayName(command)}' has no category.`,
        );
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

    //#endregion

    //#region Middleware

    public registerMiddleware(middleware: AbstractMiddleware): void {
        const options: IMiddlewareOptions =
            Reflect.getMetadata(METAKEY_MIDDLEWARE_OPTIONS, middleware.constructor) || {};

        const priority = options.priority ?? this.middlewareDefaultPriority;

        this.middlewares.push({
            instance: middleware,
            priority,
        });

        this.middlewares.sort((a, b) => a.priority - b.priority);
        this.logger.debug(`Registered middleware: ${middleware.constructor.name} (Priority: ${priority})`);
    }

    //#endregion

    //#region Discord application commands

    public getApplicationCommandData(): Array<ApplicationCommandDataResolvable> {
        /*
         * By the time Discord application command data is generated,
         * registration is expected to be complete.
         */
        this.validateCommandGraph();

        const payload = new Map<string, any>();

        /*
         * Root commands.
         */
        for (const [name, command] of this.slashRootCommands.entries()) {
            const options: ICommandOptions = Reflect.getMetadata(METAKEY_COMMAND_OPTIONS, command.constructor);

            const properties: Array<IOptionMetadata> =
                Reflect.getMetadata(METAKEY_COMMAND_PROPERTIES, command.constructor.prototype) || [];

            const userInstallable = this.isCommandUserInstallable(command);
            const guildOnly = this.isCommandGuildOnly(command);

            payload.set(name, {
                name: options.name,
                description: options.description,
                options: this.mapApplicationCommandOptions(properties),
                integration_types: userInstallable
                    ? [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall]
                    : [ApplicationIntegrationType.GuildInstall],
                contexts: guildOnly
                    ? [InteractionContextType.Guild]
                    : [
                          InteractionContextType.Guild,
                          InteractionContextType.BotDM,
                          InteractionContextType.PrivateChannel,
                      ],
            });
        }

        /*
         * Explicitly declared subcommand groups.
         *
         * Groups must exist before grouped subcommands are appended below.
         */
        for (const [key, groupOptions] of this.subcommandGroups.entries()) {
            const rootPayload = payload.get(groupOptions.root.toLowerCase());

            if (!rootPayload) {
                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    `Slash subcommand group '${key}' has no slash-capable root command '${groupOptions.root}'.`,
                );
            }

            rootPayload.options.push({
                type: ApplicationCommandOptionType.SubcommandGroup,
                name: groupOptions.name,
                description: groupOptions.description,
                options: [],
            });
        }

        /*
         * Subcommands.
         */
        for (const [key, command] of this.slashSubcommands.entries()) {
            const subcommandOptions: ISubcommandOptions = Reflect.getMetadata(
                METAKEY_SUBCOMMAND_OPTIONS,
                command.constructor,
            );

            const subcommandProperties: Array<IOptionMetadata> =
                Reflect.getMetadata(METAKEY_COMMAND_PROPERTIES, command.constructor.prototype) || [];

            const rootPayload = payload.get(subcommandOptions.root.toLowerCase());

            if (!rootPayload) {
                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    `Slash subcommand '${key}' has no slash-capable root command '${subcommandOptions.root}'.`,
                );
            }

            const data = {
                type: ApplicationCommandOptionType.Subcommand,
                name: subcommandOptions.name,
                description: subcommandOptions.description,
                options: this.mapApplicationCommandOptions(subcommandProperties),
            };

            if (subcommandOptions.group) {
                const group = rootPayload.options.find(
                    (option: any) =>
                        option.name === subcommandOptions.group &&
                        option.type === ApplicationCommandOptionType.SubcommandGroup,
                );

                if (!group) {
                    throw new Exception(
                        EApplicationError.INTERNAL_ERROR,
                        `Slash subcommand '${key}' references missing group '${subcommandOptions.root}:${subcommandOptions.group}'.`,
                    );
                }

                group.options.push(data);
            } else {
                rootPayload.options.push(data);
            }
        }

        return Array.from(payload.values());
    }

    //#endregion

    //#region Command lookup

    public getCommand(name: string): AbstractCommand | undefined {
        const lower = name.toLowerCase().trim();
        const asSubcommandKey = lower.replace(/\s+/g, ":");

        return (
            this.prefixCommands.get(lower) ||
            this.slashSubcommands.get(asSubcommandKey) ||
            this.slashRootCommands.get(lower)
        );
    }

    private getCommandDisplayName(command: AbstractCommand): string {
        const subcommandOptions: ISubcommandOptions | undefined = Reflect.getMetadata(
            METAKEY_SUBCOMMAND_OPTIONS,
            command.constructor,
        );

        if (subcommandOptions) {
            return [subcommandOptions.root, subcommandOptions.group, subcommandOptions.name].filter(Boolean).join(" ");
        }

        const commandOptions: ICommandOptions | undefined = Reflect.getMetadata(
            METAKEY_COMMAND_OPTIONS,
            command.constructor,
        );

        return commandOptions?.name ?? command.constructor.name;
    }

    private mapApplicationCommandOptions(properties: ReadonlyArray<IOptionMetadata>): Array<any> {
        return [...properties]
            .sort((a, b) => Number(b.required) - Number(a.required))
            .map((property) => CommandParser.mapToDiscordOption(property));
    }

    public getAllCommandNames(): Array<string> {
        const names = new Set<string>();

        for (const key of this.prefixCommands.keys()) {
            names.add(key);
        }

        for (const key of this.slashRootCommands.keys()) {
            names.add(key);
        }

        for (const key of this.slashSubcommands.keys()) {
            names.add(key.replace(/:/g, " "));
        }

        return Array.from(names);
    }

    public getPrefixCommandEntries(category?: ECommandCategory): Array<{
        name: string;
        command: AbstractCommand;
    }> {
        return Array.from(this.prefixCommands.entries())
            .filter(([name, command]) => {
                const aliases = this.getCommandOptions(command)?.aliases ?? [];

                return !aliases.some((alias) => alias.toLowerCase() === name);
            })
            .filter(([, command]) => {
                return category === undefined || this.getCommandCategory(command) === category;
            })
            .map(([name, command]) => ({
                name,
                command,
            }));
    }

    //#endregion

    //#region Execution

    private async handleAutocomplete(ctx: AutocompleteContext): Promise<void> {
        const commandName = ctx.commandName.toLowerCase();
        const groupName = ctx.getSubcommandGroup();
        const subName = ctx.getSubcommand();

        let targetCommand: AbstractCommand | undefined;

        if (groupName && subName) {
            targetCommand = this.slashSubcommands.get(`${commandName}:${groupName}:${subName}`);
        } else if (subName) {
            targetCommand = this.slashSubcommands.get(`${commandName}:${subName}`);
        } else {
            targetCommand = this.slashRootCommands.get(commandName);
        }

        if (!targetCommand) {
            return await ctx.respond([]);
        }

        try {
            await targetCommand.autocomplete?.(ctx);
        } catch (error) {
            this.logger.error(
                {
                    error,
                    command: commandName,
                    option: ctx.getFocused().name,
                },
                `Error handling autocomplete for "${commandName}"`,
            );

            await ctx.respond([]).catch(() => {});
        }
    }

    private async handleCommand(ctx: CommandContext): Promise<void> {
        let targetCommand: AbstractCommand | undefined;
        let targetCommandName: string;

        /*
         * Resolve command.
         */
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

            /*
             * Support index input as part of the command name.
             */
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

        if (!targetCommand) {
            return;
        }

        const options = this.getCommandOptions(targetCommand);
        if (!options) {
            return;
        }

        const guildOnly = this.isCommandGuildOnly(targetCommand);
        const userPermissions = this.getCommandUserPermissions(targetCommand);
        const botPermissions = this.getCommandBotPermissions(targetCommand);

        ctx.metadata = {
            options,
            guildOnly,
            userPermissions,
            botPermissions,
        };

        const executeChain = async (index: number): Promise<void> => {
            if (index < this.middlewares.length) {
                await Promise.resolve(this.middlewares[index]?.instance.execute(ctx, () => executeChain(index + 1)));
            } else {
                await this.runCommand(ctx, targetCommand);
            }
        };

        const profiler = new InteractionProfiler();
        const commandType = ctx.isSlash ? "slash" : "prefix";

        await ProfilerStorage.run(profiler, async () => {
            const startTimer = this.metrics.commandHistogram
                .labels(targetCommandName, "success", commandType)
                .startTimer();

            this.logger.debug(
                {
                    user: ctx.author.id,
                    guild: ctx.guild?.id,
                },
                `Executing command "${targetCommandName}"`,
            );

            try {
                await executeChain(0);

                const stats = profiler.end();
                startTimer();

                this.logger.debug(
                    {
                        performance: stats,
                    },
                    `Command "${targetCommandName}" executed in ${stats.total.toFixed(2)}ms`,
                );
            } catch (error) {
                const stats = profiler.end();

                this.metrics.commandHistogram
                    .labels(targetCommandName, "error", commandType)
                    .observe(stats.total / 1000);

                this.logger.error(
                    {
                        error,
                        performance: stats,
                    },
                    `Command "${targetCommandName}" failed after ${stats.total.toFixed(2)}ms`,
                );
            }
        });
    }

    private async runCommand(ctx: CommandContext, targetCommand: AbstractCommand): Promise<void> {
        if (ctx.metadata.options.defer !== false) {
            await ctx.defer(ctx.metadata.options.ephemeral).catch(() => {});
        }

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

    //#endregion
}
