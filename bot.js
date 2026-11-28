// bot.js
require("dotenv").config();
const path = require("path");
const express = require("express");
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  MessageFlags,
} = require("discord.js");

// Services & Models
const {
  connectDB,
  getOrCreateDiscordUser,
  DiscordUser,
  logActivity,
} = require("./services/database");
const User = require("./models/User");
const UserProfile = require("./models/UserProfile");
const { loadAppEmojis, EMOJIS } = require("./config/emojis");
const { registerNitroMimic } = require("./nitro-mimic");
const {
  trackMemberBehavior,
  generateRefinedAiResponse,
} = require("./services/conversationEngine");

// Modular Handlers
const {
  activeGames,
  activeLobbies,
  launchNextRound,
  handleGameCommands,
} = require("./modules/games");
const { evaluateMathGuess } = require("./modules/gameEngines");
const { handleSocialCommands } = require("./modules/social");
const { handleUtilityCommands } = require("./modules/utility");
const { handleIdentityCommands } = require("./modules/identity");

process.on("unhandledRejection", (reason) =>
  console.error("[Process Guard] Unhandled Rejection:", reason),
);
process.on("uncaughtException", (error) =>
  console.error("[Process Guard] Uncaught Exception:", error),
);

// Connect Database
connectDB();

// Initialize Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// Express Web Documentation Server
const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("docs", {
    botName: "ARIX",
    version: "2.4.0",
    serverCount: client?.guilds?.cache?.size || 1,
    latency: client?.ws?.ping || 24,
  });
});

