import { test, expect, beforeEach, afterEach, mock } from "bun:test";
import { DiscordBot } from "../../src/bot/DiscordBot";

// Mock AIService for testing
const mockAIService = {
  generateResponse: async (messages: any[], personality?: string | null) => {
    return "Mock response";
  },
  processImage: async (imageURL: string, messages: any[], personality?: string | null) => {
    return "Mock image processing response";
  }
};

// Mock Discord.js classes for testing
const createMockTextChannel = (name: string, id?: string) => ({
  name,
  id: id || `channel-${name}`,
  type: 0, // GuildText
  delete: mock(() => Promise.resolve())
});

const createMockUser = (username: string, id?: string) => ({
  id: id || "user-id",
  username
});

const createMockGuild = (channels: any[] = []) => {
  // Create a map of channels for easier lookup
  const channelMap = new Map(channels.map(channel => [channel.id, channel]));
  
  // Create a cache that mimics Discord.js ChannelManager cache
  const cache = {
    ...channelMap,
    find: (predicate: (channel: any) => boolean) => {
      for (const [, value] of channelMap) {
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
      cache
    }
  };
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

test("should not delete irrelevant channels when ending AI chat", async () => {
  // Create a user
  const user = createMockUser("testuser");
  
  // Create channels - one relevant (AI chat channel for this user) and one irrelevant
  const relevantChannel = createMockTextChannel("ai-chat-testuser-1234567890-abcd", "relevant-channel-id");
  const irrelevantChannel = createMockTextChannel("general", "irrelevant-channel-id");
  
  // Create a guild with both channels
  const guild: any = createMockGuild([relevantChannel, irrelevantChannel]);
  
  // Mock the channel manager's deletePrivateChannel method to track calls
  const originalDeletePrivateChannel = (bot as any).channelManager.deletePrivateChannel;
  const deletePrivateChannelMock = mock(async (channel: any) => {
    await originalDeletePrivateChannel.call((bot as any).channelManager, channel);
  });
  (bot as any).channelManager.deletePrivateChannel = deletePrivateChannelMock;
  
  // First, we need to create a channel for the user to ensure it exists
  // We'll mock the channel manager's findUserPrivateChannel method to return the relevant channel
  const originalFindUserPrivateChannel = (bot as any).channelManager.findUserPrivateChannel;
  (bot as any).channelManager.findUserPrivateChannel = () => relevantChannel;
  
  // Handle the end AI chat command
  const response = await bot.handleEndAiChatCommand(user as any, guild as any, relevantChannel as any);
  
  // Verify the response
  expect(response).toBe("This private AI chat channel has been deleted.");
  
  // Verify that deletePrivateChannel was called once (for the relevant channel)
  expect(deletePrivateChannelMock).toHaveBeenCalledTimes(1);
  
  // Verify that the relevant channel's delete method was called
  expect(relevantChannel.delete).toHaveBeenCalledTimes(1);
  
  // Verify that the irrelevant channel's delete method was NOT called
  expect(irrelevantChannel.delete).toHaveBeenCalledTimes(0);
  
  // Restore original methods
  (bot as any).channelManager.deletePrivateChannel = originalDeletePrivateChannel;
  (bot as any).channelManager.findUserPrivateChannel = originalFindUserPrivateChannel;
});

test("should not delete channels for different users", async () => {
  // Create a user
  const user = createMockUser("testuser");
  
  // Create channels - one for this user and one for a different user
  const userChannel = createMockTextChannel("ai-chat-testuser-1234567890-abcd", "user-channel-id");
  const otherUserChannel = createMockTextChannel("ai-chat-otheruser-1234567890-efgh", "other-user-channel-id");
  const generalChannel = createMockTextChannel("general", "general-channel-id");
  
  // Create a guild with all channels
  const guild: any = createMockGuild([userChannel, otherUserChannel, generalChannel]);
  
  // Mock the channel manager's deletePrivateChannel method to track calls
  const originalDeletePrivateChannel = (bot as any).channelManager.deletePrivateChannel;
  const deletePrivateChannelMock = mock(async (channel: any) => {
    await originalDeletePrivateChannel.call((bot as any).channelManager, channel);
  });
  (bot as any).channelManager.deletePrivateChannel = deletePrivateChannelMock;
  
  // Mock the channel manager's findUserPrivateChannel method to return the user's channel
  const originalFindUserPrivateChannel = (bot as any).channelManager.findUserPrivateChannel;
  (bot as any).channelManager.findUserPrivateChannel = () => userChannel;
  
  // Handle the end AI chat command
  const response = await bot.handleEndAiChatCommand(user as any, guild as any, userChannel as any);
  
  // Verify the response
  expect(response).toBe("This private AI chat channel has been deleted.");
  
  // Verify that deletePrivateChannel was called once (for the user's channel)
  expect(deletePrivateChannelMock).toHaveBeenCalledTimes(1);
  
  // Verify that the user's channel delete method was called
  expect(userChannel.delete).toHaveBeenCalledTimes(1);
  
  // Verify that the other user's channel delete method was NOT called
  expect(otherUserChannel.delete).toHaveBeenCalledTimes(0);
  
  // Verify that the general channel delete method was NOT called
  expect(generalChannel.delete).toHaveBeenCalledTimes(0);
  
  // Restore original methods
  (bot as any).channelManager.deletePrivateChannel = originalDeletePrivateChannel;
  (bot as any).channelManager.findUserPrivateChannel = originalFindUserPrivateChannel;
});

test("should handle case when user has no AI chat channel", async () => {
  // Create a user
  const user = createMockUser("testuser");
  
  // Create channels that are not related to this user's AI chat
  const otherUserChannel = createMockTextChannel("ai-chat-otheruser-1234567890-efgh", "other-user-channel-id");
  const generalChannel = createMockTextChannel("general", "general-channel-id");
  
  // Create a guild with unrelated channels
  const guild: any = createMockGuild([otherUserChannel, generalChannel]);
  
  // Handle the end AI chat command
  const response = await bot.handleEndAiChatCommand(user as any, guild as any);
  
  // Verify the response
  expect(response).toBe("You don't have an active private AI chat channel.");
  
  // Verify that no channels were deleted
  expect(otherUserChannel.delete).toHaveBeenCalledTimes(0);
  expect(generalChannel.delete).toHaveBeenCalledTimes(0);
});

test("should delete the channel when /end-ai-chat is issued from within a private AI chat channel", async () => {
  // Create a user
  const user = createMockUser("testuser");
  
  // Create a private AI chat channel
  const privateChannel = createMockTextChannel("ai-chat-testuser-1234567890-abcd", "private-channel-id");
  
  // Create a guild with the private channel
  const guild: any = createMockGuild([privateChannel]);
  
  // Mock the channel manager's deletePrivateChannel method to track calls
  const originalDeletePrivateChannel = (bot as any).channelManager.deletePrivateChannel;
  const deletePrivateChannelMock = mock(async (channel: any) => {
    await originalDeletePrivateChannel.call((bot as any).channelManager, channel);
  });
  (bot as any).channelManager.deletePrivateChannel = deletePrivateChannelMock;
  
  // Handle the end AI chat command, passing the private channel
  const response = await bot.handleEndAiChatCommand(user as any, guild as any, privateChannel as any);
  
  // Verify the response
  expect(response).toBe("This private AI chat channel has been deleted.");
  
  // Verify that deletePrivateChannel was called once (for the private channel)
  expect(deletePrivateChannelMock).toHaveBeenCalledTimes(1);
  
  // Verify that the private channel's delete method was called
  expect(privateChannel.delete).toHaveBeenCalledTimes(1);
  
  // Restore original method
  (bot as any).channelManager.deletePrivateChannel = originalDeletePrivateChannel;
});

test("should handle case when channel deletion fails", async () => {
  // Create a user
  const user = createMockUser("testuser");
  
  // Create a private AI chat channel
  const privateChannel = createMockTextChannel("ai-chat-testuser-1234567890-abcd", "private-channel-id");
  
  // Create a guild with the private channel
  const guild: any = createMockGuild([privateChannel]);
  
  // Mock console.error to prevent logging during test
  const originalConsoleError = console.error;
  console.error = () => {};
  
  // Mock the channel manager's deletePrivateChannel method to throw an error
  const originalDeletePrivateChannel = (bot as any).channelManager.deletePrivateChannel;
  (bot as any).channelManager.deletePrivateChannel = () => {
    throw new Error("Channel deletion failed");
  };
  
  // Handle the end AI chat command, passing the private channel
  const response = await bot.handleEndAiChatCommand(user as any, guild as any, privateChannel as any);
  
  // Restore original method and console.error
  (bot as any).channelManager.deletePrivateChannel = originalDeletePrivateChannel;
  console.error = originalConsoleError;
  
  // Verify the response
  expect(response).toBe("Sorry, I couldn't delete this private AI chat channel. Please try again later.");
});