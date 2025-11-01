import { Router } from "express";
import passport from "passport";
import { storage } from "../storage";
import { validate } from "../middlewares/validate";
import { insertUserSchema } from "@shared/schema";
import { requireAuth } from "../config/auth";

const router = Router();

// Register
router.post("/register", validate(insertUserSchema), async (req, res, next) => {
  try {
    const { username } = req.body;
    
    const existing = await storage.getUserByUsername(username);
    if (existing) {
      return res.status(400).json({ message: "Username already exists" });
    }

    const user = await storage.createUser(req.body);
    
    // Auto-login after registration
    req.login(user, (err) => {
      if (err) return next(err);
      console.log(`User ${user.username} registered and logged in, session ID: ${req.sessionID}`);
      res.json({ 
        id: user.id, 
        username: user.username 
      });
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post("/login", validate(insertUserSchema), (req, res, next) => {
  passport.authenticate("local", (err: any, user: any, info: any) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({ message: info?.message || "Invalid credentials" });
    }
    
    req.login(user, (err) => {
      if (err) return next(err);
      console.log(`User ${user.username} logged in, session ID: ${req.sessionID}`);
      res.json({ 
        id: user.id, 
        username: user.username 
      });
    });
  })(req, res, next);
});

// Logout
router.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: "Logout failed" });
    }
    res.json({ message: "Logged out" });
  });
});

// Get current user
router.get("/me", requireAuth, (req, res) => {
  const user = req.user as any;
  res.json({ 
    id: user.id, 
    username: user.username 
  });
});

export default router;
