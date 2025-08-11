// Mock for Gemini API responses
export interface GeminiMessage {
  role: "user" | "model";
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
}

export interface GeminiRequest {
  contents: GeminiMessage[];
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
}

export class MockGeminiClient {
  async generateContent(request: GeminiRequest): Promise<GeminiResponse> {
    // Simple mock response based on the request
    const userMessage = request.contents.find(msg => msg.role === "user");
    const userText = userMessage?.parts.find(part => "text" in part)?.text || "";
    
    // Create a mock response
    return {
      candidates: [{
        content: {
          parts: [{
            text: `Mock response to: ${userText}`
          }]
        }
      }]
    };
  }
}