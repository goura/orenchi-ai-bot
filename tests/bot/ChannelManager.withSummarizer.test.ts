import { test, expect, jest } from "bun:test";
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
  delete: () => Promise.resolve(),
  edit: () => Promise.resolve(),
  setName: function(newName: string) {
    this.name = newName;
    return Promise.resolve(this);
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
    }
  };
};

test("should rename channel with summary", async () => {
  const manager = new ChannelManager();
  const guild = createMockGuild();
  const user = { id: "user-id", username: "testuser" };
  
  // Create channel first
  const channel = await manager.createPrivateChannel(guild as any, [user as any], "bot-id");
  
  // Mock the summarizeConversation method
  const mockSummarizer = {
    summarizeConversation: jest.fn().mockResolvedValue("ai-discussion")
  };
  
  // Mock channel messages
  const mockMessages = {
    first: () => null,
    map: () => [
      { role: "assistant", content: "I'm doing well, thanks!" },
      { role: "user", content: "How are you?" },
      { role: "assistant", content: "Hi there!" },
      { role: "user", content: "Hello" }
    ],
    reverse: function() {
      return {
        first: this.first,
        map: () => [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there!" },
          { role: "user", content: "How are you?" },
          { role: "assistant", content: "I'm doing well, thanks!" }
        ],
        reverse: this.reverse,
        filter: this.filter
      };
    },
    filter: function() { return this; }
  };
  
  channel.messages.fetch = () => Promise.resolve(mockMessages as any);
  
  // Rename the channel
  const result = await manager.renameChannelWithSummary(channel as any, mockSummarizer as any);
  
  // Check that the channel was renamed with the summary
  expect(result).toMatch(/^ai-chat-\d{10}-ai-discussion-[a-zA-Z0-9]{4}$/);
  expect(mockSummarizer.summarizeConversation).toHaveBeenCalledWith([
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi there!" },
    { role: "user", content: "How are you?" },
    { role: "assistant", content: "I'm doing well, thanks!" }
  ]);
});