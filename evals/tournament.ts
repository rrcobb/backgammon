import { constants as c, helpers as h } from "../src/backgammon";
import type { Player } from "../src/backgammon";
import { forCompare as Strategies } from "../src/strategies";

type StrategyName = keyof typeof Strategies;

function compareTwo(a: StrategyName, b: StrategyName, games: number, tStrategies): [number, number] {
  let awins = 0;
  let bwins = 0;

  for (let i = 0; i < games; i++) {
    drawProgressBar(i, games);
    let game = h.newGame();
    game.turn = (i % 2 === 0 ? c.WHITE : c.BLACK) as Player;

    while (!h.checkWinner(game)) {
      const currentStrategy = game.turn === c.WHITE ? tStrategies[a] : tStrategies[b];
      const roll = h.generateRoll();
      [, game] = h.takeTurn(game, roll, currentStrategy);
    }
    h.checkWinner(game) === c.WHITE ? awins++ : bwins++;
    clearProgressBar(i, games)
  }

  return [awins, bwins];
}

const colWidth = 8; // tweak to fit

function drawProgressBar(current, total) {
    const width = 30;
    const percent = Math.round((current / total) * 100);
    const filledWidth = Math.round((current / total) * width);
    const emptyWidth = width - filledWidth;
    
    const filled = "█".repeat(filledWidth);
    const empty = "░".repeat(emptyWidth);
    const output = `[${filled}${empty}] ${percent}% (${current}/${total})`;
    
    process.stdout.write(output);
}

function clearProgressBar(current, total) {
  const percent = Math.round((current / total) * 100);
  const output = `[${"█".repeat(30)}] ${percent}% (${current}/${total})`;
  // First move back by the length of the output
  const backspaces = "\b".repeat(output.length);
  // Then write spaces to clear old content
  const spaces = " ".repeat(output.length);
  // Then move back again and write new content
  process.stdout.write(backspaces + spaces + backspaces)
}

function roundRobinTournament(strategies, games: number) {
  const names = Object.keys(strategies) as StrategyName[];
  const results: number[][] = names.map(() => new Array(names.length).fill(0));

  const totalMatches = names.length * (names.length - 1);
  let currentMatch = 0;
  process.stdout.write(`${games} games per round. Strategies: ${names.join(", ")}\n`);
  const startTime = performance.now();

  for (let i = 0; i < names.length; i++) {
    for (let j = i; j < names.length; j++) {
      currentMatch++;
      process.stdout.write("\x1b[2K\r");
      process.stdout.write(`[${currentMatch}/${totalMatches}] ${String(names[i]).padEnd(10)} vs ${String(names[j]).padEnd(10)} `);
      if (i == j) {
        results[i][i] = 0.5;
        continue;
      }
      const [aWins, bWins] = compareTwo(names[i], names[j], games, strategies);
      results[j][i] = aWins / games;
      results[i][j] = bWins / games;
    }
  }

  const endTime = performance.now();
  const totalDuration = (endTime - startTime) / 1000;
  process.stdout.write("\n\n");

  console.log("".padStart(colWidth) + "\t" + names.map((n) => String(n).padStart(colWidth)).join("\t"));
  for (let i = 0; i < names.length; i++) {
    console.log(String(names[i]).padStart(colWidth) + "\t" + results[i].map((w) => colorWinPercent(w)).join("\t"));
  }

  const averageLossRates = names.map((_, i) => results[i].reduce((sum, rate) => sum + rate, 0) / names.length);
  const bestStrategyIndex = averageLossRates.indexOf(Math.min(...averageLossRates));
  const worstStrategyIndex = averageLossRates.indexOf(Math.max(...averageLossRates));

  console.log(`${names.length} strategies. ${totalMatches} matchups. ${totalMatches * games} games played.`);
  console.log(`best: ${String(names[bestStrategyIndex])} with ${((1 - averageLossRates[bestStrategyIndex]) * 100).toFixed(1)}% average win rate`);
  console.log(`worst: ${String(names[worstStrategyIndex])} with ${((1 - averageLossRates[worstStrategyIndex]) * 100).toFixed(1)}% average win rate`);
  console.log(`Total time: ${totalDuration.toFixed(2)}s.`);
  console.log(`${(totalDuration / totalMatches).toFixed(2)}s per matchup of ${games} games`);

  return { totalMatches, names, averageLossRates, totalDuration, totalMatches, results}
}

function colorWinPercent(winPercent: number): string {
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

if (import.meta.main) {
  roundRobinTournament(Strategies, 20);
} else {
  // this file is being imported by another file
  // don't run something
}

export { roundRobinTournament }
