export type AdapterErrorKind = "http" | "network" | "timeout" | "cancelled" | "internal";

export interface AdapterRequestErrorOptions {
    providerName: string;
    endpointName: string;
    kind: AdapterErrorKind;
    retryable: boolean;
    attempt: number;
    maxAttempts: number;
    status?: number;
    code?: string;
    originalError?: unknown;
}

export class AdapterRequestError extends Error {
    public readonly providerName: string;
    public readonly endpointName: string;
    public readonly kind: AdapterErrorKind;
    public readonly retryable: boolean;
    public readonly attempt: number;
    public readonly maxAttempts: number;
    public readonly status?: number;
    public readonly code?: string;
    public readonly originalError?: unknown;

    constructor(message: string, options: AdapterRequestErrorOptions) {
        super(message);

        this.name = "AdapterRequestError";
        this.providerName = options.providerName;
        this.endpointName = options.endpointName;
        this.kind = options.kind;
        this.retryable = options.retryable;
        this.attempt = options.attempt;
        this.maxAttempts = options.maxAttempts;
        this.status = options.status;
        this.code = options.code;
        this.originalError = options.originalError;
    }
}
