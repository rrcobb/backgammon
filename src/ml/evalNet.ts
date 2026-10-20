import { constants as c, helpers as h } from "../backgammon";
import type { Game, Player } from "../backgammon";
import { fromSafetensors, type MLP } from "./mlp";
import { INPUT_SIZE } from "./encoding";
import { whiteWins } from "../strategy/net";
import { Strategies, isStrategyName } from "../strategy/strategies";
import type { AppliedStrategy } from "../strategy/strategies";
import { seededDice, playOut } from "../evals/play";

/*
  How well does a net predict who wins?

  Play games with a fixed policy (not the net, so the positions don't come
  from its own play), and score the net's P(white wins) at every position
  against the result. Reports the Brier score (mean squared error of the
  probability; always guessing 50% scores 0.25) and how often the net picks
  the winner, overall and by quarter of the game.
*/

type Sample = { game: Game; onRoll: Player; whiteWon: number; progress: number };

function collect(policy: AppliedStrategy, games: number, seed: number): Sample[] {
  const samples: Sample[] = [];
  for (let g = 0; g < games; g++) {
    const dice = seededDice(seed * 1009 + g);
    const positions: { game: Game; onRoll: Player }[] = [];
    // record each position before its move, by wrapping the policy
    const recording: AppliedStrategy = (game, roll, report) => {
      positions.push({ game: h.cloneGame(game), onRoll: h.toMove(game) });
      return policy(game, roll, report);
    };
    const start = h.newGame();
    start.turn = g % 2 === 0 ? c.WHITE : c.BLACK;
    const winner = playOut(start, recording, recording, dice);
    positions.forEach((p, i) =>
      samples.push({ ...p, whiteWon: winner === c.WHITE ? 1 : 0, progress: i / positions.length }),
    );
  }
  return samples;
}

type Score = { n: number; brier: number; accuracy: number; meanPrediction: number };

function score(net: MLP, samples: Sample[]): Score {
  const x = new Float32Array(INPUT_SIZE);
  let se = 0;
  let right = 0;
  let sum = 0;
  for (const s of samples) {
    const p = whiteWins(net, s.game, s.onRoll, x);
    se += (p - s.whiteWon) ** 2;
    right += (p > 0.5 ? 1 : 0) === s.whiteWon ? 1 : 0;
    sum += p;
  }
  return { n: samples.length, brier: se / samples.length, accuracy: right / samples.length, meanPrediction: sum / samples.length };
}

function evaluateNet(net: MLP, samples: Sample[]) {
  const quarters = [0, 1, 2, 3].map((q) => samples.filter((s) => Math.min(3, Math.floor(s.progress * 4)) === q));
  return { overall: score(net, samples), quarters: quarters.map((qs) => score(net, qs)) };
}

const fmt = (s: Score) =>
  `brier ${s.brier.toFixed(3)}, picks the winner ${(100 * s.accuracy).toFixed(1)}%, mean P(white) ${s.meanPrediction.toFixed(2)} (${s.n} positions)`;

// bun src/ml/evalNet.ts <checkpoint.safetensors>... [--games=300] [--policy=learned]
if (import.meta.main) {
  const args = process.argv.slice(2);
  const flags = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));
  const paths = args.filter((a) => !a.startsWith("--"));
  const policyName = flags.policy ?? "learned";
  if (!paths.length || !isStrategyName(policyName)) {
    console.error("usage: bun src/ml/evalNet.ts <checkpoint.safetensors>... [--games=300] [--policy=learned]");
    process.exit(1);
  }
  const games = Number(flags.games ?? 300);
  const samples = collect(Strategies[policyName], games, 1);
  console.log(`${games} games of ${policyName} vs ${policyName}, ${samples.length} positions. Always guessing 50% scores brier 0.250.`);
  for (const path of paths) {
    const { net, metadata } = fromSafetensors(new Uint8Array(await Bun.file(path).arrayBuffer()));
    const r = evaluateNet(net, samples);
    console.log(`\n${path} (${metadata.games ?? "?"} training games)`);
    console.log(`  overall: ${fmt(r.overall)}`);
    r.quarters.forEach((q, i) => console.log(`  quarter ${i + 1}: ${fmt(q)}`));
  }
}

export { collect, evaluateNet, score, type Sample, type Score };
