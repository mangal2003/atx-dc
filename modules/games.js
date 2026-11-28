// modules/games.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  PermissionsBitField,
} = require("discord.js");
const { callAiWithFallback } = require("../services/ai");
const { EMOJIS } = require("../config/emojis");
const { DiscordUser } = require("../services/database");
const { generateMathRush, getRandomAnagramSet } = require("./gameEngines");

const activeGames = new Map();
const activeLobbies = new Map();
const GAME_TIMEOUT_MS = 2 * 60 * 1000;

function buildRestartRow(gameType) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`game_restart_${gameType}`)
      .setLabel("Play Again 🔄")
      .setStyle(ButtonStyle.Success),
  );
}

function attachRestartCollector(resultMsg, channel, gameType, client) {
  if (!resultMsg) return;
  const collector = resultMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 45000,
  });

  collector.on("collect", async (interaction) => {
    if (interaction.customId === `game_restart_${gameType}`) {
      if (activeGames.has(channel.id) || activeLobbies.has(channel.id)) {
        return interaction.reply({
          content:
            "<a:warningAlert:1571926598804971740> A game or lobby is already running here!",
          ephemeral: true,
        });
      }

      await interaction.update({ components: [] }).catch(() => {});
      collector.stop("restarted");

      await channel.send(
        `<a:megaphoneSourceAnnouncement:1571920802775961660> **${interaction.user.username}** restarted **${gameType.toUpperCase()}**! Initializing...`,
      );
      return launchGameInstance(
        channel,
        gameType,
        [interaction.user.id],
        client,
      );
    }
  });

  collector.on("end", async (_, reason) => {
    if (reason !== "restarted") {
      await resultMsg.edit({ components: [] }).catch(() => {});
    }
  });
}

// Helper to construct the live anagram prompt embed
function buildAnagramEmbed(
  letters,
  minLen,
  lastClaimText = null,
  claimedWords = [],
) {
  const claimedList =
    claimedWords.length > 0
      ? claimedWords.map((w) => `\`${w}\``).join(", ")
      : "*None yet*";

  const lines = [
    lastClaimText ? `${lastClaimText}\n` : "",
    `### GIVEN LETTERS: \`[ ${letters.join(" ")} ]\``,
    `> Make ANY English word using these letters (min **${minLen} letters**).`,
    `> **Multiple winners!** Type as many unique words as you can.`,
    ``,
    `> **Claimed Words:** ${claimedList}`,
    ``,
    `- 4 letters: \`+20 EP\``,
    `- 5 letters: \`+40 EP\``,
    `- 6+ letters: \`+80 EP\``,
    `-# <:aesthetictimer:1572153881704534036> Type directly in chat! Respawns on valid entry.`,
  ];

  return new EmbedBuilder()
    .setColor(0xffd700)
    .setAuthor({ name: "ANAGRAM • LIVE SAMPLE" })
    .setDescription(lines.filter(Boolean).join("\n"));
}

