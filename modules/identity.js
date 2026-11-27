// modules/identity.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");
const { DiscordUser, logActivity } = require("../services/database");
const User = require("../models/User"); // Added requirement to look up website accounts

function getHelpPages() {
  return [
    // PAGE 1: AI & Smart Intelligence
    new EmbedBuilder()
      .setColor(0x00f3ff)
      .setAuthor({
        name: "ARIX UTILITIES",
      })
      .setDescription(
        [
          `### \`/ai <prompt>\` • \`!ai\``,
          `> Chat with **ARIX** directly with telemetry-aware community context.`,
          `### \`/summary [hours]\` • \`!summary\``,
          `> Generates an AI debrief of chat highlights and storylines.`,
          `### \`/counter <statement>\` • \`!counter\``,
          `> Synthesizes a witty, tactical rebuttal to refute an argument.`,
          `### \`/factcheck <claim>\` • \`!factcheck\``,
          `> Verifies claims and outputs a verdict with evidence.`,
          `### \`/eli5 <topic>\` • \`!eli5\``,
          `> Explains complex topics in simple, intuitive terms.`,
          `### \`/translate <text>\` • \`!translate\``,
          `> Dual-output translation into clean English and Hindi.`,
          `### \`/remind <time> <task>\` • \`!remind\``,
          `> Sets an automated timer alert (e.g., \`!remind 10m tourney\`).`,
          `────────────────────────────────────────`,
          `-# <a:diamondgem:1571920814041858149> Unified Ledger active on [**atx-family.onrender.com**](https://atx-family.onrender.com)`,
        ].join("\n"),
      ),

    // PAGE 2: Continuous Mini-Games & Economy
    new EmbedBuilder()
      .setColor(0xffd700)
      .setAuthor({
        name: "ARIX MINI-GAMES",
      })
      .setDescription(
        [
          `### \`/unscramble\` • \`!unscramble\``,
          `> Solve letter anagrams before the 2-minute round timer expires.`,
          `### \`/emojigame\` • \`!emojigame\``,
          `> Decrypt visual emoji puzzles (movies, games, and personalities).`,
          `### \`/fasttype\` • \`!fasttype\``,
          `> Test raw typing reflexes against high-speed prompt sentences.`,
          `### \`/quiz\` • \`!quiz\``,
          `> Answer trivia questions with category hints and letter leads.`,
          `### \`/stopgame\` • \`!stopgame\``,
          `> Aborts the current arena session and reveals the solution.`,
          `────────────────────────────────────────`,
          `> **<:moneyPaisaPurse:1571805482392227870> Victor Reward:** \`+50 EP\` auto-credited per correct round.`,
          `-# <a:lightningAuraBolt:1572172753602224168> EP syncs instantly to your Web Vault upon round victory.`,
        ].join("\n"),
      ),
    // PAGE 3: Social Dynamics & Banter
    new EmbedBuilder()
      .setColor(0xff007f)
      .setAuthor({
        name: "ARIX SOCIAL DYNAMICS",
      })
      .setDescription(
        [
          `### \`/roast [target]\` • \`/flirt [target]\``,
          `> Sharp stand-up punchlines or magnetic rizz lines directed at a member.`,
          `### \`/lovemeter <target>\` • \`!lovemeter\``,
          `> Calculates chemistry percentages, visual meters, and oracle verdicts.`,
          `### \`/aura [target]\` • \`/delulu [target]\` • \`/simp [target]\``,
          `> Daily behavioral diagnostics with real-time status classifications.`,
          `### \`/crush [target]\` • \`/expose [target]\``,
          `> Declassified leaks comparing gameplay chokes to historical blunders.`,
          `### \`/truthdare [mode]\` • \`/excuse [target]\``,
          `> Chaotic dares, gaming confessions, and high-tier copium quotes.`,
          `### \`/joke\` • \`/wish [target]\` • \`/tossacoin\``,
          `> Stand-up humor, gamer blessings, and provably fair 50/50 coin flips.`,
          `────────────────────────────────────────`,
          `-# 🎭 Daily diagnostic seeds refresh automatically every 24 hours.`,
        ].join("\n"),
      ),

    // PAGE 4: Identity, Registry & Security
    new EmbedBuilder()
      .setColor(0x7928ca)
      .setAuthor({
        name: "IDENTITY",
      })
      .setDescription(
        [
          `### \`/profile [target]\` • \`/balance\``,
          `> Inspects unified EP net, level progress, chat metrics, and birthdays.`,
          `### \`/connectweb <code>\``,
          `> Bridges Discord identity with the official ATX Web Platform.`,
          `### \`/birthday [target]\` • \`/setbirthday <DD/MM>\``,
          `> Checks registry entries or binds your birthday for server celebrations.`,
          `### \`/welcome <target>\` • \`!welcome\``,
          `> Dispatches the official onboarding briefing to newly arrived operators.`,
          `### \`/rules\` • \`!rules\``,
          `> Displays server protocols, conduct boundaries, and admin escalations.`,
          `### \`/secret <message>\` • \`/report <reason> <target>\``,
          `> Ephemeral whisper messages or direct logs to executive moderators.`,
          `────────────────────────────────────────`,
          `-# <:linkChain:1575177914457006080> Web Pairing available strictly inside the ATX Server.`,
        ].join("\n"),
      ),
  ];
}

