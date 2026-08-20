export interface IOsekaiResponse<T> {
    success: boolean;
    message: string;
    content: T;
    timings?: Record<string, unknown>;
}

export interface IOsekaiCompactData {
    _t?: boolean;
    k: Array<string>;
    d: Array<Array<unknown>>;
}
