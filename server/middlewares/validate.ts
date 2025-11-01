import { type Request, type Response, type NextFunction } from "express";
import { type ZodSchema } from "zod";
import { fromZodError } from "zod-validation-error";

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const error = fromZodError(result.error);
      return res.status(400).json({ message: error.message });
    }
    req.body = result.data;
    next();
  };
};