// ==========================================
// MATCHMAKING LOBBY (SOLO & MULTIPLAYER)
// ==========================================
async function startMultiplayerLobby(ctx, gameType, client) {
  const { channel, reply, author } = ctx;

  if (activeLobbies.has(channel.id)) activeLobbies.delete(channel.id);
  if (activeGames.has(channel.id)) {
    const old = activeGames.get(channel.id);
    if (old?.timer) clearTimeout(old.timer);
    activeGames.delete(channel.id);
  }

  const gameTitles = {
    mathrush: "MATH RUSH",
    anagram: "QUICK ANAGRAM",
    guessnumber: "GUESS THE NUMBER",
  };

  const players = new Set([author.id]);

  const getLobbyEmbed = (remainingSec) =>
    new EmbedBuilder().setColor(0x00f3ff).setDescription(
      [
        `###  Matchmaking <a:sparklesstars:1571929733770383521> **${gameTitles[gameType]}**`,
        ``,
        `> **Joined (${players.size}):**`,
        Array.from(players)
          .map((id) => `- <@${id}>`)
          .join("\n"),
        ``,
        `────────────────────────────────────────`,
        `-# <:aesthetictimer:1572153881704534036> Auto-starts in **${remainingSec}s** with all joined players.`,
      ].join("\n"),
    );

  const lobbyButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("lobby_join")
      .setLabel("⚔️ Join")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("lobby_start_now")
      .setLabel("Start Now 🚀")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("lobby_leave")
      .setLabel("Leave")
      .setStyle(ButtonStyle.Secondary),
  );

  let secondsLeft = 30;

  const lobbyMsg = await reply({
    embeds: [getLobbyEmbed(secondsLeft)],
    components: [lobbyButtons],
    fetchReply: true,
  });

  if (!lobbyMsg) return;
  activeLobbies.set(channel.id, lobbyMsg.id);

  const startMatch = async () => {
    clearInterval(countdown);
    collector.stop("started");
    activeLobbies.delete(channel.id);

    await lobbyMsg
      .edit({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00ffaa)
            .setDescription(
              `### <a:flameflicker:1571805360145047622> Launching **${gameTitles[gameType]}**!`,
            ),
        ],
        components: [],
      })
      .catch(() => {});

    launchGameInstance(channel, gameType, Array.from(players), client);
  };

  const countdown = setInterval(async () => {
    secondsLeft -= 5;
    if (secondsLeft <= 0 || !activeLobbies.has(channel.id)) {
      clearInterval(countdown);
      if (players.size >= 1) {
        await startMatch();
      } else {
        activeLobbies.delete(channel.id);
        const expiredEmbed = new EmbedBuilder()
          .setColor(0x8e8e93)
          .setDescription(
            "### <:skullcry:1571908660219609089> Match Cancelled\n> No players remained in the lobby.",
          );
        await lobbyMsg
          .edit({ embeds: [expiredEmbed], components: [] })
          .catch(() => {});
      }
    } else {
      await lobbyMsg
        .edit({ embeds: [getLobbyEmbed(secondsLeft)] })
        .catch(() => {});
    }
  }, 5000);

  const collector = lobbyMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 30000,
  });

  collector.on("collect", async (interaction) => {
    if (interaction.customId === "lobby_join") {
      players.add(interaction.user.id);
      await interaction.reply({
        content: "<:like:1572178511446151259> You joined the match!",
        ephemeral: true,
      });
      return lobbyMsg
        .edit({ embeds: [getLobbyEmbed(secondsLeft)] })
        .catch(() => {});
    }

    if (interaction.customId === "lobby_start_now") {
      if (!players.has(interaction.user.id)) {
        players.add(interaction.user.id);
      }
      await interaction.reply({
        content:
          "<a:lightningAuraBolt:1572172753602224168> Starting match immediately!",
        ephemeral: true,
      });
      return startMatch();
    }

    if (interaction.customId === "lobby_leave") {
      players.delete(interaction.user.id);
      await interaction.reply({
        content: "<:skullcry:1571908660219609089> You left the lobby.",
        ephemeral: true,
      });
      return lobbyMsg
        .edit({ embeds: [getLobbyEmbed(secondsLeft)] })
        .catch(() => {});
    }
  });
}

