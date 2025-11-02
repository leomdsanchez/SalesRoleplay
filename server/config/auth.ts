import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import { db } from "../db/sqlite";
import { sessions, schema } from "@shared/schema";
import { eq, lt } from "drizzle-orm";
import { storage } from "../storage";
import bcrypt from "bcrypt";
import { type User } from "@shared/schema";

// Custom Drizzle Session Store
class DrizzleSessionStore extends session.Store {
  constructor() {
    super();
  }

  get(sid: string, callback: (err: any, session?: any) => void): void {
    try {
      const rows = db.select().from(sessions).where(eq(sessions.sid, sid)).all();
      if (rows.length > 0) {
        const sessionData = JSON.parse(rows[0].sess);
        callback(null, sessionData);
      } else {
        callback(null, null);
      }
    } catch (error) {
      callback(error);
    }
  }

  set(sid: string, session: any, callback?: (err?: any) => void): void {
    try {
      const expire = Date.now() + (session.cookie?.maxAge || 86400000); // 24h default
      db.insert(sessions)
        .values({
          sid,
          sess: JSON.stringify(session),
          expire,
        })
        .onConflictDoUpdate({
          target: sessions.sid,
          set: {
            sess: JSON.stringify(session),
            expire,
          },
        })
        .run();
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  destroy(sid: string, callback?: (err?: any) => void): void {
    try {
      db.delete(sessions).where(eq(sessions.sid, sid)).run();
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  all(callback: (err: any, obj?: { [sid: string]: any } | null) => void): void {
    // Not implemented - not needed for basic functionality
    callback(null, {});
  }

  length(callback: (err: any, length?: number) => void): void {
    // Not implemented
    callback(null, 0);
  }

  clear(callback?: (err?: any) => void): void {
    try {
      db.delete(sessions).run();
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  touch(sid: string, session: any, callback?: (err?: any) => void): void {
    // Update expire time
    this.set(sid, session, callback);
  }
}

// Cleanup expired sessions periodically
setInterval(() => {
  try {
    db.delete(sessions).where(lt(sessions.expire, Date.now())).run();
  } catch (error) {
    console.error("[Auth] Session cleanup error:", error);
  }
}, 15 * 60 * 1000); // Every 15 minutes

export function setupAuth(app: Express) {
  // Session config with custom Drizzle store
  app.use(
    session({
      store: new DrizzleSessionStore(),
      secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        sameSite: "lax",
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // Passport local strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Invalid credentials" });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
          return done(null, false, { message: "Invalid credentials" });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, (user as User).id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        // User no longer exists, invalidate session
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      console.error("[Auth] Deserialize error:", error);
      done(null, false); // Don't fail, just invalidate session
    }
  });
}

export function requireAuth(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}
