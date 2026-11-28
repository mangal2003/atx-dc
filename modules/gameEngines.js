// modules/gameEngines.js
const { Parser } = require("expr-eval");
const mathParser = new Parser();

// ---------------------------
// 1. MATH RUSH ENGINE (GUARANTEED SOLVABLE)
// ---------------------------
function generateMathRush() {
  const bigNumbers = [25, 50, 75, 100];
  const smallNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const numbers = [bigNumbers[Math.floor(Math.random() * bigNumbers.length)]];
  while (numbers.length < 5) {
    numbers.push(smallNumbers[Math.floor(Math.random() * smallNumbers.length)]);
  }

  // Shuffle pool
  const pool = [...numbers].sort(() => 0.5 - Math.random());

  // Procedurally generate a guaranteed target using a subset of numbers
  const a = pool[0];
  const b = pool[1];
  const c = pool[2];

  const templates = [
    { target: (a + b) * c, eq: `(${a} + ${b}) * ${c}` },
    { target: a * b + c, eq: `(${a} * ${b}) + ${c}` },
    {
      target: Math.abs(a - b) * c,
      eq: `(${Math.max(a, b)} - ${Math.min(a, b)}) * ${c}`,
    },
    { target: a + b + c, eq: `${a} + ${b} + ${c}` },
  ];

  // Pick a valid candidate equation with target between 20 and 250
  const validCandidates = templates.filter(
    (t) => Number.isInteger(t.target) && t.target >= 20 && t.target <= 250,
  );
  const selected =
    validCandidates.length > 0
      ? validCandidates[Math.floor(Math.random() * validCandidates.length)]
      : { target: a + b, eq: `${a} + ${b}` };

  return {
    numbers,
    target: selected.target,
    solution: selected.eq,
  };
}

function evaluateMathGuess(expression, allowedNumbers, target) {
  try {
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
// 2. INFINITE ANAGRAM ENGINE
// ---------------------------
let wordsDict = null;
try {
  const checkWord = require("check-word");
  wordsDict = checkWord("en");
} catch (e) {
  console.warn(
    "[ANAGRAM] 'check-word' module not installed. Running without dictionary validation.",
  );
}

const VOWEL_POOL = [
  "A",
  "A",
  "A",
  "A",
  "A",
  "A",
  "A",
  "A",
  "A",
  "E",
  "E",
  "E",
  "E",
  "E",
  "E",
  "E",
  "E",
  "E",
  "E",
  "E",
  "E",
  "I",
  "I",
  "I",
  "I",
  "I",
  "I",
  "I",
  "I",
  "I",
  "O",
  "O",
  "O",
  "O",
  "O",
  "O",
  "O",
  "O",
  "U",
  "U",
  "U",
  "U",
];

const CONSONANT_POOL = [
  "R",
  "R",
  "R",
  "R",
  "R",
  "R",
  "J",
  "J",
  "J",
  "J",
  "R",
  "T",
  "T",
  "T",
  "T",
  "T",
  "T",
  "N",
  "N",
  "N",
  "N",
  "N",
  "N",
  "N",
  "N",
  "S",
  "X",
  "S",
  "X",
  "X",
  "X",
  "S",
  "S",
  "S",
  "L",
  "L",
  "L",
  "L",
  "L",
  "C",
  "C",
  "D",
  "D",
  "D",
  "D",
  "P",
  "P",
  "P",
  "P",
  "P",
  "M",
  "M",
  "M",
  "M",
  "M",
  "H",
  "H",
  "H",
  "H",
  "G",
  "G",
  "G",
  "G",
  "B",
  "Q",
  "Q",
  "Q",
  "Q",
  "B",
  "F",
  "F",
  "F",
  "F",
  "Y",
  "Y",
  "Y",
  "Y",
  "W",
  "W",
  "W",
  "W",
  "K",
  "K",
  "K",
  "K",
  "K",
  "Z",
  "V",
  "Z",
  "Z",
  "V",
  "Z",
  "V",
  "Z",
  "V",
];

function getRandomAnagramSet() {
  const letters = [];
  const numVowels = Math.floor(Math.random() * 2) + 2; // 2 or 3 vowels
  for (let i = 0; i < numVowels; i++) {
    letters.push(VOWEL_POOL[Math.floor(Math.random() * VOWEL_POOL.length)]);
  }

  while (letters.length < 7) {
    letters.push(
      CONSONANT_POOL[Math.floor(Math.random() * CONSONANT_POOL.length)],
    );
  }

  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }

  return {
    letters,
    minLen: 4,
  };
}

function isValidDictionaryWord(word) {
  if (!wordsDict) return true;
  return wordsDict.check(word.toLowerCase());
}

module.exports = {
  generateMathRush,
  evaluateMathGuess,
  getRandomAnagramSet,
  isValidDictionaryWord,
};
