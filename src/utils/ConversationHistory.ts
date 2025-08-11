// Utility functions for handling conversation history and message processing
export interface MessageHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export class ConversationHistory {
  private history: MessageHistoryItem[] = [];
  private readonly maxHistory: number;

  constructor(maxHistory: number = 10) {
    this.maxHistory = maxHistory;
  }

  addMessage(item: MessageHistoryItem): void {
    this.history.push(item);
    
    // Keep only the most recent messages
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  getHistory(): MessageHistoryItem[] {
    return [...this.history];
  }

  clear(): void {
    this.history = [];
  }

  getFormattedHistory(): string {
    return this.history
      .map(item => `${item.role}: ${item.content}`)
      .join("\n");
  }
}