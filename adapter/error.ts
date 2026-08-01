export class AdapterError extends Error {
    constructor(message: string) {
        super(message);

        this.name = new.target.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export interface AdapterConfigurationErrorOptions {
    providerName: string;
    endpointName: string;
}

export class AdapterConfigurationError extends AdapterError {
    public readonly providerName: string;
    public readonly endpointName: string;

    constructor(message: string, options: AdapterConfigurationErrorOptions) {
        super(message);

        this.providerName = options.providerName;
        this.endpointName = options.endpointName;
    }
}

export interface AdapterEndpointNotImplementedErrorOptions {
    providerName: string;
    endpointName: string;
}

export class AdapterEndpointNotImplementedError extends AdapterError {
    public readonly providerName: string;
    public readonly endpointName: string;

    constructor(message: string, options: AdapterEndpointNotImplementedErrorOptions) {
        super(message);

        this.providerName = options.providerName;
        this.endpointName = options.endpointName;
    }
}

export type AdapterRequestErrorKind = "http" | "network" | "timeout" | "cancelled" | "internal";

export interface AdapterRequestErrorOptions {
    providerName: string;
    endpointName: string;
    kind: AdapterRequestErrorKind;
    retryable: boolean;
    attempt: number;
    maxAttempts: number;
    status?: number;
    code?: string;
    originalError?: unknown;
}

export class AdapterRequestError extends AdapterError {
    public readonly providerName: string;
    public readonly endpointName: string;
    public readonly kind: AdapterRequestErrorKind;
    public readonly retryable: boolean;
    public readonly attempt: number;
    public readonly maxAttempts: number;
    public readonly status?: number;
    public readonly code?: string;
    public readonly originalError?: unknown;

    constructor(message: string, options: AdapterRequestErrorOptions) {
        super(message);

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
