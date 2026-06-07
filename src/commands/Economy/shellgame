import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, warningEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const PAYOUT_MULTIPLIER = 3;

export default {
    data: new SlashCommandBuilder()
        .setName('shellgame')
        .setDescription('Guess which cup hides the golden ball!')
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Amount of cash to bet')
                .setRequired(true)
                .setMinValue(1)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const betAmount = interaction.options.getInteger("amount");

        const userData = await getEconomyData(client, guildId, userId);

        if (userData.wallet < betAmount) {
            throw createError(
                "Insufficient funds",
                ErrorTypes.VALIDATION,
                `You only have $${userData.wallet.toLocaleString()} in your wallet, but you are trying to bet $${betAmount.toLocaleString()}.`,
                { required: betAmount, current: userData.wallet }
            );
        }

        // 1. Deduct the bet amount immediately to prevent exploits
        userData.wallet -= betAmount;
        await setEconomyData(client, guildId, userId, userData);

        // 2. Helper function to generate Cup buttons
        const getCupButtons = (disabled = false) => {
            const row = new ActionRowBuilder();
            for (let i = 1; i <= 3; i++) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`cup_${i}`)
                        .setLabel(`Cup ${i}`)
                        .setEmoji('🥤')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(disabled)
                );
            }
            return row;
        };

        // 3. Send the initial game board
        const gameEmbed = createEmbed({
            title: '🥤 Shell Game',
            description: `You placed a bet of **$${betAmount.toLocaleString()}**.\n\nOne of the three cups below hides the golden ball (🎁).\nChoose carefully! If you guess correctly, your money is multiplied by **${PAYOUT_MULTIPLIER}x**!`,
            color: 0xF1C40F // Gold color
        }).setFooter({ text: "You have 30 seconds to choose a cup." });

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [gameEmbed],
            components: [getCupButtons(false)]
        });

        const message = await interaction.fetchReply();

        // 4. Create Collector for the buttons
        const collector = message.createMessageComponentCollector({
            filter: i => i.user.id === userId,
            time: 30000 // 30 seconds to click
        });

        collector.on('collect', async i => {
            await i.deferUpdate(); // Acknowledge the click
            
            // Extract the chosen cup number from customId (e.g., 'cup_2' -> 2)
            const chosenCup = parseInt(i.customId.split('_')[1]);
            
            // Randomize the winning cup (1, 2, or 3)
            const winningCup = Math.floor(Math.random() * 3) + 1;
            const isWin = chosenCup === winningCup;
            
            // Fetch fresh data before modifying to avoid race conditions
            const freshUserData = await getEconomyData(client, guildId, userId);
            
            // Build the visual representation of the cups
            let cupsVisual = "";
            for (let j = 1; j <= 3; j++) {
                if (j === winningCup) cupsVisual += "🎁 ";
                else cupsVisual += "❌ ";
            }

            let resultEmbed;

            if (isWin) {
                const winnings = betAmount * PAYOUT_MULTIPLIER;
                freshUserData.wallet += winnings; // Add winnings to wallet
                
                resultEmbed = successEmbed(
                    "🎉 Perfect Guess!",
                    `**Result:** ${cupsVisual}\n\nAmazing! The golden ball was in **Cup ${winningCup}**.\nYou won **$${winnings.toLocaleString()}**!`
                );
            } else {
                resultEmbed = errorEmbed(
                    "💔 Wrong Cup...",
                    `**Result:** ${cupsVisual}\n\nToo bad, the golden ball was hidden in **Cup ${winningCup}**. You picked Cup ${chosenCup}.\nYou lost your **$${betAmount.toLocaleString()}** bet.`
                );
            }
            
            // Save the final economy data
            await setEconomyData(client, guildId, userId, freshUserData);
            
            // Edit the message with the result and disable the buttons
            await interaction.editReply({
                embeds: [resultEmbed],
                components: [getCupButtons(true)]
            });
            
            collector.stop('clicked'); // Stop the collector gracefully
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                // If they AFK/Timeout, we refund their initial bet to be fair
                const freshUserData = await getEconomyData(client, guildId, userId);
                freshUserData.wallet += betAmount;
                await setEconomyData(client, guildId, userId, freshUserData);
                
                const timeoutEmbed = warningEmbed(
                    "⏰ Time's Up!",
                    `You didn't pick a cup in time. Your bet of **$${betAmount.toLocaleString()}** has been refunded to your wallet.`
                );
                
                await interaction.editReply({
                    embeds: [timeoutEmbed],
                    components: [getCupButtons(true)]
                });
            }
        });

    }, { command: 'shellgame' })
};
