import { throwError } from "rxjs";
export class ErrorHandlingEnabledBaseType {
    handleError(operation) {
        return (error) =>
            throwError(() =>
                Object.assign(
                    new Error(
                        `${operation}: ${error.status === 404 ? "Resource not found" : error.error?.detail || error.error?.message || error.message || error.status || "Unexpected error"}`,
                    ),
                    { status: error.status, error: error.error },
                ),
            );
    }
}
