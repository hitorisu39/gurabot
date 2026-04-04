import { CommandContext } from "@/core/discord/context/CommandContext";
import { ComponentContext } from "@/core/discord/context/ComponentContext";

export interface IApplicationEvents {
    app: {
        ready(): void;
    };
    discord: {
        command(ctx: CommandContext): void;
        component(ctx: ComponentContext): void;
    };
}
