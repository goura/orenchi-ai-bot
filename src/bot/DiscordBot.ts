import { Client, Guild, User, TextChannel } from "discord.js";
import { PersonalityDB } from "../database/PersonalityDB";
import { ChannelManager } from "./ChannelManager";
import { PersonalityCommand } from "../commands/PersonalityCommand";
import type { MessageHistoryItem } from "../utils/ConversationHistory";
import {ConversationHistory} from "../utils/ConversationHistory";
import { AIService } from "../services/AIService";
import { ChannelSummarizer } from "../services/ChannelSummarizer";

// Types for the mock
type MockAIService = {
  generateResponse: (messages: MessageHistoryItem[], personality?: string | null) => Promise<string>;
  processImage: (imageURL: string, messages: MessageHistoryItem[], personality?: string | null) => Promise<string>;
};

export class DiscordBot {
  private db: PersonalityDB;
  private channelManager: ChannelManager;
  private personalityCommand: PersonalityCommand;
  private aiService: AIService | MockAIService;
  private channelSummarizer: ChannelSummarizer;
  private client: Client | null = null;

  constructor(dbPath?: string, mockAIService?: MockAIService) {
    this.db = new PersonalityDB(dbPath);
    this.channelManager = new ChannelManager();
    this.personalityCommand = new PersonalityCommand(this.db);
    
    // Use mock if provided (for testing)
    if (mockAIService) {
      this.aiService = mockAIService;
    } else {
      // Initialize AI service with OpenRouter API key from environment
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY environment variable is required");
      }
      
      this.aiService = new AIService({ apiKey });
    }
    
    // Initialize ChannelSummarizer with OpenRouter API key from environment
    const summarizerApiKey = process.env.OPENROUTER_API_KEY;
    if (!summarizerApiKey) {
      throw new Error("OPENROUTER_API_KEY environment variable is required for ChannelSummarizer");
    }
    
