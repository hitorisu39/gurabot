import { AbstractInteraction } from "./AbstractInteraction";
import { TMessagePayload } from "./context/CommandContext";
import { ComponentContext } from "./context/ComponentContext";

export abstract class AbstractComponent extends AbstractInteraction {
    protected async runWithLoading<T>(
        ctx: ComponentContext,
        task: () => Promise<T>,
        loadingMessage: TMessagePayload = {
            content: "Processing... please wait.",
            embeds: [],
            components: [],
        },
        timeout: number = 1000,
    ): Promise<T> {
        const taskPromise = task();
        const timeoutSymbol = Symbol("TIMEOUT");
        const timeoutPromise = new Promise<typeof timeoutSymbol>((resolve) =>
            setTimeout(() => resolve(timeoutSymbol), timeout),
        );

        const raceResult = await Promise.race([taskPromise, timeoutPromise]);
        if (raceResult === timeoutSymbol) {
            await ctx.update(loadingMessage).catch(() => null);
            return await taskPromise;
        }

        return raceResult as T;
    }

    public abstract execute(ctx: ComponentContext): Promise<void>;
}
