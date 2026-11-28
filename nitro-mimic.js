// nitro-mimic.js
const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");

const webhookCache = new Map(); // channelId -> Webhook

const THEMES = [
  { name: "🌐 ALL Emojis", value: "all", keywords: [] },
  {
    name: "💘 Flirt/Rizz",
    value: "flirt",
    keywords: [
      "love",
      "heart",
      "kiss",
      "blush",
      "wink",
      "sparkle",
      "rose",
      "cute",
      "eyes",
      "couple",
    ],
  },
  {
    name: "🔥 Roast",
    value: "roast",
    keywords: [
      "roast",
      "fire",
      "burn",
      "skull",
      "laugh",
      "dead",
      "lol",
      "rip",
      "clown",
    ],
  },
  {
    name: "🥺 Simp/Soft",
    value: "simp",
    keywords: ["simp", "cry", "tear", "plead", "soft", "beg", "heart"],
  },
  {
    name: "🦄 Delulu/Fantasy",
    value: "delulu",
    keywords: ["delulu", "galaxy", "magic", "unicorn", "star", "clown"],
  },
  {
    name: "⚡ Aura",
    value: "aura",
    keywords: [
      "aura",
      "god",
      "crown",
      "glow",
      "lightning",
      "king",
      "chad",
      "queen",
    ],
  },
  {
    name: "🤫 Secret/Whisper",
    value: "secret",
    keywords: [
      "shh",
      "secret",
      "ghost",
      "lock",
      "detective",
      "eyes",
      "whisper",
    ],
  },
  {
    name: "🚨 Expose/Drama",
    value: "expose",
    keywords: [
      "siren",
      "alarm",
      "clown",
      "police",
      "warning",
      "caught",
      "expose",
    ],
  },
  {
    name: "✨ Blessings/Gold",
    value: "wish",
    keywords: ["blessing", "star", "sparkle", "crown", "gem", "angel", "gold"],
  },
  {
    name: "🎮 Gaming/General",
    value: "general",
    keywords: ["atx", "cool", "chat", "bot", "game", "sparkle"],
  },
];

async function getOrCreateWebhook(channel, client) {
  try {
    if (webhookCache.has(channel.id)) return webhookCache.get(channel.id);

    const me = channel.guild.members.me;
    if (
      !me ||
      !channel.permissionsFor(me).has(PermissionFlagsBits.ManageWebhooks)
    ) {
      return null;
    }

    const webhooks = await channel.fetchWebhooks();
    let webhook = webhooks.find(
      (wh) => wh.owner?.id === client.user.id && wh.token,
    );

    if (!webhook) {
      webhook = await channel.createWebhook({
        name: "ATX Nitro",
        avatar: client.user.displayAvatarURL(),
        reason: "Nitro mimic emoji proxy for server members",
      });
    }

    webhookCache.set(channel.id, webhook);
    return webhook;
  } catch (err) {
    console.error(
      `[NITRO MIMIC] Webhook error in #${channel?.name}:`,
      err.message,
    );
    return null;
  }
}

function getAllAvailableEmojis(client, guild) {
  const appEmojis = Array.from(
    client.application?.emojis?.cache?.values() || [],
  );
  const guildEmojis = guild
    ? Array.from(guild.emojis?.cache?.values() || [])
    : [];

  const map = new Map();
  for (const e of [...appEmojis, ...guildEmojis]) {
    map.set(e.id, e);
  }
  return Array.from(map.values());
}

