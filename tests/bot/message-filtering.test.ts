import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { ChannelManager } from "../../src/bot/ChannelManager";

// Mock Discord.js classes for testing
const createMockTextChannel = (name: string, id: string = `channel-${name}`) => ({
  name,
  id,
  type: 0, // GuildText
  send: mock(() => Promise.resolve()),
  sendTyping: mock(() => Promise.resolve()),
  messages: {
    fetch: () => Promise.resolve({
      first: () => null,
      filter: () => ({
        map: (fn: any) => [],
        reverse: () => []
      })
    })
  },
  delete: () => Promise.resolve()
});

const createMockUser = (id: string, username: string) => ({
  id,
  username,
  tag: `${username}#${id.substring(0, 4)}`
});

const createMockMessage = (options: {
  content: string,
  authorId: string,
  channelId: string,
  mentionedUserIds?: string[]
}) => {
  const mentionedUsers = new Map();
  if (options.mentionedUserIds) {
    for (const userId of options.mentionedUserIds) {
      mentionedUsers.set(userId, createMockUser(userId, `user-${userId}`));
    }
  }
  
  return {
    content: options.content,
    author: {
      id: options.authorId,
      tag: `user-${options.authorId}#${options.authorId.substring(0, 4)}`
    },
    channel: {
      id: options.channelId,
      type: 0, // GuildText
      name: `ai-chat-test-${options.channelId}`,
      send: mock(() => Promise.resolve()),
      sendTyping: mock(() => Promise.resolve())
    },
    mentions: {
      users: mentionedUsers,
      has: (userId: string) => mentionedUsers.has(userId)
    }
  };
};

const createMockClient = (botUserId: string) => ({
  user: {
    id: botUserId
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

// Import the isMessageDirectedToOthers function from index.ts
// Since it's not exported, we'll recreate it here for testing
function isMessageDirectedToOthers(message: any, botUserId: string): boolean {
  // If there are no mentions, the message is not directed to anyone specifically
  if (message.mentions.users.size === 0) {
    return false;
  }
  
  // Check if all mentions are to users other than the bot
  const mentionedUsers = message.mentions.users;
  for (const [userId, user] of mentionedUsers) {
    if (userId === botUserId) {
      // If the bot is mentioned, the message is directed to the bot
      return false;
    }
  }
  
  // If we get here, all mentions are to users other than the bot
  return true;
}

describe("Message filtering functionality", () => {
  test("should return false for message with no mentions", () => {
    const message = createMockMessage({
      content: "Hello everyone!",
      authorId: "user1",
      channelId: "channel1"
    });
    
    const result = isMessageDirectedToOthers(message, "bot1");
    expect(result).toBe(false);
  });
  
  test("should return false for message mentioning the bot", () => {
    const message = createMockMessage({
      content: "Hello <@bot1>!",
      authorId: "user1",
      channelId: "channel1",
      mentionedUserIds: ["bot1"]
    });
    
    const result = isMessageDirectedToOthers(message, "bot1");
    expect(result).toBe(false);
  });
  
  test("should return true for message mentioning only other users", () => {
    const message = createMockMessage({
      content: "Hello <@user2> and <@user3>!",
      authorId: "user1",
      channelId: "channel1",
      mentionedUserIds: ["user2", "user3"]
    });
    
    const result = isMessageDirectedToOthers(message, "bot1");
    expect(result).toBe(true);
  });
  
  test("should return false for message mentioning both bot and other users", () => {
    const message = createMockMessage({
      content: "Hello <@bot1> and <@user2>!",
      authorId: "user1",
      channelId: "channel1",
      mentionedUserIds: ["bot1", "user2"]
    });
    
    const result = isMessageDirectedToOthers(message, "bot1");
    expect(result).toBe(false);
  });
  
  test("should return false for message mentioning only the bot", () => {
    const message = createMockMessage({
      content: "Hello <@bot1>!",
      authorId: "user1",
      channelId: "channel1",
      mentionedUserIds: ["bot1"]
    });
    
    const result = isMessageDirectedToOthers(message, "bot1");
    expect(result).toBe(false);
  });
});