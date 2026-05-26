import { DomainErrorCode } from "./domain-error/domain-error.types";

export type LogicalErrorCode =
	| "VALIDATION_ERROR"
	| "UNAUTHENTICATED"
	| "UNAUTHORIZED"
	| "NOT_FOUND"
	| "CONFLICT"
	| "INTERNAL_ERROR";

export type ErrorCode = LogicalErrorCode | DomainErrorCode;

export interface CanonicalError {
	code: ErrorCode;
	message: string;
	status: number;
	details?: any;
	correlationId?: string;
}

export type ThrownErrorCallback = () => void;
