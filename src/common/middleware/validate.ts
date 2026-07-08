import { NextFunction, Request, Response } from 'express';
import { AnyZodObject } from 'zod';

/**
 * Validates req.body/query/params against a schema shaped like { body?, query?, params? }.
 * Writes every parsed section back onto req - not just body - so that
 * z.coerce.*() transforms (e.g. turning ?page=2 into a real number) actually
 * take effect. Only overwriting req.body was a latent bug: it silently
 * worked for every route so far because none of them coerced query/params,
 * but the admin module's pagination (`page`/`pageSize` as z.coerce.number())
 * was the first to depend on it.
 */
export function validate(schema: AnyZodObject) {
  return function validateMiddleware(req: Request, _res: Response, next: NextFunction) {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (parsed.body) req.body = parsed.body;
      if (parsed.query) req.query = parsed.query;
      if (parsed.params) req.params = parsed.params;
      next();
    } catch (err) {
      next(err); // ZodError is handled by the centralized errorHandler
    }
  };
}