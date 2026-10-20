import { Game, Player, Roll, constants as c, helpers as h } from "../../backgammon";
import { evaluate } from "../../strategy/evaluate";
import { factors as f, FACTOR_KEYS } from "../../strategy/factors";
import type { Factors } from "../../strategy/factors";
import { AppliedStrategy, useEval, Strategies } from "../../strategy/strategies";
import { compareTwo } from "../../evals/tournament";
import { default as learnedFactors } from "../learnedFactors.json";

type Position = { game: Game; score: number; roll: Roll };
type GameOutcome = 1 | -1; // 1 for win, -1 for loss

const factorScales: Record<keyof Factors, number> = {
  barPenalty: 1,
  barReward: 1,
  homeReward: 1,
  homePenalty: 1,
  blotPenalty: 1,
  primeReward: 0.25, // Primes are rare (0-2), so small divisor = larger effective LR
  racingPipReward: 60, // Pip differences are large (20-50), so large divisor = smaller effective LR
  contactPipReward: 60, // Same as racing
  positionDecay: 0.4, // Used in exponential, needs smaller effective LR
  homeBonus: 1,
  anchorBonus: 1,
};

const getLR = (initialLR: number, gameCount: number, decay = 0.9995) => {
  const minLR = 1e-5;
  return Math.max(initialLR * Math.pow(decay, gameCount), minLR);
};

function scaleFactors(factors: Factors): Factors {
  // Instead of normalizing to sum=1, scale to keep factors in reasonable range
  const maxAbsValue = Math.max(...Object.values(factors).map(Math.abs));
  if (maxAbsValue > 10) {
    const scale = 10 / maxAbsValue;
    const newFactors = { ...factors };
    for (const key of FACTOR_KEYS) {
      newFactors[key] = factors[key] * scale;
    }
    return newFactors;
  }
  return factors;
}

function updateFactors(factors: Factors, gameHistory: Position[], outcome: GameOutcome, learningRate: number): Factors {
  const newFactors = { ...factors };
  const baselineScores = new Map<string, number>(); // Cache game scores

  // Compute and cache baseline scores
  for (const { game } of gameHistory) {
    const key = JSON.stringify(game);
    if (!baselineScores.has(key)) {
      baselineScores.set(key, evaluate(factors)(game, h.toMove(game)));
    }
  }

  // Track factor updates for adaptive learning rates
  const updates = new Map<string, number>();

  for (const key of FACTOR_KEYS) {
    const tweakedFactors = { ...factors };
    const perturbation = 0.003 * Math.abs(factors[key]); // Relative perturbation
    tweakedFactors[key] += perturbation;

    let improvement = 0;
    let weightSum = 0;

    for (let i = 0; i < gameHistory.length; i++) {
      const { game } = gameHistory[i];
      const gameKey = JSON.stringify(game);
      const originalEval = baselineScores.get(gameKey)!;
      const tweakedEval = evaluate(tweakedFactors)(game, h.toMove(game));

      // Progressive weighting - more weight to later positions
      const weight = Math.exp(i / gameHistory.length - 1);
      weightSum += weight;

      // Normalize improvement by perturbation size
      improvement += ((tweakedEval - originalEval) * weight * outcome) / perturbation;
    }

    // Normalize by total weight
    improvement /= weightSum;

    // Adaptive learning rate based on recent updates
    const prevUpdate = updates.get(key) || 0;
    const adaptiveLR = learningRate * (Math.abs(prevUpdate) < 0.1 ? 1.1 : 0.9);

    // Scale learning rate by factor's typical magnitude
    const effectiveLR = adaptiveLR / factorScales[key];

    // Update with momentum and gradient clipping
    const momentum = 0.5;
    const gradientClip = 0.3;
    const clampedImprovement = Math.max(Math.min(improvement, gradientClip), -gradientClip);
    const update = effectiveLR * clampedImprovement + momentum * prevUpdate;

    newFactors[key] = Math.max(0.0001, newFactors[key] + update); // Keep factors positive
    updates.set(key, update);
  }

  return scaleFactors(newFactors);
}