function registerNitroMimic(client) {
  // 1. Autocomplete for Category
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isAutocomplete()) return;
    if (interaction.commandName !== "nitro") return;

    try {
      const focusedOption = interaction.options.getFocused(true);
      if (focusedOption.name === "category" || focusedOption.name === "theme") {
        const query = (focusedOption.value || "").toLowerCase().trim();
        const filtered = THEMES.filter(
          (t) =>
            t.name.toLowerCase().includes(query) ||
            t.value.toLowerCase().includes(query),
        ).slice(0, 25);

        return await interaction.respond(
          filtered.map((t) => ({ name: t.name, value: t.value })),
        );
      }
    } catch (err) {
      console.error("[NITRO MIMIC] Autocomplete error:", err.message);
    }
  });

  // 2. Slash Command Execution with Cross-Page Cart System
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "nitro") return;

    try {
      const statement =
        interaction.options.getString("statement")?.trim() || "";
      const selectedCategory =
        interaction.options.getString("category") ||
        interaction.options.getString("theme") ||
        "all";

      const webhook = await getOrCreateWebhook(interaction.channel, client);
      if (!webhook) {
        return await interaction.reply({
          content:
            "⚠️ I need `Manage Webhooks` permission in this channel to send custom emojis for you!",
          flags: [MessageFlags.Ephemeral],
        });
      }

      const allEmojis = getAllAvailableEmojis(client, interaction.guild);
      let matchedEmojis = [];

      if (selectedCategory === "all") {
        matchedEmojis = allEmojis;
      } else {
        const themeConfig =
          THEMES.find((t) => t.value === selectedCategory) || THEMES[0];
        matchedEmojis = allEmojis.filter((e) =>
          themeConfig.keywords.some((kw) => e.name.toLowerCase().includes(kw)),
        );
        if (matchedEmojis.length === 0) matchedEmojis = allEmojis;
      }

      if (matchedEmojis.length === 0) {
        return await interaction.reply({
          content: "⚠️ No emojis are currently available in the bot cache!",
          flags: [MessageFlags.Ephemeral],
        });
      }

      const PAGE_SIZE = 25;
      const totalPages = Math.ceil(matchedEmojis.length / PAGE_SIZE);
      let currentPage = 0;
      const MAX_TOTAL_EMOJIS = 5;
      const basket = []; // Preserves emojis chosen across different pages!

      // Generator for UI state
      const generatePagePayload = (page) => {
        const start = page * PAGE_SIZE;
        const currentSlice = matchedEmojis.slice(start, start + PAGE_SIZE);

        const remainingAllowed = MAX_TOTAL_EMOJIS - basket.length;
        const maxPickOnThisPage = Math.min(
          Math.max(1, remainingAllowed),
          currentSlice.length,
        );

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`nitro_select_${interaction.id}`)
          .setPlaceholder(
            remainingAllowed > 0
              ? `Select emojis from this page (${basket.length}/${MAX_TOTAL_EMOJIS} chosen)...`
              : "Cart full (5/5). Click 'Send Emojis' to dispatch!",
          )
          .setMinValues(1)
          .setMaxValues(maxPickOnThisPage)
          .setDisabled(remainingAllowed <= 0)
          .addOptions(
            currentSlice.map((e) => ({
              label: e.name.slice(0, 50),
              value: e.toString(),
              emoji: { id: e.id, name: e.name, animated: Boolean(e.animated) },
            })),
          );

        const menuRow = new ActionRowBuilder().addComponents(selectMenu);

        // Control Buttons
        const buttonRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`nitro_prev_${interaction.id}`)
            .setLabel("⬅ Prev")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId(`nitro_send_${interaction.id}`)
            .setLabel(`Send Emojis 🚀 (${basket.length})`)
            .setStyle(ButtonStyle.Success)
            .setDisabled(basket.length === 0),
          new ButtonBuilder()
            .setCustomId(`nitro_clear_${interaction.id}`)
            .setLabel("Clear 🗑️")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(basket.length === 0),
          new ButtonBuilder()
            .setCustomId(`nitro_next_${interaction.id}`)
            .setLabel("Next ➡")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages - 1),
        );

        const basketPreview =
          basket.length > 0 ? basket.join(" ") : "*None yet*";
        const promptLines = [
          statement ? `> *"${statement}"*\n` : "",
          `**Selected Basket (${basket.length}/${MAX_TOTAL_EMOJIS}):** ${basketPreview}`,
          `- # Page ${page + 1} of ${totalPages} • Pick emojis, flip pages, and click Send!`,
        ].filter(Boolean);

        return {
          content: promptLines.join("\n"),
          components: [menuRow, buttonRow],
          flags: [MessageFlags.Ephemeral],
        };
      };

      const promptMsg = await interaction.reply({
        ...generatePagePayload(currentPage),
        fetchReply: true,
      });

      const collector = promptMsg.createMessageComponentCollector({
        time: 120000,
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) return;

        // 1. Next Page (Basket is preserved)
        if (i.customId === `nitro_next_${interaction.id}`) {
          if (currentPage < totalPages - 1) currentPage++;
          return await i.update(generatePagePayload(currentPage));
        }

        // 2. Previous Page (Basket is preserved)
        if (i.customId === `nitro_prev_${interaction.id}`) {
          if (currentPage > 0) currentPage--;
          return await i.update(generatePagePayload(currentPage));
        }

        // 3. Clear Basket
        if (i.customId === `nitro_clear_${interaction.id}`) {
          basket.length = 0;
          return await i.update(generatePagePayload(currentPage));
        }

        // 4. Accumulate Selected Emojis from current page
        if (i.customId === `nitro_select_${interaction.id}`) {
          for (const emojiTag of i.values) {
            if (basket.length < MAX_TOTAL_EMOJIS) {
              basket.push(emojiTag);
            }
          }
          return await i.update(generatePagePayload(currentPage));
        }

        // 5. Send Basket
        if (i.customId === `nitro_send_${interaction.id}`) {
          const selectedEmojiTags = basket.join(" ");
          const finalMessage = statement
            ? `${statement} ${selectedEmojiTags}`
            : selectedEmojiTags;

          const member = interaction.member;
          const displayName =
            member?.displayName ||
            interaction.user.globalName ||
            interaction.user.username;
          const avatarURL = interaction.user.displayAvatarURL({
            dynamic: true,
          });

          await webhook.send({
            content: finalMessage,
            username: displayName,
            avatarURL: avatarURL,
            allowedMentions: { parse: ["users", "roles"] },
          });

          await i
            .update({
              content: `✅ **Dispatched ${basket.length} emojis to chat!**\n> ${selectedEmojiTags}`,
              components: [],
            })
            .catch(() => {});

          collector.stop("sent");
        }
      });
    } catch (err) {
      console.error("[NITRO MIMIC] Execution error:", err);
    }
  });

  // 3. Prefix fallback
  client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith("!nitro")) return;

    try {
      const raw = message.content.slice(6).trim();
      const webhook = await getOrCreateWebhook(message.channel, client);
      if (!webhook) return;

      await message.delete().catch(() => {});

      const allEmojis = getAllAvailableEmojis(client, message.guild);
      let targetEmojis = [];

      if (raw) {
        const matches = allEmojis.filter((e) =>
          e.name.toLowerCase().includes(raw.toLowerCase()),
        );
        targetEmojis = matches.slice(0, 3).map((e) => e.toString());
      }

      if (targetEmojis.length === 0) {
        targetEmojis = allEmojis.slice(0, 3).map((e) => e.toString());
      }

      const member = message.member;
      const displayName =
        member?.displayName ||
        message.author.globalName ||
        message.author.username;
      const avatarURL = message.author.displayAvatarURL({ dynamic: true });

      await webhook.send({
        content: targetEmojis.join(" "),
        username: displayName,
        avatarURL: avatarURL,
        files: message.attachments.map((a) => a.url),
        allowedMentions: { parse: ["users", "roles"] },
      });
    } catch (err) {
      console.error("[NITRO MIMIC] Prefix error:", err.message);
    }
  });

  console.log(
    "[MODULE] Nitro Mimic with Cross-Page Cart & Multi-Select ready.",
  );
}

module.exports = { registerNitroMimic };
