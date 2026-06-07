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
    // UBAH 1: Memakai addUserOption agar wajib pilih orang (mention)
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

      // UBAH 2: Menggunakan getUser untuk mengambil data akunnya
      const user1 = interaction.options.getUser("user1");
      const user2 = interaction.options.getUser("user2");

      // Cek apakah user nge-ship dengan dirinya sendiri
      if (user1.id === user2.id) {
        const embed = warningEmbed(
          "💖 Ship Score",
          `**${user1.username}** can't be shipped with themselves! Please choose two different people.`
        );
        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      // Menggabungkan ID mereka agar hasilnya konsisten walaupun urutan dibalik
      const sortedIds = [user1.id, user2.id].sort();
      const combination = sortedIds.join("-");
      
      let score = stringToHash(combination) % 101;

      // --- CHEAT CODE DIMULAI DI SINI ---
      // Cukup masukkan angka ID saja karena kita membandingkan dengan user.id
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

      // Menampilkan mention berwarna biru di pesan Embed menggunakan format <@ID>
      const embed = successEmbed(
        `💖 Ship Score`,
        `<@${user1.id}> vs <@${user2.id}>\n\nCompatibility: **${score}%**\n\n\`${progressBar}\`\n\n*${description}*`,
      );

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
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
