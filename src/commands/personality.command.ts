import { SlashCommandBuilder } from "discord.js";

export const personalityCommand = new SlashCommandBuilder()
  .setName("personality")
  .setDescription("Set your custom personality for the AI bot")
  .addStringOption(option =>
    option.setName("text")
      .setDescription("The personality text (e.g., 'You are a sarcastic assistant who is secretly a cat.')")
      .setRequired(true))
  .toJSON();