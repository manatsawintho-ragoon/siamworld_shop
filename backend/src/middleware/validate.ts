import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }));
      // Build a human-readable Thai summary so even clients that only read `message`
      // (or older builds) show *which* field is wrong, not just "Validation failed".
      const message = errors
        .map((e) => (e.field ? `${e.field}: ${e.message}` : e.message))
        .join(' • ');
      res.status(400).json({ success: false, error: 'Validation failed', message, errors });
      return;
    }
    req.body = result.data;
    next();
  };
}
