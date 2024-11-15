import { constants as c, helpers as h } from "../backgammon";
import type { Player } from "../backgammon";
import { forCompare as Strategies } from "../strategy/strategies";

type StrategyName = keyof typeof Strategies;

interface MatchResult {
  wins: number;
  games: number;
  winRate: number;
  confidenceInterval: [number, number];
}

interface TournamentResult {
  results: MatchResult[][];
  names: StrategyName[];
  totalGames: number;
  totalDuration: number;
  significance: number;
}

interface EarlyStopConfig {
  minGames: number;           // Minimum games to play before considering early stop
  maxGames: number;           // Maximum games to play before forcing stop
  significanceLevel: number;  // p-value threshold for significance (e.g., 0.05)
}

const DEFAULT_EARLY_STOP_CONFIG: EarlyStopConfig = {
  minGames: 100,    // Always play at least 100 games
  maxGames: 1000,   // Never play more than 1000 games
  significanceLevel: 0.05
};

const colWidth = 8; // tweak to fit

function drawProgressBar(current: number, total: number) {
    const width = 30;
    const percent = Math.round((current / total) * 100);
    const filledWidth = Math.round((current / total) * width);
    const emptyWidth = width - filledWidth;
    
    const filled = "█".repeat(filledWidth);
    const empty = "░".repeat(emptyWidth);
    const output = `[${filled}${empty}] ${percent}% (${current}/${total})`;
    
    process.stdout.write(output);
}

function clearProgressBar(current: number, total: number) {
  const percent = Math.round((current / total) * 100);
  const output = `[${"█".repeat(30)}] ${percent}% (${current}/${total})`;
  // First move back by the length of the output
  const backspaces = "\b".repeat(output.length);
  // Then write spaces to clear old content
  const spaces = " ".repeat(output.length);
  // Then move back again and write new content
  process.stdout.write(backspaces + spaces + backspaces);
}

function calculateConfidenceInterval(wins: number, games: number, confidence = 0.95): [number, number] {
  // Using Wilson score interval
  const z = 1.96; // 95% confidence
  const p = wins / games;
  const n = games;
  
  const denominator = 1 + z * z / n;
  const center = (p + z * z / (2 * n)) / denominator;
  const interval = z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n) / denominator;
  
  return [
    Math.max(0, center - interval),
    Math.min(1, center + interval)
  ];
}

function isSignificantDifference(result1: MatchResult, result2: MatchResult): boolean {
  // Check if confidence intervals overlap
  return result1.confidenceInterval[1] < result2.confidenceInterval[0] ||
         result2.confidenceInterval[1] < result1.confidenceInterval[0];
}

function createMatchResult(wins: number, games: number): MatchResult {
  return {
    wins,
    games,
    winRate: wins / games,
    confidenceInterval: calculateConfidenceInterval(wins, games)
  };
}

function shouldContinuePlaying(wins: number, games: number, config: EarlyStopConfig): boolean {
  // Always play minimum number of games
  if (games < config.minGames) return true;
  
  // Never exceed maximum games
  if (games >= config.maxGames) return false;

  // Create match results for both perspectives
  const result1 = createMatchResult(wins, games);
  const result2 = createMatchResult(games - wins, games);

  // If we have statistical significance, we can stop
  if (isSignificantDifference(result1, result2)) {
    return false;
  }

  // Otherwise, keep playing
  return true;
}

