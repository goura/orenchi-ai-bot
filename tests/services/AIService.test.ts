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
    // Mock the webSearchService
    (aiService as any).webSearchService = {
      shouldSearch: jest.fn().mockResolvedValue({ type: "none" })
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should process image", async () => {
    const imageRecognitionModel = "openrouter/gemini-2.5-flash";
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
      model: "openai/gpt-4o",
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
      model: "openai/gpt-4o",
      messages: [
        { role: "user" as const, content: "Hello" }
      ],
      temperature: 0.7,
      max_tokens: (aiService as any).getMaxTokens()
    });
  });

  test("should handle API errors gracefully", async () => {
    // Mock webSearchService to return none
    (aiService as any).webSearchService.shouldSearch.mockResolvedValue({ type: "none" });
    
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

  test("should use perplexity/sonar-pro model when webSearchService returns sonar-pro", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: "Mock AI response with sonar-pro"
        }
      }]
    };

    mockClient.chat.completions.create.mockResolvedValue(mockResponse);
    // Mock webSearchService to return sonar-pro
    (aiService as any).webSearchService.shouldSearch.mockResolvedValue({ type: "sonar-pro", query: "deep analysis" });

    const messages = [{ role: "user" as const, content: "Hello" }];
    
    const response = await aiService.generateResponse(messages, null, true);
    
    expect(response).toBe("Mock AI response with sonar-pro");
    expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
      model: "perplexity/sonar-pro",
      messages: [
        { role: "user" as const, content: "Hello" }
      ],
      temperature: 0.7,
      max_tokens: (aiService as any).getMaxTokens()
    });
  });

  test("should add web_search_options for gpt-4o-search-preview model", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: "Mock AI response with web search"
        }
      }]
    };

    mockClient.chat.completions.create.mockResolvedValue(mockResponse);

    // Call the private method directly using type assertion
    const response = await (aiService as any).createChatCompletion({
      model: "gpt-4o-search-preview",
      messages: [{ role: "user" as const, content: "Hello" }],
      temperature: 0.7,
      max_tokens: (aiService as any).getMaxTokens()
    });

    expect(response).toBe(mockResponse);
    expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
      model: "gpt-4o-search-preview",
      messages: [{ role: "user" as const, content: "Hello" }],
      temperature: 0.7,
      max_tokens: (aiService as any).getMaxTokens(),
      web_search_options: {}
    });
  });

  test("should add web_search_options for gpt-4o-mini-search-preview model", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: "Mock AI response with web search"
        }
      }]
    };

    mockClient.chat.completions.create.mockResolvedValue(mockResponse);

    // Call the private method directly using type assertion
    const response = await (aiService as any).createChatCompletion({
      model: "gpt-4o-mini-search-preview",
      messages: [{ role: "user" as const, content: "Hello" }],
      temperature: 0.7,
      max_tokens: (aiService as any).getMaxTokens()
    });

    expect(response).toBe(mockResponse);
    expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
      model: "gpt-4o-mini-search-preview",
      messages: [{ role: "user" as const, content: "Hello" }],
      temperature: 0.7,
      max_tokens: (aiService as any).getMaxTokens(),
      web_search_options: {}
    });
  });

  test("should not add web_search_options for gpt-4o model", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: "Mock AI response without web search"
        }
      }]
    };

    mockClient.chat.completions.create.mockResolvedValue(mockResponse);

    // Call the private method directly using type assertion
    const response = await (aiService as any).createChatCompletion({
      model: "gpt-4o",
      messages: [{ role: "user" as const, content: "Hello" }],
      temperature: 0.7,
      max_tokens: (aiService as any).getMaxTokens()
    });

    expect(response).toBe(mockResponse);
    expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
      model: "gpt-4o",
      messages: [{ role: "user" as const, content: "Hello" }],
      temperature: 0.7,
      max_tokens: (aiService as any).getMaxTokens()
    });
    // Verify web_search_options was not added
    const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty('web_search_options');
  });

  test("should process citations from Perplexity Sonar response", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: "Here are some recent AI developments."
        }
      }],
      search_results: [
        {
          title: "Latest AI Breakthroughs and News: May, June, July 2025",
          url: "https://www.crescendo.ai/news/latest-ai-news-and-updates"
        },
        {
          title: "AI Magazine: Home of AI and Artificial Intelligence News",
          url: "https://aimagazine.com"
        }
      ]
    };

    mockClient.chat.completions.create.mockResolvedValue(mockResponse);
    // Mock webSearchService to return sonar
    (aiService as any).webSearchService.shouldSearch.mockResolvedValue({ type: "sonar", query: "latest AI news" });

    const messages = [{ role: "user" as const, content: "What's new in AI?" }];
    
    const response = await aiService.generateResponse(messages, null, true);
    
    expect(response).toBe("Here are some recent AI developments.\n\n[1] [Latest AI Breakthroughs and News: May, June, July 2025](https://www.crescendo.ai/news/latest-ai-news-and-updates)\n[2] [AI Magazine: Home of AI and Artificial Intelligence News](https://aimagazine.com)");
  });

  test("should handle Perplexity Sonar response without citations", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: "Here's a general response without citations."
        }
      }]
      // No search_results property
    };

    mockClient.chat.completions.create.mockResolvedValue(mockResponse);

    const messages = [{ role: "user" as const, content: "Hello" }];
    
    const response = await aiService.generateResponse(messages);
    
    
    expect(response).toBe("Here's a general response without citations.");
  });

  test("should not process citations for non-Sonar models", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: "Here's a response from a non-Sonar model."
        }
      }],
      search_results: [
        {
          title: "Some Article",
          url: "https://example.com"
        }
      ],
      model: "gpt-4o"
    };

    mockClient.chat.completions.create.mockResolvedValue(mockResponse);
    // Mock webSearchService to return none so we use the default model
    (aiService as any).webSearchService.shouldSearch.mockResolvedValue({ type: "none" });

    const messages = [{ role: "user" as const, content: "Hello" }];
    
    const response = await aiService.generateResponse(messages, null, true);
    
    // Should not include citations since we're not using a Sonar model
    expect(response).toBe("Here's a response from a non-Sonar model.");
  });
  test("should not add web_search_options for gpt-4o:online model", async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: "Mock AI response without web search"
        }
      }]
    };

    mockClient.chat.completions.create.mockResolvedValue(mockResponse);

    // Call the private method directly using type assertion
    const response = await (aiService as any).createChatCompletion({
      model: "gpt-4o:online",
      messages: [{ role: "user" as const, content: "Hello" }],
      temperature: 0.7,
      max_tokens: (aiService as any).getMaxTokens()
    });

    expect(response).toBe(mockResponse);
    expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
      model: "gpt-4o:online",
      messages: [{ role: "user" as const, content: "Hello" }],
      temperature: 0.7,
      max_tokens: (aiService as any).getMaxTokens()
    });
    // Verify web_search_options was not added
    const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty('web_search_options');
  });
});