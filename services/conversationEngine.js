// services/conversationEngine.js
const UserProfile = require("../models/UserProfile");
const { callAiWithFallback } = require("./ai");

/**
 * Updates member telemetry in the background without blocking the response
 */
async function trackMemberBehavior(message) {
  try {
    if (!message.guild) return null;
    const authorId = message.author.id;
    const guildId = message.guild.id;

    // Atomically find or create the user profile scoped to THIS guild
    let profile = await UserProfile.findOneAndUpdate(
      { userId: authorId, guildId: guildId },
      {
        $setOnInsert: { userId: authorId, guildId: guildId },
        $set: {
          username: message.author.username,
          lastActiveAt: new Date(),
        },
        $inc: { totalInteractions: 1 },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );

    // Track companion replies within this guild
    if (message.reference?.messageId) {
      try {
        const repliedMsg = await message.channel.messages.fetch(
          message.reference.messageId,
        );
        if (repliedMsg && repliedMsg.author.id !== authorId) {
          const target = repliedMsg.author;

          if (target.bot && target.id !== message.client.user.id) {
            const botEntry = profile.externalBotsUsed.find(
              (b) => b.botId === target.id,
            );
            if (botEntry) {
              botEntry.count += 1;
              botEntry.lastUsedAt = new Date();
            } else {
              profile.externalBotsUsed.push({
                botName: target.username,
                botId: target.id,
                count: 1,
              });
            }
          } else if (!target.bot) {
            const friendEntry = profile.socialAffinity.find(
              (f) => f.targetUserId === target.id,
            );
            if (friendEntry) {
              friendEntry.interactionCount += 1;
            } else {
              profile.socialAffinity.push({
                targetUserId: target.id,
                targetTag: target.username,
                interactionCount: 1,
              });
            }
          }
        }
      } catch (err) {}
    }

    // Track command triggers in this guild
    if (
      message.content.startsWith("/") ||
      message.content.startsWith("!") ||
      message.content.startsWith("?")
    ) {
      const cmdName = message.content
        .slice(1)
        .split(" ")[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      if (cmdName) {
        const current = profile.commandTelemetry.get(cmdName) || 0;
        profile.commandTelemetry.set(cmdName, current + 1);
      }
    }

    await profile.save();
    return profile;
  } catch (err) {
    if (err.code === 11000) return null; // Safe guard for simultaneous race events
    console.error("[TELEMETRY ERROR]:", err.message);
    return null;
  }
}

// In-memory cache for app emojis
let cachedAppEmojis = null;
let lastEmojiFetch = 0;

async function getCachedAppEmojis(client) {
  const now = Date.now();
  if (cachedAppEmojis && now - lastEmojiFetch < 5 * 60 * 1000) {
    return cachedAppEmojis;
  }

  const emojiMap = new Map();
  let promptText = "";

  try {
    if (client.application) {
      const fetched = await client.application.emojis.fetch();
      const preview = [];
      fetched.forEach((e) => {
        const tag = e.animated
          ? `<a:${e.name}:${e.id}>`
          : `<:${e.name}:${e.id}>`;
        emojiMap.set(e.name.toLowerCase(), tag);
        if (preview.length < 20) preview.push(`:${e.name}:`);
      });
      if (preview.length > 0) {
        promptText = `Custom emojis available: ${preview.join(", ")}`;
      }
      cachedAppEmojis = { emojiMap, promptText };
      lastEmojiFetch = now;
      return cachedAppEmojis;
    }
  } catch (err) {}

  return { emojiMap: new Map(), promptText: "" };
}

/**
 * Generates an instant, zero-search AI response
 */
async function generateRefinedAiResponse(message, query) {
  // Fire profile tracking asynchronously (fire & forget)
  trackMemberBehavior(message).catch(() => {});

  // Fetch recent messages and cached emojis concurrently
  const [userProfile, fetchedMessages, emojiData] = await Promise.all([
    UserProfile.findOne({
      userId: message.author.id,
      guildId: message.guild?.id || "DM",
    }).lean(),
    message.channel.messages.fetch({ limit: 10 }).catch(() => []),
    getCachedAppEmojis(message.client),
  ]);

  // Fast chat history extraction
  let contextChat = "None";
  if (Array.isArray(fetchedMessages) || fetchedMessages.size > 0) {
    const list = Array.from(
      fetchedMessages.values ? fetchedMessages.values() : fetchedMessages,
    );
    const recent = list
      .filter((m) => m.content && m.content.trim().length > 0)
      .reverse()
      .slice(-6)
      .map(
        (m) => `[${m.author.displayName || m.author.username}]: ${m.content}`,
      );
    if (recent.length > 0) contextChat = recent.join("\n");
  }

  // Social affinity context
  let companionContext = "No close companions identified yet.";
  if (userProfile?.socialAffinity?.length > 0) {
    const top = userProfile.socialAffinity
      .sort((a, b) => b.interactionCount - a.interactionCount)
      .slice(0, 2)
      .map((f) => `@${f.targetTag}`)
      .join(", ");
    companionContext = `Frequently chats with: ${top}`;
  }

  const systemPersona = [
    "You are 'Arix AI', Arena's Resilient Intelligence X also known as 'ARIX', the witty, authentic, and grounded digital companion of the 'ATX Family' server and 'Starza' is your girlfriend, who is handling everything in plato GC but she also lives in your brain and heart.",
    "",
    `MEMBER PROFILE (@${message.author.username}):`,
    `- Social Circle: ${companionContext}`,
    `- Vibe: ${userProfile?.vibeProfile || "Regular server member"}`,
    "",
    "STRICT BOUNDARY ON LIVE DATA (NO WEB ACCESS):",
    "- You DO NOT have access to live internet browsing or real-time feeds.",
    "- If asked about live sports scores, current weather outside, today's news headlines, or live stock/crypto prices: Do NOT guess or hallucinate.",
    "- Immediately give a brief, playful refusal in 1 sentence (e.g., 'I run on server banter, not satellite weather radar—check your phone window!' or 'I'm locked inside the Discord with zero live score feeds, check Google for the match!').",
    "",
    "EMOJI USAGE RULES:",
    `- ${emojiData.promptText || "Use standard Discord emojis"}`,
    "- Strict limit: Use AT MOST 4 or 5 animated emojis across your entire answer.",
    "- Place emojis naturally between sentences and punctuation and at the end of thoughts also use some love/cute emoji after addressing user/member.",
    "",
    "CONVERSATION DIRECTIVES:",
    "1. Speak in clean, natural, conversational English.",
    "2. Friendly, sharp, and witty — avoid corporate assistant clichés.",
    "3. Keep everyday replies concise (1-3 sentences). Jump straight into the point. If someone ask to explain something give them explanation in around 2 paragraphs of 4-5 sentences.",
  ].join("\n");

  const fullPrompt = [
    `Recent Context:\n${contextChat}`,
    "",
    `User Query (@${message.author.username}):\n${query}`,
  ].join("\n");

  // Call AI with ZERO search tools for maximum speed
  let replyText = await callAiWithFallback(fullPrompt, systemPersona);
  if (!replyText) return null;

  // Swap emoji tags
  for (const [name, tag] of emojiData.emojiMap.entries()) {
    const pattern = new RegExp(`(?<!<a?):${name}:(?!\\d+>)`, "gi");
    replyText = replyText.replace(pattern, tag);
  }

  return replyText.trim();
}

module.exports = {
  trackMemberBehavior,
  generateRefinedAiResponse,
};
