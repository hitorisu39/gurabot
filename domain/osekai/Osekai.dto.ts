export interface IOsekaiResponse<T> {
    success: boolean;
    message: string;
    content: T;
    timings?: Record<string, unknown>;
}
