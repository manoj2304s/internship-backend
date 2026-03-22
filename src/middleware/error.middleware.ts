import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import AppError from "../utils/app-error";

export const notFoundHandler = (
  _req: Request,
  _res: Response,
  next: NextFunction,
) => {
  next(new AppError("Route not found", 404));
};

export const errorHandler = (
  error: Error | AppError | ZodError,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      errors: error.flatten(),
    });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      message: error.message,
      details: error.details,
    });
  }

  console.error(error);
  return res.status(500).json({
    message: "Internal server error",
  });
};
