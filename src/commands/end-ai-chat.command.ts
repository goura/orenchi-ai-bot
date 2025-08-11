import { SlashCommandBuilder } from "discord.js";

export const endAiChatCommand = new SlashCommandBuilder()
  .setName("end-ai-chat")
  .setDescription("Delete your private AI chat channel")
  .toJSON();