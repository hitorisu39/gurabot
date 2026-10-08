import { AsyncLocalStorage } from "async_hooks";
import { performance } from "perf_hooks";

export interface IPerformanceStep {
    count: number;
    total: number;
    max: number;
}

export interface IPerformanceSpan {
    id: number;
    parentId: number | null;
    name: string;
    /** Start offset and duration are in milliseconds. */
    start: number;
    duration?: number;
    status: "running" | "success" | "error";
}

export class InteractionProfiler {
    private readonly startTime = performance.now();
    private readonly spans: IPerformanceSpan[] = [];
    private readonly stepStats: Record<string, IPerformanceStep> = {};
    private droppedSpans = 0;
    private ended = false;
    private endTime?: number;

    public steps: Record<string, number> = {};

    constructor(private readonly spanLimit = 0) {}

    /**
     * Records the duration of a specific step.
     * If called multiple times with the same name, it accumulates the time.
     */
    public record(name: string, duration: number): void {
        if (this.ended) return;
        this.steps[name] = (this.steps[name] || 0) + duration;
        const stats = (this.stepStats[name] ??= { count: 0, total: 0, max: 0 });
        stats.count++;
        stats.total += duration;
        stats.max = Math.max(stats.max, duration);
    }

    public trace<T>(name: string, operation: () => T): T {
        if (this.ended) return operation();

        const start = performance.now();
        let span: IPerformanceSpan | undefined;
        if (this.spans.length < this.spanLimit) {
            const parent = SpanStorage.getStore();
            const parentId = parent?.profiler === this ? parent.spanId : null;
            span = { id: this.spans.length, parentId, name, start: start - this.startTime, status: "running" };
            this.spans.push(span);
        } else if (this.spanLimit > 0) {
            this.droppedSpans++;
        }

        const finish = (status: "success" | "error") => {
            if (this.ended) return;
            const duration = performance.now() - start;
            this.record(name, duration);
            if (span) {
                span.duration = duration;
                span.status = status;
            }
        };

        const run = () => {
            try {
                const result = operation();
                if (result instanceof Promise) {
                    return result.then(
                        (value) => {
                            finish("success");
                            return value;
                        },
                        (error) => {
                            finish("error");
                            throw error;
                        },
                    ) as T;
                }
                finish("success");
                return result;
            } catch (error) {
                finish("error");
                throw error;
            }
        };

        return span ? SpanStorage.run({ profiler: this, spanId: span.id }, run) : run();
    }

    public end() {
        this.ended = true;
        this.endTime ??= performance.now();
        const round = (value: number) => Math.round(value * 100) / 100;
        const repeated = Object.fromEntries(
            Object.entries(this.stepStats)
                .filter(([, stats]) => stats.count > 1)
                .map(([name, stats]) => [name, { count: stats.count, max: round(stats.max) }]),
        );

        return {
            total: round(this.endTime - this.startTime),
            steps: Object.fromEntries(Object.entries(this.steps).map(([name, total]) => [name, round(total)])),
            ...(Object.keys(repeated).length > 0 ? { repeated } : {}),
            ...(this.spanLimit > 0
                ? {
                      spans: this.spans.map((span) => ({
                          ...span,
                          start: round(span.start),
                          ...(span.duration !== undefined ? { duration: round(span.duration) } : {}),
                      })),
                      droppedSpans: this.droppedSpans,
                  }
                : {}),
        };
    }
}

const SpanStorage = new AsyncLocalStorage<{ profiler: InteractionProfiler; spanId: number }>();
export const ProfilerStorage = new AsyncLocalStorage<InteractionProfiler>();

/** Trace an internal stage without changing its return value when profiling is disabled. */
export function traceStep<T>(name: string, operation: () => T): T {
    const profiler = ProfilerStorage.getStore();
    return profiler ? profiler.trace(name, operation) : operation();
}