// ==========================================
// GAME INSTANCE LAUNCHER
// ==========================================
async function launchGameInstance(channel, gameType, playerList, client) {
  // 1. MATH RUSH
  if (gameType === "mathrush") {
    const { numbers, target, solution } = generateMathRush();

    const embed = new EmbedBuilder()
      .setColor(0x00f3ff)
      .setAuthor({ name: "MATH RUSH • REACH THE TARGET" })
      .setDescription(
        [
          `### TARGET NUMBER: \` ${target} \``,
          `> Available Numbers: **[ ${numbers.join(", ")} ]**`,
          ``,
          `Type your math equation using these numbers to equal **${target}**!`,
          `*Allowed symbols:* \`+\` \`-\` \`*\` \`/\` \`(\` \`)\``,
          ``,
          `> **Reward:** \`+75 EP\``,
          `-# <a:pixelclockalarm:1571867210018852875> Time: 45 seconds | Example: (25 - 5) * 3 + 2`,
        ].join("\n"),
      );

    const timer = setTimeout(async () => {
      if (activeGames.has(channel.id)) {
        activeGames.delete(channel.id);
        const timeoutMsg = await channel.send({
          content: [
            `### <:vdaylost:1571861008954425436> Time's Up! Nobody solved for Target \`${target}\`.`,
            `> <:pawclawwarning:1571939413523562586> **Sample Solution:** \`${solution} = ${target}\``,
          ].join("\n"),
          components: [buildRestartRow("mathrush")],
        });
        attachRestartCollector(timeoutMsg, channel, "mathrush", client);
      }
    }, 45000);

    activeGames.set(channel.id, {
      type: "mathrush",
      numbers,
      target,
      solution,
      playerList,
      startedBy: playerList[0],
      timer,
      isSolving: false,
    });

    return channel.send({ embeds: [embed] });
  }

  // 2. QUICK-FIRE ANAGRAM DUEL
  if (gameType === "anagram") {
    const { letters, minLen } = getRandomAnagramSet();
    const solvedWords = new Set();
    const scores = new Map();

    const initialMsg = await channel.send({
      embeds: [buildAnagramEmbed(letters, minLen)],
    });

    const timer = setTimeout(async () => {
      if (activeGames.has(channel.id)) {
        const game = activeGames.get(channel.id);
        if (game.activeMsg) {
          game.activeMsg.delete().catch(() => {});
        }
        activeGames.delete(channel.id);

        const scoreLines = Array.from(scores.entries())
          .map(([id, ep]) => `- <@${id}>: **+${ep} EP**`)
          .join("\n");

        const resultEmbed = new EmbedBuilder()
          .setColor(0x00ffaa)
          .setTitle("<:rankbolt:1572178504731070524> Anagram Scores")
          .setDescription(
            scoreLines || "> No valid words were submitted this round!",
          );

        const endMsg = await channel.send({
          embeds: [resultEmbed],
          components: [buildRestartRow("anagram")],
        });
        attachRestartCollector(endMsg, channel, "anagram", client);
      }
    }, 45000);

    activeGames.set(channel.id, {
      type: "anagram",
      letters,
      minLen,
      solvedWords,
      scores,
      startedBy: playerList[0],
      timer,
      activeMsg: initialMsg,
    });
  }

  // 3. GUESS THE NUMBER (1-100)
  if (gameType === "guessnumber") {
    const secret = Math.floor(Math.random() * 100) + 1;
    let attempts = 0;

    const embed = new EmbedBuilder()
      .setColor(0x7928ca)
      .setAuthor({ name: "GUESS: 1 TO 100" })
      .setDescription(
        [
          `### I have chosen a secret number between **1** and **100**.`,
          `> Spam your guesses in chat!`,
          `> I will react **<:greenarrowup:1576128774309806281> (High)** / **<:redarrowdown:1576128771394642090> (Low)**.`,
          ``,
          `<a:moneybagcoin:1571920822694715492> Reward: **\` +75 EP \`**`,
          ``,
          `-# <:aesthetictimer:1572153881704534036> Auto-expires in 60 seconds.`,
        ].join("\n"),
      );

    await channel.send({ embeds: [embed] });

    const timer = setTimeout(async () => {
      if (activeGames.has(channel.id)) {
        activeGames.delete(channel.id);
        const timeoutMsg = await channel.send({
          content: `### <:vdaylost:1571861008954425436> Expired! The secret number was \`${secret}\`.`,
          components: [buildRestartRow("guessnumber")],
        });
        attachRestartCollector(timeoutMsg, channel, "guessnumber", client);
      }
    }, 60000);

    activeGames.set(channel.id, {
      type: "guessnumber",
      secret,
      attempts,
      startedBy: playerList[0],
      timer,
      isSolving: false,
    });
  }
}

