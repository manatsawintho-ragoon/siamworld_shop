export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) { super(400, message, 'VALIDATION_ERROR'); }
}

export class AuthError extends AppError {
  constructor(message = 'Unauthorized', code = 'AUTH_FAILED') { super(401, message, code); }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') { super(403, message, 'FORBIDDEN'); }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') { super(404, message, 'NOT_FOUND'); }
}

export class ConflictError extends AppError {
  constructor(message: string) { super(409, message, 'CONFLICT'); }
}

export class SessionKickedError extends AppError {
  constructor(message = 'เซสชันถูกยกเลิก: มีการเข้าสู่ระบบจากอุปกรณ์อื่น') {
    super(401, message, 'SESSION_KICKED');
  }
}

export class SessionExpiredError extends AppError {
  constructor(message = 'เซสชันหมดอายุเนื่องจากไม่มีการใช้งาน กรุณาเข้าสู่ระบบใหม่') {
    super(401, message, 'SESSION_EXPIRED');
  }
}
