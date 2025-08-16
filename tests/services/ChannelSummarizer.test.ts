import { test, expect, describe, jest, beforeEach, afterEach } from "bun:test";
import { ChannelSummarizer } from "../../src/services/ChannelSummarizer.ts";
import type { MessageHistoryItem } from "../../src/utils/ConversationHistory";

describe("ChannelSummarizer", () => {
  let channelSummarizer: ChannelSummarizer;
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

    // Create ChannelSummarizer instance with mock
    channelSummarizer = new ChannelSummarizer({ apiKey: "test-key" });
    // Override the client with our mock for testing
    (channelSummarizer as any).client = mockClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should generate a summary for conversation history", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: "Tech discussion about AI and machine learning"
        }
      }]
    };

    mockClient.chat.completions.create.mockResolvedValue(mockResponse);

    const messages: MessageHistoryItem[] = [
      { role: "user", content: "What is machine learning?" },
      { role: "assistant", content: "Machine learning is a type of AI that allows computers to learn from data." },
      { role: "user", content: "How does it work?" },
      { role: "assistant", content: "It works by finding patterns in data and making predictions based on those patterns." }
    ];
    
    const summary = await channelSummarizer.summarizeConversation(messages);
    
    expect(summary).toBe("tech-discussion-about-ai-and-m");
    expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
      model: "openai/gpt-5-nano",
      messages: [
        {
          role: "system",
          content: ChannelSummarizer.SYSTEM_PROMPT
        },
        {
          role: "user",
          content: "User: What is machine learning?\nAssistant: Machine learning is a type of AI that allows computers to learn from data.\nUser: How does it work?\nAssistant: It works by finding patterns in data and making predictions based on those patterns."
        }
      ],
      max_tokens: ChannelSummarizer.MAX_TOKENS
    });
  });

  test("should handle API errors gracefully", async () => {
    mockClient.chat.completions.create.mockRejectedValue(new Error("API Error"));

    const messages: MessageHistoryItem[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" }
    ];
    
    const summary = await channelSummarizer.summarizeConversation(messages);
    
    expect(summary).toBe("Chat Summary");
  });

  test("should handle empty API response", async () => {
    const mockResponse = {
      choices: [{}]
    };

    mockClient.chat.completions.create.mockResolvedValue(mockResponse);

    const messages: MessageHistoryItem[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" }
    ];
    
    const summary = await channelSummarizer.summarizeConversation(messages);
    
    expect(summary).toBe("Chat Summary");
  });
});