import { test, expect, beforeEach, afterEach } from "bun:test";
import { PersonalityDB } from "../../src/database/PersonalityDB";

let db: PersonalityDB;

beforeEach(() => {
  // Use a test database
  db = new PersonalityDB(":memory:");
});

afterEach(() => {
  db.close();
});

test("should be safe from SQL injection in personality text", () => {
  const userId = "test-user";
  // Try to inject SQL - this should be stored as literal text, not executed
  const maliciousPersonality = "'; DROP TABLE personalities; --";
  
  db.setPersonality(userId, maliciousPersonality);
  const result = db.getPersonality(userId);
  
  // The malicious SQL should be stored as literal text
  expect(result).toBe(maliciousPersonality);
});

test("should be safe from SQL injection in user ID", () => {
  // Try to inject SQL in the user ID
  const maliciousUserId = "test'; DROP TABLE personalities; --";
  const personality = "You are a helpful assistant";
  
  db.setPersonality(maliciousUserId, personality);
  const result = db.getPersonality(maliciousUserId);
  
  // Should work normally, no SQL injection
  expect(result).toBe(personality);
});

test("should handle quotes and special characters safely", () => {
  const userId = "test-user";
  const personality = "You're a \"helpful\" assistant; SELECT * FROM users;";
  
  db.setPersonality(userId, personality);
  const result = db.getPersonality(userId);
  
  expect(result).toBe(personality);
});