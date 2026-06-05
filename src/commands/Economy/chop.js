import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const CHOP_COOLDOWN = 1000;

const BASE_MIN_REWARD = 250;
const BASE_MAX_REWARD = 900;

const AXE_MULTIPLIER = 1.2;
const DIAMOND_AXE_MULTIPLIER = 2.0;

const CHOP_LOCATIONS = [
    "dense forest",
    "pine woods",
    "ancient jungle",
    "mystic grove",
    "mountain forest",
];

const TREES = [
    "Oak Tree",
    "Pine Tree",
    "Birch Tree",
    "Maple Tree",
    "Ancient Tree",
];

export default {
    data: new SlashCommandBuilder()
        .setName('chop')
        .setDescription('Chop trees to earn money'),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const now = Date.now();

        const userData = await getEconomyData(client, guildId, userId);

        const lastChop = userData.lastChop || 0;

        const hasDiamondAxe = userData.inventory["diamond_axe"] || 0;
        const hasAxe = userData.inventory["axe"] || 0;

        if (now < lastChop + CHOP_COOLDOWN) {
            const remaining = lastChop + CHOP_COOLDOWN - now;

            const hours = Math.floor(
                remaining / (1000 * 60 * 60)
            );

            const minutes = Math.floor(
                (remaining % (1000 * 60 * 60)) /
                (1000 * 60)
            );

            throw createError(
                "Woodcutting cooldown active",
                ErrorTypes.RATE_LIMIT,
                `Your axe is resting. Wait **${hours}h ${minutes}m** before chopping again.`,
                {
                    remaining,
                    cooldownType: 'chop'
                }
            );
        }

        const baseEarned =
            Math.floor(
                Math.random() *
                (BASE_MAX_REWARD - BASE_MIN_REWARD + 1)
            ) + BASE_MIN_REWARD;

        let finalEarned = baseEarned;
        let multiplierMessage = "";

        if (hasDiamondAxe > 0) {
            finalEarned = Math.floor(
                baseEarned * DIAMOND_AXE_MULTIPLIER
            );

            multiplierMessage =
                "\n💎 **Diamond Axe Bonus: +100%**";
        } else if (hasAxe > 0) {
            finalEarned = Math.floor(
                baseEarned * AXE_MULTIPLIER
            );

            multiplierMessage =
                "\n🪓 **Axe Bonus: +20%**";
        }

        const location =
            CHOP_LOCATIONS[
                Math.floor(
                    Math.random() *
                    CHOP_LOCATIONS.length
                )
            ];

        const tree =
            TREES[
                Math.floor(
                    Math.random() *
                    TREES.length
                )
            ];

        userData.wallet += finalEarned;
        userData.lastChop = now;

        await setEconomyData(
            client,
            guildId,
            userId,
            userData
        );

        const embed = successEmbed(
            "🪓 Woodcutting Successful!",
            `You chopped down a **${tree}** in the **${location}** and sold the wood for **$${finalEarned.toLocaleString()}**!${multiplierMessage}`
        )
            .addFields({
                name: "💵 New Cash Balance",
                value: `$${userData.wallet.toLocaleString()}`,
                inline: true,
            })
            .setFooter({
                text: "Next chop available in 30 minutes."
            });

        await InteractionHelper.safeEditReply(
            interaction,
            {
                embeds: [embed]
            }
        );
    }, {
        command: 'chop'
    })
};
