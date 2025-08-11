import { SlashCommandBuilder } from "discord.js";

export const startAiChatCommand = new SlashCommandBuilder()
  .setName("start-ai-chat")
  .setDescription("Create a private AI chat channel for you")
  .toJSON();