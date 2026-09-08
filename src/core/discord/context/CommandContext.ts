import { ICommandState } from "@domain/core/Command";
import { ICommandMetadata } from "@/core/decorators";
import { DiscordContext, IDiscordContextEvents } from "./DiscordContext";

/**
 * Base context for command executions.
 * Contains only behaviour/data specific to commands.
 * Shared response behaviour belongs to DiscordContext.
 */
export abstract class CommandContext extends DiscordContext {
    /**
     * Command state for this execution.
     */
    public readonly state: ICommandState = {} as ICommandState;

    /**
     * Whether this command originated from a slash command.
     */
    public abstract readonly isSlash: boolean;

    /**
     * Name of the executed command.
     */
    public abstract readonly commandName: string;

    /**
     * Metadata injected for the executed command.
     */
    declare public metadata: ICommandMetadata;

    protected constructor(events?: IDiscordContextEvents) {
        super(events);
    }

    /**
     * Get the current slash-command subcommand group.
     * Message commands return null.
     */
    public abstract getSubcommandGroup(): string | null;

    /**
     * Get the current slash-command subcommand.
     * Message commands return null.
     */
    public abstract getSubcommand(): string | null;
}