// ------------------------------------------
// ORIGINAL CONTINUOUS SINGLE-PLAYER GENERATOR
// ------------------------------------------
async function fetchRandomWord(round = 1) {
  let length;
  let diffPool;

  if (round <= 10) {
    length = Math.floor(Math.random() * 4) + 4;
    diffPool = [1, 2, 3];
  } else if (round <= 25) {
    length = Math.floor(Math.random() * 4) + 6;
    diffPool = [2, 3, 4];
  } else {
    length = Math.floor(Math.random() * 3) + 9;
    diffPool = [3, 4, 5];
  }

  const diff = diffPool[Math.floor(Math.random() * diffPool.length)];

  try {
    const res = await fetch(
      `https://random-word-api.herokuapp.com/word?length=${length}&diff=${diff}`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (
        Array.isArray(data) &&
        data.length > 0 &&
        typeof data[0] === "string"
      ) {
        const candidate = data[0]
          .toUpperCase()
          .replace(/[^A-Z]/g, "")
          .trim();
        if (candidate.length >= 4) return candidate;
      }
    }
  } catch (err) {
    console.warn("[GAMES] Word API fetch timed out or failed:", err.message);
  }

  return null;
}

async function generateAiGameData(type, round = 1) {
  try {
    if (type === "unscramble") {
      let word = await fetchRandomWord(round);

      if (!word) {
        const fallbackPool = [
          "CYBER",
          "SATELLITE",
          "ROBOT",
          "NETWORK",
          "CIRCUIT",
          "GALAXY",
          "BROWSER",
          "SERVER",
          "CHAMPION",
          "STADIUM",
          "PYTHON",
          "CRYPTO",
          "KEYBOARD",
          "DATABASE",
          "MONITOR",
          "RADAR",
          "AVATAR",
          "STREAM",
          "GLITCH",
          "CONSOLE",
          "TITAN",
          "QUANTUM",
          "ROCKET",
          "ARENA",
        ];
        word = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
      }

      const shuffle = (str) => {
        const arr = str.split("");
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr.join("");
      };

      let scrambled = shuffle(word);
      let attempts = 0;
      while (scrambled === word && attempts < 10) {
        scrambled = shuffle(word);
        attempts++;
      }

      const spacedScramble = scrambled.split("").join("·");
      const roundEndTime = Math.floor((Date.now() + GAME_TIMEOUT_MS) / 1000);

      return {
        answer: word,
        embed: new EmbedBuilder()
          .setColor(0x00f3ff)
          .setDescription(
            [
              `### Unscramble the Target word`,
              `## \` ${spacedScramble} \` <a:wordlesolvepuzzle:1572154402326843422>`,
              `─────────────────────────────`,
              `> ${EMOJIS.timer} **Time Limit:** <t:${roundEndTime}:R> (<t:${roundEndTime}:T>)`,
              `> ${EMOJIS.bid} **Round Bounty:** \` +50 EP \``,
              `> <a:diamondgem:1571920814041858149> **Word Length:** \` ${word.length} Letters \``,
              `─────────────────────────────`,
              `-# <a:typing:1572155935915245638> **Type the unscrambled word directly in chat!**`,
            ].join("\n"),
          )
          .setFooter({ text: `Use /stopgame to end session` }),
      };
    }

    if (type === "emojigame") {
      const domainPools = [
        {
          category: "Movie / Franchise",
          seeds: [
            "Titanic",
            "Jurassic Park",
            "Pirates of the Caribbean",
            "Avatar",
            "The Matrix",
            "Toy Story",
            "Star Wars",
            "Inception",
            "The Lion King",
            "Finding Nemo",
          ],
        },
        {
          category: "Superhero / Character",
          seeds: [
            "Iron Man",
            "Batman",
            "Spider-Man",
            "Goku",
            "Pikachu",
            "Naruto",
            "Sherlock Holmes",
            "Darth Vader",
            "Captain America",
            "Thor",
          ],
        },
        {
          category: "Popular Video Game",
          seeds: [
            "Minecraft",
            "Grand Theft Auto",
            "Super Mario",
            "Pac Man",
            "Subway Surfers",
            "Among Us",
            "Fortnite",
            "Clash of Clans",
            "Temple Run",
            "Angry Birds",
          ],
        },
        {
          category: "Iconic Personality",
          seeds: [
            "Albert Einstein",
            "Cristiano Ronaldo",
            "Lionel Messi",
            "Michael Jackson",
            "Neil Armstrong",
            "William Shakespeare",
            "Elon Musk",
            "Usain Bolt",
          ],
        },
      ];

      const domain =
        domainPools[Math.floor(Math.random() * domainPools.length)];
      const candidateChoices = domain.seeds
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

      let puzzle = null;
      const res = await callAiWithFallback(
        `Choose ONE item from this list: [${candidateChoices.join(", ")}].
Create a clear, universally recognized "Guess the ${domain.category}" emoji riddle for it.
Strict Rules:
- Provide exactly 3 or 4 emojis that literally and unmistakably represent the chosen subject.
- Return strictly valid JSON: {"emojis": "EMOJIS", "answer": "Exact Name", "category": "${domain.category}"}. No extra text or markdown.`,
      );

      if (res) {
        try {
          const parsed = JSON.parse(res.replace(/```json|```/g, "").trim());
          if (parsed.emojis && parsed.answer) {
            puzzle = {
              emojis: parsed.emojis.trim(),
              answer: parsed.answer.trim(),
              category: parsed.category || domain.category,
            };
          }
        } catch (e) {}
      }

      if (!puzzle) {
        const fallbacks = [
          {
            emojis: "🧠👴💡",
            answer: "Albert Einstein",
            category: "Iconic Personality",
          },
          {
            emojis: "🚢🧊🌊",
            answer: "Titanic",
            category: "Movie / Franchise",
          },
          {
            emojis: "🦖🏝️🚙",
            answer: "Jurassic Park",
            category: "Movie / Franchise",
          },
          {
            emojis: "⛏️🧱🧟",
            answer: "Minecraft",
            category: "Popular Video Game",
          },
          {
            emojis: "🏎️🍌🍄",
            answer: "Super Mario",
            category: "Popular Video Game",
          },
          {
            emojis: "🕷️🕸️🏙️",
            answer: "Spider-Man",
            category: "Superhero / Character",
          },
          {
            emojis: "🦇🃏🏙️",
            answer: "Batman",
            category: "Superhero / Character",
          },
          {
            emojis: "⚡👓🦉",
            answer: "Harry Potter",
            category: "Superhero / Character",
          },
        ];
        puzzle = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      }

      return {
        answer: puzzle.answer,
        embed: new EmbedBuilder()
          .setColor(0xffd700)
          .setTitle(
            `🧩 Guess the **${puzzle.category}**\n-# <a:alertWarning:1571926677934575816> **Emoji game is broken, we're fixing it** <a:alertWarning:1571926677934575816>`,
          )
          .setDescription(
            [
              ``,
              `# \` ${puzzle.emojis} \``,
              ``,
              `> ${EMOJIS.timer} **Time Limit:** <t:${Math.floor((Date.now() + GAME_TIMEOUT_MS) / 1000)}:R>`,
              `> ${EMOJIS.bid} **Bounty:** \` +50 EP \``,
              ``,
              `-# **TYPE YOUR ANSWER DIRECTLY IN CHAT!**`,
              `-# \`/stopgame\` or \`!stopgame\` to cancel.`,
            ].join("\n"),
          )
          .setFooter({ text: `Guess It • Round ${round} • ATX` }),
      };
    }

    if (type === "fasttype") {
      let phrase = null;

      try {
        const res = await fetch("https://dummyjson.com/quotes/random", {
          signal: AbortSignal.timeout(4000),
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.quote) {
            let cleaned = data.quote
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, "")
              .replace(/\s+/g, " ")
              .trim();

            if (cleaned.split(" ").length >= 3) {
              phrase = cleaned;
            }
          }
        }
      } catch (err) {
        console.warn("[FASTTYPE API] Fetch failed:", err.message);
      }

      if (!phrase) {
        const fallbackPhrases = [
          "strike hard before the timer ends",
          "checkmate victory royale in the arena",
          "claim the ep balance and win",
          "super fast fingers win the prize",
          "lag is just an excuse for losing",
          "stay focused and type with speed",
          "never stop until victory is claimed",
        ];
        phrase =
          fallbackPhrases[Math.floor(Math.random() * fallbackPhrases.length)];
      }

      const roundEndTime = Math.floor((Date.now() + GAME_TIMEOUT_MS) / 1000);

      return {
        answer: phrase,
        embed: new EmbedBuilder()
          .setColor(0x00ff88)
          .setDescription(
            [
              `<:announcement:1571850123615404162> First to type this exact phrase wins`,
              ``,
              `\`\`\`ansi`,
              `\u001b[1;32m${phrase}\u001b[0m`,
              `\`\`\``,
              `─────────────────────────────`,
              `> ${EMOJIS.timer} **Time Limit:** <t:${roundEndTime}:R>`,
              `> ${EMOJIS.bid} **Round Bounty:** \` +50 EP \``,
              `─────────────────────────────`,
              `-# <a:typing:1572155935915245638> **Send the exact phrase in chat!**`,
            ].join("\n"),
          )
          .setFooter({ text: `Use /stopgame to end session` }),
      };
    }

    if (type === "quiz") {
      let difficulty = "easy";
      if (round > 15) difficulty = "hard";
      else if (round > 5) difficulty = "medium";

      const decodeHtml = (str) =>
        (str || "")
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&eacute;/g, "é")
          .replace(/&ntilde;/g, "ñ");

      let quizData = null;

      try {
        const res = await fetch(
          `https://opentdb.com/api.php?amount=1&difficulty=${difficulty}&type=multiple`,
          { signal: AbortSignal.timeout(4500) },
        );

        if (res.ok) {
          const data = await res.json();
          if (
            data.response_code === 0 &&
            data.results &&
            data.results.length > 0
          ) {
            const item = data.results[0];
            quizData = {
              question: decodeHtml(item.question),
              answer: decodeHtml(item.correct_answer).trim(),
              category: decodeHtml(item.category),
              difficulty: difficulty.toUpperCase(),
            };
          }
        }
      } catch (err) {
        console.warn("[QUIZ API] OpenTDB fetch error:", err.message);
      }

      if (!quizData) {
        quizData = {
          question:
            "Which planet is known as the Red Planet in our solar system?",
          answer: "Mars",
          category: "Science: Astronomy",
          difficulty: "EASY",
        };
      }

      const roundEndTime = Math.floor((Date.now() + GAME_TIMEOUT_MS) / 1000);
      const firstLetter = quizData.answer.charAt(0);
      const letterCount = quizData.answer.replace(/\s+/g, "").length;

      return {
        answer: quizData.answer,
        embed: new EmbedBuilder()
          .setColor(
            difficulty === "hard"
              ? 0xff0055
              : difficulty === "medium"
                ? 0xffa500
                : 0x00f3ff,
          )
          .setDescription(
            [
              `**Category <a:glowingsparkle:1571929751105315017> ${quizData.category}**`,
              ``,
              `### <a:questionmark:1572172749525221396> ${quizData.question}`,
              ``,
              `─────────────────────────────`,
              `> ${EMOJIS.timer} **Time Limit:** <t:${roundEndTime}:R>`,
              `> ${EMOJIS.bid} **Round Bounty:** +50 EP`,
              `> <a:tipsfedora:1571856989775073350> **Hint:** ${letterCount} Letters • **Starts with: \` ${firstLetter} \`**`,
              `─────────────────────────────`,
              `-# <a:typing:1572155935915245638> **Type the exact answer directly in chat!**`,
            ].join("\n"),
          )
          .setFooter({ text: `Use /stopgame to end session` }),
      };
    }
  } catch (err) {
    return {
      answer: "ACCELERATE",
      embed: new EmbedBuilder()
        .setColor(0x00f3ff)
        .setTitle("🎮 ATX Game Backup")
        .setDescription(
          "Unscramble this word: **`LATEACARCE`**\nTime: 2 Minutes!",
        ),
    };
  }
}

