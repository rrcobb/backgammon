const STRATEGIES = {
  'random': (game, moves) =>  moves[Math.floor(Math.random() * moves.length)],
  'mcts': (game, moves) => { throw "implement mcts"},
  'keely': (game, moves) => {},
  'a*-minimax': (game, moves) => { throw "implement heuristic eval fn"}
}

const STRATEGY = 'random'

// decide on a move among the possible moves, based on the current state of the game
export function choice(game, moves) {
  // todo: implement AI
  return STRATEGIES[STRATEGY](game, moves)
}

// #########
// ## Keely's evaluation function
// #########

// use the recommended starts table
// make blocks
// make and keep primes
// try to hit your opponent
// don't leave a blot
  // - if you have to leave one, leave it in places harder to reach
  // - or, further back in your board
  // - or, if you are beyond the last piece in your opponent
  // - unless you expect to hit your opponent soon
// custom bearing-off function?
  // - may not actually matter
  // fill an empty spot, instead of stacking

// Risk level
// - settable
// - behind: increase risk-taking
// - if you have a good defensive prime: increase risk-taking with other pieces
// - affect willingness to leave a blot
// - affect willingness to hit your opponent, if it would leave you vulnerable

// Rob's evaluation function