async function handleIdentityCommands({
  commandName,
  author,
  member,
  channel,
  guild,
  args,
  targetUser,
  textInput,
  reply,
  client,
  deleteOriginal,
}) {
  if (commandName === "help") {
    let currentPage = 0;
    const pages = getHelpPages();

    const getRow = (idx) =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("help_prev")
          .setLabel("◀ Prev")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(idx === 0),
        new ButtonBuilder()
          .setCustomId("help_next")
          .setLabel("Next ▶")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(idx === pages.length - 1),
        new ButtonBuilder()
          .setCustomId("help_close")
          .setLabel("✖ Close")
          .setStyle(ButtonStyle.Danger),
      );

    const helpMsg = await reply({
      embeds: [pages[currentPage]],
      components: [getRow(currentPage)],
      fetchReply: true,
    });

    if (!helpMsg) return true;

    const collector = helpMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.user.id !== author.id) {
        return interaction.reply({
          content: "⚠️ Open your own help menu with `/help`!",
          flags: [MessageFlags.Ephemeral],
        });
      }
      if (interaction.customId === "help_prev")
        currentPage = Math.max(0, currentPage - 1);
      else if (interaction.customId === "help_next")
        currentPage = Math.min(pages.length - 1, currentPage + 1);
      else if (interaction.customId === "help_close")
        return collector.stop("user_closed");

      await interaction.update({
        embeds: [pages[currentPage]],
        components: [getRow(currentPage)],
      });
    });

    collector.on("end", async (_, reason) => {
      if (reason === "user_closed") {
        await helpMsg.delete().catch(() => {});
      } else {
        const disabled = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("1")
            .setLabel("◀ Prev")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("2")
            .setLabel("Next ▶")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        );
        await helpMsg.edit({ components: [disabled] }).catch(() => {});
      }
    });
    return true;
  }

  if (commandName === "profile" || commandName === "balance") {
    const target = targetUser || author;
    const profile = await DiscordUser.findOne({ discordId: target.id });
    if (!profile)
      return reply("No profile initialized yet. Chat in the server first!");

    // Check for a linked website profile in the unified collection
    const webUser = await User.findOne({ discordId: target.id }).lean();

    // Define exact numerical balances
    const botEp = profile.botBalance || 0;
    const webXp = webUser ? webUser.xpBalance || 0 : 0;
    const totalCombinedEp = botEp + webXp;

    const safeAuthorName = (target.username || "ATX MEMBER").toUpperCase();
    const userAvatar = target.displayAvatarURL
      ? target.displayAvatarURL()
      : undefined;
    const botAvatar = client.user?.displayAvatarURL
      ? client.user.displayAvatarURL()
      : undefined;

    const msgCount = profile.chatStats?.messageCount || 0;
    const level = Math.floor(Math.sqrt(msgCount / 5)) + 1;
    const progressXP = msgCount % 50;
    const progressBar =
      "█".repeat(Math.floor(progressXP / 5)) +
      "░".repeat(10 - Math.floor(progressXP / 5));

    // Compile dynamic status
    let statusLabel = profile.isStaff
      ? "Staff <a:crownBossKingQueen:1571805552303018024>"
      : "Member <:memberapprovedids:1571852902295937134>";
    if (webUser) {
      statusLabel;
    }

    const embed = new EmbedBuilder()
      .setColor(0x00f3ff)
      .setAuthor({
        name: `PROFILE  •  ${safeAuthorName}`,
        iconURL: userAvatar,
      })
      .setThumbnail(userAvatar || null)
      .setDescription(
        [
          ``,
          `> Rank Status: **${statusLabel}**`,
          ``,
          `**<a:ranking:1572188246920663041> Level ${level} Progress:** \`${progressBar}\` *(${progressXP * 2}%)*`,
          `─────────────────────────────────`,
          `### <a:moneybagcoin:1571920822694715492> **Total EP:** \` ${totalCombinedEp.toLocaleString()} EP \``,
          `> **Discord EP:** ${botEp.toLocaleString()} EP`,
          webUser
            ? `> **Website EP:** ${webXp.toLocaleString()} EP`
            : `> **Website Vault:** Unlinked`,
          `─────────────────────────────────`,
          `### <a:redenvelopeMessage:1571854787610148954> **Messages Dispatched:** \` ${msgCount.toLocaleString()} \``,
          `### <a:botAI:1571833293802967081> **AI Interactions:** \` ${(profile.chatStats?.aiPromptsCount || 0).toLocaleString()} \``,
          `### <a:kuromiLoveChase:1571805445629411429> **Mini-Games Played:** \` ${(profile.gameStats?.totalGamesPlayed || 0).toLocaleString()} \``,
          `### <:birthdaycake:1571854782170140693> **Birthday Record:** \` ${profile.metadata?.birthday || "Not set"} \``,
          `─────────────────────────────────`,
          `-# <a:tipsfedora:1571856989775073350> Tip: Participate in **Mini Games** to earn +50 EP every round`,
        ].join("\n"),
      )
      .setFooter({
        text: `User ID: ${profile.discordId}`,
        iconURL: botAvatar,
      });

    return reply({ embeds: [embed] });
  }

  if (commandName === "birthday") {
    const target = targetUser || author;
    const doc = await DiscordUser.findOne({ discordId: target.id });
    const bdayRaw = doc?.metadata?.birthday;

    const bdayEmbed = new EmbedBuilder()
      .setColor(bdayRaw ? 0xffa500 : 0x8e8e93)
      .setAuthor({
        name: "🎉 ATX BIRTHDAYS",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        bdayRaw
          ? `## <:birthdaycake:1571854782170140693> ${target}'s Birthday:  \` ${bdayRaw} \``
          : `### <:birthdaycake:1571854782170140693> ${target}'s Birthday: *Not set yet* \n(Use  \` /setbirthday date:DD/MM \`)`,
      )
      .setFooter({ text: `Use /help for more commands` });

    return reply({ embeds: [bdayEmbed] });
  }

  if (commandName === "setbirthday") {
    const dateInput = (textInput || args[0] || "").trim();
    const match = dateInput.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
    if (!match) {
      return reply(
        "### <a:warningAlert:1571926598804971740> Please provide a valid date in `DD/MM` \n-# Format (e.g., `/setbirthday date:15/08` or `!setbirthday 15/08`).",
      );
    }

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
      return reply(
        `### <a:alertWarning:1571926677934575816> \`${dateInput}\` is not a valid calendar date! Please verify the day and month.`,
      );
    }

    const formattedDate = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
    await DiscordUser.findOneAndUpdate(
      { discordId: author.id },
      { $set: { "metadata.birthday": formattedDate } },
      { upsert: true, returnDocument: "after" },
    );

    const embed = new EmbedBuilder()
      .setColor(0x00f3ff)
      .setAuthor({
        name: "ATX BIRTHDAY REGISTRY",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        `> <:birthdaycake:1571854782170140693> Your birthday has been recorded as **\` ${formattedDate} \`**`,
      );

    return reply({ embeds: [embed] });
  }

  if (commandName === "rules") {
    const embed = new EmbedBuilder()
      .setColor(0x00f3ff)
      .setAuthor({
        name: "ATX SERVER RULES",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        [
          `Welcome to the **ATX Family**. To maintain an elite, respectful, and safe community, all members must adhere strictly to these core rules:`,
          ``,
          `### <:numberOne1:1571805438532657193> Mutual Respect & Decency <a:sparklesstarsunsolar:1571929761557647592>`,
          `> Treat every member with dignity. **Zero tolerance** for harassment, toxicity, abuse, slurs, or hate speech across text and voice channels.`,
          ``,
          `### <:numberTwo2:1571805436028653601> Anti-Spam & Chat Hygiene 🚫`,
          `> Keep channels clean and readable. Avoid message flooding, rapid emote spam, wall-of-text copy-pastes, or disruptive mentions.`,
          ``,
          `### <:numberThree3:1571805433532780646> Strictly No NSFW Material <:nsfw:1572178514352939048><:disslike:1572178509265109124>`,
          `> Uploading, linking, or discussing adult, explicit, suggestive, or inappropriate content results in an **immediate and permanent ban**.`,
          ``,
          `### <:numberFour4:1571805431503003689> Suspicious Links & Safety <a:warningAlert:1571926598804971740>`,
          `> Do not share unverified downloads, phishing portals, scam links, or malicious files. Automated link monitoring is strictly enforced.`,
          ``,
          `### <:numberFive5:1571805455804670052> Advertising & Self-Promotion <a:announcement2:1571861016306782298>`,
          `> Unauthorized promotion of other Discord servers, group chats, personal products, or commercial ventures is prohibited without admin approval.`,
          ``,
          `### <:numberSix6:1571805524368818276> DM Etiquette & Privacy <:blessings:1571929736203206777>`,
          `> Unsolicited DMs, predatory outreach, or harassing members in private messages will lead to an immediate server blacklist.`,
          ``,
          `-------`,
          `### Need to Report an Incident? <:sirenPolice:1571926589795598346>`,
          `> Use \` /report target:@user reason:<details> \` or [**Report Anonymously**](https://atx-family.onrender.com/contact/) straight to the admins`,
          ``,
          `-# *Failure to comply may trigger warnings, mutes, kicks, or permanent ban.*`,
        ].join("\n"),
      )
      .setFooter({ text: "Server Rules • ATX Family" });

    return reply({ embeds: [embed] });
  }

  if (commandName === "welcome") {
    const target = targetUser || author;
    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x00f3ff)
      .setAuthor({
        name: "ATX RECEPTION",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        [
          `Yooo! **${target.username}** has successfully joined the **ATX Family**`,
          ``,
          `> <a:bookMagic:1571905895296663572> **Mandatory Briefing:** Review server laws with \` /rules \``,
          `> <a:diamondgem:1571920814041858149> **Web Operations:** Login yourself on the [**Official Portal**](https://atx-family.onrender.com/)`,
          `> <a:botAI:1571833293802967081> **Bot Commands:** Use \` /help \` to see all commands`,
          ``,
          `------`,
          `-# <a:redenvelopeMessage:1571854787610148954> **Introduce yourself in chat, squad up for Plato battles, and make yourself at home!**`,
          ``,
        ].join("\n"),
      )
      .setFooter({ text: "ATX Reception • Enter with Honor, Play to Conquer" });

    return reply({
      content: `<:welcome:1571805398615330816> ${target} <:cuteWelcome:1571805395930845235>`,
      embeds: [welcomeEmbed],
    });
  }

  if (commandName === "report") {
    // Block prefix trigger fallback if it ever reaches here
    if (typeof isSlash !== "undefined" && !isSlash) {
      return reply({
        content:
          "🔒 **Prefix disabled.** Use the slash command `/report` so your report remains strictly ephemeral and private.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const target = targetUser;
    const reportText = (textInput || args.join(" ") || "").trim();

    if (!reportText && !target) {
      return reply({
        content:
          "### <a:warningAlert:1571926598804971740> Anonymous Report Usage\n> Use: `/report reason:<details>` or `/report target:@user reason:<details>`\n-# Your identity is completely scrubbed from staff logs.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    try {
      const REPORT_CHANNEL_ID =
        process.env.DISCORD_REPORT_CHANNEL_ID || "1536438131790712892";
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      const LOGO_URL =
        "https://res.cloudinary.com/disuussfy/image/upload/v1786689078/auction_items/ff6xykirlrcdwqwfeauu.jpg";

      const descriptionLines = [];
      if (target) {
        descriptionLines.push(`**Against:** ${target} (\`${target.id}\`)`);
        descriptionLines.push(``);
      }
      descriptionLines.push(`**INCIDENT / MESSAGE DETAILS**`);
      descriptionLines.push(
        `> ${reportText || "No additional description provided."}`,
      );

      const reportEmbed = new EmbedBuilder()
        .setTitle("Anonymous REPORT")
        .setDescription(descriptionLines.join("\n"))
        .setColor(0xff0055)
        .setFooter({
          text: "ATX Anonymous Terminal",
          iconURL: LOGO_URL,
        })
        .setTimestamp();

      let dispatched = false;

      // Method A: Native Discord Text Channel
      const reportChannel = client.channels.cache.get(REPORT_CHANNEL_ID);
      if (reportChannel && reportChannel.isTextBased()) {
        await reportChannel.send({ embeds: [reportEmbed] });
        dispatched = true;
      }
      // Method B: Webhook Fallback
      else if (webhookUrl) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "ATX Anonymous Terminal",
            avatar_url: LOGO_URL,
            embeds: [reportEmbed.toJSON()],
          }),
        });
        dispatched = true;
      }

      if (!dispatched) {
        return reply({
          content:
            "### <:deadSkull:1571908653966041308> ARIX Offline\n> Unable to connect to the internal review channel. Please report via the [**Web Portal**](https://atx-family.onrender.com/contact).",
          flags: [MessageFlags.Ephemeral],
        });
      }

      // Ephemeral confirmation visible only to the submitter
      return reply({
        content: [
          `### <a:approvedCorrect:1572188241245900890> Anonymous Report Dispatched`,
        ].join("\n"),
        flags: [MessageFlags.Ephemeral],
      });
    } catch (err) {
      console.error("[ANONYMOUS REPORT ERROR]:", err);
      return reply({
        content:
          "### <:auraloss:1571805296769110056> Failed to submit report. Please try again later.",
        flags: [MessageFlags.Ephemeral],
      });
    }
  }

  return false;
}

module.exports = { handleIdentityCommands };
