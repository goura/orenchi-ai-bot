import OpenAI from "openai";

export interface WebSearchServiceConfig {
  apiKey: string;
  baseURL?: string;
}

export type WebSearchResult = 
  | { type: "search", query: string }
  | { type: "none" }
  | { type: "sonar", query: string };

export class WebSearchService {
  private client: OpenAI;

  constructor(config: WebSearchServiceConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "X-Title": "orenchi-ai-bot"
      }
    });
  }

  async shouldSearch(messages: { role: string; content: string }[]): Promise<WebSearchResult> {
    // Create a conversation context for the decision-making AI
    const conversationContext = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');

    const prompt = `
      You are a decision-making AI. Based on the user's conversation history, decide whether to use a web search.
      The conversation history is:
      ${conversationContext}

      You have three options:
      1. SONAR: If the message is a question about recent facts, news, or unpopular specialized facts.
      2. SEARCH: If the message is a question about less-known things that would benefit from a web search.
      3. NONE: If the user is greeting, conversing, or asking about well-known facts (geographical, historical, scientific).

      Respond with a JSON object in the format {"decision": "SONAR" | "SEARCH" | "NONE", "query": "search query" | null}.
      The "query" should be a concise search query if the decision is SONAR or SEARCH, otherwise null.
    `;

    try {
      const response = await this.client.chat.completions.create({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 100,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.warn("Empty response from pre-flight decision-making AI");
        return { type: "none" };
      }

      const result = JSON.parse(content);
      
      if (result.decision === "SONAR" && result.query) {
        return { type: "sonar", query: result.query };
      } else if (result.decision === "SEARCH" && result.query) {
        return { type: "search", query: result.query };
      } else {
        return { type: "none" };
      }
    } catch (error) {
      console.error("Error in pre-flight decision-making:", error);
      // Fallback to none in case of any error
      return { type: "none" };
    }
  }
}