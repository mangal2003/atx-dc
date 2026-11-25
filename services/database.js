// services/database.js
const mongoose = require("mongoose");
const { PermissionFlagsBits, PermissionsBitField } = require("discord.js");
const DiscordUser = require("../models/DiscordUser");
const DiscordActivity = require("../models/DiscordActivity");

// In services/database.js, right inside connectDB():
function connectDB() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  mongoose
    .connect(mongoUri)
    .then(async () => {
      console.log("[DATABASE] Connected to DB");

      // Auto-cleanup: remove legacy single-user unique index if it still exists
      try {
        const collection = mongoose.connection.collection("userprofiles");
        const indexes = await collection.indexes();
        const hasLegacyIndex = indexes.some((idx) => idx.name === "userId_1");
        if (hasLegacyIndex) {
          await collection.dropIndex("userId_1");
          console.log(
            "[DATABASE] Dropped legacy single userId_1 index successfully.",
          );
        }
      } catch (err) {
        // Safe to ignore if collection doesn't exist yet or already dropped
      }
    })
    .catch((err) => console.error("[DATABASE ERROR]", err));
}

async function getOrCreateDiscordUser(author, member) {
  try {
    const safeUsername = author?.username || "Unknown User";
    const safeDisplayName =
      member?.displayName || author?.globalName || safeUsername;

    // Safely parse permissions
    let isStaff = false;
    if (member?.permissions) {
      if (typeof member.permissions.has === "function") {
        isStaff =
          member.permissions.has(PermissionsBitField.Flags.ManageMessages) ||
          member.permissions.has(PermissionsBitField.Flags.Administrator);
      } else {
        // When member.permissions is a raw bitfield string/number from Discord API
        const bitfield = new PermissionsBitField(BigInt(member.permissions));
        isStaff =
          bitfield.has(PermissionsBitField.Flags.ManageMessages) ||
          bitfield.has(PermissionsBitField.Flags.Administrator);
      }
    }

    return await DiscordUser.findOneAndUpdate(
      { discordId: author.id },
      {
        $set: {
          username: safeUsername,
          displayName: safeDisplayName,
          tag: author?.tag || safeUsername,
          avatarUrl: author?.displayAvatarURL
            ? author.displayAvatarURL()
            : null,
          isStaff: Boolean(isStaff),
          "chatStats.lastActiveAt": new Date(),
        },
        $inc: { "chatStats.messageCount": 1 },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
  } catch (err) {
    console.error("[DB USER UPSERT ERROR]", err);
    return null;
  }
}

async function logActivity({
  author,
  channel,
  guild,
  activityType,
  details = {},
  metadata = {},
}) {
  try {
    await DiscordActivity.create({
      discordId: author.id,
      username: author.tag || author.username || "Unknown",
      activityType,
      channelId: channel?.id || "DM",
      channelName: channel?.name || "DM",
      guildId: guild ? guild.id : null,
      details,
      metadata,
    });
  } catch (err) {
    console.error("[DB ACTIVITY LOG ERROR]", err);
  }
}

module.exports = {
  connectDB,
  getOrCreateDiscordUser,
  logActivity,
  DiscordUser,
  DiscordActivity,
};
