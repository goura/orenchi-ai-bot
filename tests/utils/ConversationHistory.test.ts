import { test, expect } from "bun:test";
import { ConversationHistory } from "../../src/utils/ConversationHistory";
import type { MessageHistoryItem } from "../../src/utils/ConversationHistory";

test("should initialize with empty history", () => {
  const history = new ConversationHistory();
  expect(history.getHistory()).toEqual([]);
});

test("should add messages to history", () => {
  const history = new ConversationHistory();
  
  const userMessage: MessageHistoryItem = {
    role: "user",
    content: "Hello"
  };
  
  const assistantMessage: MessageHistoryItem = {
    role: "assistant",
    content: "Hi there!"
  };
  
  history.addMessage(userMessage);
  history.addMessage(assistantMessage);
  
  const result = history.getHistory();
  expect(result).toEqual([userMessage, assistantMessage]);
});

test("should limit history to maximum size", () => {
  const history = new ConversationHistory(2);
  
  const messages: MessageHistoryItem[] = [
    { role: "user", content: "Message 1" },
    { role: "assistant", content: "Response 1" },
    { role: "user", content: "Message 2" },
    { role: "assistant", content: "Response 2" }
  ];
  
  messages.forEach(msg => history.addMessage(msg));
  
  const result = history.getHistory();
  // Should only contain the last 2 messages
  expect(result).toEqual([
    { role: "user", content: "Message 2" },
    { role: "assistant", content: "Response 2" }
  ]);
});

test("should clear history", () => {
  const history = new ConversationHistory();
  
  history.addMessage({ role: "user", content: "Hello" });
  expect(history.getHistory()).toHaveLength(1);
  
  history.clear();
  expect(history.getHistory()).toEqual([]);
});

test("should format history as string", () => {
  const history = new ConversationHistory();
  
  history.addMessage({ role: "user", content: "Hello" });
  history.addMessage({ role: "assistant", content: "Hi there!" });
  
  const result = history.getFormattedHistory();
  expect(result).toBe("user: Hello\nassistant: Hi there!");
});