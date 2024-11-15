import type { Result, Player, Game } from "../backgammon";
export type EvaluationFunction = (game: Game, player: Player) => number;
import { default as learnedFactors } from "../ml/learnedFactors.json";
import { evaluate } from "./evaluate";

export type Factors = {
  barPenalty: number;
  barReward: number;
  homeReward: number;
  homePenalty: number;
  blotPenalty: number;
  primeReward: number;
  racingPipReward: number;
  contactPipReward: number;
  positionDecay: number;
  homeBonus: number;
  anchorBonus: number;
};

const balancedFactors: Factors = {
  barPenalty: 0.3,
  barReward: 0.2,
  homeReward: 0.4,
  homePenalty: 0.2,
  blotPenalty: 0.2,
  primeReward: 4,
  racingPipReward: 0.03,
  contactPipReward: 0.005,
  positionDecay: 2.5,
  homeBonus: 0.3,
  anchorBonus: 0.3,
};

const runnerFactors: Factors = {
  barPenalty: 0.1,
  barReward: 0.1,
  homeReward: 9,
  homePenalty: 1,
  blotPenalty: 0.1,
  primeReward: 0.3,
  racingPipReward: 0.15,
  contactPipReward: 0.05,
  positionDecay: 2,
  homeBonus: 0.01,
  anchorBonus: 0.01,
};

// see learnFactors.ts
const learned = learnedFactors[learnedFactors.length - 1];
const prevLearned = learnedFactors[learnedFactors.length - 2];
const prevPrevLearned = learnedFactors[learnedFactors.length - 3];

const factors = { balancedFactors, runnerFactors, learned, prevLearned, prevPrevLearned };

export { evaluate, factors };
