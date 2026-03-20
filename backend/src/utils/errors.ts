export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') { super(message, 404, 'NOT_FOUND'); }
}
export class ValidationError extends AppError {
  constructor(message = 'Validation failed') { super(message, 400, 'VALIDATION_ERROR'); }
}
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') { super(message, 401, 'AUTH_FAILED'); }
}
export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') { super(message, 403, 'FORBIDDEN'); }
}
export class ConflictError extends AppError {
  constructor(message = 'Conflict') { super(message, 409, 'CONFLICT'); }
}
export class InsufficientBalanceError extends AppError {
  constructor(message = 'Insufficient balance') { super(message, 400, 'INSUFFICIENT_BALANCE'); }
}
export class PlayerOfflineError extends AppError {
  constructor(message = 'Player is not online') { super(message, 400, 'PLAYER_OFFLINE'); }
}
export class RconError extends AppError {
  constructor(message = 'RCON command failed') { super(message, 502, 'RCON_ERROR'); }
}
