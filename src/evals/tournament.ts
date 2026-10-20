import { constants as c, helpers as h } from "../backgammon";
import type { Die, Game, Player, Roll } from "../backgammon";
import type { AppliedStrategy } from "../strategy/strategies";
import { forCompare as Strategies } from "../strategy/strategies";

/*
  Tournament between strategies.

  Games are played in pairs. Both games in a pair use the same dice sequence,
  with the strategies swapping colors between them. That cancels most of the
  dice luck, and any advantage one color has, out of the comparison.

  Each pair scores 1, 0.5, or 0 for a strategy (won both, split, lost both).
  The confidence interval is computed over the pair scores, since the two
  games in a pair are not independent.

  The number of pairs is fixed up front. Stopping as soon as the interval
  excludes 50% would inflate the false positive rate.
*/

type Strategies = Record<string, AppliedStrategy>;

interface TournamentConfig {
  pairs: number; // pairs of games per matchup
  seed?: number; // seed for the game dice; strategies keep their own randomness
  confidence?: number; // e.g. 0.95
  progress?: boolean; // print progress while running
}

interface MatchResult {
  wins: number;
  games: number;
  winRate: number;
  confidenceInterval: [number, number];
  significant: boolean; // the interval excludes 50%
}

interface TournamentResult {
  names: string[];
  results: (MatchResult | null)[][]; // results[i][j]: i's results against j
  averageWinRates: number[]; // each strategy's mean win rate over its opponents
  totalGames: number;
  totalDuration: number; // seconds
  config: Required<TournamentConfig>;
}

const DEFAULTS = { seed: 1, confidence: 0.95, progress: true };

// mulberry32, a small seeded PRNG
function seededRandom(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededDice(seed: number) {
  const rand = seededRandom(seed);
  const die = () => (Math.floor(rand() * 6) + 1) as Die;
  return { die, roll: (): Roll => [die(), die()] };
}

// play one game; returns the winner
function playGame(white: AppliedStrategy, black: AppliedStrategy, seed: number): Player {
  const dice = seededDice(seed);

  // roll off: the higher die moves first, and plays the two dice as its first roll
  let wDie: Die, bDie: Die;
  do {
    wDie = dice.die();
    bDie = dice.die();
  } while (wDie === bDie);

  let game: Game = h.newGame();
  game.turn = wDie > bDie ? c.WHITE : c.BLACK;
  let roll: Roll = [wDie, bDie];

  let winner: Player | false;
  while (!(winner = h.checkWinner(game))) {
    const strategy = game.turn === c.WHITE ? white : black;
    [, game] = h.takeTurn(game, roll, strategy);
    roll = dice.roll();
  }
  return winner;
}

function zScore(confidence: number): number {
  // two-sided z for common levels; fall back to 95%
  const table = { 0.9: 1.645, 0.95: 1.96, 0.99: 2.576, 0.999: 3.291 };
  return table[confidence] ?? 1.96;
}

function summarize(pairScores: number[], confidence: number): MatchResult {
  const n = pairScores.length;
  const mean = pairScores.reduce((s, x) => s + x, 0) / n;
  const variance = n > 1 ? pairScores.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1) : 0;
  const half = zScore(confidence) * Math.sqrt(variance / n);
  const low = Math.max(0, mean - half);
  const high = Math.min(1, mean + half);
  return {
    wins: Math.round(mean * n * 2),
    games: n * 2,
    winRate: mean,
    confidenceInterval: [low, high],
    significant: low > 0.5 || high < 0.5,
  };
}

function invert(r: MatchResult): MatchResult {
  return {
    wins: r.games - r.wins,
    games: r.games,
    winRate: 1 - r.winRate,
    confidenceInterval: [1 - r.confidenceInterval[1], 1 - r.confidenceInterval[0]],
    significant: r.significant,
  };
}

// play `pairs` pairs of games between a and b; results are from a's side
function compareTwo(a: AppliedStrategy, b: AppliedStrategy, config: TournamentConfig, onPair?: (done: number) => void): MatchResult {
  const { pairs, seed, confidence } = { ...DEFAULTS, ...config };
  const pairScores: number[] = [];
  for (let p = 0; p < pairs; p++) {
    const pairSeed = seed * 1_000_003 + p;
    const aWhite = playGame(a, b, pairSeed) === c.WHITE ? 1 : 0;
    const aBlack = playGame(b, a, pairSeed) === c.BLACK ? 1 : 0;
    pairScores.push((aWhite + aBlack) / 2);
    onPair?.(p + 1);
  }
  return summarize(pairScores, confidence);
}