app.get("/health", (_, res) => {
  res.json({
    status: "online",
    service: "ARIX Terminal Core",
    guilds: client?.guilds?.cache?.size || 0,
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`[HTTP CORE] Cyber Terminal running on port ${PORT}`);
});

// Central Command Dispatcher
async function executeCommand(ctx) {
  await getOrCreateDiscordUser(ctx.author, ctx.member);

  const ATX_GUILD_ID = "1330548041974812722";
  const ATX_INVITE_URL = "https://discord.gg/pjzdHKS6Jj";

  // 0. Account Linking Command
  if (ctx.commandName === "connectweb") {
    if (ctx.guild?.id !== ATX_GUILD_ID) {
      return ctx.reply({
        content: [
          `### <:auraloss:1571805296769110056> Server Mismatch Detected`,
          `> Web synchronization is strictly restricted to the official **ATX Family Discord Server**.`,
          ``,
          `Join the server to link your profile and sync your EP:`,
          `👉 [**Join ATX Family Discord**](${ATX_INVITE_URL})`,
          ``,
          `-# Once inside ATX Family, execute \`/connectweb code:<6-digits>\` in any chat channel.`,
        ].join("\n"),
        ephemeral: true,
      });
    }

    const code = (ctx.textInput || ctx.args?.[0] || "").trim();

    if (!code || code.length !== 6) {
      return ctx.reply({
        content:
          "### <:shutupSilentZipped:1571805467670347796> Invalid Verification Code\n> Provide the 6-digit code from your [ATX Website Profile](https://atx-family.onrender.com/profile).\n-# Example: `/connectweb code:749201`",
        ephemeral: true,
      });
    }

    try {
      const now = new Date();
      const webUser = await User.findOne({
        connectionCode: code,
        codeExpiresAt: { $gt: now },
      });

      if (!webUser) {
        return ctx.reply({
          content:
            "### <:auraloss:1571805296769110056> Code Expired or Unrecognized\n> Refresh your [Website Profile](https://atx-family.onrender.com/profile) to generate a fresh 6-digit token and try again.\n-# Verification tokens expire in 5 minutes.",
          ephemeral: true,
        });
      }

      webUser.discordId = ctx.author.id;
      webUser.connectionCode = null;
      webUser.codeExpiresAt = null;
      await webUser.save();

      const dcUser = await DiscordUser.findOneAndUpdate(
        { discordId: ctx.author.id },
        {
          $setOnInsert: {
            username: ctx.author.username,
            tag: ctx.author.tag || ctx.author.username,
          },
          $set: { "chatStats.lastActiveAt": new Date() },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      );

      await UserProfile.findOneAndUpdate(
        { userId: ctx.author.id, guildId: ATX_GUILD_ID },
        {
          $setOnInsert: { userId: ctx.author.id, guildId: ATX_GUILD_ID },
          $set: {
            webUser: webUser._id,
            username: ctx.author.username,
          },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      );

      const totalBotEp = dcUser?.botBalance || 0;
      const webVaultXp = webUser?.xpBalance || 0;

      return ctx.reply({
        content: [
          `### <a:sparklesstars:1571929733770383521> Connected Successfully! <a:approvedCorrect:1572188241245900890>`,
          `─────────────────────────────`,
          `> **<a:flameflicker:1571805360145047622> ${webUser.username} <a:flameflicker:1571805360145047622> ${ctx.author} <a:flameflicker:1571805360145047622>**`,
          `> <a:verifiedBadgeApproved:1571805350925967360> **ATX Family**`,
          `─────────────────────────────`,
          `### <a:diamondgem:1571920814041858149> **EP Collection**`,
          `> <:coingold:1571936733455720518> • **Discord Bal:** ${totalBotEp.toLocaleString()} EP`,
          `> <:coingold:1571936733455720518> • **Website Bal:** ${webVaultXp.toLocaleString()} EP`,
          `> <a:moneybagcoin:1571920822694715492> • **Combined Bal: ${(totalBotEp + webVaultXp).toLocaleString()} EP**`,
          ``,
        ].join("\n"),
      });
    } catch (err) {
      console.error("[CONNECT WEB ERROR]:", err);
      return ctx.reply({
        content:
          "### <:deadSkull:1571908653966041308> Database connection failed. Please retry shortly.",
        ephemeral: true,
      });
    }
  }

  // 1. Mini-Games
  const gameHandled = await handleGameCommands(ctx);
  if (gameHandled) return;

  // 2. Social Commands
  const socialHandled = await handleSocialCommands(ctx);
  if (socialHandled) return;

  // 3. AI & Utilities
  const utilHandled = await handleUtilityCommands(ctx);
  if (utilHandled) return;

  // 4. Identity & Moderation
  await handleIdentityCommands(ctx);
}

// Lifecycle
client.once(Events.ClientReady, async () => {
  console.log(`[DISCORD] ATX Bot is live as ${client.user.tag}`);
  client.user.setActivity("ATX Discord Server ⚔️ 24/7", { type: 3 });

  await loadAppEmojis(client);
  registerNitroMimic(client);
});

// Slash Command Handler
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "nitro") return;

  const isPrivate =
    interaction.commandName === "secret" ||
    interaction.commandName === "report";

  await interaction
    .deferReply({
      flags: isPrivate ? [MessageFlags.Ephemeral] : undefined,
    })
    .catch(() => {});

  const targetUser = interaction.options.getUser("target");
  const timeOption = interaction.options.getString("time");
  const reminderOption = interaction.options.getString("reminder");

  const textInput =
    interaction.options.getString("code") ||
    interaction.options.getString("prompt") ||
    interaction.options.getString("topic") ||
    interaction.options.getString("text") ||
    interaction.options.getString("claim") ||
    interaction.options.getString("statement") ||
    reminderOption ||
    interaction.options.getString("message") ||
    interaction.options.getString("date") ||
    interaction.options.getString("reason");

  const numberInput =
    interaction.options.getInteger("count") ||
    interaction.options.getInteger("hours");

  await executeCommand({
    commandName: interaction.commandName,
    author: interaction.user,
    member: interaction.member,
    channel: interaction.channel,
    guild: interaction.guild,
    args: timeOption ? [timeOption, reminderOption].filter(Boolean) : [],
    targetUser,
    textInput,
    numberInput,
    client,
    isSlash: true,
    reply: async (payload) => {
      try {
        if (typeof payload === "string")
          return await interaction.editReply({ content: payload });
        return await interaction.editReply(payload);
      } catch (err) {
        if (typeof payload === "string")
          return await interaction
            .followUp({ content: payload })
            .catch(() => {});
        return await interaction.followUp(payload).catch(() => {});
      }
    },
    deleteOriginal: null,
  });
});

