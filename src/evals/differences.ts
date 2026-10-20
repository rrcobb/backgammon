import { constants as c, helpers as h } from "../backgammon";
import type { Game, Move, Player, Roll } from "../backgammon";
import type { AppliedStrategy } from "../strategy/strategies";
import { Strategies, isStrategyName } from "../strategy/strategies";
import { formatMove, formatPosition } from "../notation";
import { seededDice, playOut, meanInterval, type MeanInterval } from "./play";

/*
  Difference rollouts: compare two strategies only where they disagree.

  Play games between A and B. At every turn, ask both strategies what they
  would play with that roll. Where they choose different positions, roll out
  each choice to the end of the game with a fixed policy playing both sides,
  and compare the mover's win rate. Both choices are rolled out on the same
  dice seeds, so most of the dice luck cancels between them.

  Positions where the strategies agree don't affect the result, which makes
  this much more sensitive than a tournament for strategies that mostly agree.
  The result depends on the rollout policy: a weak policy may misjudge which
  choice is better.
*/

type DifferencesConfig = {
  positions: number; // disagreements to collect
  rollouts: number; // rollouts per choice
  policy: AppliedStrategy; // plays both sides in the rollouts
  seed?: number;
  maxDecisions?: number; // stop looking after this many turns, in case the strategies rarely disagree
  progress?: boolean;
};

type Disagreement = {
  game: Game; // before the move; game.turn is the mover
  roll: Roll;
  mover: Player;
  moves: [Move, Move]; // A's move, B's move
  values: [number, number]; // the mover's rollout win rate after each choice
  difference: MeanInterval; // A minus B, per paired rollout
};

type DifferencesResult = {
  disagreements: Disagreement[];
  decisions: number; // turns looked at
  difference: MeanInterval; // mean over disagreements of A minus B
};

function samePosition(a: Game, b: Game): boolean {
  if (a.wBar !== b.wBar || a.bBar !== b.bBar || a.wHome !== b.wHome || a.bHome !== b.bHome) return false;
  for (let i = 0; i < 24; i++) if (a.positions[i] !== b.positions[i]) return false;
  return true;
}

const other = (p: Player): Player => (p === c.WHITE ? c.BLACK : c.WHITE);

// roll out both choices on the same seeds; returns per-seed differences for the mover (1, 0, or -1)
function pairedRollouts(afterA: Game, afterB: Game, mover: Player, config: DifferencesConfig, seedBase: number) {
  const diffs: number[] = [];
  let winsA = 0;
  let winsB = 0;
  for (let r = 0; r < config.rollouts; r++) {
    const seed = seedBase + r;
    // the game in a Result still has turn set to the mover; the opponent rolls next
    const a = { ...h.cloneGame(afterA), turn: other(mover) };
    const b = { ...h.cloneGame(afterB), turn: other(mover) };
    const wonA = playOut(a, config.policy, config.policy, seededDice(seed)) === mover ? 1 : 0;
    const wonB = playOut(b, config.policy, config.policy, seededDice(seed)) === mover ? 1 : 0;
    winsA += wonA;
    winsB += wonB;
    diffs.push(wonA - wonB);
  }
  return { diffs, values: [winsA / config.rollouts, winsB / config.rollouts] as [number, number] };
}

