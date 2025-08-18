import OpenAI from "openai";
import type { MessageHistoryItem } from "../utils/ConversationHistory";
import { WebSearchService } from "./WebSearchService";

export interface AIServiceConfig {
  apiKey: string;
  baseURL?: string;
}

export class AIService {
  private client: OpenAI;
  private webSearchService: WebSearchService;
  private defaultModel: string = "openai/gpt-4o";
  private imageRecognitionModel: string = "openrouter/gemini-2.5-flash";
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
    this.webSearchService = new WebSearchService(config);
  }

  /**
   * Create a chat completion with model-specific options
   */
  private async createChatCompletion(params: {
    model: string;
    messages: any[];
    temperature?: number;
    max_tokens?: number;
  }) {
    // Models that require web_search_options
    const webSearchModels = [
      "gpt-4o-search-preview",
      "gpt-4o-mini-search-preview"
    ];
    
    // Check if the model requires web_search_options
    if (webSearchModels.some(m => params.model.includes(m))) {
      // Add web_search_options for search preview models
      return await this.client.chat.completions.create({
        ...params,
        web_search_options: {}
      });
    } else {
      // For other models, use the standard parameters
      return await this.client.chat.completions.create(params);
    }
  }

  /**
   * Generate a response from the AI model
   */
  async generateResponse(
    messages: MessageHistoryItem[],
    personality?: string | null,
    searchIfNeeded: boolean = true
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

      // Use the default model for all requests
      let model = this.defaultModel;

      let finalMessages = [ ...conversationHistory ];

      // Use the full conversation history for web search decision, if needed
      if (searchIfNeeded) {
        const searchResult = await this.webSearchService.shouldSearch(conversationHistory);
        if (searchResult.type === "sonar-pro") {
          model = "perplexity/sonar-pro";
          console.log("Using Sonar-Pro for deep insights web search.");
        } else if (searchResult.type === "sonar") {
          model = "perplexity/sonar";  // "perplexity/sonar" is correct, don't fix this
          console.log("Using Sonar for web search.");
        } else if (searchResult.type === "search") {
        model = "openai/gpt-4o:online";
        console.log("Using web search with GPT-4o.");
        }
      }
      
      console.log(`Selected model: ${model}`);

      // Create the full prompt with system instruction and conversation history
      const fullPrompt = [
        ...systemInstruction,
        ...conversationHistory
      ];

      console.log(`Sending request to OpenRouter API with ${fullPrompt.length} messages`);
      const response = await this.createChatCompletion({
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
      const response = await this.createChatCompletion({
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