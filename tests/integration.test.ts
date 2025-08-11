import { test, expect, beforeEach, afterEach } from "bun:test";
import { DiscordBot } from "../src/bot/DiscordBot";

// Mock AIService for testing
const mockAIService = {
  generateResponse: async (messages: any[], personality?: string | null) => {
    const lastMessage = messages[messages.length - 1];
    const userText = lastMessage?.content || "";
    
    if (personality) {
      return `Mock response with personality: ${personality}`;
    }
    
    return `Mock response to: ${userText}`;
  },
  processImage: async (imageURL: string, messages: any[], personality?: string | null) => {
    return "Mock image processing response";
  }
};

// Mock Guild for testing
const mockGuild = {
  channels: {
    cache: {
      filter: () => new Map(),
      values: () => []
    }
  }
};

let bot: DiscordBot;

beforeEach(() => {
  // Use an in-memory database for testing with mock AIService
  bot = new DiscordBot(":memory:", mockAIService);
});

afterEach(async () => {
  if (bot) {
    await bot.shutdown();
  }
});

test("integration: full conversation flow", async () => {
  const userId = "test-user";
  const personality = "You are a helpful assistant who speaks like a pirate";
  const message = "Hello there!";
  
  // 1. Set personality
  const personalityResponse = await bot.handlePersonalityCommand(userId, personality);
  expect(personalityResponse).toBe("Personality updated!");
  
  // 2. Send message
  const messageResponse = await bot.handleMessage(userId, message);
  expect(messageResponse).toBe(`Mock response with personality: ${personality}`);
  
  // 3. Cleanup (should not throw)
  await expect(bot.cleanupInactiveChannels(mockGuild as any)).resolves.toBeUndefined();
});