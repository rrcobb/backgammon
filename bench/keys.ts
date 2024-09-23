import { run, bench, summary, group } from "mitata"

export function movesStringify(moves: Movement[]) {
  return JSON.stringify(moves);
}

export function movesStringCustom(moves: Movement[]) {
  let result = "";
  for (let i = 0; i < moves.length; i++) {
    for (let j = 0; j < moves[i].length; j++) {
      result += moves[i][j]
    }
    result += "|"
  }
  return result;
}

export function movesBigInt(moves: Movement[]) {
  let result = 0n;
  let shift = 0n;
  for (let i = 0; i < moves.length; i++) {
    for (let j = 0; j < moves[i].length; j++) {
      result |= (BigInt(moves[i][j]) << shift++)
    }
  }
  return result;
}

export function movesNumber(moves: Movement[]) {
  let result = 0;
  let shift = 0;
  for (let i = 0; i < moves.length; i++) {
    for (let j = 0; j < moves[i].length; j++) {
      result |= (moves[i][j] << shift++)
    }
  }
  return result;
}

summary(() => {
  let movesOptions = [
    [[1,3]],
    [[0,5],[11,16]],
    [[24,19],[22,17],[24, 17]],
    [[0,1],[2,3],[18,20],[19,21]],
  ]

  bench("movesStringify ($moves)", function*(s) {
    const moves = s.get('moves');
    yield () => movesStringify(moves);
  }).args('moves', movesOptions);

  bench("movesStringCustom ($moves)", function*(s) {
    const moves = s.get('moves');
    yield () => movesStringCustom(moves);
  }).args('moves', movesOptions);

  bench("movesBigInt ($moves)", function*(s) {
    const moves = s.get('moves');
    yield () => movesBigInt(moves);
  }).args('moves', movesOptions);

  bench("movesNumber ($moves)", function*(s) {
    const moves = s.get('moves');
    yield () => movesBigInt(moves);
  }).args('moves', movesOptions);
})


await run();
