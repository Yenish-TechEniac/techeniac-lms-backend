import { StatusCodes } from 'http-status-codes';

export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    status: number = StatusCodes.INTERNAL_SERVER_ERROR,
    code: string = 'INTERNAL_ERROR',
    details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(
    message: string = 'Resource not found',
    code: string = 'NOT_FOUND',
    details?: unknown,
  ) {
    super(message, StatusCodes.NOT_FOUND, code, details);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string = 'Validation failed',
    details?: unknown,
    code: string = 'VALIDATION_ERROR',
  ) {
    super(message, StatusCodes.BAD_REQUEST, code, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(
    message: string = 'Authentication required',
    code: string = 'UNAUTHENTICATED',
    details?: unknown,
  ) {
    super(message, StatusCodes.UNAUTHORIZED, code, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied', code: string = 'FORBIDDEN', details?: unknown) {
    super(message, StatusCodes.FORBIDDEN, code, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', code: string = 'CONFLICT', details?: unknown) {
    super(message, StatusCodes.CONFLICT, code, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', code: string = 'BAD_REQUEST', details?: unknown) {
    super(message, StatusCodes.BAD_REQUEST, code, details);
  }
}
