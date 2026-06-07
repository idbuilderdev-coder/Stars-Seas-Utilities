import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, warningEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin to double your money! Double or Nothing!')
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Initial bet amount')
                .setRequired(true)
                .setMinValue(1)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const initialBet = interaction.options.getInteger("amount");

        // Fetch player's economy data
        const userData = await getEconomyData(client, guildId, userId);

        if (userData.wallet < initialBet) {
            throw createError(
                "Insufficient funds",
                ErrorTypes.VALIDATION,
                `You only have $${userData.wallet.toLocaleString()} in your wallet, but you are trying to bet $${initialBet.toLocaleString()}.`,
                { required: initialBet, current: userData.wallet }
            );
        }

        // 1. Deduct the initial bet at the start of the game
        userData.wallet -= initialBet;
        await setEconomyData(client, guildId, userId, userData);

        let currentWinnings = initialBet * 2;
        let round = 1;

        // 2. First Toss (50:50)
        const isWin = Math.random() < 0.5;

        if (!isWin) {
            // Instant loss on the first flip
            const loseEmbed = errorEmbed(
                "🪙 The Coin Spins... and You LOST!",
                `Too bad, your first toss failed. You lost your bet of **$${initialBet.toLocaleString()}**.`
            );
            return await InteractionHelper.safeEditReply(interaction, { embeds: [loseEmbed] });
        }

        // 3. Helper functions for Embeds and Buttons to keep the code clean
        const getWinEmbed = (winnings, currentRound) => {
            return successEmbed(
                `🪙 WINNER! (Round ${currentRound})`,
                `The coin landed on the right side! Your money is now **$${winnings.toLocaleString()}**.\n\nDo you want to **Cash Out** or take the **Double Risk**?`
            ).setFooter({ text: "Time to choose: 30 seconds. Defaults to Cash Out if ignored." });
        };

        const getButtons = (disabled = false) => {
            const cashOutBtn = new ButtonBuilder()
                .setCustomId('cf_cashout')
                .setLabel('💰 Cash Out')
                .setStyle(ButtonStyle.Success)
                .setDisabled(disabled);

            const doubleBtn = new ButtonBuilder()
                .setCustomId('cf_double')
                .setLabel('🎲 Double Risk!')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(disabled);

            return new ActionRowBuilder().addComponents(cashOutBtn, doubleBtn);
        };

        // Send the first win embed and the action row with buttons
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [getWinEmbed(currentWinnings, round)],
            components: [getButtons(false)]
        });

        // Fetch the reply message to attach the Collector
        const message = await interaction.fetchReply();

        // 4. Create a Collector to listen for button clicks specific to this user
        const collector = message.createMessageComponentCollector({
            filter: i => i.user.id === userId, // Only the original player can click
            time: 30000 // 30-second timer
        });

        collector.on('collect', async i => {
            // Acknowledge the button click to Discord
            await i.deferUpdate();

            if (i.customId === 'cf_cashout') {
                collector.stop('cashout'); // Stop collector with reason 'cashout'
            } 
            else if (i.customId === 'cf_double') {
                round++;
                const winDouble = Math.random() < 0.5; // Odds remain 50:50

                if (winDouble) {
                    currentWinnings *= 2; // Double the prize money
                    collector.resetTimer(); // Reset the timer back to 30 seconds

                    await interaction.editReply({
                        embeds: [getWinEmbed(currentWinnings, round)],
                        components: [getButtons(false)]
                    });
                } else {
                    collector.stop('lose'); // Stop collector because the player lost
                }
            }
        });

        // 5. Handle what happens when the game ends (Win/Lose/Timeout)
        collector.on('end', async (collected, reason) => {
            let finalEmbed;
            
            // Fetch fresh data again to prevent money duplication bugs during the 30s window
            const freshUserData = await getEconomyData(client, guildId, userId);

            if (reason === 'lose') {
                finalEmbed = errorEmbed(
                    "💥 BOOM! You Got Too Greedy!",
                    `In Round ${round}, the coin landed on the wrong side. You **lost all your winnings** ($${currentWinnings.toLocaleString()}) and your initial bet.`
                );
            } else {
                // reason === 'cashout' or 'time' (timeout)
                freshUserData.wallet += currentWinnings; // Add the winnings to the wallet
                await setEconomyData(client, guildId, userId, freshUserData);
                
                const timeoutMsg = reason === 'time' ? "\n*(Time expired - Auto Cashed Out)*" : "";
                finalEmbed = successEmbed(
                    "💸 Successfully Cashed Out!",
                    `You stopped at Round ${round} and walked away with **$${currentWinnings.toLocaleString()}**!${timeoutMsg}`
                );
            }

            // Update the final message and disable the buttons
            await interaction.editReply({
                embeds: [finalEmbed],
                components: [getButtons(true)] 
            });
        });

    }, { command: 'coinflip' })
};
