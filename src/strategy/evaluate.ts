import type { Result, Player, Game } from "../backgammon";
import { constants as c, helpers as h } from "../backgammon";
import type { Factors } from "./factors";
export type EvaluationFunction = (game: Game, player: Player) => number;

type PipCounts = {
  white: number;
  black: number;
  diff: number;
  isRacing: boolean;
};

function getPipCounts(game: Game): PipCounts {
  let lastWhite = -1;
  let firstBlack = 24;
  let whitePips = game.wBar * 25;
  let blackPips = game.bBar * 25;

  for (let i = 0; i < 24; i++) {
    const pos = game.positions[i];
    const count = pos & 0b1111;

    if ((pos & c.WHITE) === c.WHITE) {
      lastWhite = i;
      whitePips += count * (i + 1);
    }
    if ((pos & c.BLACK) === c.BLACK && firstBlack == 24) {
      firstBlack = i;
      blackPips += count * (24 - i);
    }
  }

  return {
    white: whitePips,
    black: blackPips,
    diff: whitePips - blackPips,
    isRacing: lastWhite < firstBlack,
  };
}

export type Blot = {
  position: number;
  hitChance: number;
};

export type BlotAnalysis = {
  blots: Blot[];
  totalPenalty: number;
};

export function getBlots(game: Game, player: Player): BlotAnalysis {
  const blots: Blot[] = [];
  let totalPenalty = 0;

  for (let i = 0; i < 24; i++) {
    if ((game.positions[i] & player) === player && (game.positions[i] & 0b1111) === 1) {
      const hitChance = blotHitChance(game, i, player);
      blots.push({ position: i, hitChance });
      totalPenalty += hitChance;
    }
  }

  return { blots, totalPenalty };
}

export type PositionStrength = {
  homeBonus: number;
  anchorBonus: number;
  distanceValue: number;
};

export function getPositionStrength(pos: number, player: Player, f: Factors): PositionStrength {
  const whitePos = player === c.WHITE ? pos : 23 - pos;
  const HOME_FIVE_POINT = 4;
  const dist = Math.abs(whitePos - HOME_FIVE_POINT);

  return {
    homeBonus: whitePos <= 5 ? f.homeBonus : 0,
    anchorBonus: whitePos >= 18 && whitePos <= 23 ? f.anchorBonus : 0,
    distanceValue: 2.0 * Math.exp(-dist / f.positionDecay),
  };
}

export type BoardStrength = {
  positions: PositionStrength[]; // strength of each point
  homePoints: number; // count of points in home
  anchorPoints: number; // count of anchor points
  fivePointControl: number; // sum of position values
};

export function getBoardStrength(game: Game, player: Player, f: Factors): BoardStrength {
  const positions = new Array(24);
  let homePoints = 0;
  let anchorPoints = 0;
  let fivePointControl = 0;

  for (let i = 0; i < 24; i++) {
    if ((game.positions[i] & player) === player) {
      positions[i] = getPositionStrength(i, player, f);
      fivePointControl += positions[i].distanceValue;
      if (positions[i].homeBonus) homePoints++;
      if (positions[i].anchorBonus) anchorPoints++;
    }
  }

  return { positions, homePoints, anchorPoints, fivePointControl };
}

type Prime = {
  start: number;
  length: number;
};

type PrimeAnalysis = {
  primes: Prime[];
  count: number;
};

function analyzePrimes(game: Game, player: Player): PrimeAnalysis {
  const primes: Prime[] = [];
  let currentPrime = null;
  let count = 0;

  for (let i = 0; i < 24; i++) {
    if ((game.positions[i] & player) === player && (game.positions[i] & 0b1111) >= 2) {
      if (!currentPrime) {
        currentPrime = { start: i, length: 1 };
      } else {
        currentPrime.length++;
      }
    } else if (currentPrime) {
      if (currentPrime.length >= 3) {
        primes.push(currentPrime);
        count += currentPrime.length - 2;
      }
      currentPrime = null;
    }
  }

  if (currentPrime?.length >= 3) {
    primes.push(currentPrime);
    count += currentPrime.length - 2;
  }

  return { primes, count };
}

function generateHitProbabilities() {
  const probs = {};
  for (let d = 1; d <= 24; d++) {
    probs[d] = 0;
  } // init
  for (let d1 = 1; d1 <= 6; d1++) {
    for (let d2 = 1; d2 <= 6; d2++) {
      probs[d1] += 1 / 36;
      if (d1 !== d2) probs[d2] += 1 / 36;
      probs[d1 + d2] += 1 / 36; // using both dice
      if (d1 === d2) {
        // doubles
        probs[d1 * 3] += 1 / 36; // Using 3
        probs[d1 * 4] += 1 / 36; // Using all 4
      }
    }
  }
  return probs;
}

const probMap = generateHitProbabilities();

function blotHitChance(game, blotPosition, player) {
  const opponent = player === c.WHITE ? c.BLACK : c.WHITE;
  const direction = opponent === c.BLACK ? -1 : 1;
  let totalProb = 0;

  // Look at each position that could potentially hit
  for (let dist = 1; dist < 24; dist++) {
    if (!probMap[dist]) continue;
    const hitFromPos = blotPosition - dist * direction;

    // check opponent bar
    if (hitFromPos == -1 && opponent == c.BLACK && game.bBar) totalProb += probMap[dist];
    if (hitFromPos == 24 && opponent == c.WHITE && game.wBar) totalProb += probMap[dist];
    if (hitFromPos <= -1 || hitFromPos >= 24) continue;

    // If there's an opponent piece at this distance
    if ((game.positions[hitFromPos] & opponent) === opponent) {
      const pieceCount = game.positions[hitFromPos] & 0b1111;
      if (pieceCount == 1 || pieceCount >= 3) {
        totalProb += probMap[dist];
      } else {
        totalProb += probMap[dist] / 2; // discount breaking a prime
      }
    }
  }

  return Math.min(1, totalProb); // Cap at 100% chance
}

const evaluate: (f: Factors) => EvaluationFunction = (f: Factors) => (game, player) => {
  let score = 0;

  score -= (player === c.WHITE ? game.wBar : game.bBar) * f.barPenalty;
  score += (player === c.WHITE ? game.bBar : game.wBar) * f.barReward;

  score += (player === c.WHITE ? game.wHome : game.bHome) * f.homeReward;
  score -= (player === c.WHITE ? game.bHome : game.wHome) * f.homePenalty;

  const pips = getPipCounts(game);
  score += pips.isRacing ? (pips.diff / 24) * f.racingPipReward : (pips.diff / 24) * f.contactPipReward;

  const strength = getBoardStrength(game, player, f);
  score += strength.fivePointControl + strength.homePoints * f.homeBonus + strength.anchorPoints * f.anchorBonus;

  const primes = analyzePrimes(game, player);
  score += primes.count * f.primeReward;

  const blots = getBlots(game, player);
  score -= blots.totalPenalty * f.blotPenalty;

  return score;
};

export { evaluate };
