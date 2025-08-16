import { test, expect, jest } from "bun:test";
import { DiscordBot } from "../../src/bot/DiscordBot";

// Mock Discord.js classes for testing
const createMockTextChannel = (name: string, ageInMs: number = 0) => ({
  name,
  id: `channel-${name}`,
  type: 0, // GuildText
  createdAt: new Date(Date.now() - ageInMs),
  send: () => Promise.resolve(),
  sendTyping: () => Promise.resolve(),
  messages: {
    fetch: () => Promise.resolve({
      first: () => null,
      map: (fn: any) => [],
      reverse: () => [],
      values: () => [],
      filter: (fn: any) => ({
        map: (fn: any) => [],
        reverse: () => [],
        size: 0
      }),
      size: 0
    })
  },
  delete: () => Promise.resolve(),
  edit: () => Promise.resolve(),
  setName: function(newName: string) {
    this.name = newName;
    return Promise.resolve(this);
  },
  toString: function() {
    return `<#${this.id}>`;
  }
});

const createMockGuild = () => {
  const channels = new Map();
  
  // Add a find method to the cache
  const cacheWithFind = {
    ...channels,
    find: (predicate: (channel: any) => boolean) => {
      for (const [key, value] of channels) {
        if (predicate(value)) {
          return value;
        }
      }
      return undefined;
    }
  };
  
  return {
    roles: {
      everyone: {
        id: "everyone-id"
      }
    },
    channels: {
      cache: cacheWithFind,
      create: (options: any) => {
        const channel = createMockTextChannel(options.name);
        channels.set(options.name, channel);
        return Promise.resolve(channel);
      }
    },
    client: {
      user: {
        id: "bot-id"
      }
    }
  };
};

const createMockUser = (username: string = "testuser") => ({
  id: "user-id",
  username,
  tag: username + "#1234",
  toString: () => `<@${username}>`
});

// Mock AIService for testing
const createMockAIService = () => ({
  generateResponse: jest.fn().mockResolvedValue("Mock AI response"),
  processImage: jest.fn().mockResolvedValue("Mock image response")
});

test("should rename channel after 6 messages (2nd in sequence 2,6,10,14)", async () => {
  // Set up environment variables
  process.env.OPENROUTER_API_KEY = "test-key";
  
  // Create bot with mock AI service
  const mockAIService = createMockAIService();
  const bot = new DiscordBot(undefined, mockAIService);
  
  // Set up mock client
  const mockClient = {
    user: {
      id: "bot-id"
    }
  };
  bot.setClient(mockClient as any);
  
  // Create a private chat channel
  const guild = createMockGuild();
  const user = createMockUser();
  const channel = createMockTextChannel("ai-chat-1234567890-testuser-abcd");
  
  // Mock the channel manager's renameChannelWithSummary method
  const mockRenameChannelWithSummary = jest.fn().mockResolvedValue("ai-chat-1234567890-ai-discussion-efgh");
  (bot as any).channelManager.renameChannelWithSummary = mockRenameChannelWithSummary;
  
  // Mock channel messages to simulate 6 messages
  const mockMessages = {
    first: () => null,
    map: (fn: any) => [],
    reverse: () => [],
    values: () => [],
    filter: (fn: any) => ({
      map: (fn: any) => [],
      reverse: () => [],
      size: 6 // 6 messages (next in sequence 2, 6, 10, 14)
    }),
    size: 6
  };
  
  channel.messages.fetch = () => Promise.resolve(mockMessages as any);
  
  // Handle 6 messages
  for (let i = 0; i < 6; i++) {
    await bot.handleMessage("user-id", `Message ${i}`, channel as any);
  }
  
  // Check that renameChannelWithSummary was called
  expect(mockRenameChannelWithSummary).toHaveBeenCalledWith(channel, (bot as any).channelSummarizer);
});

test("should not rename channel if already renamed", async () => {
  // Set up environment variables
  process.env.OPENROUTER_API_KEY = "test-key";
  
  // Create bot with mock AI service
  const mockAIService = createMockAIService();
  const bot = new DiscordBot(undefined, mockAIService);
  
  // Set up mock client
  const mockClient = {
    user: {
      id: "bot-id"
    }
  };
  bot.setClient(mockClient as any);
  
  // Create a private chat channel that's already been renamed
  const guild = createMockGuild();
  const user = createMockUser();
  const channel = createMockTextChannel("ai-chat-1234567890-ai-discussion-efgh");
  
  // Mock the channel manager's renameChannelWithSummary method
  const mockRenameChannelWithSummary = jest.fn().mockResolvedValue("ai-chat-1234567890-ai-discussion-efgh");
  (bot as any).channelManager.renameChannelWithSummary = mockRenameChannelWithSummary;
  
  // Mock channel messages to simulate 5 messages
  const mockMessages = {
    first: () => null,
    map: (fn: any) => [],
    reverse: () => [],
    values: () => [],
    filter: (fn: any) => ({
      map: (fn: any) => [],
      reverse: () => [],
      size: 4 // 4 messages (even number for renaming)
    }),
    size: 4
  };
  
  channel.messages.fetch = () => Promise.resolve(mockMessages as any);
  
  // Handle 4 messages
  for (let i = 0; i < 4; i++) {
    await bot.handleMessage("user-id", `Message ${i}`, channel as any);
  }
  
  // Check that renameChannelWithSummary was NOT called
  expect(mockRenameChannelWithSummary).not.toHaveBeenCalled();
});

test("should not rename non-private channels", async () => {
  // Set up environment variables
  process.env.OPENROUTER_API_KEY = "test-key";
  
  // Create bot with mock AI service
  const mockAIService = createMockAIService();
  const bot = new DiscordBot(undefined, mockAIService);
  
  // Set up mock client
  const mockClient = {
    user: {
      id: "bot-id"
    }
  };
  bot.setClient(mockClient as any);
  
  // Create a regular channel (not a private chat channel)
  const guild = createMockGuild();
  const user = createMockUser();
  const channel = createMockTextChannel("general");
  
  // Mock the channel manager's renameChannelWithSummary method
  const mockRenameChannelWithSummary = jest.fn().mockResolvedValue("ai-chat-1234567890-ai-discussion-efgh");
  (bot as any).channelManager.renameChannelWithSummary = mockRenameChannelWithSummary;
  
  // Mock channel messages to simulate 5 messages
  const mockMessages = {
    first: () => null,
    map: (fn: any) => [],
    reverse: () => [],
    values: () => [],
    filter: (fn: any) => ({
      map: (fn: any) => [],
      reverse: () => [],
      size: 4 // 4 messages (even number for renaming)
    }),
    size: 4
  };
  
  channel.messages.fetch = () => Promise.resolve(mockMessages as any);
  
  // Handle 4 messages
  for (let i = 0; i < 4; i++) {
    await bot.handleMessage("user-id", `Message ${i}`, channel as any);
  }
  
  // Check that renameChannelWithSummary was NOT called
  expect(mockRenameChannelWithSummary).not.toHaveBeenCalled();
});