function colorWinPercent(result: MatchResult): string {
  const winPercent = result.winRate;
  const hue = Math.round(120 * winPercent); // 0 (red) to 120 (green)
  const saturation = 90;
  const lightness = 35;
  return `\x1b[48;2;${hslToRgb(hue, saturation, lightness).join(";")}m${(100 * winPercent).toFixed(1).padStart(colWidth)}%\x1b[0m`;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

function compareTwoAdaptive(
  a: StrategyName, 
  b: StrategyName, 
  tStrategies,
  config: EarlyStopConfig
): MatchResult {
  let awins = 0;
  let games = 0;

  // Keep playing until we hit our stopping condition
  while (shouldContinuePlaying(awins, games, config)) {
    games++;
    drawProgressBar(games, config.maxGames);
    
    let game = h.newGame();
    game.turn = (games % 2 === 0 ? c.WHITE : c.BLACK) as Player;

    while (!h.checkWinner(game)) {
      const currentStrategy = game.turn === c.WHITE ? tStrategies[a] : tStrategies[b];
      const roll = h.generateRoll();
      [, game] = h.takeTurn(game, roll, currentStrategy);
    }
    
    if (h.checkWinner(game) === c.WHITE) awins++;
    clearProgressBar(games, config.maxGames);
  }

  const winRate = awins / games;
  const confidenceInterval = calculateConfidenceInterval(awins, games);

  return {
    wins: awins,
    games,
    winRate,
    confidenceInterval
  };
}

function roundRobinTournament(
  strategies, 
  config: EarlyStopConfig = DEFAULT_EARLY_STOP_CONFIG
): TournamentResult {
  const names = Object.keys(strategies) as StrategyName[];
  const results: MatchResult[][] = names.map(() => 
    new Array(names.length).fill(null as unknown as MatchResult)
  );

  const totalMatches = names.length * (names.length - 1);
  let currentMatch = 0;
  process.stdout.write(
    `Adaptive games (${config.minGames}-${config.maxGames}) per round.\n` +
    `Significance level: p < ${config.significanceLevel}\n` +
    `Strategies: ${names.join(", ")}\n`
  );
  
  const startTime = performance.now();

  for (let i = 0; i < names.length; i++) {
    for (let j = i; j < names.length; j++) {
      currentMatch++;
      process.stdout.write("\x1b[2K\r");
      process.stdout.write(`[${currentMatch}/${totalMatches}] ${String(names[i]).padEnd(10)} vs ${String(names[j]).padEnd(10)} `);
      
      if (i === j) {
        results[i][i] = {
          wins: config.minGames / 2,
          games: config.minGames,
          winRate: 0.5,
          confidenceInterval: [0.5, 0.5]
        };
        continue;
      }

      const result = compareTwoAdaptive(names[i], names[j], strategies, config);
      results[i][j] = result;
      results[j][i] = {
        wins: result.games - result.wins,
        games: result.games,
        winRate: 1 - result.winRate,
        confidenceInterval: [1 - result.confidenceInterval[1], 1 - result.confidenceInterval[0]]
      };
    }
  }

  const endTime = performance.now();
  const totalDuration = (endTime - startTime) / 1000;
  const totalGames = results.reduce((sum, row) => 
    sum + row.reduce((rowSum, cell) => rowSum + cell.games, 0), 0) / 2;

  process.stdout.write("\n\n");

  // Print results table - flipped axes for better readability
  console.log("Against\t" + names.map((n) => String(n).padStart(colWidth)).join("\t"));
  for (let j = 0; j < names.length; j++) {
    const row = [];
    for (let i = 0; i < names.length; i++) {
      row.push(results[i][j]); // Note: accessing [i][j] instead of [j][i] for the flip
    }
    console.log(
      String(names[j]).padStart(colWidth) + "\t" + 
      row.map(r => colorWinPercent(r)).join("\t")
    );
  }

  // Calculate and display average loss rates (more intuitive - lower is better)
  const averageLossRates = names.map((_, i) => 
    results.reduce((sum, row) => sum + row[i].winRate, 0) / names.length
  );
  const bestStrategyIndex = averageLossRates.indexOf(Math.min(...averageLossRates));
  const worstStrategyIndex = averageLossRates.indexOf(Math.max(...averageLossRates));

  console.log(`\n${names.length} strategies. ${totalMatches} matchups. ${totalGames} total games played.`);
  console.log(`best: ${String(names[bestStrategyIndex])} with ${(100 - averageLossRates[bestStrategyIndex] * 100).toFixed(1)}% average win rate`);
  console.log(`worst: ${String(names[worstStrategyIndex])} with ${(100 - averageLossRates[worstStrategyIndex] * 100).toFixed(1)}% average win rate`);
  console.log(`Total time: ${totalDuration.toFixed(2)}s.`);
  console.log(`${(totalDuration / totalMatches).toFixed(2)}s average per matchup`);

  // Print significant results with clearer win rate interpretations
  console.log("\nSignificant Results (95% confidence):");
  for (let i = 0; i < names.length; i++) {
    for (let j = 0; j < i; j++) {
      const result = results[i][j];
      const oppositeResult = results[j][i];
      
      if (isSignificantDifference(result, oppositeResult)) {
        const winner = result.winRate > oppositeResult.winRate ? names[i] : names[j];
        const loser = winner === names[i] ? names[j] : names[i];
        const winnerResult = result.winRate > oppositeResult.winRate ? result : oppositeResult;
        console.log(
          `${winner} wins ${(winnerResult.winRate * 100).toFixed(1)}% ` +
          `[${(winnerResult.confidenceInterval[0] * 100).toFixed(1)}% - ${(winnerResult.confidenceInterval[1] * 100).toFixed(1)}%] ` +
          `against ${loser}`
        );
      } else if (result.winRate !== 0.5) { // Only show non-ties
        console.log(
          `${names[i]} vs ${names[j]}: No significant advantage ` +
          `(${(result.winRate * 100).toFixed(1)}% ± ${((result.confidenceInterval[1] - result.confidenceInterval[0]) * 50).toFixed(1)}%)`
        );
      }
    }
  }

  return {
    results,
    names,
    totalGames,
    totalDuration,
    significance: 1 - config.significanceLevel
  };
}

function runMultipleTrials(
  strategies,
  config: EarlyStopConfig = DEFAULT_EARLY_STOP_CONFIG,
  trials: number = 10
): void {
  const names = Object.keys(strategies) as StrategyName[];
  const winCounts: Record<string, Record<string, number>> = {};
  const totalGames: Record<string, Record<string, number[]>> = {};
  const winRates: Record<string, Record<string, number[]>> = {};
  
  // Initialize tracking structures
  for (const a of names) {
    winCounts[a] = {};
    totalGames[a] = {};
    winRates[a] = {};
    for (const b of names) {
      if (a < b) {  // Only track one direction
        winCounts[a][b] = { a: 0, b: 0, inconclusive: 0 };
        totalGames[a][b] = [];
        winRates[a][b] = [];
      }
    }
  }

  console.log(`Running ${trials} trials...\n`);
  
  for (let trial = 0; trial < trials; trial++) {
    const result = roundRobinTournament(strategies, config);
    
    // Record results
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {  // Only process each pair once
        const a = names[i];
        const b = names[j];
        const result1 = result.results[i][j];
        const result2 = result.results[j][i];
        
        // Track games played and win rates
        totalGames[a][b].push(result1.games);
        winRates[a][b].push(result1.winRate);
        
        if (isSignificantDifference(result1, result2)) {
          if (result1.winRate > result2.winRate) {
            winCounts[a][b].a++;
          } else {
            winCounts[a][b].b++;
          }
        } else {
          winCounts[a][b].inconclusive++;
        }
      }
    }
    
    console.log(`Completed trial ${trial + 1}/${trials}`);
  }

  console.log("\nWin consistency analysis:");
  for (const a of names) {
    for (const b of names) {
      if (a < b) {  // Only report each pair once
        const counts = winCounts[a][b];
        const games = totalGames[a][b];
        const rates = winRates[a][b];
        
        // Calculate mean and standard deviation of win rates
        const meanRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;
        const stdDev = Math.sqrt(
          rates.reduce((sum, r) => sum + (r - meanRate) ** 2, 0) / (rates.length - 1)
        );
        
        console.log(
          `${a} vs ${b}: ` +
          `${a} wins ${counts.a}, ${b} wins ${counts.b}, ${counts.inconclusive} inconclusive ` +
          `(${(counts.a/trials*100).toFixed(1)}% / ${(counts.b/trials*100).toFixed(1)}% / ${(counts.inconclusive/trials*100).toFixed(1)}%)`
        );
        console.log(
          `  Win rate: ${(meanRate*100).toFixed(1)}% ± ${(stdDev*100).toFixed(1)}% (std dev)` +
          `  Games per trial: ${Math.round(games.reduce((sum, g) => sum + g, 0) / games.length)}`
        );
      }
    }
  }
}
}

if (import.meta.main) {
  runMultipleTrials(Strategies, {
    minGames: 50,
    maxGames: 1500,
    significanceLevel: 0.05
  }, 5);
}

export { roundRobinTournament, type MatchResult, type TournamentResult, type EarlyStopConfig };