function roundRobinTournament(strategies: Strategies, config: TournamentConfig): TournamentResult {
  const full = { ...DEFAULTS, ...config };
  const names = Object.keys(strategies);
  const n = names.length;
  const results: (MatchResult | null)[][] = names.map(() => new Array(n).fill(null));
  const totalMatches = (n * (n - 1)) / 2;

  if (full.progress) {
    console.log(`${full.pairs} pairs (${full.pairs * 2} games) per matchup, seed ${full.seed}. Strategies: ${names.join(", ")}`);
  }

  const start = performance.now();
  let match = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      match++;
      const label = `[${match}/${totalMatches}] ${names[i]} vs ${names[j]}`;
      const onPair = !full.progress
        ? undefined
        : process.stdout.isTTY
          ? (done: number) => process.stdout.write(`\x1b[2K\r${label}: pair ${done}/${full.pairs}`)
          : (done: number) => (done % 10 === 0 || done === full.pairs) && console.log(`${label}: pair ${done}/${full.pairs}`);
      // each matchup gets the same dice, so results across matchups are comparable
      const result = compareTwo(strategies[names[i]], strategies[names[j]], full, onPair);
      results[i][j] = result;
      results[j][i] = invert(result);
    }
  }
  if (full.progress && process.stdout.isTTY) process.stdout.write("\x1b[2K\r");

  const averageWinRates = names.map((_, i) => {
    const rates = results[i].filter((r) => r).map((r) => r!.winRate);
    return rates.length ? rates.reduce((s, x) => s + x, 0) / rates.length : 0.5;
  });

  return {
    names,
    results,
    averageWinRates,
    totalGames: totalMatches * full.pairs * 2,
    totalDuration: (performance.now() - start) / 1000,
    config: full,
  };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

function colorCell(r: MatchResult | null, width: number): string {
  if (!r) return "—".padStart(width);
  const hue = Math.round(120 * r.winRate); // 0 (red) to 120 (green)
  const text = `${(100 * r.winRate).toFixed(1)}%${r.significant ? "*" : " "}`.padStart(width);
  return `\x1b[48;2;${hslToRgb(hue, 90, 35).join(";")}m${text}\x1b[0m`;
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

function printTournament(t: TournamentResult) {
  const width = Math.max(9, ...t.names.map((n) => n.length + 1));
  console.log(`\nRow's win rate against column. * marks results whose ${pct(t.config.confidence)} interval excludes 50%.\n`);
  console.log("".padStart(width) + t.names.map((n) => n.padStart(width)).join(""));
  t.names.forEach((name, i) => {
    console.log(name.padStart(width) + t.results[i].map((r) => colorCell(r, width)).join(""));
  });

  console.log("\nAverage win rate against the field:");
  t.names
    .map((name, i) => ({ name, rate: t.averageWinRates[i] }))
    .sort((a, b) => b.rate - a.rate)
    .forEach(({ name, rate }) => console.log(`  ${name.padEnd(width)} ${pct(rate)}`));

  console.log("\nMatchups:");
  for (let i = 0; i < t.names.length; i++) {
    for (let j = i + 1; j < t.names.length; j++) {
      const r = t.results[i][j]!;
      const [low, high] = r.confidenceInterval;
      const verdict = !r.significant
        ? "no significant difference"
        : `${r.winRate > 0.5 ? t.names[i] : t.names[j]} is stronger`;
      console.log(`  ${t.names[i]} vs ${t.names[j]}: ${pct(r.winRate)} [${pct(low)}, ${pct(high)}] over ${r.games} games; ${verdict}`);
    }
  }

  console.log(`\n${t.totalGames} games in ${t.totalDuration.toFixed(1)}s.`);
}

if (import.meta.main) {
  const pairs = Number(process.argv[2] ?? 100);
  printTournament(roundRobinTournament(Strategies, { pairs }));
}

export { roundRobinTournament, compareTwo, playGame, printTournament, type MatchResult, type TournamentResult, type TournamentConfig };
