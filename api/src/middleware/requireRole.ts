import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";

/**
 * Looks up the caller's membership in the business named by req.params.businessId
 * and rejects unless their role is in `allowedRoles`. Must run after requireAuth.
 */
export function requireRole(...allowedRoles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const businessId = req.params.businessId;
    if (!req.userId || !businessId) {
      return res.status(400).json({ error: { code: "bad_request", message: "Missing businessId or auth context" } });
    }

    const membership = await prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId: req.userId } },
    });

    if (!membership || !membership.joinedAt) {
      return res.status(403).json({ error: { code: "forbidden", message: "Not a member of this business" } });
    }

    if (!allowedRoles.includes(membership.role)) {
      return res.status(403).json({ error: { code: "forbidden", message: "Insufficient role" } });
    }

    next();
  };
}
