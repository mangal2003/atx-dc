// deploy-commands.js
require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  // 1. General & Info
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Open the interactive help directory"),
  new SlashCommandBuilder()
    .setName("rules")
    .setDescription("Display community rules"),
  new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Welcome a member")
    .addUserOption((opt) =>
      opt
        .setName("target")
        .setDescription("Member to welcome")
        .setRequired(false),
    ),

  // 2. Profile & Identity
  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View your player profile card")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("User to view").setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Check your EP balance"),
  new SlashCommandBuilder()
    .setName("birthday")
    .setDescription("Check someone's birthday")
    .addUserOption((opt) =>
      opt
        .setName("target")
        .setDescription("User to inspect")
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("setbirthday")
    .setDescription("Save your birthday (DD/MM)")
    .addStringOption((opt) =>
      opt
        .setName("date")
        .setDescription("Date in DD/MM format")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("secret")
    .setDescription(
      "[COMING SOON] Send an anonymous confession to the server archives",
    )
    .addStringOption((opt) =>
      opt
        .setName("message")
        .setDescription("Your secret confession")
        .setRequired(true),
    ),

  // 3. AI & Smart Utilities
  new SlashCommandBuilder()
    .setName("ai")
    .setDescription("Ask ATX AI anything within community context")
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("What do you want to ask or talk about?")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("eli5")
    .setDescription("Explain a topic simply")
    .addStringOption((opt) =>
      opt
        .setName("topic")
        .setDescription("Concept to explain")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("summary")
    .setDescription(
      "Debrief recent server conversations from the past few hours",
    )
    .addIntegerOption((opt) =>
      opt
        .setName("hours")
        .setDescription("Hours to look back (1-12, default: 3)")
        .setMinValue(1)
        .setMaxValue(12)
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("factcheck")
    .setDescription("Fact-check a claim")
    .addStringOption((opt) =>
      opt
        .setName("claim")
        .setDescription("Statement to verify")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("translate")
    .setDescription("Translate text to English")
    .addStringOption((opt) =>
      opt.setName("text").setDescription("Text to translate").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("counter")
    .setDescription("Generate a logical counter-argument")
    .addStringOption((opt) =>
      opt
        .setName("statement")
        .setDescription("Statement to counter")
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("remind")
    .setDescription("Set a timed reminder")
    .addStringOption((opt) =>
      opt
        .setName("time")
        .setDescription("Time (e.g. 10s, 5m, 2h)")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("reminder")
        .setDescription("What to remind you of")
        .setRequired(true),
    ),

  // 4. Social & Fun Meters
  new SlashCommandBuilder()
    .setName("roast")
    .setDescription("Playfully roast a member")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("User to roast").setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("flirt")
    .setDescription("Send a smooth pickup line")
    .addUserOption((opt) =>
      opt
        .setName("target")
        .setDescription("User to flirt with")
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("lovemeter")
    .setDescription("Calculate relationship compatibility")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("Target member").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("crush")
    .setDescription("Uncover a secret crush rumor")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("Target member").setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("expose")
    .setDescription("Expose a member's gaming secrets")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("Target member").setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("simp")
    .setDescription("Calculate simp percentage")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("Target member").setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("delulu")
    .setDescription("Measure delusion level")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("Target member").setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("aura")
    .setDescription("Calculate aura rating")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("Target member").setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("truthdare")
    .setDescription("Get a Truth or Dare challenge"),
  new SlashCommandBuilder()
    .setName("joke")
    .setDescription("Tell a playful joke"),
  new SlashCommandBuilder()
    .setName("excuse")
    .setDescription("Generate a hilarious excuse")
    .addUserOption((opt) =>
      opt
        .setName("target")
        .setDescription(
          "The user making or needing the excuse (defaults to yourself)",
        )
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("tossacoin")
    .setDescription("Flip a coin (Heads or Tails)"),
  new SlashCommandBuilder()
    .setName("wish")
    .setDescription("Send best wishes")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("Member").setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName("message")
        .setDescription("Custom message")
        .setRequired(false),
    ),

  // 5. Mini-Games
  new SlashCommandBuilder()
    .setName("unscramble")
    .setDescription("Start a continuous word unscramble game"),
  new SlashCommandBuilder()
    .setName("emojigame")
    .setDescription("[NEEDS FIX]:Start a continuous guess-the-game challenge"),
  new SlashCommandBuilder()
    .setName("fasttype")
    .setDescription("Start a continuous speed-typing contest"),
  new SlashCommandBuilder()
    .setName("quiz")
    .setDescription("Start a continuous trivia quiz game"),
  new SlashCommandBuilder()
    .setName("stopgame")
    .setDescription("Stop the active game session in this channel"),

  // 6. Moderation & Staff
  new SlashCommandBuilder()
    .setName("report")
    .setDescription(
      "Dispatches an anonymous incident report directly to ATX Administrators",
    )
    .addStringOption((opt) =>
      opt
        .setName("reason")
        .setDescription("Detailed description of the issue or incident")
        .setRequired(true),
    )
    .addUserOption((opt) =>
      opt
        .setName("target")
        .setDescription("User you are reporting (optional)")
        .setRequired(false),
    ),

  // 7. Nitro Mimic Command
  new SlashCommandBuilder()
    .setName("nitro")
    .setDescription(
      "Send messages with ATX custom emojis even without Discord Nitro!",
    )
    .addStringOption((opt) =>
      opt
        .setName("theme")
        .setDescription("Select an emoji category (flirt, roast, aura, etc.)")
        .setAutocomplete(true)
        .setRequired(true),
    ),

  // 8. Connect web command
  new SlashCommandBuilder()
    .setName("connectweb")
    .setDescription("Connect your Discord with your ATX Website account")
    .addStringOption((opt) =>
      opt
        .setName("code")
        .setDescription("6-digit verification code from your website profile")
        .setAutocomplete(true)
        .setRequired(true),
    ),
].map((c) => c.toJSON());

const botToken = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
const clientId =
  process.env.CLIENT_ID ||
  (botToken ? Buffer.from(botToken.split(".")[0], "base64").toString() : null);

const rest = new REST({ version: "10" }).setToken(botToken);

(async () => {
  try {
    console.log(
      `[DEPLOY] Registering ${commands.length} application commands...`,
    );

    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(clientId, process.env.GUILD_ID),
        { body: commands },
      );
      console.log(
        `[DEPLOY] Successfully registered commands to test Guild (${process.env.GUILD_ID}).`,
      );
    }

    const data = await rest.put(Routes.applicationCommands(clientId), {
      body: commands,
    });

    console.log(
      `[DEPLOY] Successfully registered ${data.length} commands globally.`,
    );
  } catch (error) {
    console.error("[DEPLOY ERROR]:", error);
  }
})();
