import {
    ApplicationCommandDataResolvable,
    ApplicationCommandOptionType,
    ApplicationIntegrationType,
    InteractionContextType,
    PermissionResolvable,
} from "discord.js";
import {
    type ICommandOptions,
    type IOptionMetadata,
    type ISubcommandGroupOptions,
    type ISubcommandOptions,
} from "../decorators";

import { ECoreCommandKind, type ICoreMiddlewareDefinition, type TCoreCommandDefinition } from "../definition";
import { TDispatcher, TLogger, TMetrics } from "../types";
import { AbstractCommand } from "./AbstractCommand";
import { CommandContext } from "./context/CommandContext";
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

    private readonly commandDefinitions = new WeakMap<AbstractCommand, TCoreCommandDefinition>();

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
        this.dispatcher.on("discord", "autocomplete", this.handleAutocomplete.bind(this));
    }

    //#region Registration

    public register(command: AbstractCommand, definition: TCoreCommandDefinition): void {
        this.commandDefinitions.set(command, definition);

        if (definition.kind === ECoreCommandKind.Subcommand) {
            this.registerSubcommand(command, definition.options);
        } else {
            this.registerRootCommand(command, definition.options);
        }

        this.rebuildRoutes();
    }

    private registerRootCommand(command: AbstractCommand, options: ICommandOptions): void {
        const name = options.name.toLowerCase();
        this.rootCommands.set(name, command);
        this.logger.debug(`Registered root command: ${options.name}`);
    }

    private registerSubcommand(command: AbstractCommand, options: ISubcommandOptions): void {
        const key = this.getSubcommandKey(options);
        this.subcommands.set(key, command);
        this.logger.debug(`Registered subcommand: ${key}`);
    }

    public registerSubcommandGroup(options: ISubcommandGroupOptions): void {
        const key = this.getSubcommandGroupKey(options);
        this.subcommandGroups.set(key, options);
        this.logger.debug(`Registered subcommand group: ${key}`);
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
            const definition = this.getCommandDefinition(command);

            if (definition.kind !== ECoreCommandKind.Root) {
                continue;
            }

            const options = definition.options;

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
            const definition = this.getCommandDefinition(command);

            if (definition.kind !== ECoreCommandKind.Subcommand) {
                continue;
            }

            const options = definition.options;
            const rootCommand = this.rootCommands.get(options.root.toLowerCase());
            if (!rootCommand) {
                continue;
            }

            const rootDefinition = this.getCommandDefinition(rootCommand);
            if (rootDefinition.kind !== ECoreCommandKind.Root) {
                continue;
            }

            const rootOptions = rootDefinition.options;
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

    private getSubcommandGroupKey(options: ISubcommandGroupOptions): string {
        return `${options.root}:${options.name}`.toLowerCase();
    }

    private getSubcommandKey(options: ISubcommandOptions): string {
        return (
            options.group ? `${options.root}:${options.group}:${options.name}` : `${options.root}:${options.name}`
        ).toLowerCase();
    }

    //#endregion

    //#region Metadata

    private getCommandDefinition(command: AbstractCommand): TCoreCommandDefinition {
        const definition = this.commandDefinitions.get(command);

        if (!definition) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `Command '${command.constructor.name}' has no generated core definition.`,
            );
        }

        return definition;
    }

    public getCommandOptions(command: AbstractCommand): ICommandOptions | ISubcommandOptions {
        return this.getCommandDefinition(command).options;
    }

    public getCommandProperties(command: AbstractCommand): ReadonlyArray<IOptionMetadata> {
        return this.getCommandDefinition(command).properties;
    }

    public getCommandCategory(command: AbstractCommand): ECommandCategory {
        const definition = this.getCommandDefinition(command);
        if (definition.category !== undefined) {
            return definition.category;
        }

        if (definition.kind === ECoreCommandKind.Subcommand) {
            const root = this.rootCommands.get(definition.options.root.toLowerCase());

            if (root) {
                const rootCategory = this.getCommandDefinition(root).category;
                if (rootCategory !== undefined) {
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
        return this.getCommandDefinition(command).guildOnly;
    }

    public isCommandUserInstallable(command: AbstractCommand): boolean {
        return !this.getCommandDefinition(command).noUserInstall;
    }

    public getCommandUserPermissions(command: AbstractCommand): ReadonlyArray<PermissionResolvable> {
        return this.getCommandDefinition(command).userPermissions;
    }

    public getCommandBotPermissions(command: AbstractCommand): ReadonlyArray<PermissionResolvable> {
        return this.getCommandDefinition(command).botPermissions;
    }

    public getCommandHelp(command: AbstractCommand): string | undefined {
        return this.getCommandDefinition(command).help;
    }

    public getCommandExamples(command: AbstractCommand): ReadonlyArray<string> {
        return this.getCommandDefinition(command).examples ?? [];
    }

    public getCommandDisplayName(command: AbstractCommand): string {
        const definition = this.getCommandDefinition(command);
        if (definition.kind === ECoreCommandKind.Subcommand) {
            return [definition.options.root, definition.options.group, definition.options.name]
                .filter(Boolean)
                .join(" ");
        }

        return definition.options.name;
    }

    //#endregion

    //#region Middleware

    public registerMiddleware(middleware: AbstractMiddleware, definition: ICoreMiddlewareDefinition): void {
        const priority = definition.options.priority ?? this.middlewareDefaultPriority;
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
        const payload = new Map<string, any>();

        for (const [name, command] of this.slashRootCommands) {
            const definition = this.getCommandDefinition(command);
            if (definition.kind !== ECoreCommandKind.Root) {
                continue;
            }

            const options = definition.options;

            payload.set(name, {
                name: options.name,
                description: options.description,
                options: this.mapApplicationCommandOptions(definition.properties),
                integration_types: this.isCommandUserInstallable(command)
                    ? [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall]
                    : [ApplicationIntegrationType.GuildInstall],
                contexts: this.isCommandGuildOnly(command)
                    ? [InteractionContextType.Guild]
                    : [
                          InteractionContextType.Guild,
                          InteractionContextType.BotDM,
                          InteractionContextType.PrivateChannel,
                      ],
            });
        }

        for (const [key, options] of this.subcommandGroups) {
            const rootPayload = payload.get(options.root.toLowerCase());

            if (!rootPayload) {
                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    `Slash subcommand group '${key}' has no slash-capable root command '${options.root}'.`,
                );
            }

            rootPayload.options.push({
                type: ApplicationCommandOptionType.SubcommandGroup,
                name: options.name,
                description: options.description,
                options: [],
            });
        }

        for (const [key, command] of this.slashSubcommands) {
            const definition = this.getCommandDefinition(command);
            if (definition.kind !== ECoreCommandKind.Subcommand) {
                continue;
            }

            const options = definition.options;
            const rootPayload = payload.get(options.root.toLowerCase());

            if (!rootPayload) {
                throw new Exception(
                    EApplicationError.INTERNAL_ERROR,
                    `Slash subcommand '${key}' has no slash-capable root command '${options.root}'.`,
                );
            }

            const data = {
                type: ApplicationCommandOptionType.Subcommand,
                name: options.name,
                description: options.description,
                options: this.mapApplicationCommandOptions(definition.properties),
            };

            if (options.group) {
                const group = rootPayload.options.find(
                    (option: any) =>
                        option.name === options.group && option.type === ApplicationCommandOptionType.SubcommandGroup,
                );

                if (!group) {
                    throw new Exception(
                        EApplicationError.INTERNAL_ERROR,
                        `Slash subcommand '${key}' references missing group '${options.root}:${options.group}'.`,
                    );
                }

                group.options.push(data);
            } else {
                rootPayload.options.push(data);
            }
        }

        return [...payload.values()];
    }

    private mapApplicationCommandOptions(properties: ReadonlyArray<IOptionMetadata>): Array<any> {
        return [...properties]
            .sort((a, b) => Number(b.required) - Number(a.required))
            .map((property) => CommandParser.mapToDiscordOption(property));
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

        return [...names];
    }

    public getPrefixCommandEntries(category?: ECommandCategory): Array<{
        name: string;
        command: AbstractCommand;
    }> {
        return [...this.prefixCommands.entries()]
            .filter(([name, command]) => {
                const aliases = this.getCommandOptions(command).aliases ?? [];
                return !aliases.some((alias) => alias.toLowerCase() === name);
            })
            .filter(([, command]) => category === undefined || this.getCommandCategory(command) === category)
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
                { error, command: commandName, option: ctx.getFocused().name },
                `Error handling autocomplete for "${commandName}"`,
            );

            await ctx.respond([]).catch(() => {});
        }
    }

    private async handleCommand(ctx: CommandContext): Promise<void> {
        let targetCommand: AbstractCommand | undefined;
        let targetCommandName: string;

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

        ctx.metadata = {
            options,
            guildOnly: this.isCommandGuildOnly(targetCommand),
            userPermissions: this.getCommandUserPermissions(targetCommand),
            botPermissions: this.getCommandBotPermissions(targetCommand),
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
                { user: ctx.author.id, guild: ctx.guild?.id },
                `Executing command "${targetCommandName}"`,
            );

            try {
                await executeChain(0);

                const stats = profiler.end();
                startTimer();

                this.logger.debug(
                    { performance: stats },
                    `Command "${targetCommandName}" executed in ${stats.total.toFixed(2)}ms`,
                );
            } catch (error) {
                const stats = profiler.end();

                this.metrics.commandHistogram
                    .labels(targetCommandName, "error", commandType)
                    .observe(stats.total / 1000);

                this.logger.error(
                    { error, performance: stats },
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
