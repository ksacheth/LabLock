// The Express/Prisma adapter over the pure `authorize` decision: load the actor,
// ask the decision, and on denial send the response and return null. On allow it
// returns the loaded actor (handlers need actor.id). The resource is still loaded
// by the handler, so nested-resource existence stays a handler precondition.
// See docs/adr/0003-authorization-decision-seam.md.
import type { Request, Response } from "express";
import prisma from "@repo/database";
import { authorize, type Action, type Actor, type Resource } from "./authorize.ts";

async function authorizeRequest(
  req: Request,
  res: Response,
  action: Action,
  resource?: Resource,
): Promise<Actor> {
  const actor = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { id: true, role: true, facultyApproved: true },
  });

  const decision = authorize(actor, action, resource);
  if (!decision.ok) {
    res.status(decision.status).json({
      error: decision.error,
      ...(decision.code ? { code: decision.code } : {}),
    });
    return null;
  }

  return actor;
}

export { authorizeRequest };
