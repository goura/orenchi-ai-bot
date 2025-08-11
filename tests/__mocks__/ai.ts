// Mock for AIService
export class MockAIService {
  async generateResponse(messages: any[], personality?: string | null): Promise<string> {
    // Simple mock response based on the request
    const lastMessage = messages[messages.length - 1];
    const userText = lastMessage?.content || "";
    
    if (personality) {
      return `Mock response with personality: ${personality}`;
    }
    
    // Create a mock response
    return `Mock response to: ${userText}`;
  }

  async processImage(
    imageURL: string,
    messages: any[],
    personality?: string | null
  ): Promise<string> {
    return "Image processing is not yet implemented.";
  }
}