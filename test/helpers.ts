import * as fc from "fast-check";
import { helpers as h, constants as c } from "../src/backgammon.ts";

// generate a number from 0-25
// 0-23 are the positions 24 is bar, 25 is home
const playerPieces = fc.array(fc.nat(25), { minLength: 15, maxLength: 15 });

// map to the players' game positions 15 times
const arbitraryGame = fc
  .tuple(playerPieces, playerPieces, fc.oneof(fc.constant(c.WHITE), fc.constant(c.BLACK)), fc.nat())
  .map(([firstPieces, secondPieces, first, id]) => {
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
      _id: id,
      bBar,
      wBar,
      bHome,
      wHome,
      positions,
      turn: first,
      cube: 1,
    };
  });

const genGame = () => fc.sample(arbitraryGame, { seed: 10, numRuns: 1 })[0];
const genGames = (n) => fc.sample(arbitraryGame, { seed: 10, numRuns: n });
const genRoll = () => fc.sample(fc.constantFrom(...c.ALL_ROLLS), { seed: 10, numRuns: 1 })[0];
const genRolls = (n) => fc.sample(fc.constantFrom(...c.ALL_ROLLS), { seed: 10, numRuns: n });

export { arbitraryGame, genGame, genGames, genRoll, genRolls };
