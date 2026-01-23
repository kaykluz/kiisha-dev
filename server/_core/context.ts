import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { COOKIE_NAME } from "@shared/const";
import * as sessionManager from "../services/sessionManager";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // Get session ID from cookie
    const sessionId = opts.req.cookies?.[COOKIE_NAME];
    if (sessionId) {
      // Validate session using database-based session manager
      const validation = await sessionManager.validateSession(sessionId);
      if (validation.valid && validation.session) {
        // Get user from database
        user = await db.getUserById(validation.session.userId);
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    console.error("[Context] Error validating session:", error);
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
