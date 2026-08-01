import { EApplicationError, Exception } from "@domain/core/Exception";
import { AdapterHook, AdapterRequestError } from "@generated/adapter/types";

interface AdapterExceptionMapping {
    code: EApplicationError;
    message?: string;
}

export class AdapterExceptionMiddleware implements AdapterHook {
    private static readonly statusMappings: Readonly<Partial<Record<number, AdapterExceptionMapping>>> = {
        404: {
            code: EApplicationError.NOT_FOUND,
            message: "Not Found. This might be due to an incorrect username, unranked map, etc.",
        },
    };

    public mapError(error: Error): Error {
        if (!(error instanceof AdapterRequestError)) {
            return error;
        }

        if (error.status === undefined) {
            return error;
        }

        const mapping = AdapterExceptionMiddleware.statusMappings[error.status];

        if (!mapping) {
            return error;
        }

        return new Exception(mapping.code, mapping.message ?? error.message);
    }
}
