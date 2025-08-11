import { test, expect } from "bun:test";
import { ChannelManager } from "../../src/bot/ChannelManager";

// Mock Discord.js classes for testing
const createMockTextChannel = (name: string, ageInMs: number = 0) => ({
  name,
  id: `channel-${name}`,
  type: 0, // GuildText
  createdAt: new Date(Date.now() - ageInMs),
  send: () => Promise.resolve(),
  messages: {
    fetch: () => Promise.resolve({
      first: () => null,
      map: (fn: any) => [],
      reverse: () => [],
      values: () => [],
      filter: () => ({
        map: (fn: any) => [],
        reverse: () => []
      })
    })
  },
  delete: () => Promise.resolve()
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
    }
  };
};

test("should generate correct channel name", () => {
  const manager = new ChannelManager();
  
  const channelName = manager.generateChannelName("testuser");
  // New format: ai-chat-{username}-{timestamp}-{random}
  expect(channelName).toMatch(/^ai-chat-testuser-\d{10}-[a-zA-Z0-9]{4}$/);
});

test("should sanitize usernames with invalid characters", () => {
  const manager = new ChannelManager();
  
  const channelName = manager.generateChannelName("test.user@domain");
  // New format: ai-chat-{sanitized-username}-{timestamp}-{random}
  expect(channelName).toMatch(/^ai-chat-test-user--\d{10}-[a-zA-Z0-9]{4}$/);
});

test("should identify private chat channels", () => {
  const manager = new ChannelManager();
  
  expect(manager.isPrivateChatChannel("ai-chat-testuser")).toBe(true);
  expect(manager.isPrivateChatChannel("general")).toBe(false);
  expect(manager.isPrivateChatChannel("bot-ai-chat")).toBe(false);
});

test("should create private channel", async () => {
  const manager = new ChannelManager();
  const guild = createMockGuild();
  const user = { id: "user-id", username: "testuser" };
  
  const channel = await manager.createPrivateChannel(guild as any, [user as any]);
  // New format: ai-chat-{username}-{timestamp}-{random}
  expect(channel.name).toMatch(/^ai-chat-testuser-\d{10}-[a-zA-Z0-9]{4}$/);
});

test("should always create a new channel even if one exists", async () => {
  const manager = new ChannelManager();
  const guild = createMockGuild();
  const user = { id: "user-id", username: "testuser" };
  
  // Create channel first
  const channel1 = await manager.createPrivateChannel(guild as any, [user as any], "bot-id");
  
  // Try to create again - should return a new channel with different name
  const channel2 = await manager.createPrivateChannel(guild as any, [user as any], "bot-id");
  
  expect(channel1.name).not.toBe(channel2.name);
  expect(channel1).not.toBe(channel2);
});

test("should delete private channel", async () => {
  const manager = new ChannelManager();
  const channel = createMockTextChannel("ai-chat-testuser");
  
  // This should not throw
  await manager.deletePrivateChannel(channel as any);
  expect(true).toBe(true);
});

test("should handle delete channel errors gracefully", async () => {
  const manager = new ChannelManager();
  const channel = createMockTextChannel("ai-chat-testuser");
  
  // Make delete throw an error
  channel.delete = () => Promise.reject(new Error("Delete failed"));
  
  // This should not throw
  await manager.deletePrivateChannel(channel as any);
  expect(true).toBe(true);
});

test("should detect inactive channels with no messages", async () => {
  const manager = new ChannelManager(1); // 1 hour threshold
  const channel = createMockTextChannel("ai-chat-testuser", 2 * 60 * 60 * 1000); // 2 hours old
  
  const result = await manager.isChannelInactive(channel as any);
  expect(result).toBe(true);
});

test("should detect active channels with recent creation", async () => {
  const manager = new ChannelManager(24); // 24 hour threshold
  const channel = createMockTextChannel("ai-chat-testuser", 12 * 60 * 60 * 1000); // 12 hours old
  
  const result = await manager.isChannelInactive(channel as any);
  expect(result).toBe(false);
});

test("should handle channel inactivity check errors gracefully", async () => {
  const manager = new ChannelManager();
  const channel = createMockTextChannel("ai-chat-testuser");
  
  // Make messages.fetch throw an error
  channel.messages.fetch = () => Promise.reject(new Error("Fetch failed"));
  
  const result = await manager.isChannelInactive(channel as any);
  expect(result).toBe(false);
});
