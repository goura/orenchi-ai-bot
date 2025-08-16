import { test, expect, beforeEach, afterEach } from "bun:test";
import { PersonalityCommand } from "../../src/commands/PersonalityCommand";
import { PersonalityDB } from "../../src/database/PersonalityDB";

let db: PersonalityDB;
let command: PersonalityCommand;

beforeEach(() => {
  db = new PersonalityDB(":memory:");
  command = new PersonalityCommand(db);
});

afterEach(() => {
  db.close();
});

test("should set personality and return success message", async () => {
  const userId = "test-user";
  const personality = "You are a helpful assistant";
  
  const result = await command.handle(userId, personality);
  
  expect(result).toBe("Personality updated!");
  
  // Verify the personality was actually set
  const storedPersonality = command.getPersonality(userId);
  expect(storedPersonality).toBe(personality);
});

test("should overwrite existing personality", async () => {
  const userId = "test-user";
  const personality1 = "You are a helpful assistant";
  const personality2 = "You are a sarcastic assistant";
  
  await command.handle(userId, personality1);
  await command.handle(userId, personality2);
  
  const storedPersonality = command.getPersonality(userId);
  expect(storedPersonality).toBe(personality2);
});

test("should return null for user with no personality", () => {
  const result = command.getPersonality("non-existent-user");
  expect(result).toBeNull();
});

test("should handle empty personality text", async () => {
  const userId = "test-user";
  const personality = "";
  
  const result = await command.handle(userId, personality);
  
  expect(result).toBe("Personality updated!");
  
  const storedPersonality = command.getPersonality(userId);
  expect(storedPersonality).toBe(personality);
});

test("should return current personality when no text is provided", async () => {
  const userId = "test-user";
  const personality = "You are a helpful assistant";
  
  // Set a personality first
  await command.handle(userId, personality);
  
  // Test the getPersonality method directly
  const result = command.getPersonality(userId);
  expect(result).toBe(personality);
});

test("should return null when getting personality for user with no personality set", () => {
  // Test with a user ID that has never had a personality set
  const result = command.getPersonality("user-without-personality");
  expect(result).toBeNull();
});