function compareByRollouts(a: AppliedStrategy, b: AppliedStrategy, config: DifferencesConfig): DifferencesResult {
  const seed = config.seed ?? 1;
  const maxDecisions = config.maxDecisions ?? 100_000;
  const disagreements: Disagreement[] = [];
  let decisions = 0;
  let gameNo = 0;

  const searching = () => disagreements.length < config.positions && decisions < maxDecisions;
  while (searching()) {
    // alternate which strategy plays white
    const aColor = gameNo % 2 === 0 ? c.WHITE : c.BLACK;
    const dice = seededDice(seed * 7919 + gameNo);
    gameNo++;

    let game = h.newGame();
    game.turn = gameNo % 4 < 2 ? c.WHITE : c.BLACK;
    while (!h.checkWinner(game) && searching()) {
      const roll = dice.roll();
      const mover = game.turn as Player;
      const choiceA = a(h.cloneGame(game), roll);
      const choiceB = b(h.cloneGame(game), roll);
      decisions++;

      if (choiceA && choiceB && !samePosition(choiceA[1], choiceB[1])) {
        const seedBase = (seed * 104729 + disagreements.length) * 10007;
        const { diffs, values } = pairedRollouts(choiceA[1], choiceB[1], mover, config, seedBase);
        disagreements.push({
          game: h.cloneGame(game),
          roll,
          mover,
          moves: [choiceA[0], choiceB[0]],
          values,
          difference: meanInterval(diffs),
        });
        if (config.progress && disagreements.length % 10 === 0) {
          console.log(`${disagreements.length}/${config.positions} disagreements, ${decisions} decisions looked at`);
        }
      }

      // continue the game with whichever strategy owns this turn
      const own = mover === aColor ? choiceA : choiceB;
      const next = own ? own[1] : h.cloneGame(game);
      next.turn = other(mover);
      game = next;
    }
  }

  return {
    disagreements,
    decisions,
    difference: disagreements.length
      ? meanInterval(disagreements.map((d) => d.values[0] - d.values[1]))
      : { mean: 0, low: 0, high: 0, n: 0 },
  };
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const signedPct = (x: number) => `${x >= 0 ? "+" : ""}${(100 * x).toFixed(1)}%`;

function printDifferences(nameA: string, nameB: string, policyName: string, config: DifferencesConfig, r: DifferencesResult, top = 5) {
  const { mean, low, high } = r.difference;
  console.log(
    `\n${nameA} vs ${nameB}: they disagreed on ${r.disagreements.length} of ${r.decisions} decisions (${pct(r.disagreements.length / r.decisions)}).`,
  );
  console.log(`Each choice rolled out ${config.rollouts} times with ${policyName} playing both sides.\n`);
  console.log(`Mean win rate difference where they disagree, ${nameA} minus ${nameB}: ${signedPct(mean)} [${signedPct(low)}, ${signedPct(high)}]`);
  const verdict = low > 0 ? `${nameA} chooses better` : high < 0 ? `${nameB} chooses better` : "no significant difference";
  console.log(`${verdict}.`);

  const significantA = r.disagreements.filter((d) => d.difference.low > 0).length;
  const significantB = r.disagreements.filter((d) => d.difference.high < 0).length;
  console.log(`Positions where one choice is significantly better: ${nameA} ${significantA}, ${nameB} ${significantB}.`);

  const biggest = [...r.disagreements].sort((x, y) => Math.abs(y.difference.mean) - Math.abs(x.difference.mean)).slice(0, top);
  console.log(`\nLargest differences:`);
  for (const d of biggest) {
    const moverName = d.mover === c.WHITE ? "white" : "black";
    console.log(`\n${formatPosition(d.game)}`);
    console.log(`${moverName} to play ${d.roll[0]}-${d.roll[1]}`);
    console.log(`  ${nameA}: ${formatMove(d.moves[0], d.mover).padEnd(20)} wins ${pct(d.values[0])}`);
    console.log(`  ${nameB}: ${formatMove(d.moves[1], d.mover).padEnd(20)} wins ${pct(d.values[1])}`);
    console.log(`  difference ${signedPct(d.difference.mean)} [${signedPct(d.difference.low)}, ${signedPct(d.difference.high)}]`);
  }
}

// bun src/evals/differences.ts <A> <B> [positions] [rollouts] [policy]
if (import.meta.main) {
  const [nameA, nameB, positionsArg, rolloutsArg, policyArg] = process.argv.slice(2);
  const policyName = policyArg ?? "learned";
  if (!isStrategyName(nameA) || !isStrategyName(nameB) || !isStrategyName(policyName)) {
    console.error(`usage: bun src/evals/differences.ts <A> <B> [positions=100] [rollouts=100] [policy=learned]`);
    console.error(`strategies: ${Object.keys(Strategies).join(", ")}`);
    process.exit(1);
  }
  const config = {
    positions: Number(positionsArg ?? 100),
    rollouts: Number(rolloutsArg ?? 100),
    policy: Strategies[policyName],
    progress: true,
  };
  const start = performance.now();
  const result = compareByRollouts(Strategies[nameA], Strategies[nameB], config);
  printDifferences(nameA, nameB, policyName, config, result);
  console.log(`\n${((performance.now() - start) / 1000).toFixed(1)}s`);
}

export { compareByRollouts, printDifferences, type DifferencesConfig, type DifferencesResult, type Disagreement };
