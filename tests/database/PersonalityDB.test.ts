import { test, expect, beforeEach, afterEach } from "bun:test";
import { PersonalityDB } from "../../src/database/PersonalityDB";
import { existsSync, rmSync } from "node:fs";

let db: PersonalityDB;

beforeEach(() => {
  // Use a test database
  db = new PersonalityDB(":memory:");
});

afterEach(() => {
  db.close();
});

test("should initialize database with personalities table", () => {
  // The database should be initialized with the personalities table
  const result = db.getPersonality("test-user");
  expect(result).toBeNull();
});

test("should set and get personality", () => {
  const userId = "test-user";
  const personality = "You are a helpful assistant";
  
  db.setPersonality(userId, personality);
  const result = db.getPersonality(userId);
  
  expect(result).toBe(personality);
});

test("should overwrite existing personality", () => {
  const userId = "test-user";
  const personality1 = "You are a helpful assistant";
  const personality2 = "You are a sarcastic assistant";
  
  db.setPersonality(userId, personality1);
  db.setPersonality(userId, personality2);
  
  const result = db.getPersonality(userId);
  expect(result).toBe(personality2);
});

test("should return null for non-existent user", () => {
  const result = db.getPersonality("non-existent-user");
  expect(result).toBeNull();
});

test("should create database file and initialize table when file doesn't exist", () => {
  const testDbPath = "test-personalities.db";
  
  // Remove test database file if it exists
  if (existsSync(testDbPath)) {
    rmSync(testDbPath);
  }
  
  // Create new database instance with file path
  const fileDb = new PersonalityDB(testDbPath);
  
  // Verify database file is created
  expect(existsSync(testDbPath)).toBe(true);
  
  // Verify we can use the database (table should be initialized)
  const result = fileDb.getPersonality("test-user");
  expect(result).toBeNull();
  
  // Clean up
  fileDb.close();
  rmSync(testDbPath);
});

test("should return null when getting personality for user with no personality set", () => {
  // Test with a user ID that has never had a personality set
  const result = db.getPersonality("user-without-personality");
  expect(result).toBeNull();
});