async function launchNextRound(channel, type, round = 1, client) {
  if (activeGames.has(channel.id)) {
    clearTimeout(activeGames.get(channel.id).timer);
  }

  const gameData = await generateAiGameData(type, round);
  const commandTitle = type ? type.toUpperCase() : "ARENA";

  const timer = setTimeout(async () => {
    if (activeGames.has(channel.id)) {
      const currentGame = activeGames.get(channel.id);
      activeGames.delete(channel.id);

      const timeoutEmbed = new EmbedBuilder()
        .setColor(0xff0055)
        .setAuthor({
          name: `${commandTitle} • TIMEOUT`,
          iconURL: client.user?.displayAvatarURL(),
        })
        .setDescription(
          [
            `### <:gameOverFinishEnd:1571805470249975878> Nobody was able to solve it`,
            ``,
            `> <a:approvedCorrect:1572188241245900890> **Correct Answer:** ${currentGame.answer}`,
            `> <:deadSkull:1571908653966041308> **Survived:** ${currentGame.round} Round${currentGame.round === 1 ? "" : "s"}`,
            ``,
            `-# Start new round with \`/${type}\` or \`!${type}\` `,
          ].join("\n"),
        )
        .setFooter({ text: "Use /help • Better luck next time!" });
      await channel.send({ embeds: [timeoutEmbed] }).catch(() => {});
    }
  }, GAME_TIMEOUT_MS);

  activeGames.set(channel.id, {
    type,
    answer: gameData.answer,
    round,
    startedBy: null,
    timer,
    isSolving: false,
  });

  gameData.embed.setAuthor({
    name: `${commandTitle} • ROUND - ${round}`,
    iconURL: client.user?.displayAvatarURL(),
  });

  await channel.send({ embeds: [gameData.embed] });
}

