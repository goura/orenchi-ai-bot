import { ChannelType, Guild, PermissionsBitField, TextChannel, User } from "discord.js";
import type { MessageHistoryItem } from "../utils/ConversationHistory";
import { ChannelSummarizer } from "../services/ChannelSummarizer";

export class ChannelManager {
  static readonly WELCOME_MESSAGE_SUFFIX = "You can customize my personality with the /personality command.";
  private readonly channelPrefix: string = "ai-chat-";
  private readonly inactivityThreshold: number; // in milliseconds

  constructor(inactivityThresholdHours: number = 24) {
    this.inactivityThreshold = inactivityThresholdHours * 60 * 60 * 1000;
  }

  /**
   * Generate a unique channel name using timestamp and random characters
   */
  generateChannelName(username: string): string {
    // Create a safe username by replacing invalid characters
    const safeUsername = username.replace(/[^a-zA-Z0-9-_]/g, "-").substring(0, 10);
    
    // Generate timestamp
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Generate 4 random characters
    const chars = 'abcdfghijklmnopqrstuvwxyzABCDFGHIJKLMNPQRSTUVWXYZ0123456789';
    let randomStr = '';
    for (let i = 0; i < 4; i++) {
      randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return `${this.channelPrefix}${timestamp}-${safeUsername}-${randomStr}`;
  }

  isPrivateChatChannel(channelName: string): boolean {
    return channelName.startsWith(this.channelPrefix);
  }

  /**
   * Find a user's private chat channel by username
   */
  findUserPrivateChannel(guild: Guild, username: string): TextChannel | undefined {
    // Create a safe username by replacing invalid characters (same as in generateChannelName)
    const safeUsername = username.replace(/[^a-zA-Z0-9-_]/g, "-").substring(0, 10);
    const channelPrefixWithUsername = `${this.channelPrefix}${safeUsername}-`;
    
    // Find the first channel that starts with the prefix and username
    return guild.channels.cache.find(
      channel =>
        channel.type === ChannelType.GuildText &&
        channel.name.startsWith(channelPrefixWithUsername)
    ) as TextChannel | undefined;
  }

  /**
   * Create a private channel for a user with proper permissions
   */
  async createPrivateChannel(guild: Guild, users: User[], botId?: string, originalMessage?: string): Promise<TextChannel> {
    // Use the first user's username for the channel name
    const channelName = this.generateChannelName(users[0]?.username || 'unknown');
    console.log(`Creating private channel: ${channelName} for users: ${users.map(u => u.tag || u.username).join(', ')}`);
    
    // Create new channel with permissions for all users
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        // Add permissions for all users
        ...users.map(user => ({
          id: user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        })),
        // Add bot permissions if botId is provided
        ...(botId ? [{
          id: botId,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageChannels
          ]
        }] : [])
      ]
    });
    
    // Send welcome message
    // If there was an original message, only include the Q: part
    if (originalMessage) {
      const welcomeMessage = `Q: ${originalMessage}`;
      await channel.send(welcomeMessage);
    } else {
      // If no original message, include the full welcome message
      const userMentions = users.map(user => `<@${user.id}>`).join(', ');
      const welcomeMessage = `Hello ${userMentions}! This is your private chat channel with the AI assistant. ${ChannelManager.WELCOME_MESSAGE_SUFFIX}`;
      await channel.send(welcomeMessage);
    }
    
    console.log(`Private channel created: ${channel.name} (${channel.id})`);
    
    return channel;
  }

  /**
   * Delete a private channel
   */
  async deletePrivateChannel(channel: TextChannel): Promise<void> {
    try {
      await channel.delete();
    } catch (error) {
      console.error(`Failed to delete channel ${channel.name}:`, error);
    }
  }

  /**
   * Check if a channel is inactive based on last message timestamp
   */
  async isChannelInactive(channel: TextChannel): Promise<boolean> {
    try {
      const messages = await channel.messages.fetch({ limit: 1 });
      const lastMessage = messages.first();
      
      if (!lastMessage) {
        // If no messages, check channel creation time
        const createdAt = channel.createdAt;
        const now = new Date();
        const timeDiff = now.getTime() - createdAt.getTime();
        return timeDiff > this.inactivityThreshold;
      }
      
      const now = new Date();
      const timeDiff = now.getTime() - lastMessage.createdAt.getTime();
      return timeDiff > this.inactivityThreshold;
    } catch (error) {
      console.error(`Failed to check inactivity for channel ${channel.name}:`, error);
      return false;
    }
  }

  /**
   * Clean up inactive channels
   */
  async cleanupInactiveChannels(guild: Guild): Promise<void> {
    const channels = guild.channels.cache.filter(
      channel => channel.type === ChannelType.GuildText && 
                 this.isPrivateChatChannel(channel.name)
    ) as any as TextChannel[];
    
    for (const channel of channels.values()) {
      if (await this.isChannelInactive(channel)) {
        await this.deletePrivateChannel(channel);
      }
    }
  }

  /**
   * Rename a channel with a summary of the conversation
   */
  async renameChannelWithSummary(channel: TextChannel, summarizer: ChannelSummarizer): Promise<string> {
    try {
      // Fetch the message history from the channel
      const messages = await channel.messages.fetch({ limit: 10 });
      const historyItems: MessageHistoryItem[] = messages
        .filter(msg => !msg.author.bot || msg.author.id === channel.client.user?.id)
        .map(msg => ({
          role: msg.author.id === channel.client.user?.id ? "assistant" as const : "user" as const,
          content: msg.content
        }))
        .reverse(); // Reverse to get chronological order
      
      // Generate summary using the summarizer
      const summary = await summarizer.summarizeConversation(historyItems);
      
      // Generate a new channel name with the summary
      // Format: ai-chat-{timestamp}-{summarized_title}-{random}
      const timestamp = Math.floor(Date.now() / 1000);
      
      // Generate 4 random characters
      const chars = 'abcdfghijklmnopqrstuvwxyzABCDFGHIJKLMNPQRSTUVWXYZ0123456789';
      let randomStr = '';
      for (let i = 0; i < 4; i++) {
        randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      const newChannelName = `ai-chat-${timestamp}-${summary}-${randomStr}`;
      console.log(`Renaming channel ${channel.name} to ${newChannelName}`);
      
      // Rename the channel
      await channel.setName(newChannelName);
      return newChannelName;
    } catch (error) {
      console.error(`Failed to rename channel ${channel.name} with summary:`, error);
      throw error;
    }
  }
}