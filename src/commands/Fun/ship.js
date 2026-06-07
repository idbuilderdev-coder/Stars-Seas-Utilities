import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';

function stringToHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

export default {
  data: new SlashCommandBuilder()
    .setName("ship")
    .setDescription("Calculate the compatibility score between two people.")
    .addUserOption((option) =>
      option
        .setName("user1")
        .setDescription("The first user to ship.")
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("user2")
        .setDescription("The second user to ship.")
        .setRequired(true)
    ),
  category: 'Fun',

  async execute(interaction, config, client) {
    try {
      await InteractionHelper.safeDefer(interaction);

      const user1 = interaction.options.getUser("user1");
      const user2 = interaction.options.getUser("user2");

      if (user1.id === user2.id) {
        const embed = warningEmbed(
          "💖 Ship Score",
          `**${user1.globalName || user1.username}** can't be shipped with themselves! Please choose two different people.`
        );
        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      const sortedIds = [user1.id, user2.id].sort();
      const combination = sortedIds.join("-");
      
      let score = stringToHash(combination) % 101;

      // --- CHEAT CODE ---
      const idKamu = "1444580570423361668";       
      const idTeman = "975687177235230790";   

      const isVipMatch = 
        (user1.id === idKamu && user2.id === idTeman) ||
        (user1.id === idTeman && user2.id === idKamu);

      if (isVipMatch) {
        score = 98;
      }
      // --- CHEAT CODE SELESAI ---

      let description;
      if (score === 100) {
        description = "Soulmates! It's destiny, they belong together!";
      } else if (score >= 80) {
        description = "A perfect match! Get the wedding bells ready!";
      } else if (score >= 60) {
        description = "Solid chemistry. Definitely worth exploring!";
      } else if (score >= 40) {
        description = "Just friends status. Maybe with time?";
      } else if (score >= 20) {
        description = "It's a struggle. They might need space.";
      } else {
        description = "Zero compatibility. Run for the hills!";
      }

      const progressBar =
        "█".repeat(Math.floor(score / 10)) +
        "░".repeat(10 - Math.floor(score / 10));

      // Kotak embed fokus menampilkan persentase dan bar saja
      const embed = successEmbed(
        `💖 Ship Score`,
        `Compatibility: **${score}%**\n\n\`${progressBar}\`\n\n*${description}*`,
      );

      // Kirim pesan dengan menaruh MENTION di luar embed (di bagian content)
      await InteractionHelper.safeEditReply(interaction, { 
        content: `💖 **Ship:** <@${user1.id}> vs <@${user2.id}>`,
        embeds: [embed],
        allowedMentions: { users: [] } // <--- KUNCI RAHASIA: Ini yang bikin mention-nya GAK AKAN NGE-PING orangnya!
      });

      logger.debug(`Ship command executed by user ${interaction.user.id} in guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Ship command error:', error);
      await handleInteractionError(interaction, error, {
        commandName: 'ship',
        source: 'ship_command'
      });
    }
  },
};
