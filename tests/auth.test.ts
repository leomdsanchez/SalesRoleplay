import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createTestApp } from "./helpers/app";
import type { Express } from "express";

describe("Auth API", () => {
  let app: Express;

  beforeEach(async () => {
    app = await createTestApp();
  });

  describe("POST /api/v1/auth/register", () => {
    it("should register a new user", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          username: "testuser",
          password: "password123",
        })
        .expect(200);

      expect(res.body).toHaveProperty("id");
      expect(res.body.username).toBe("testuser");
      expect(res.body).not.toHaveProperty("password");
    });

    it("should reject duplicate username", async () => {
      await request(app).post("/api/v1/auth/register").send({
        username: "testuser",
        password: "password123",
      });

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          username: "testuser",
          password: "different",
        })
        .expect(400);

      expect(res.body.message).toContain("already exists");
    });

    it("should reject invalid input", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          username: "test",
          // missing password
        })
        .expect(400);

      expect(res.body).toHaveProperty("message");
    });
  });

  describe("POST /api/v1/auth/login", () => {
    beforeEach(async () => {
      await request(app).post("/api/v1/auth/register").send({
        username: "testuser",
        password: "password123",
      });
    });

    it("should login with valid credentials", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          username: "testuser",
          password: "password123",
        })
        .expect(200);

      expect(res.body).toHaveProperty("id");
      expect(res.body.username).toBe("testuser");
    });

    it("should reject invalid password", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          username: "testuser",
          password: "wrongpassword",
        })
        .expect(401);

      expect(res.body.message).toContain("Invalid credentials");
    });

    it("should reject non-existent user", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          username: "nonexistent",
          password: "password123",
        })
        .expect(401);

      expect(res.body.message).toContain("Invalid credentials");
    });
  });

  describe("GET /api/v1/auth/me", () => {
    it("should return current user when authenticated", async () => {
      const agent = request.agent(app);

      // Register and login automatically creates session
      await agent.post("/api/v1/auth/register").send({
        username: "meuser",
        password: "password123",
      }).expect(200);

      const res = await agent.get("/api/v1/auth/me").expect(200);

      expect(res.body.username).toBe("meuser");
      expect(res.body).toHaveProperty("id");
    });

    it("should reject unauthenticated request", async () => {
      const res = await request(app).get("/api/v1/auth/me").expect(401);

      expect(res.body.message).toBe("Unauthorized");
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("should logout authenticated user", async () => {
      const agent = request.agent(app);

      await agent.post("/api/v1/auth/register").send({
        username: "testuser",
        password: "password123",
      });

      await agent.post("/api/v1/auth/logout").expect(200);

      // After logout, /me should fail
      await agent.get("/api/v1/auth/me").expect(401);
    });
  });
});
