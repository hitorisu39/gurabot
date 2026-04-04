import { AsyncLocalStorage } from "async_hooks";
import { performance } from "perf_hooks";

export class InteractionProfiler {
    private startTime = performance.now();
    public steps: Record<string, number> = {};

    /**
     * Records the duration of a specific step.
     * If called multiple times with the same name, it accumulates the time.
     */
    public record(name: string, duration: number): void {
        this.steps[name] = (this.steps[name] || 0) + duration;
    }

    /**
     * Ends the profiling and returns the statistics.
     */
    public end() {
        return {
            total: performance.now() - this.startTime,
            steps: this.steps,
        };
    }
}

export const ProfilerStorage = new AsyncLocalStorage<InteractionProfiler>();
