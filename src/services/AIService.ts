import OpenAI from "openai";
import type { MessageHistoryItem } from "../utils/ConversationHistory";

export interface AIServiceConfig {
  apiKey: string;
  baseURL?: string;
}

export class AIService {
  private client: OpenAI;
  private defaultModel: string = "openrouter/auto:online";
  private imageRecognitionModel: string = "openrouter/gemini-2.5-flash:online";
  private maxTokens: number = 100000;

  // Expose maxTokens for testing purposes
  public getMaxTokens(): number {
    return this.maxTokens;
  }

  constructor(config: AIServiceConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "X-Title": "orenchi-ai-bot"
      }
    });
  }

  /**
   * Select the most appropriate model based on message length
   */
  private selectModel(message: string): string {
    const tokenEstimate = message.split(' ').length;
    
    if (tokenEstimate < 100) {
      // Lightweight model for short messages
      return "openai/gpt-5-chat:online";
    } else if (tokenEstimate < 500) {
      // Balanced model for medium messages
      return this.defaultModel;
    } else {
      // Powerful model for long messages
      return "openai/gpt-5:online";
    }
  }

  /**
   * Generate a response from the AI model
   */
  async generateResponse(
    messages: MessageHistoryItem[],
    personality?: string | null
  ): Promise<string> {
    try {
      console.log(`Generating AI response with ${messages.length} history items`);
      if (personality) {
        console.log(`Using personality: ${personality.substring(0, 50)}${personality.length > 50 ? '...' : ''}`);
      }
      
      // Build the conversation history for the API
      const conversationHistory = messages.map(msg => ({
        role: msg.role === "user" ? "user" as const : "assistant" as const,
        content: msg.content
      }));

      // Prepare the system instruction if personality is provided
      const systemInstruction = personality
        ? [{ role: "system" as const, content: personality }]
        : [];

      // Get the last user message to determine model selection
      const lastUserMessage = messages.filter(m => m.role === "user").pop();
      const model = lastUserMessage 
        ? this.selectModel(lastUserMessage.content) 
        : this.defaultModel;
      
      console.log(`Selected model: ${model}`);

      // Create the full prompt with system instruction and conversation history
      const fullPrompt = [
        ...systemInstruction,
        ...conversationHistory
      ];

      console.log(`Sending request to OpenRouter API with ${fullPrompt.length} messages`);
      const response = await this.client.chat.completions.create({
        model: model,
        messages: fullPrompt,
        temperature: 0.7,
        max_tokens: this.maxTokens
      });

      const content = response.choices[0]?.message?.content;
      console.log(`Received response from OpenRouter API: ${content?.substring(0, 50)}${content && content.length > 50 ? '...' : ''}`);
      return content || "I'm not sure how to respond to that.";
    } catch (error) {
      console.error("Error calling OpenRouter API:", error);
      return "Sorry, I encountered an error while processing your request.";
    }
  }

  /**
   * Process an image input and generate a response
   */
  async processImage(
    imageURL: string,
    messages: MessageHistoryItem[],
    personality?: string | null
  ): Promise<string> {
    try {
      console.log(`Processing image from URL: ${imageURL}`);
      
      // Build the conversation history for the API
      const conversationHistory = messages.map(msg => {
        // For existing messages, maintain as is
        return {
          role: msg.role === "user" ? "user" as const : "assistant" as const,
          content: msg.content
        };
      });

      // Add the image as content to the latest user message
      const imageMessage = {
        role: "user" as const,
        content: [
          {
            type: "image_url" as const,
            image_url: {
              url: imageURL
            }
          },
          {
            type: "text" as const,
            text: "What do you see in this image?"
          }
        ]
      };

      // Prepare the system instruction if personality is provided
      const systemInstruction = personality
        ? [{ role: "system" as const, content: personality }]
        : [];

      // Create the full prompt with system instruction, conversation history, and image
      const fullPrompt = [
        ...systemInstruction,
        ...conversationHistory,
        imageMessage
      ];

      console.log(`Sending image request to OpenRouter API with ${fullPrompt.length} messages`);
      
      // Use the image recognition model for image processing
      const response = await this.client.chat.completions.create({
        model: this.imageRecognitionModel,
        messages: fullPrompt,
        temperature: 0.7,
        max_tokens: this.maxTokens
      });

      // Log the model that was actually used
      const usedModel = response.model || this.defaultModel;
      console.log(`Image processed using model: ${usedModel}`);
      
      const content = response.choices[0]?.message?.content;
      console.log(`Received image response from OpenRouter API: ${content?.substring(0, 50)}${content && content.length > 50 ? '...' : ''}`);
      return content || "I'm unable to analyze this image.";
    } catch (error) {
      console.error("Error processing image with OpenRouter API:", error);
      return "Sorry, I encountered an error while processing your image.";
    }
  }
}