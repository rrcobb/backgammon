import assert from "assert";
import type { Result, Player, Game } from "../backgammon";
import { constants as c, helpers as h } from "../backgammon";
import type { Factors } from "./factors";
export type EvaluationFunction = (game: Game, player: Player) => number;

type PipCounts = {
  white: number;
  black: number;
  diff: number; // the player's lead: opponent's pips minus the player's
  isRacing: boolean;
};

// white moves from index 0 up to 23, black from 23 down to 0
function getPipCounts(game: Game, player: Player): PipCounts {
  let firstWhite = 24;
  let lastBlack = -1;
  // a checker on the bar has the full 25 pips to go
  let whitePips = game.wBar * 25;
  let blackPips = game.bBar * 25;

  for (let i = 0; i < 24; i++) {
    const pos = game.positions[i];
    const count = pos & 0b1111;

    if ((pos & c.WHITE) === c.WHITE) {
      if (firstWhite == 24) {
        firstWhite = i;
      }
      whitePips += count * (24 - i);
    }
    if ((pos & c.BLACK) === c.BLACK) {
      lastBlack = i;
      blackPips += count * (i + 1);
    }
  }

  const whiteLead = blackPips - whitePips;
  return {
    white: whitePips,
    black: blackPips,
    diff: player === c.WHITE ? whiteLead : -whiteLead,
    // the checkers have passed each other: every black checker is below every white one
    isRacing: !game.wBar && !game.bBar && lastBlack < firstWhite,
  };
}

export type HitChance = number;
export type BlotAnalysis = {
  blots: Record<number, HitChance>;
  totalPenalty: number;
};

function getBlots(game: Game, player: Player): BlotAnalysis {
  const blots: Record<number, HitChance> = {};
  let totalPenalty = 0;

  for (let i = 0; i < 24; i++) {
    if ((game.positions[i] & player) === player && (game.positions[i] & 0b1111) === 1) {
      const hitChance = blotHitChance(game, i, player);
      blots[i] = (hitChance);
      totalPenalty += hitChance;
    } else {
    }
  }

  return { blots, totalPenalty };
}

type PositionInfo = {
  isHome: boolean;
  isAnchor: boolean;
  distanceValue: number;
};

function getPositionInfo(pos: number, player: Player, f: Factors): PositionInfo {
  // the point number from the player's side: 1-6 is their home board, 19-24 is the opponent's
  const point = player === c.WHITE ? 24 - pos : pos + 1;
  const FIVE_POINT = 5;
  const dist = Math.abs(point - FIVE_POINT);

  return {
    isHome: point <= 6,
    isAnchor: point >= 19,
    distanceValue: 2.0 * Math.exp(-dist / f.positionDecay),
  };
}

type BoardStrength = {
  positions: PositionInfo[];
  homeCount: number;
  anchorCount: number;
  fivePointControl: number;
};

function getBoardStrength(game: Game, player: Player, blots: BlotAnalysis, f: Factors): BoardStrength {
  const positions = new Array(24);
  let homeCount = 0;
  let anchorCount = 0;
  let fivePointControl = 0;

  for (let i = 0; i < 24; i++) {
    const count = game.positions[i] & 0b1111;
    const pos = game.positions[i];
    if ((pos & player) === player) {
      positions[i] = getPositionInfo(i, player, f);
      if (count >= 2) {
        fivePointControl += positions[i].distanceValue;
        if (positions[i].isHome) homeCount++;
        if (positions[i].isAnchor) anchorCount++;
      } else {
        const hitChance = blots.blots[i] ?? 0;
        const scaleFactor = 1 - hitChance;
        fivePointControl += positions[i].distanceValue * scaleFactor;
        if (positions[i].isHome) homeCount += scaleFactor;
        if (positions[i].isAnchor) anchorCount += scaleFactor;
      }
    }
  }

  return { positions, homeCount, anchorCount, fivePointControl };
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
      if (currentPrime.length >= 2) {
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

    // check opponent bar: white enters from below index 0, black from above index 23
    if (hitFromPos == 24 && opponent == c.BLACK && game.bBar) totalProb += probMap[dist];
    if (hitFromPos == -1 && opponent == c.WHITE && game.wBar) totalProb += probMap[dist];
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

const NO_RISK: BlotAnalysis = { blots: {}, totalPenalty: 0 };

// `game.turn` is the player who just moved, as in a Result from validMoves; the other player rolls next.
// The player who just moved has blots at risk. The player on roll doesn't, yet, and has shots at the opponent's blots.
const evaluate: (f: Factors) => EvaluationFunction = (f: Factors) => (game, player) => {
  let score = 0;
  const opponent = player === c.WHITE ? c.BLACK : c.WHITE;
  const onRoll = game.turn !== player;

  score += (player === c.WHITE ? game.wHome : game.bHome) * f.homeReward;
  score -= (player === c.WHITE ? game.bHome : game.wHome) * f.homePenalty;
  score -= (player === c.WHITE ? game.wBar : game.bBar) * f.barPenalty;
  score += (player === c.WHITE ? game.bBar : game.wBar) * f.barReward;

  const blots = onRoll ? NO_RISK : getBlots(game, player);
  score -= blots.totalPenalty * f.blotPenalty;
  if (onRoll) score += getBlots(game, opponent).totalPenalty * f.blotPenalty;

  const strength = getBoardStrength(game, player, blots, f);
  score += strength.fivePointControl;
  score += strength.homeCount * f.homeBonus;
  score += strength.anchorCount * f.anchorBonus;

  const primes = analyzePrimes(game, player);
  score += primes.count * f.primeReward;

  const pips = getPipCounts(game, player);
  score += pips.isRacing ? (pips.diff / 24) * f.racingPipReward : (pips.diff / 24) * f.contactPipReward;

  return score;
};

export { evaluate, getPipCounts, getBlots, analyzePrimes, getBoardStrength };
