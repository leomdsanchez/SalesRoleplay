import { describe, it, expect, beforeEach } from "vitest";
import { executeTool, toolHandlers } from "../../server/voice/tools";

describe("Voice Agent Tools", () => {
  describe("search_knowledge_base", () => {
    it("should search knowledge base with query", async () => {
      const result = await toolHandlers.search_knowledge_base({
        query: "how to reset password",
      });

      expect(result).toHaveProperty("results");
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
    });

    it("should support category filtering", async () => {
      const result = await toolHandlers.search_knowledge_base({
        query: "billing issue",
        category: "billing",
      });

      expect(result).toHaveProperty("results");
    });
  });

  describe("transfer_to_human", () => {
    it("should initiate transfer to human agent", async () => {
      const result = await toolHandlers.transfer_to_human({
        reason: "Complex technical issue",
        department: "technical",
      });

      expect(result.status).toBe("transfer_initiated");
      expect(result.department).toBe("technical");
      expect(result).toHaveProperty("estimatedWaitTime");
    });

    it("should support different departments", async () => {
      const salesTransfer = await toolHandlers.transfer_to_human({
        reason: "Purchase inquiry",
        department: "sales",
      });

      const supportTransfer = await toolHandlers.transfer_to_human({
        reason: "Need help",
        department: "support",
      });

      expect(salesTransfer.department).toBe("sales");
      expect(supportTransfer.department).toBe("support");
    });
  });

  describe("get_user_info", () => {
    it("should retrieve user information", async () => {
      const result = await toolHandlers.get_user_info(
        { field: "email" },
        "user123"
      );

      expect(result).toHaveProperty("field");
      expect(result).toHaveProperty("value");
      expect(result.field).toBe("email");
    });

    it("should support different user fields", async () => {
      const fields = ["email", "plan", "usage", "billing_status"];

      for (const field of fields) {
        const result = await toolHandlers.get_user_info(
          { field },
          "user123"
        );
        expect(result.field).toBe(field);
      }
    });
  });

  describe("executeTool", () => {
    it("should execute tool by name with JSON args", async () => {
      const result = await executeTool(
        "search_knowledge_base",
        JSON.stringify({ query: "test query" })
      );

      expect(result).toHaveProperty("results");
    });

    it("should handle invalid tool name", async () => {
      await expect(
        executeTool("invalid_tool", JSON.stringify({}))
      ).rejects.toThrow("Unknown tool");
    });

    it("should handle invalid JSON args", async () => {
      await expect(
        executeTool("search_knowledge_base", "invalid json")
      ).rejects.toThrow();
    });

    it("should pass userId to tools", async () => {
      const result = await executeTool(
        "get_user_info",
        JSON.stringify({ field: "email" }),
        "user456"
      );

      expect(result).toBeDefined();
    });
  });
});
