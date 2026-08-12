import { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "../lib/jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: { code: "unauthorized", message: "Missing bearer token" } });
  }

  try {
    const payload = verifyAuthToken(header.slice("Bearer ".length));
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: { code: "unauthorized", message: "Invalid or expired token" } });
  }
}