function trainFactors(): Factors {
  // start from the hand-tuned weights; the older learned weights were trained against a buggy evaluation
  const initialFactors = f.balancedFactors;
  const initialLearningRate = 0.008;
  const numGames = 8000;
  const validationInterval = 500;
  const escapeThreshold = 2000;

  let currentFactors = { ...initialFactors };
  let bestFactors = { ...currentFactors };
  let bestWinRate = -Infinity;
  let gamesSinceImprovement = 0;

  for (let count = 0; count < numGames; count++) {
    const gameHistory: Position[] = [];
    const currentEval = evaluate(currentFactors);
    const currentStrategy = useEval(currentEval);

    const opponents = [
      Strategies.random,
      Strategies.random,
      Strategies.runner,
      Strategies.balanced,
      useEval(evaluate(f.learned)),
      useEval(evaluate(f.prevLearned)),
      useEval(evaluate(f.prevPrevLearned)),
      useEval(evaluate(bestFactors)),
    ];

    const opponent = opponents[Math.floor(Math.random() * opponents.length)];

    // alternate the learner's color, and pick who moves first at random
    const learner: Player = count % 2 ? c.BLACK : c.WHITE;
    let game = h.newGame();
    game.turn = Math.random() < 0.5 ? c.WHITE : c.BLACK;

    const maxMoves = 400;
    let moveCount = 0;

    while (!h.checkWinner(game) && moveCount < maxMoves) {
      moveCount++;
      const mover = game.turn;
      const roll = h.generateRoll();
      const result = (mover === learner ? currentStrategy : opponent)(game, roll);
      const next = result ? result[1] : h.cloneGame(game);
      if (mover === learner && result) {
        // copy before switching turns, so the position is scored from the learner's side
        gameHistory.push({ game: h.cloneGame(next), roll, score: currentEval(next, learner) });
      }
      next.turn = mover === c.WHITE ? c.BLACK : c.WHITE;
      game = next;
    }

    const winner = h.checkWinner(game);
    if (!winner) continue; // hit the move cap; no outcome to learn from
    const outcome: GameOutcome = winner === learner ? 1 : -1;

    currentFactors = updateFactors(currentFactors, gameHistory, outcome, getLR(initialLearningRate, gamesSinceImprovement));

    if (count % validationInterval === 0) {
      // paired games on fixed dice, so checkpoints are compared on the same games
      const validationOpps = [Strategies.balanced, Strategies.runner, Strategies.learned, useEval(evaluate(f.prevLearned))];
      const strategy = useEval(evaluate(currentFactors));
      const rates = validationOpps.map((opp) => compareTwo(strategy, opp, { pairs: 60, seed: 7 }).winRate);
      const validationWinRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;
      const names = ["balanced", "runner", "learned", "prevLearned"];
      console.log(
        `[game ${count}/${numGames}] validation win rate ${(validationWinRate * 100).toFixed(1)}% (` +
          names.map((n, i) => `${n} ${(rates[i] * 100).toFixed(1)}%`).join(", ") +
          ")",
      );

      // Take the average of both win rates for determining improvement
      if (validationWinRate > bestWinRate) {
        bestWinRate = validationWinRate;
        bestFactors = { ...currentFactors };
        gamesSinceImprovement = 0;
        console.log("New best factors: ", Object.fromEntries(Object.entries(currentFactors).map(([k, v]) => [k, v.toFixed(3)])));
      } else {
        gamesSinceImprovement += validationInterval; // increment by validation interval
      }

      // If we're stuck, try escaping the local optimum
      if (gamesSinceImprovement >= escapeThreshold || validationWinRate < .4) {
        console.log(`No improvement for ${gamesSinceImprovement} games. Attempting to escape local optimum...`);

        // Create a new point in factor space by:
        // 1. Taking best factors so far
        // 2. Randomly perturbing some factors significantly
        // 3. Keeping some factors from current position
        const escapedFactors = { ...bestFactors };
        const numFactorsToPerturb = Math.floor(Object.keys(currentFactors).length * 0.7); // Perturb 70% of factors

        // Randomly select factors to perturb
        const factorKeys = [...FACTOR_KEYS];
        const shuffled = factorKeys.sort(() => Math.random() - 0.5);
        const toPerturb = shuffled.slice(0, numFactorsToPerturb);

        for (const key of toPerturb) {
          // Random perturbation between 0.1x and 5x the current value
          const multiplier = 0.2 + 5 * Math.random();
          escapedFactors[key] = bestFactors[key] * multiplier + multiplier;

          // Sometimes (10% chance) try taking value from the initial factors
          if (Math.random() < 0.1) {
            escapedFactors[key] = initialFactors[key];
          }
          if (Math.random() < 0.02) {
            escapedFactors[key] = 1;
          }
        }

        currentFactors = escapedFactors;
        gamesSinceImprovement = 0;

        console.log("Escaped to new factors:", Object.fromEntries(Object.entries(currentFactors).map(([k, v]) => [k, v.toFixed(3)])));
      }
    }
  }

  return bestFactors;
}

// Train against opponents
const finalFactors = trainFactors();
learnedFactors.push(finalFactors);

const path = "src/ml/learnedFactors.json";
await Bun.write(path, JSON.stringify(learnedFactors, null, 2));

console.log("Training complete. Best factors found:", finalFactors, "wrote to ", path);
