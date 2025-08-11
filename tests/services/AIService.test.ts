import { test, expect, describe, jest, beforeEach, afterEach } from "bun:test";
import { AIService } from "../../src/services/AIService";
import OpenAI from "openai";

describe("AIService", () => {
  let aiService: AIService;
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

    // Create AIService instance with mock
    aiService = new AIService({ apiKey: "test-key" });
    // Override the client with our mock for testing
    (aiService as any).client = mockClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should select appropriate model based on message length", () => {
    // Test short message
    const shortMessage = "Hello";
    const shortModel = (aiService as any).selectModel(shortMessage);
    expect(shortModel).toBe("openai/gpt-5-chat:online");
    
    // Test medium message with 100+ words
    const mediumMessage = "word ".repeat(150); // 150 words
    const mediumModel = (aiService as any).selectModel(mediumMessage);
    expect(mediumModel).toBe("openrouter/auto:online");
    
    // Test long message with 500+ words
    const longMessage = "word ".repeat(600); // 600 words
    const longModel = (aiService as any).selectModel(longMessage);
    expect(longModel).toBe("openai/gpt-5:online");
  });
  
  test("should process image", async () => {
    const imageRecognitionModel = "openrouter/gemini-2.5-flash:online";
    const mockResponse = {
      choices: [{
        message: {
          content: "Mock AI response for image processing"
        }
      }],
      model: imageRecognitionModel
    };

    mockClient.chat.completions.create.mockResolvedValue(mockResponse);

    const messages = [{ role: "user" as const, content: "Hello" }];
    const response = await aiService.processImage("http://example.com/image.jpg", messages);
    expect(response).toBe("Mock AI response for image processing");
    
    // Verify the correct model was used
    expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
      model: imageRecognitionModel,
      messages: [
        { role: "user" as const, content: "Hello" },
        {
          role: "user" as const,
          content: [
            {
              type: "image_url",
              image_url: {
                url: "http://example.com/image.jpg"
              }
            },
            {
              type: "text",
              text: "What do you see in this image?"
            }
          ]
        }
      ],
      temperature: 0.7,
      max_tokens: (aiService as any).getMaxTokens()
    });
  });

  test("should handle image processing errors gracefully", async () => {
    mockClient.chat.completions.create.mockRejectedValue(new Error("API Error"));

    const messages = [{ role: "user" as const, content: "Hello" }];
    const response = await aiService.processImage("http://example.com/image.jpg", messages);
    expect(response).toBe("Sorry, I encountered an error while processing your image.");
  });

  test("should generate response with personality", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: "Mock AI response with personality"
        }
      }]
    };

    mockClient.chat.completions.create.mockResolvedValue(mockResponse);

    const messages = [{ role: "user" as const, content: "Hello" }];
    const personality = "You are a helpful assistant";
    
    const response = await aiService.generateResponse(messages, personality);
    
    expect(response).toBe("Mock AI response with personality");
    expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
      model: "openai/gpt-5-chat:online",
      messages: [
        { role: "system" as const, content: personality },
        { role: "user" as const, content: "Hello" }
      ],
      temperature: 0.7,
      max_tokens: (aiService as any).getMaxTokens()
    });
  });

  test("should generate response without personality", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: "Mock AI response"
        }
      }]
    };

    mockClient.chat.completions.create.mockResolvedValue(mockResponse);

    const messages = [{ role: "user" as const, content: "Hello" }];
    
    const response = await aiService.generateResponse(messages);
    
    expect(response).toBe("Mock AI response");
    expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
      model: "openai/gpt-5-chat:online",
      messages: [
        { role: "user" as const, content: "Hello" }
      ],
      temperature: 0.7,
      max_tokens: (aiService as any).getMaxTokens()
    });
  });

  test("should handle API errors gracefully", async () => {
    mockClient.chat.completions.create.mockRejectedValue(new Error("API Error"));

    const messages = [{ role: "user" as const, content: "Hello" }];
    
    const response = await aiService.generateResponse(messages);
    
    expect(response).toBe("Sorry, I encountered an error while processing your request.");
  });

  test("should handle empty API response", async () => {
    const mockResponse = {
      choices: [{}]
    };

    mockClient.chat.completions.create.mockResolvedValue(mockResponse);

    const messages = [{ role: "user" as const, content: "Hello" }];
    
    const response = await aiService.generateResponse(messages);
    
    expect(response).toBe("I'm not sure how to respond to that.");
  });

  test("should select different models based on message length", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: "Mock response"
        }
      }]
    };

    mockClient.chat.completions.create.mockResolvedValue(mockResponse);

    // Test with short message
    const shortMessages = [{ role: "user" as const, content: "Short message" }];
    await aiService.generateResponse(shortMessages);
    expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "openai/gpt-5-chat:online"
      })
    );

    // Reset mock
    mockClient.chat.completions.create.mockClear();

    // Test with medium message
    const mediumMessages = [{ role: "user" as const, content: "word ".repeat(150) }];
    await aiService.generateResponse(mediumMessages);
    expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "openrouter/auto:online"
      })
    );

    // Reset mock
    mockClient.chat.completions.create.mockClear();

    // Test with long message
    const longMessages = [{ role: "user" as const, content: "word ".repeat(600) }];
    await aiService.generateResponse(longMessages);
    expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "openai/gpt-5:online"
      })
    );
  });
});