// Real-Time Chat Message Handler
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  trackMemberBehavior(message).catch(() => {});

  const content = message.content.trim();
  const lower = content.toLowerCase();

  // ==========================================
  // REAL-TIME MINI-GAME EVALUATION
  // ==========================================
  if (activeGames.has(message.channel.id)) {
    const game = activeGames.get(message.channel.id);
    const text = message.content.trim();

    // Emergency Stop
    if (lower === "!stopgame" || lower === "/stopgame") {
      clearTimeout(game.timer);
      if (game.interval) clearInterval(game.interval);
      activeGames.delete(message.channel.id);
      const reveal =
        game.answer ||
        game.word ||
        game.secret ||
        (game.target ? `Target: ${game.target}` : "N/A");
      return message.reply(
        `### <:idcDonotCare:1571805403786772500> Mini-game halted\n-# The solution was **\`${reveal}\`**`,
      );
    }

    // 1. Guess The Number (1-100)
    if (game.type === "guessnumber") {
      const guess = parseInt(text, 10);
      if (!isNaN(guess) && guess >= 1 && guess <= 100) {
        if (guess === game.secret) {
          if (game.isSolving) return;
          game.isSolving = true;
          clearTimeout(game.timer);
          activeGames.delete(message.channel.id);

          await message.react("🎯");
          const updatedUser = await DiscordUser.findOneAndUpdate(
            { discordId: message.author.id },
            { $inc: { botBalance: 75, "gameStats.totalGamesPlayed": 1 } },
            { returnDocument: "after" },
          );

          await UserProfile.findOneAndUpdate(
            { userId: message.author.id },
            { $inc: { botBalance: 75 } },
          ).catch(() => {});

          return message.reply(
            `🎉 **BINGO!** ${message.author} guessed the exact number **\`${game.secret}\`**! \n💰 **+75 EP** credited! • New Bal: **${(updatedUser?.botBalance || 0).toLocaleString()} EP**`,
          );
        } else if (guess < game.secret) {
          await message.react("🔼");
        } else {
          await message.react("🔽");
        }
      }
    }

    // 2. Math Rush
    if (game.type === "mathrush") {
      if (evaluateMathGuess(text, game.numbers, game.target)) {
        if (game.isSolving) return;
        game.isSolving = true;
        clearTimeout(game.timer);
        activeGames.delete(message.channel.id);

        const updatedUser = await DiscordUser.findOneAndUpdate(
          { discordId: message.author.id },
          { $inc: { botBalance: 75, "gameStats.totalGamesPlayed": 1 } },
          { returnDocument: "after" },
        );

        await UserProfile.findOneAndUpdate(
          { userId: message.author.id },
          { $inc: { botBalance: 75 } },
        ).catch(() => {});

        return message.reply(
          `🧠 **GENIUS!** ${message.author} correctly formed the equation: **\`${text} = ${game.target}\`**!\n💰 **+75 EP** credited! • New Bal: **${(updatedUser?.botBalance || 0).toLocaleString()} EP**`,
        );
      }
    }

    // 3. Cyber Hangman
    if (game.type === "hangman") {
      const cleanGuess = text.toUpperCase().replace(/[^A-Z]/g, "");
      if (cleanGuess === game.word) {
        if (game.isSolving) return;
        game.isSolving = true;
        clearTimeout(game.timer);
        if (game.interval) clearInterval(game.interval);
        activeGames.delete(message.channel.id);

        const wonPot = game.pot();
        const updatedUser = await DiscordUser.findOneAndUpdate(
          { discordId: message.author.id },
          { $inc: { botBalance: wonPot, "gameStats.totalGamesPlayed": 1 } },
          { returnDocument: "after" },
        );

        await UserProfile.findOneAndUpdate(
          { userId: message.author.id },
          { $inc: { botBalance: wonPot } },
        ).catch(() => {});

        return message.reply(
          `🏆 **SOLVED!** ${message.author} cracked the word: **\`${game.word}\`** before all hints revealed!\n💰 Won **+${wonPot} EP** from the prize pot! • New Bal: **${(updatedUser?.botBalance || 0).toLocaleString()} EP**`,
        );
      }
    }

    // 4. Quick-Fire Anagram Duel
    if (game.type === "anagram") {
      const cleanWord = text.toUpperCase().replace(/[^A-Z]/g, "");
      if (cleanWord.length >= game.minLen && !game.solvedWords.has(cleanWord)) {
        const pool = [...game.letters];
        let valid = true;
        for (const char of cleanWord) {
          const idx = pool.indexOf(char);
          if (idx === -1) {
            valid = false;
            break;
          }
          pool.splice(idx, 1);
        }

        if (valid) {
          game.solvedWords.add(cleanWord);
          const reward =
            cleanWord.length >= 6 ? 80 : cleanWord.length === 5 ? 40 : 20;

          await DiscordUser.findOneAndUpdate(
            { discordId: message.author.id },
            { $inc: { botBalance: reward, "gameStats.totalGamesPlayed": 1 } },
          );

          await UserProfile.findOneAndUpdate(
            { userId: message.author.id },
            { $inc: { botBalance: reward } },
          ).catch(() => {});

          const currentTotal =
            (game.scores.get(message.author.id) || 0) + reward;
          game.scores.set(message.author.id, currentTotal);

          await message.react("✨");
          await message.reply(
            `✅ Valid word: **${cleanWord}** (+${reward} EP)`,
          );
        }
      }
    }

    // 5. Classic Continuous Single-Player Games (Unscramble, Fasttype, Quiz, Emojigame)
    if (["unscramble", "fasttype", "quiz", "emojigame"].includes(game.type)) {
      const cleanGuess = lower
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const cleanTarget = (game.answer || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      const isMatch =
        cleanGuess === cleanTarget ||
        cleanGuess === cleanTarget.replace(/^the\s+/, "") ||
        `the ${cleanGuess}` === cleanTarget;

      if (isMatch) {
        if (game.isSolving) return;
        game.isSolving = true;

        clearTimeout(game.timer);
        const currentRound = game.round;
        const gameType = game.type;
        const displayAnswer = game.answer;

        const updatedUser = await DiscordUser.findOneAndUpdate(
          { discordId: message.author.id },
          { $inc: { "gameStats.totalGamesPlayed": 1, botBalance: 50 } },
          { returnDocument: "after" },
        );

        await UserProfile.findOneAndUpdate(
          { userId: message.author.id },
          { $inc: { botBalance: 50 } },
        ).catch(() => {});

        await logActivity({
          author: message.author,
          channel: message.channel,
          guild: message.guild,
          activityType: "MINI_GAME_WIN",
          details: {
            gameType,
            answer: displayAnswer,
            round: currentRound,
            reward: 50,
          },
        });

        await message.reply(
          [
            `<a:sparklesstars:1571929733770383521> **${message.author}** got it right! <a:approvedCorrect:1572188241245900890>`,
            `<a:moneybagcoin:1571920822694715492> **+50 Bot EP** credited! • New Balance: **${(updatedUser?.botBalance || 0).toLocaleString()} EP** ${EMOJIS.bid}`,
            ``,
            `-# <a:lightningAuraBolt:1572172753602224168> Launching round ${currentRound + 1} in 3 seconds...`,
          ].join("\n"),
        );

        setTimeout(() => {
          if (activeGames.has(message.channel.id)) {
            launchNextRound(
              message.channel,
              gameType,
              currentRound + 1,
              client,
            );
          }
        }, 3000);
        return;
      }
    }
  }

  // Conversational response check
  let isReplyingToBot = false;
  if (message.reference && message.reference.messageId) {
    try {
      const referencedMsg = await message.channel.messages.fetch(
        message.reference.messageId,
      );
      if (referencedMsg && referencedMsg.author.id === client.user.id) {
        isReplyingToBot = true;
      }
    } catch (e) {}
  }

  const botMentioned = message.mentions.has(client.user.id);
  const containsBotName =
    /\b(ai arix|ai starza|starza ai|arix ai|arix|starza)\b/i.test(content);

  if (
    !content.startsWith("!") &&
    (botMentioned || isReplyingToBot || containsBotName)
  ) {
    let cleanPrompt = content
      .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
      .replace(/\b(ai arix|ai starza|starza ai|arix ai|arix|starza)\b/gi, "")
      .trim();

    if (!cleanPrompt) {
      return message.reply(
        "### Need assistance? <:cutie:1571805401194823730>\nAsk anything or explore **/help**!",
      );
    }

    await message.channel.sendTyping().catch(() => {});

    try {
      const response = await generateRefinedAiResponse(message, cleanPrompt);
      if (response) {
        return message.reply(
          response.length > 2000 ? response.slice(0, 1990) + "..." : response,
        );
      }
    } catch (err) {
      console.error("[CONVERSATION ERROR]:", err.message);
    }
    return;
  }

  // Prefix commands (!command)
  if (content.startsWith("!")) {
    const args = content.slice(1).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();
    const targetUser = message.mentions.users.first() || null;

    if (commandName === "report") {
      const warning = await message.reply(
        "🔒 **For total privacy & anonymity**, prefix `!report` is disabled in public channels.\nPlease use the slash command: **/report** (visible only to you).\n## DELETE YOUR MESSAGE ASAP <:redcardpenalty:1571939410977620059>",
      );
      setTimeout(() => warning.delete().catch(() => {}), 6000);
      return;
    }

    await executeCommand({
      commandName,
      author: message.author,
      member: message.member,
      channel: message.channel,
      guild: message.guild,
      args,
      targetUser,
      textInput: args.join(" "),
      numberInput: parseInt(args[0], 10) || null,
      client,
      isSlash: false,
      reply: (payload) => message.reply(payload),
      deleteOriginal: () => message.delete().catch(() => {}),
    });
  }
});

const botToken = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
client.login(botToken);
