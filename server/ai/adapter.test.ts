import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the gateway module
vi.mock("./gateway", () => ({
  runTask: vi.fn(),
}));

// Mock the LLM module
vi.mock("../_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

describe("AI Gateway Adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("invokeAI", () => {
    it("should route requests through the gateway", async () => {
      const { runTask } = await import("./gateway");
      const { invokeAI } = await import("./adapter");
      
      const mockResponse = {
        content: "Test response",
        finishReason: "stop" as const,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        model: "test-model",
        provider: "forge",
      };
      
      vi.mocked(runTask).mockResolvedValue(mockResponse);
      
      const result = await invokeAI({
        task: "CHAT_RESPONSE",
        messages: [{ role: "user", content: "Hello" }],
        userId: 1,
        orgId: 1,
      });
      
      expect(runTask).toHaveBeenCalledWith(expect.objectContaining({
        task: "CHAT_RESPONSE",
        userId: 1,
        orgId: 1,
      }));
      
      expect(result.choices[0].message.content).toBe("Test response");
      expect(result._meta?.task).toBe("CHAT_RESPONSE");
      expect(result._meta?.provider).toBe("forge");
    });

    it("should fall back to direct invokeLLM on gateway failure", async () => {
      const { runTask } = await import("./gateway");
      const { invokeLLM } = await import("../_core/llm");
      const { invokeAI } = await import("./adapter");
      
      vi.mocked(runTask).mockRejectedValue(new Error("Gateway unavailable"));
      vi.mocked(invokeLLM).mockResolvedValue({
        choices: [{ message: { role: "assistant", content: "Fallback response" }, finish_reason: "stop", index: 0 }],
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
        model: "forge-default",
      });
      
      const result = await invokeAI({
        task: "CHAT_RESPONSE",
        messages: [{ role: "user", content: "Hello" }],
      });
      
      expect(invokeLLM).toHaveBeenCalled();
      expect(result.choices[0].message.content).toBe("Fallback response");
      expect(result._meta?.provider).toBe("forge");
    });

    it("should include metadata in response", async () => {
      const { runTask } = await import("./gateway");
      const { invokeAI } = await import("./adapter");
      
      vi.mocked(runTask).mockResolvedValue({
        content: "Response",
        finishReason: "stop" as const,
        usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
        model: "gpt-4",
        provider: "openai",
        cached: true,
      });
      
      const result = await invokeAI({
        task: "DOC_EXTRACT_FIELDS",
        messages: [{ role: "user", content: "Extract fields" }],
      });
      
      expect(result._meta).toBeDefined();
      expect(result._meta?.task).toBe("DOC_EXTRACT_FIELDS");
      expect(result._meta?.model).toBe("gpt-4");
      expect(result._meta?.tokensUsed).toBe(300);
      expect(result._meta?.cached).toBe(true);
    });
  });

  describe("classifyDocument", () => {
    it("should classify document type", async () => {
      const { runTask } = await import("./gateway");
      const { classifyDocument } = await import("./adapter");
      
      vi.mocked(runTask).mockResolvedValue({
        content: JSON.stringify({ type: "invoice", confidence: 0.95 }),
        finishReason: "stop" as const,
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
        model: "test-model",
        provider: "forge",
      });
      
      const result = await classifyDocument("Invoice #12345\nTotal: $500");
      
      expect(result.type).toBe("invoice");
      expect(result.confidence).toBe(0.95);
    });

    it("should return unknown on parse error", async () => {
      const { runTask } = await import("./gateway");
      const { classifyDocument } = await import("./adapter");
      
      vi.mocked(runTask).mockResolvedValue({
        content: "invalid json",
        finishReason: "stop" as const,
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
        model: "test-model",
        provider: "forge",
      });
      
      const result = await classifyDocument("Some content");
      
      expect(result.type).toBe("unknown");
      expect(result.confidence).toBe(0);
    });
  });

  describe("extractFields", () => {
    it("should extract fields with evidence", async () => {
      const { runTask } = await import("./gateway");
      const { extractFields } = await import("./adapter");
      
      vi.mocked(runTask).mockResolvedValue({
        content: JSON.stringify({
          fields: { name: "John Doe", amount: 500 },
          evidence: [
            { field: "name", source: "Customer: John Doe", location: "line 3" },
            { field: "amount", source: "Total: $500", location: "line 10" },
          ],
        }),
        finishReason: "stop" as const,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: "test-model",
        provider: "forge",
      });
      
      const result = await extractFields(
        "Invoice content...",
        {
          name: { type: "string", description: "Customer name" },
          amount: { type: "number", description: "Total amount" },
        }
      );
      
      expect(result.fields.name).toBe("John Doe");
      expect(result.fields.amount).toBe(500);
      expect(result.evidence).toHaveLength(2);
      expect(result.evidence[0].field).toBe("name");
    });
  });

  describe("draftRFIResponse", () => {
    it("should draft response with sources", async () => {
      const { runTask } = await import("./gateway");
      const { draftRFIResponse } = await import("./adapter");
      
      vi.mocked(runTask).mockResolvedValue({
        content: JSON.stringify({
          response: "Based on the provided documents, the project capacity is 50MW.",
          sources: ["Technical Spec v2.1", "Project Summary"],
        }),
        finishReason: "stop" as const,
        usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
        model: "test-model",
        provider: "forge",
      });
      
      const result = await draftRFIResponse(
        "What is the project capacity?",
        "Project capacity: 50MW as per technical specifications..."
      );
      
      expect(result.response).toContain("50MW");
      expect(result.sources).toContain("Technical Spec v2.1");
    });
  });

  describe("classifyIntent", () => {
    it("should classify user intent", async () => {
      const { runTask } = await import("./gateway");
      const { classifyIntent } = await import("./adapter");
      
      vi.mocked(runTask).mockResolvedValue({
        content: JSON.stringify({
          intent: "query_asset",
          confidence: 0.92,
          entities: { asset_id: "AST-001" },
        }),
        finishReason: "stop" as const,
        usage: { promptTokens: 30, completionTokens: 20, totalTokens: 50 },
        model: "test-model",
        provider: "forge",
      });
      
      const result = await classifyIntent("Show me details for asset AST-001");
      
      expect(result.intent).toBe("query_asset");
      expect(result.confidence).toBe(0.92);
      expect(result.entities.asset_id).toBe("AST-001");
    });
  });
});
