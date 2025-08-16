import { test, expect } from "bun:test";
import { ChannelManager } from "../src/bot/ChannelManager";

// Mock Discord.js classes for testing
const createMockTextChannel = (name: string) => ({
  name,
  id: `channel-${name}`,
  type: 0, // GuildText
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

const createMockUser = (id: string, username: string) => ({
  id,
  username
});

test("should create private channel with multiple users", async () => {
  const manager = new ChannelManager();
  const guild = createMockGuild();
  const user1 = createMockUser("user1-id", "user1");
  const user2 = createMockUser("user2-id", "user2");
  const user3 = createMockUser("user3-id", "user3");
  
  const channel = await manager.createPrivateChannel(guild as any, [user1 as any, user2 as any, user3 as any], "bot-id");
  
  // Check that the channel was created with the correct name (based on first user)
  expect(channel.name).toMatch(/^ai-chat-\d{10}-user1-[a-zA-Z0-9]{4}$/);
  
  // The test passes if no errors were thrown during channel creation
  expect(channel).toBeDefined();
});

test("should create private channel with single user (backward compatibility)", async () => {
  const manager = new ChannelManager();
  const guild = createMockGuild();
  const user = createMockUser("user-id", "testuser");
  
  const channel = await manager.createPrivateChannel(guild as any, [user as any], "bot-id");
  
  // Check that the channel was created with the correct name
  expect(channel.name).toMatch(/^ai-chat-\d{10}-testuser-[a-zA-Z0-9]{4}$/);
  
  // The test passes if no errors were thrown during channel creation
  expect(channel).toBeDefined();
});