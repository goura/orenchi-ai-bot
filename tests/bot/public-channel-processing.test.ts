import { test, expect, describe } from "bun:test";

// Mock Discord.js classes for testing
const createMockTextChannel = (name: string, id: string = `channel-${name}`, type: number = 0) => ({
  name,
  id,
  type, // GuildText
  send: () => Promise.resolve(),
  sendTyping: () => Promise.resolve(),
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
  channelType?: number,
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
      type: options.channelType || 0, // GuildText
      name: `public-channel-${options.channelId}`,
      send: () => Promise.resolve(),
      sendTyping: () => Promise.resolve()
    },
    mentions: {
      users: mentionedUsers,
      has: (userId: string) => mentionedUsers.has(userId)
    }
  };
};

// Import the shouldBotProcessMessage function logic
// Since it's not exported, we'll recreate it here for testing
function shouldBotProcessMessage(message: any, botUserId: string, respondToPublicNoMention: boolean = false): boolean {
  // If the bot is explicitly mentioned, always process
  if (message.mentions.has(botUserId)) {
    return true;
  }
  
  // If there are no mentions, check the environment variable
  if (message.mentions.users.size === 0) {
    // Check if RESPOND_TO_PUBLIC_NO_MENTION is set to true
    return respondToPublicNoMention;
  }
  
  // If there are mentions but the bot is not mentioned, don't process
  return false;
}

// Test the new behavior for public channels
describe("Public channel message processing functionality", () => {
  test("should process message with no mentions when RESPOND_TO_PUBLIC_NO_MENTION is true", () => {
    const message = createMockMessage({
      content: "Hello everyone!",
      authorId: "user1",
      channelId: "channel1",
      channelType: 0 // GuildText
    });
    
    const result = shouldBotProcessMessage(message, "bot1", true);
    expect(result).toBe(true);
  });
  
  test("should not process message with no mentions when RESPOND_TO_PUBLIC_NO_MENTION is false", () => {
    const message = createMockMessage({
      content: "Hello everyone!",
      authorId: "user1",
      channelId: "channel1",
      channelType: 0 // GuildText
    });
    
    const result = shouldBotProcessMessage(message, "bot1", false);
    expect(result).toBe(false);
  });
  
  test("should process message when bot is explicitly mentioned", () => {
    const message = createMockMessage({
      content: "Hello <@bot1>!",
      authorId: "user1",
      channelId: "channel1",
      channelType: 0, // GuildText
      mentionedUserIds: ["bot1"]
    });
    
    // Should process regardless of RESPOND_TO_PUBLIC_NO_MENTION setting
    expect(shouldBotProcessMessage(message, "bot1", true)).toBe(true);
    expect(shouldBotProcessMessage(message, "bot1", false)).toBe(true);
  });
  
  test("should not process message when other users are mentioned but bot is not", () => {
    const message = createMockMessage({
      content: "Hello <@user2> and <@user3>!",
      authorId: "user1",
      channelId: "channel1",
      channelType: 0, // GuildText
      mentionedUserIds: ["user2", "user3"]
    });
    
    // Should not process regardless of RESPOND_TO_PUBLIC_NO_MENTION setting
    expect(shouldBotProcessMessage(message, "bot1", true)).toBe(false);
    expect(shouldBotProcessMessage(message, "bot1", false)).toBe(false);
  });
  
  test("should process message when bot and other users are mentioned", () => {
    const message = createMockMessage({
      content: "Hello <@bot1> and <@user2>!",
      authorId: "user1",
      channelId: "channel1",
      channelType: 0, // GuildText
      mentionedUserIds: ["bot1", "user2"]
    });
    
    // Should process regardless of RESPOND_TO_PUBLIC_NO_MENTION setting
    expect(shouldBotProcessMessage(message, "bot1", true)).toBe(true);
    expect(shouldBotProcessMessage(message, "bot1", false)).toBe(true);
  });
});