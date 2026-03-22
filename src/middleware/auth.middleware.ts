import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET ?? "access-secret-dev";

type AuthenticatedRequest = Request & {
  user?: {
    userId: string;
  };
};

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Access token is required",
    });
  }

  const token = authorizationHeader.slice("Bearer ".length).trim();

  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as unknown as {
      userId: string;
    };
    (req as AuthenticatedRequest).user = {
      userId: decoded.userId,
    };

    return next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        message: "Access token has expired",
      });
    }

    return res.status(401).json({
      message: "Invalid access token",
    });
  }
};

export type { AuthenticatedRequest };
