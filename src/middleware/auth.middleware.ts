import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import AppError from "../utils/app-error";
import { UserRole } from "../types/auth.types";

type AuthenticatedRequest = Request & {
  user?: {
    userId: string;
    role: UserRole;
  };
};

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader?.startsWith("Bearer ")) {
    return next(new AppError("Access token is required", 401));
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as unknown as {
      userId: string;
      role: UserRole;
    };

    (req as AuthenticatedRequest).user = {
      userId: decoded.userId,
      role: decoded.role,
    };

    return next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError("Access token has expired", 401));
    }

    return next(new AppError("Invalid access token", 401));
  }
};

export const authorize =
  (...allowedRoles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const currentRole = (req as AuthenticatedRequest).user?.role;

    if (!currentRole) {
      return next(new AppError("Unauthorized", 401));
    }

    if (!allowedRoles.includes(currentRole)) {
      return next(new AppError("Forbidden: insufficient permissions", 403));
    }

    return next();
  };

export type { AuthenticatedRequest };