// ==========================================
// CENTRAL GAME COMMAND ROUTER
// ==========================================
async function handleGameCommands(ctx) {
  const { commandName, channel, reply, client, author, member } = ctx;

  if (["unscramble", "emojigame", "fasttype", "quiz"].includes(commandName)) {
    if (activeGames.has(channel.id) || activeLobbies.has(channel.id)) {
      return reply(
        "### <:gonnaCrySob:1571805498309611640> An arena game is already ongoing!\nUse `!stopgame` or `/stopgame` to cancel.",
      );
    }
    await reply(`Starting **${commandName}**! Initializing round 1...`);
    await launchNextRound(channel, commandName, 1, client);
    return true;
  }

  if (["math", "mathrush"].includes(commandName)) {
    await startMultiplayerLobby(ctx, "mathrush", client);
    return true;
  }
  if (commandName === "anagram") {
    await startMultiplayerLobby(ctx, "anagram", client);
    return true;
  }
  if (["guess", "guessnumber"].includes(commandName)) {
    await startMultiplayerLobby(ctx, "guessnumber", client);
    return true;
  }

  if (commandName === "stopgame") {
    if (!activeGames.has(channel.id) && !activeLobbies.has(channel.id)) {
      return reply(
        "### <:donotbullyids:1571852913708498955> No game or lobby is currently active in this channel!",
      );
    }

    const cur = activeGames.get(channel.id);
    const hostId = cur?.startedBy || cur?.playerList?.[0];
    const isAdmin =
      member?.permissions?.has(PermissionsBitField.Flags.Administrator) ||
      member?.permissions?.has(PermissionsBitField.Flags.ManageGuild);

    if (hostId && hostId !== author.id && !isAdmin) {
      return reply({
        content: `### <:redcardpenalty:1571939410977620059> Access Denied\n> Only the game host (<@${hostId}>) or a Server Admin can stop this round!`,
        ephemeral: true,
      });
    }

    if (activeLobbies.has(channel.id)) {
      activeLobbies.delete(channel.id);
      return reply(
        "<:skullcry:1571908660219609089> Matchmaking lobby cancelled.",
      );
    }

    clearTimeout(cur.timer);
    if (cur.activeMsg) cur.activeMsg.delete().catch(() => {});
    activeGames.delete(channel.id);

    const reveal = cur.solution
      ? `${cur.solution} = ${cur.target}`
      : cur.answer ||
        cur.secret ||
        (cur.target ? `Target: ${cur.target}` : "N/A");

    return reply(
      `### <:idcDonotCare:1571805403786772500> Mini-game halted.\n-# The solution was **\`${reveal}\`**.`,
    );
  }

  return false;
}

module.exports = {
  activeGames,
  activeLobbies,
  buildRestartRow,
  attachRestartCollector,
  buildAnagramEmbed,
  startMultiplayerLobby,
  launchNextRound,
  handleGameCommands,
};
