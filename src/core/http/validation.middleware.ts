import type { NextFunction, Request, Response } from 'express';
import type { AnyZodObject, ZodError } from 'zod';

import { ValidationError } from '../errors';

export function validate(schema: AnyZodObject) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = (await schema.parseAsync({
        body: req.body as unknown,
        query: req.query as unknown,
        params: req.params as unknown,
      })) as { body?: unknown };

      if (parsed.body !== undefined) {
        req.body = parsed.body;
      }
      next();
    } catch (error) {
      const zodError = error as ZodError;
      if (zodError.errors) {
        const fieldErrors = zodError.errors.map((err) => ({
          field: err.path.slice(1).join('.') || err.path.join('.'),
          message: err.message,
        }));
        next(new ValidationError('Validation failed', fieldErrors));
        return;
      }
      next(error);
    }
  };
}
