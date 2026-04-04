export enum EApplicationError {
    INTERNAL_ERROR = "INTERNAL_ERROR",
    INPUT_ERROR = "INPUT_ERROR",
    NOT_IMPLEMENTED = "NOT_IMPLEMENTED",
    SESSION_EXPIRED = "SESSION_EXPIRED",
    ACCESS_ERROR = "ACCESS_ERROR",
    NOT_FOUND = "NOT_FOUND",
    QUERY_ERROR = "QUERY_ERROR",
}

export class Exception<T extends EApplicationError & string> extends Error {
    constructor(
        public readonly code: T,
        public readonly extra_message?: string,
        extra?: { cause?: Error; stack?: string },
    ) {
        super(code, {
            cause: extra?.cause,
        });
        this.name = "Exception";
        if (extra?.stack) this.stack = extra.stack;
    }
}
