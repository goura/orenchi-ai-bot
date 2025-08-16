import { test, expect, describe, jest, beforeEach, afterEach } from "bun:test";
import { WebSearchService } from "../../src/services/WebSearchService";
import OpenAI from "openai";

describe("WebSearchService", () => {
  let webSearchService: WebSearchService;
  let mockClient: any;

  beforeEach(() => {
    // Create a mock OpenAI client
    mockClient = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };

    // Create WebSearchService instance with mock
    webSearchService = new WebSearchService({ apiKey: "test-key" });
    // Override the client with our mock for testing
    (webSearchService as any).client = mockClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should return 'sonar' decision with query", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            decision: "SONAR",
            query: "latest news about AI"
          })
        }
      }]
    };

    mockClient.chat.completions.create.mockResolvedValue(mockResponse);

    const messages = [
      { role: "user", content: "What's the latest news about AI?" }
    ];
    
    const result = await webSearchService.shouldSearch(messages);
    
    expect(result).toEqual({
      type: "sonar",
      query: "latest news about AI"
    });
  });

  test("should return 'search' decision with query", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            decision: "SEARCH",
            query: "how to fix a leaky faucet"
          })
        }
      }]
    };

    mockClient.chat.completions.create.mockResolvedValue(mockResponse);

    const messages = [
      { role: "user", content: "How do I fix a leaky faucet?" }
    ];
    
    const result = await webSearchService.shouldSearch(messages);
    
    expect(result).toEqual({
      type: "search",
      query: "how to fix a leaky faucet"
    });
  });

  test("should return 'none' decision for general conversation", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            decision: "NONE",
            query: null
          })
        }
      }]
    };

    mockClient.chat.completions.create.mockResolvedValue(mockResponse);

    const messages = [
      { role: "user", content: "Hello, how are you?" }
    ];
    
    const result = await webSearchService.shouldSearch(messages);
    
    expect(result).toEqual({ type: "none" });
  });

  test("should fallback to 'none' when API returns empty content", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: null
        }
      }]
    };

    mockClient.chat.completions.create.mockResolvedValue(mockResponse);

    const messages = [
      { role: "user", content: "What's the weather like?" }
    ];
    
    const result = await webSearchService.shouldSearch(messages);
    
    expect(result).toEqual({ type: "none" });
  });

  test("should fallback to 'none' when API returns invalid JSON", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: "invalid json"
        }
      }]
    };

    mockClient.chat.completions.create.mockResolvedValue(mockResponse);

    const messages = [
      { role: "user", content: "What's the weather like?" }
    ];
    
    const result = await webSearchService.shouldSearch(messages);
    
    expect(result).toEqual({ type: "none" });
  });

  test("should fallback to 'none' when API throws an error", async () => {
    mockClient.chat.completions.create.mockRejectedValue(new Error("API Error"));

    const messages = [
      { role: "user", content: "What's the weather like?" }
    ];
    
    const result = await webSearchService.shouldSearch(messages);
    
    expect(result).toEqual({ type: "none" });
  });

  test("should handle multiple messages in conversation", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            decision: "SEARCH",
            query: "quantum computing applications"
          })
        }
      }]
    };

    mockClient.chat.completions.create.mockResolvedValue(mockResponse);

    const messages = [
      { role: "user", content: "I'm interested in quantum computing" },
      { role: "assistant", content: "Quantum computing is a fascinating field" },
      { role: "user", content: "What are some real-world applications?" }
    ];
    
    const result = await webSearchService.shouldSearch(messages);
    
    expect(result).toEqual({
      type: "search",
      query: "quantum computing applications"
    });
  });
});