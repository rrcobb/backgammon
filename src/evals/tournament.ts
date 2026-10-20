import { constants as c } from "../backgammon";
import type { Player } from "../backgammon";
import type { AppliedStrategy } from "../strategy/strategies";
import { playGame, meanInterval } from "./play";
import type { MeanInterval, Outcome } from "./play";
import { forCompare } from "../strategy/strategies";

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
  points: MeanInterval; // points won per game, net: wins count +1/+2/+3, losses negative
}

interface TournamentResult {
  names: string[];
  results: (MatchResult | null)[][]; // results[i][j]: i's results against j
  averageWinRates: number[]; // each strategy's mean win rate over its opponents
  averagePoints: number[]; // each strategy's mean points per game over its opponents
  totalGames: number;
  totalDuration: number; // seconds
  config: Required<TournamentConfig>;
}

const DEFAULTS = { seed: 1, confidence: 0.95, progress: true };

function summarize(pairScores: number[], pairPoints: number[], confidence: number): MatchResult {
  const n = pairScores.length;
  const { mean, low, high } = meanInterval(pairScores, confidence);
  return {
    wins: Math.round(mean * n * 2),
    games: n * 2,
    winRate: mean,
    confidenceInterval: [Math.max(0, low), Math.min(1, high)],
    significant: low > 0.5 || high < 0.5,
    points: meanInterval(pairPoints, confidence),
  };
}

function invert(r: MatchResult): MatchResult {
  return {
    wins: r.games - r.wins,
    games: r.games,
    winRate: 1 - r.winRate,
    confidenceInterval: [1 - r.confidenceInterval[1], 1 - r.confidenceInterval[0]],
    significant: r.significant,
    points: { mean: -r.points.mean, low: -r.points.high, high: -r.points.low, n: r.points.n },
  };
}

// from `player`'s side: +points for a win, -points for a loss
const signedPoints = (o: Outcome, player: Player) => (o.winner === player ? o.points : -o.points);

// play `pairs` pairs of games between a and b; results are from a's side
function compareTwo(a: AppliedStrategy, b: AppliedStrategy, config: TournamentConfig, onPair?: (done: number) => void): MatchResult {
  const { pairs, seed, confidence } = { ...DEFAULTS, ...config };
  const pairScores: number[] = [];
  const pairPoints: number[] = [];
  for (let p = 0; p < pairs; p++) {
    const pairSeed = seed * 1_000_003 + p;
    const asWhite = playGame(a, b, pairSeed);
    const asBlack = playGame(b, a, pairSeed);
    pairScores.push(((asWhite.winner === c.WHITE ? 1 : 0) + (asBlack.winner === c.BLACK ? 1 : 0)) / 2);
    pairPoints.push((signedPoints(asWhite, c.WHITE) + signedPoints(asBlack, c.BLACK)) / 2);
    onPair?.(p + 1);
  }
  return summarize(pairScores, pairPoints, confidence);
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

  const average = (i: number, f: (r: MatchResult) => number, empty: number) => {
    const values = results[i].filter((r) => r).map((r) => f(r!));
    return values.length ? values.reduce((s, x) => s + x, 0) / values.length : empty;
  };
  const averageWinRates = names.map((_, i) => average(i, (r) => r.winRate, 0.5));
  const averagePoints = names.map((_, i) => average(i, (r) => r.points.mean, 0));

  return {
    names,
    results,
    averageWinRates,
    averagePoints,
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
const signed = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(2)}`;

function printTournament(t: TournamentResult) {
  const width = Math.max(9, ...t.names.map((n) => n.length + 1));
  console.log(`\nRow's win rate against column. * marks results whose ${pct(t.config.confidence)} interval excludes 50%.`);
  if (t.config.pairs < 30) {
    console.log(`Only ${t.config.pairs} pairs per matchup: the intervals use a normal approximation and aren't reliable below about 30.`);
  }
  console.log();
  console.log("".padStart(width) + t.names.map((n) => n.padStart(width)).join(""));
  t.names.forEach((name, i) => {
    console.log(name.padStart(width) + t.results[i].map((r) => colorCell(r, width)).join(""));
  });

  console.log("\nAverage against the field (win rate, points per game):");
  t.names
    .map((name, i) => ({ name, rate: t.averageWinRates[i], points: t.averagePoints[i] }))
    .sort((a, b) => b.points - a.points)
    .forEach(({ name, rate, points }) => console.log(`  ${name.padEnd(width)} ${pct(rate).padStart(6)}  ${signed(points)}`));

  console.log("\nMatchups:");
  for (let i = 0; i < t.names.length; i++) {
    for (let j = i + 1; j < t.names.length; j++) {
      const r = t.results[i][j]!;
      const [low, high] = r.confidenceInterval;
      const verdict = !r.significant
        ? "no significant difference"
        : `${r.winRate > 0.5 ? t.names[i] : t.names[j]} is stronger`;
      const p = r.points;
      console.log(
        `  ${t.names[i]} vs ${t.names[j]}: ${pct(r.winRate)} [${pct(low)}, ${pct(high)}], ` +
          `${signed(p.mean)} points/game [${signed(p.low)}, ${signed(p.high)}] over ${r.games} games; ${verdict}`,
      );
    }
  }

  console.log(`\n${t.totalGames} games in ${t.totalDuration.toFixed(1)}s.`);
}

// bun src/evals/tournament.ts [pairs] [strategy names, or net:<checkpoint>...]
if (import.meta.main) {
  const { resolveStrategy } = await import("./resolve");
  const [pairsArg, ...names] = process.argv.slice(2);
  const pairs = Number(pairsArg ?? 100);
  let strategies: Strategies = forCompare;
  try {
    if (names.length) strategies = Object.fromEntries(names.map(resolveStrategy).map((r) => [r.label, r.strategy]));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
  printTournament(roundRobinTournament(strategies, { pairs }));
}

export { roundRobinTournament, compareTwo, playGame, printTournament, type MatchResult, type TournamentResult, type TournamentConfig };
