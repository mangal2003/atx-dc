// modules/gameEngines.js
const { Parser } = require("expr-eval");
const mathParser = new Parser();

// ---------------------------
// 1. MATH RUSH ENGINE
// ---------------------------
function generateMathRush() {
  const bigNumbers = [25, 50, 75, 100];
  const smallNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const numbers = [];
  numbers.push(bigNumbers[Math.floor(Math.random() * bigNumbers.length)]);
  while (numbers.length < 5) {
    numbers.push(smallNumbers[Math.floor(Math.random() * smallNumbers.length)]);
  }

  // Target between 21 and 150
  const target = Math.floor(Math.random() * 130) + 21;
  return { numbers, target };
}

function evaluateMathGuess(expression, allowedNumbers, target) {
  try {
    // Only allow digits, spaces, parentheses, and standard operators
    if (/[^0-9+\-*/()\s]/.test(expression)) return false;

    const usedMatches = expression.match(/\d+/g);
    if (!usedMatches || usedMatches.length < 2) return false;

    const usedNumbers = usedMatches.map(Number);
    const pool = [...allowedNumbers];

    for (const num of usedNumbers) {
      const idx = pool.indexOf(num);
      if (idx === -1) return false;
      pool.splice(idx, 1);
    }

    const calculated = mathParser.evaluate(expression);
    return Math.abs(calculated - target) < 0.0001;
  } catch {
    return false;
  }
}

// ---------------------------
// 2. HANGMAN ENGINE
// ---------------------------
const HANGMAN_WORDS = [
  "VALORANT",
  "MINECRAFT",
  "DISCORD",
  "CYBERPUNK",
  "DATABASE",
  "TERMINAL",
  "MONITOR",
  "KEYBOARD",
  "MONGODB",
  "EXPRESS",
  "FIREWALL",
  "RENDER",
  "ALGORITHM",
  "WARSHIP",
  "CHAMPION",
];

function getHangmanWord() {
  return HANGMAN_WORDS[Math.floor(Math.random() * HANGMAN_WORDS.length)];
}

// ---------------------------
// 3. ANAGRAM DUEL ENGINE
// ---------------------------
const ANAGRAM_SETS = [
  { letters: ["A", "E", "R", "T", "S", "L", "P"], minLen: 4 },
  { letters: ["C", "A", "T", "E", "R", "I", "N"], minLen: 4 },
  { letters: ["S", "T", "A", "R", "I", "N", "G"], minLen: 4 },
  { letters: ["D", "I", "S", "C", "O", "V", "E"], minLen: 4 },
];

function getRandomAnagramSet() {
  return ANAGRAM_SETS[Math.floor(Math.random() * ANAGRAM_SETS.length)];
}

module.exports = {
  generateMathRush,
  evaluateMathGuess,
  getHangmanWord,
  getRandomAnagramSet,
};
