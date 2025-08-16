import OpenAI from "openai";
import type { MessageHistoryItem } from "../utils/ConversationHistory";
import { ChannelManager } from "../bot/ChannelManager";

export interface ChannelSummarizerConfig {
  apiKey: string;
  baseURL?: string;
}

export class ChannelSummarizer {
  private client: OpenAI;
  private model: string = "openai/gpt-5-nano";

  static readonly SYSTEM_PROMPT = "You are a helpful assistant that creates concise, descriptive titles for conversations. Create a short title (3-5 words) that captures the main topic of the conversation. Only respond with the title, nothing else. Use the language primarily used in the conversation. If it's Japanese, never separate words with spaces.";
  static readonly MAX_TOKENS = 2000;

  constructor(config: ChannelSummarizerConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "X-Title": "orenchi-ai-bot-channel-summarizer"
      }
    });
  }

  /**
   * Generate a summary/title for a conversation
   */
  async summarizeConversation(messages: MessageHistoryItem[]): Promise<string> {
    try {
      console.log(`Generating summary for conversation with ${messages.length} messages`);
      
      // Format the conversation history for the API
      // Filter out the welcome message that contains personality command information
      const filteredMessages = messages.filter(msg =>
        !msg.content.includes(ChannelManager.WELCOME_MESSAGE_SUFFIX)
      );
      
      const formattedHistory = filteredMessages.map(msg =>
        `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
      ).join("\n");
      
      // Create the prompt for summarization
      const userPrompt = formattedHistory;
      
      console.log(`Sending summarization request to OpenRouter API`);
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: ChannelSummarizer.SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ],
        max_tokens: ChannelSummarizer.MAX_TOKENS
      });

      const content = response.choices[0]?.message?.content;
      console.log(`Received summary from OpenRouter API: ${content}`);
      
      // Sanitize the title to make it safe for channel names
      if (content) {
        return this.sanitizeTitle(content);
      }
      
      return "Chat Summary";
    } catch (error) {
      console.error("Error calling OpenRouter API for summarization:", error);
      return "Chat Summary";
    }
  }
  
  /**
   * Sanitize a title to make it safe for use in channel names
   */
  private sanitizeTitle(title: string): string {
    // Allow Unicode characters including Japanese, but remove problematic characters for Discord channel names
    // Limit to 30 characters
    return title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '') // Allow Unicode letters and numbers
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      .substring(0, 30)
      .replace(/^-+|-+$/g, '') || "chat-summary";
  }
}