import type { Result, Player, Game, Roll, Move } from "../backgammon";
import type { AppliedStrategy } from "./strategies";
import { helpers as h, constants as c } from "../backgammon";

/*
  Monte Carlo Tree Search with chance nodes for the dice.

  The tree alternates two kinds of node:
  - Decision: a player has rolled, and chooses among their moves. Children are
    the positions after each move, chosen by UCB1 from the mover's side.
  - AfterState: the position after a move; the opponent rolls next. Each visit
    samples a roll, and children are the opponent's Decisions, one per roll.

  Each iteration walks down the tree, expands one untried move, plays the game
  out with the rollout strategy, and records the winner on the way back up.
  The final choice is the most visited move.
*/

const other = (p: Player): Player => (p === c.WHITE ? c.BLACK : c.WHITE);

// rolls that allow the same moves share a node
const rollKey = (roll: Roll) => Math.min(roll[0], roll[1]) * 10 + Math.max(roll[0], roll[1]);

class AfterState {
  game: Game; // game.turn is the mover, as in a Result
  mover: Player;
  move: Move;
  parent: Decision;
  visits = 0;
  wins = 0; // games the mover won through this node
  children = new Map<number, Decision>();

  constructor(game: Game, mover: Player, move: Move, parent: Decision) {
    this.game = game;
    this.mover = mover;
    this.move = move;
    this.parent = parent;
  }
}

class Decision {
  game: Game; // game.turn is the player to move
  player: Player;
  roll: Roll;
  parent: AfterState | null;
  visits = 0;
  children: AfterState[] = [];
  untried: Result[];

  constructor(game: Game, roll: Roll, parent: AfterState | null) {
    this.game = game;
    this.player = game.turn as Player;
    this.roll = roll;
    this.parent = parent;
    this.untried = h.validMoves(game, roll);
  }

  expand(): AfterState {
    const [move, next] = this.untried.pop()!;
    const child = new AfterState(next, this.player, move, this);
    this.children.push(child);
    return child;
  }

  // upper confidence bound, from this player's side
  select(explore: number): AfterState {
    const logN = Math.log(this.visits);
    let best = this.children[0];
    let bestScore = -Infinity;
    for (const child of this.children) {
      const score = child.wins / child.visits + explore * Math.sqrt((2 * logN) / child.visits);
      if (score > bestScore) {
        bestScore = score;
        best = child;
      }
    }
    return best;
  }
}

type MCTSOptions = {
  explore: number;
  simulations: number;
  rolloutStrategy: AppliedStrategy;
};

// play from the position after `leaf`'s move to the end; returns the winner
function rollout(leaf: AfterState, strategy: AppliedStrategy): Player {
  let game = h.cloneGame(leaf.game);
  game.turn = other(leaf.mover);
  let winner: Player | false;
  while (!(winner = h.checkWinner(game))) {
    const mover = game.turn as Player;
    const result = strategy(game, h.generateRoll());
    game = result ? result[1] : game;
    game.turn = other(mover);
  }
  return winner;
}

function iterate(root: Decision, options: MCTSOptions) {
  // selection and expansion
  let node = root;
  let leaf: AfterState;
  while (true) {
    if (node.untried.length) {
      leaf = node.expand();
      break;
    }
    leaf = node.select(options.explore);
    if (h.checkWinner(leaf.game)) break;

    // chance node: the opponent rolls
    const roll = h.generateRoll();
    const key = rollKey(roll);
    let child = leaf.children.get(key);
    if (!child) {
      const next = h.cloneGame(leaf.game);
      next.turn = other(leaf.mover);
      child = new Decision(next, roll, leaf);
      leaf.children.set(key, child);
    }
    node = child;
  }

  // simulation
  const winner = h.checkWinner(leaf.game) || rollout(leaf, options.rolloutStrategy);

  // backpropagation
  let after: AfterState | null = leaf;
  while (after) {
    after.visits++;
    if (winner === after.mover) after.wins++;
    after.parent.visits++;
    after = after.parent.parent;
  }
}

// build the search tree for `game` (game.turn is the player to move) and `roll`
function search(game: Game, roll: Roll, options: MCTSOptions): Decision {
  const root = new Decision(h.cloneGame(game), roll, null);
  for (let i = 0; i < options.simulations; i++) iterate(root, options);
  return root;
}

function mostVisited(root: Decision): AfterState {
  let best = root.children[0];
  for (const child of root.children) {
    const better = child.visits > best.visits || (child.visits === best.visits && child.wins > best.wins);
    if (better) best = child;
  }
  return best;
}

function useMCTS(options: MCTSOptions): AppliedStrategy {
  return function mcts(game: Game, roll: Roll): Result {
    const options_ = h.validMoves(game, roll);
    if (options_.length === 1) return options_[0];
    const best = mostVisited(search(game, roll, options));
    return [best.move, best.game];
  };
}

export { useMCTS, search, mostVisited, Decision, AfterState, type MCTSOptions };