    this.channelSummarizer = new ChannelSummarizer({ apiKey: summarizerApiKey });
  }

  // Initialize the bot (would connect to Discord in a real implementation)
  async initialize(): Promise<void> {
    console.log("Bot initialized");
  }

  // Set the Discord client (for testing)
  setClient(client: Client): void {
    this.client = client;
  }

  // Handle a message from a user
  async handleMessage(userId: string, messageContent: string, channel?: TextChannel, attachments?: { url: string, contentType?: string }[]): Promise<string> {
    console.log(`Handling message from user ${userId} in channel ${channel?.name || 'unknown'}: ${messageContent.substring(0, 50)}${messageContent.length > 50 ? '...' : ''}`);
    
    // Send initial typing indicator if channel is provided
    if (channel) {
      try {
        await channel.sendTyping();
      } catch (error) {
        console.error("Failed to send initial typing indicator:", error);
      }
    }
    
    // Set up more frequent typing indicators for better UX
    let typingInterval: NodeJS.Timeout | null = null;
    if (channel) {
      // Send typing indicator immediately and then more frequently
      let typingSentCount = 0;
      const maxTypingIndicators = 10; // Limit to prevent infinite loops
      
      typingInterval = setInterval(async () => {
        try {
          // Stop sending typing indicators after a reasonable number to prevent spam
          if (typingSentCount >= maxTypingIndicators) {
            if (typingInterval) clearInterval(typingInterval);
            return;
          }
          
          await channel.sendTyping();
          typingSentCount++;
        } catch (error) {
          console.error("Failed to send typing indicator:", error);
          if (typingInterval) clearInterval(typingInterval);
        }
      }, 5000); // Send typing indicator every 5 seconds for smoother experience
    }
    
    // Get user's personality if it exists
    const personality = this.personalityCommand.getPersonality(userId);
    if (personality) {
      console.log(`Using personality for user ${userId}: ${personality.substring(0, 50)}${personality.length > 50 ? '...' : ''}`);
    }
    
    let historyItems: MessageHistoryItem[] = [];
    
    // If we have a channel, fetch actual history from Discord
    if (channel) {
      try {
        console.log(`Fetching message history from channel ${channel.name}`);
        const messages = await channel.messages.fetch({ limit: 10 });
        historyItems = messages
          .filter(msg => !msg.author.bot || msg.author.id === this.client?.user?.id)
          .map(msg => ({
            role: msg.author.id === this.client?.user?.id ? "assistant" as const: "user" as const,
            content: msg.content
          }))
          .reverse(); // Reverse to get chronological order
        console.log(`Fetched ${historyItems.length} history items`);
      } catch (error) {
        console.error("Failed to fetch message history:", error);
        // Fall back to in-memory history
        const history = new ConversationHistory(10);
        history.addMessage({ role: "user", content: messageContent });
        historyItems = history.getHistory();
      }
    } else {
      // Use in-memory history as fallback
      console.log("Using in-memory history as fallback");
      const history = new ConversationHistory(10);
      history.addMessage({ role: "user", content: messageContent });
      historyItems = history.getHistory();
    }
    
    // Check if there are image attachments
    const imageAttachments = attachments?.filter(attachment => 
      attachment.contentType?.startsWith('image/') && 
      attachment.url
    ) || [];
    
    // Get response from AI service
    console.log("Generating AI response...");
    let response: string;
    
    try {
      if (imageAttachments.length > 0) {
        // Process the first image with the AI service
        const imageURL = imageAttachments[0]?.url;
        if (imageURL) {
          response = await this.aiService.processImage(imageURL, historyItems, personality);
        } else {
          response = "I couldn't process the image attachment.";
        }
      } else {
        // Generate response for text message
        response = await this.aiService.generateResponse(historyItems, personality);
      }
      
      console.log(`Generated response: ${response.substring(0, 50)}${response.length > 50 ? '...' : ''}`);
    } finally {
      // Clear typing interval when done (success or error)
      if (typingInterval) {
        clearInterval(typingInterval);
      }
    }
    
    // Check if we should rename the channel (after 5 messages exchanged)
    if (channel && this.channelManager.isPrivateChatChannel(channel.name)) {
      try {
        // Fetch message count
        const messages = await channel.messages.fetch({ limit: 10 });
        const userMessages = messages.filter(msg => !msg.author.bot || msg.author.id === this.client?.user?.id);
        
        // Rename channel after every 2 messages
        if (userMessages.size >= 2 && (userMessages.size - 2) % 4 === 0) {
          // Check if the channel name already contains a summary (to avoid renaming multiple times)
          if (!channel.name.includes("-ai-discussion-") && !channel.name.includes("-chat-summary-")) {
            await this.channelManager.renameChannelWithSummary(channel, this.channelSummarizer);
          }
        }
      } catch (error) {
        console.error(`Failed to check for channel renaming:`, error);
      }
    }
    
    // Send one final typing indicator right before sending the message
    // This ensures the typing indicator is active when the message appears
    if (channel) {
      try {
        await channel.sendTyping();
      } catch (error) {
        console.error("Failed to send final typing indicator:", error);
      }
    }
    
    return response;
  }

  // Handle the /personality command
  async handlePersonalityCommand(userId: string, personalityText?: string | null): Promise<string> {
    // If no personality text is provided, return the current personality with a help message
    if (!personalityText) {
      const currentPersonality = this.personalityCommand.getPersonality(userId);
      if (currentPersonality) {
        return `Current personality: ${currentPersonality}\n\nTo set a new personality, use: /personality <personality text>`;
      } else {
        return "No personality set. To set a personality, use: /personality <personality text>";
      }
    }
    
    // If personality text is provided, set it
    return await this.personalityCommand.handle(userId, personalityText);
  }

  // Handle the /start-ai-chat command
  async handleStartAiChatCommand(user: User, guild: Guild): Promise<string> {
    try {
      const botId = this.client?.user?.id;
      const channel = await this.channelManager.createPrivateChannel(guild, [user], botId);
      return `I've created a private AI chat channel for you: ${channel.toString()}`;
    } catch (error) {
      console.error("Failed to create private channel:", error);
      return "Sorry, I couldn't create a private AI chat channel for you. Please try again later.";
    }
  }

  // Handle the /end-ai-chat command
  async handleEndAiChatCommand(user: User, guild: Guild, channel?: TextChannel): Promise<string> {
    // If the command was issued from a private AI chat channel, delete that channel
    if (channel && this.channelManager.isPrivateChatChannel(channel.name)) {
      try {
        await this.channelManager.deletePrivateChannel(channel);
        return "This private AI chat channel has been deleted.";
      } catch (error) {
        console.error("Failed to delete private channel:", error);
        return "Sorry, I couldn't delete this private AI chat channel. Please try again later.";
      }
    }
    
    // Otherwise, search for the user's private channel and delete it
    const userChannel = this.channelManager.findUserPrivateChannel(guild, user.username);
    
    if (!userChannel) {
      return "You don't have an active private AI chat channel.";
    }
    
    try {
      await this.channelManager.deletePrivateChannel(userChannel);
      return "Your private AI chat channel has been deleted.";
    } catch (error) {
      console.error("Failed to delete private channel:", error);
      return "Sorry, I couldn't delete your private AI chat channel. Please try again later.";
    }
  }

  // Check and cleanup inactive channels
  async cleanupInactiveChannels(guild: Guild): Promise<void> {
    await this.channelManager.cleanupInactiveChannels(guild);
  }

  // Generate a varied response for public channel notifications
  async generatePublicResponse(userId: string, userMessage: string, channelMention: string): Promise<string> {
    // Create system prompt for generating varied responses
    const systemPrompt = "Generate a friendly one-line response indicating we're moving to a private channel in the language the user used, in a tone of who you are supposed to be. Keep it concise. Only provide one response.";
    
    // Create user prompt with the original message for language detection
    const userPrompt = `${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}`;
    
    const historyItems = [
      { role: "user" as const, content: userPrompt }
    ];
    
    // Generate response using the AI service with system prompt as personality
    const response = await this.aiService.generateResponse(historyItems, systemPrompt, false);
    return response;
  }
  
  // Generate a response for the first message in a private channel
  // This response is generated with personality and with web search enabled
  async generateFirstMessageResponse(userId: string, originalMessage: string): Promise<string> {
    console.log(`Generating first message response for user ${userId} with original message: ${originalMessage.substring(0, 50)}${originalMessage.length > 50 ? '...' : ''}`);
    
    // Get user's personality if it exists
    const personality = this.personalityCommand.getPersonality(userId);
    if (personality) {
      console.log(`Using personality for user ${userId}: ${personality.substring(0, 50)}${personality.length > 50 ? '...' : ''}`);
    }
    
    // Create a system prompt that tells the AI to generate a friendly response
    // that respects the user's personality
    const systemPrompt = `Generate a friendly, natural response in the language as the user's message, in a tone of who you are supposed to be. Keep it concise but not necessarily limited to one line. Only provide one response.`;
    
    // Create a history with just the original message
    const historyItems = [
      { role: "user" as const, content: originalMessage }
    ];
    
    // Generate response using the AI service with the system prompt as personality
    // This approach ensures we don't do web search but still respect personality
    try {
      const response = await this.aiService.generateResponse(historyItems, systemPrompt, true);
      console.log(`Generated first message response: ${response.substring(0, 50)}${response.length > 50 ? '...' : ''}`);
      return response;
    } catch (error) {
      console.error("Error generating first message response:", error);
      // Fallback to a simple response
      return "Hello! I've moved our conversation to this private channel. How can I help you today?";
    }
  }
  
  // Shutdown the bot and cleanup resources
  async shutdown(): Promise<void> {
    this.db.close();
    console.log("Bot shut down");
  }
}