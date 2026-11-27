// modules/utility.js
const { EmbedBuilder } = require("discord.js");
const { callAiWithFallback } = require("../services/ai");
const { injectThemeEmojis } = require("../config/emojis");
const { DiscordUser } = require("../services/database");

// Current:
async function handleUtilityCommands({
  commandName,
  author,
  channel,
  guild,
  args,
  textInput,
  numberInput,
  reply,
  client,
}) {
  if (
    commandName === "ai" ||
    commandName === "arix" ||
    commandName === "starza"
  ) {
    const prompt = textInput || args.join(" ").trim();
    if (!prompt) {
      return reply(
        "### Need assistance? <:cutie:1571805401194823730>\nAsk anything or explore **/help**!",
      );
    }

    const {
      generateRefinedAiResponse,
    } = require("../services/conversationEngine");

    // Construct a message-like payload compatible with the engine
    const contextMessage = {
      author,
      guild,
      channel,
      client,
      content: prompt,
      reference: null,
    };

    const response = await generateRefinedAiResponse(contextMessage, prompt);
    const final =
      response ||
      "**OOPS...** <:closed1left:1571861006043316254><:closed2right:1571861003610624072> Try again after **15** seconds!";

    await DiscordUser.updateOne(
      { discordId: author.id },
      { $inc: { "chatStats.aiPromptsCount": 1 } },
    );

    return reply(final.length > 2000 ? final.slice(0, 1990) + "..." : final);
  }

  if (commandName === "summarise" || commandName === "summary") {
    const hours = numberInput || parseInt(args[0]) || 3;
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;

    await channel.sendTyping().catch(() => {});

    try {
      const fetched = await channel.messages.fetch({ limit: 100 });
      const recentMessages = fetched
        .filter(
          (m) =>
            !m.author.bot &&
            m.createdTimestamp >= cutoffTime &&
            m.content.trim().length > 0,
        )
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .map(
          (m) => `[${m.author.displayName || m.author.username}]: ${m.content}`,
        );

      if (recentMessages.length < 4) {
        return reply(
          `**Not enough chat activity in the last ${hours} hour(s) to form a debrief**\n<:dead:1571805340809302066><:dead:1571805340809302066><:dead:1571805340809302066><:dead:1571805340809302066><:dead:1571805340809302066><:dead:1571805340809302066><:dead:1571805340809302066>`,
        );
      }

      const transcript = recentMessages.join("\n").slice(0, 4000);
      const debrief = await callAiWithFallback(
        [
          `You are ARIX Bot (your other name is "Arix" aka starza), the official resident bot and caretaker of the ATX server.`,
          `Summarize the chat activity from the past ${hours} hours into a crisp, engaging server debrief.`,
          ``,
          `Include these exact sections:`,
          `### <a:redenvelopeMessage:1571854787610148954> The Narrative`,
          `(2-3 concise sentences capturing key conversations, themes, and community vibe)`,
          ``,
          `### <a:fizzarollidance:1571836252255166524> Highlights & Banter`,
          `(3-4 clear bullet points: main topics, games played, jokes, debates, or announcements)`,
          ``,
          `### <:maincharacter:1571805299126575184> Active Members`,
          `(List the most active participants in bold)`,
          ``,
          `CHAT TRANSCRIPT:`,
          transcript,
        ].join("\n"),
      );

      if (!debrief) {
        return reply(
          "<:auraloss:1571805296769110056> **Sorryyy...** Could not compile server summary at this moment. Please try again shortly!",
        );
      }

      const summaryEmbed = new EmbedBuilder()
        .setColor(0x00f3ff)
        .setTitle(
          `<a:announcement2:1571861016306782298> Summary • Past ${hours} Hours`,
        )
        .setDescription(
          debrief.length > 4000 ? debrief.slice(0, 3990) + "..." : debrief,
        )
        .setFooter({ text: "ATX Automated Recap" })
        .setTimestamp();

      return reply({ embeds: [summaryEmbed] });
    } catch (err) {
      console.error("[SUMMARISE ERROR]", err);
      return reply(
        "<:auraloss:1571805296769110056> **Sorryyy...** Encountered an internal error while fetching channel history!",
      );
    }
  }

  if (["eli5", "factcheck", "translate"].includes(commandName)) {
    const query = textInput || args.join(" ").trim();
    if (!query)
      return reply(`Please provide text: \`/${commandName} <content>\``);

    let instruction = "";
    if (commandName === "eli5")
      instruction =
        "Explain this simply for a 5-year old in 4-5 sentences with proper and accurate facts:";
    if (commandName === "factcheck")
      instruction =
        "Verify this claim. Label it TRUE, FALSE, or MISLEADING with a brief reason:";
    if (commandName === "translate")
      instruction = "Translate the following text into English:";

    const res = await callAiWithFallback(`${instruction}\n\n${query}`);
    const embed = new EmbedBuilder()
      .setColor(0x00f3ff)
      .setTitle(`${commandName.toUpperCase()}`)
      .setDescription(
        res
          ? res.length > 2000
            ? res.slice(0, 1990) + "..."
            : res
          : "Unable to produce output at this time.",
      )
      .setFooter({ text: "Use !help for more commands" });

    return reply({ embeds: [embed] });
  }

  if (commandName === "counter") {
    const stmt = textInput || args.join(" ").trim();
    if (!stmt)
      return reply(
        "Provide an argument to counter! Example: `/counter statement:Plato pool requires no skill` or `!counter Plato pool requires no skill`",
      );

    const res = await callAiWithFallback(
      [
        `A member in a competitive gaming Discord server said: "${stmt}".`,
        "Formulate a sharp, witty, fact-checked, and logical counter-argument challenging this exact claim.",
        "Rules:",
        "- Length: 2 to 3 sentences maximum.",
        "- Tone: Eloquent, confident, sarcastic, and intellectually superior.",
        "- Do NOT use robotic assistant phrases. Jump straight into the rebuttal.",
      ].join("\n"),
    );

    const rebuttalText =
      res?.replace(/^["'\s]+|["'\s]+$/g, "").trim() ||
      "That premise completely collapses under empirical examination and basic competitive reality.";

    const counterEmbed = new EmbedBuilder()
      .setColor(0xff0055)
      .setAuthor({
        name: "COUNTER • LOGICAL REBUTTAL",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setTitle("<:okaySoo:1571805366885548063> Tactical Counter-Argument")
      .setDescription(
        [
          `### <a:announcement2:1571861016306782298> Opposing Statement`,
          `> *${stmt.length > 250 ? stmt.slice(0, 247) + "..." : stmt}*`,
          ``,
          `### <:booksPilesReading:1571805371146965062> Debunk & Refutation`,
          `> ${rebuttalText}`,
          ``,
          `-# Argued on behalf of: **${author}** <a:tipsfedora:1571856989775073350>`,
        ].join("\n"),
      )
      .setFooter({ text: "Use !help for more commands" });

    return reply({ embeds: [counterEmbed] });
  }

  if (commandName === "remind") {
    const timeArg = args[0]?.trim();
    const reminderText = args.slice(1).join(" ")?.trim();

    if (!timeArg || !reminderText) {
      return reply(
        "<a:botAI:1571833293802967081><a:fightAngryMad:1571805560771190875> Usage:\n> Prefix: `!remind 5m plato tournament`\n> Slash: `/remind time:5m reminder:plato tournament`",
      );
    }

    const match = timeArg.match(/^(\d+)([smh])$/i);
    if (!match) {
      return reply(
        "### **Eeee... <:goAwayDeny:1571805495713341491> <a:fightAngryMad:1571805560771190875> Invalid duration format!**\n-# Use `10s` (seconds), `5m` (minutes), or `2h` (hours).",
      );
    }

    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    let ms = amount * 1000;
    if (unit === "m") ms *= 60;
    if (unit === "h") ms *= 3600;

    if (ms <= 0 || ms > 2147483647) {
      return reply(
        "**Reminder duration must be between 1 second and 24 days**\n<:22168donotbullyids:1571852913708498955><:22168donotbullyids:1571852913708498955><:22168donotbullyids:1571852913708498955>",
      );
    }

    const scheduledEmbed = new EmbedBuilder()
      .setColor(0x00f3ff)
      .setAuthor({
        name: "ATX REMINDER",
        iconURL: client.user?.displayAvatarURL(),
      })
      .setDescription(
        [
          `### Reminder Initialized! <a:timer10sec:1571867206512287814>`,
          `> **Task:** "${reminderText}"`,
          `> **Alarm In:** **${amount}${unit}** <a:pixelclockalarm:1571867210018852875>`,
        ].join("\n"),
      )
      .setFooter({ text: "Use !help for more commands ● ATX Services" });

    await reply({ embeds: [scheduledEmbed] });

    setTimeout(async () => {
      const alarmEmbed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle("<a:pixelclockalarm:1571867210018852875> Alarm Triggered!")
        .setDescription(
          [
            `Hey ${author}, your scheduled reminder is up:`,
            ``,
            `> **"${reminderText}"**`,
          ].join("\n"),
        )
        .setFooter({ text: "Use !help for more commands" });

      await channel
        .send({ content: `${author}`, embeds: [alarmEmbed] })
        .catch(() => {});
    }, ms);

    return true;
  }

  return false;
}

module.exports = { handleUtilityCommands };
