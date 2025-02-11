import { expect } from "bun:test";
import * as fc from "fast-check";
import { helpers as h, constants as c } from "../src/backgammon.ts";

// generate a number from 0-25
// 0-23 are the positions 24 is bar, 25 is home
const playerPieces = fc.array(fc.nat(25), { minLength: 15, maxLength: 15 });
const playerPiecesWithFixedHome = (homeCount) => { 
  return fc.tuple(
    // Generate exactly (15 - homeCount) positions that aren't home
    fc.array(fc.nat(24), { 
      minLength: 15 - homeCount, 
      maxLength: 15 - homeCount 
    }),
    // Add exactly homeCount home positions
    fc.constant(Array(homeCount).fill(25))
  ).map(([positions, home]) => [...positions, ...home]);
}

function generateGame(arbitraries) {
  let [firstPieces, secondPieces, first] = arbitraries;
  let oneBar = 0,
      twoBar = 0,
      oneHome = 0,
      twoHome = 0;
  const positions = new Uint8Array(24);
  const second = first == c.WHITE ? c.BLACK : c.WHITE;

  for (let index of firstPieces) {
    if (index == 24) {
      oneBar++;
      continue;
    }
    if (index == 25) {
      oneHome++;
      continue;
    }
    positions[index] |= first;
    positions[index] += 1;
  }

  for (let index of secondPieces) {
    if (index == 24) {
      twoBar++;
      continue;
    }
    if (index == 25) {
      twoHome++;
      continue;
    }
    // if the first player has a piece in this spot, wrapping add
    while (positions[index] & first) {
      index++;
      if (index > 23) {
        index = 0;
      }
    }
    positions[index] |= second;
    positions[index] += 1;
  }

  let bBar, wBar, bHome, wHome;
  if (first == c.WHITE) {
    wBar = oneBar;
    wHome = oneHome;
    bBar = twoBar;
    bHome = twoHome;
  } else {
    bBar = oneBar;
    bHome = oneHome;
    wBar = twoBar;
    wHome = twoHome;
  }

  return {
    bBar,
    wBar,
    bHome,
    wHome,
    positions,
    turn: first,
    cube: 1,
  };
}

const arbitraryGame = fc
  .tuple(playerPieces, playerPieces, fc.oneof(fc.constant(c.WHITE), fc.constant(c.BLACK)))
  .map(generateGame);
const arbGameWithHome = (p1, p2) => 
  fc.tuple(playerPiecesWithFixedHome(p1), playerPiecesWithFixedHome(p2), fc.oneof(fc.constant(c.WHITE), fc.constant(c.BLACK)))
  .map(generateGame);

const genGame = () => fc.sample(arbitraryGame, { seed: 10, numRuns: 1 })[0];
const genGames = (n) => fc.sample(arbitraryGame, { seed: 10, numRuns: n });
const genRoll = () => fc.sample(fc.constantFrom(...c.ALL_ROLLS), { seed: 10, numRuns: 1 })[0];
const genRolls = (n) => fc.sample(fc.constantFrom(...c.ALL_ROLLS), { seed: 10, numRuns: n });
const genGameWithHome = (p1, p2) => fc.sample(arbGameWithHome(p1,p2), { numRuns: 1 })[0];

function expectGamesEqual(actual, expected) {
  expect(actual).toEqual(
    expect.objectContaining({
      ...expected,
    }),
  );
}

export { arbitraryGame, arbGameWithHome, genGame, genGameWithHome, genGames, genRoll, genRolls, expectGamesEqual };
