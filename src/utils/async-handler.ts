import { NextFunction, Request, Response } from "express";

const asyncHandler =
  (
    handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
  ) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(handler(req, res, next)).catch(next);

export default asyncHandler;
