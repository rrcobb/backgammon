import type { Result, Player, Game, Roll, Move } from "../backgammon";
import type { AppliedStrategy } from "./strategies";
import { random } from "./strategies";
import { helpers as h, constants as c } from "../backgammon";

function maxBy<T>(list: T[], func: (a: T) => number) {
  let max = list[0];
  let maxVal = -Infinity;
  for (let item of list) {
    const val = func(item)
    if (val > maxVal) {
      max = item;
      maxVal = val;
    }
  }
  return max;
}

class MCTSNode {
  rolloutStrategy: AppliedStrategy;
  state: Game;
  player: Player | undefined;
  parent: MCTSNode | undefined;
  visitCount: number;
  wins: number;
  losses: number;
  children: MCTSNode[];
  roll?: Roll;
  untriedActions: Result[];
  move?: Move;

  explore?: number;
  simulations?: number;

  constructor(state: Game, player: Player | undefined, rolloutStrategy: AppliedStrategy, parent?: MCTSNode, roll?: Roll, move?: Move, explore?: number, simulations?: number) {
    this.rolloutStrategy = rolloutStrategy;
    this.state = state;
    this.player = player;
    this.parent = parent;
    this.roll = roll;
    this.move = move;
    this.explore = explore;
    this.simulations = simulations;

    this.visitCount = 0;
    this.wins = 0;
    this.losses = 0;
    this.children = [];
    if (this.roll) {
      this.untriedActions = h.validMoves(this.state, this.roll);
    } else {
      this.untriedActions = []
    }
  }

  q() {
    return this.wins - this.losses
  }

  n() {
    return this.visitCount
  }

  select(): MCTSNode {
    return this.fullyExpanded() ? this.bestChild() : this.expand();
  }

  expand(): MCTSNode {
    const action = this.untriedActions.pop();
    if (!action) {
      throw new Error("No untried actions available");
    }
    const [move, next] = action;
    const child = new MCTSNode(next, this.player, this.rolloutStrategy, this, undefined, move);
    this.children.push(child);
    return child;
  }

  fullyExpanded(): boolean {
    return this.untriedActions.length == 0;
  }

  // find the best child node using the ucb/t formula
  bestChild(explore = this.explore): MCTSNode {
    if (this.children.length === 0) {
      return null;
      // throw new Error("Cannot select best child; no children available");
    }
    return maxBy(
      this.children,
      // upper confidence bound formula
      (c) => c.q() / c.n() + explore * Math.sqrt((2 * Math.log(this.n()) / c.n()))
    );
  }

  simulate(): Player {
    let current = this.state;
    let winner = h.checkWinner(current)
    while (!winner) {
      const roll = h.generateRoll();
      const result = this.rolloutStrategy(current, roll);
      if (result) {
        current = result[1]; // we have [move, Game] as the Result of a strategy
        // otherwise, there were no options for the roll, i.e. it's a pass, just switch turns
      }
      winner = h.checkWinner(current)
      current.turn = (current.turn == c.BLACK ? c.WHITE : c.BLACK) as Player;
    }
    return winner
  }

  backpropagate(win: boolean) {
    this.visitCount += 1;

    if (win) { this.wins += 1; }
    else { this.losses += 1; }

    if (this.parent) {
      this.parent.backpropagate(win)
    }
  }

  evaluate() {
    for (let i = 0; i < this.simulations; i++) {
      let node = this.select();
      if (!node) { // no valid options
        if (!this.children.length && !this.untriedActions.length) {
          return null
        } else {
          // what happened?
          throw new Error("got no node from select, but there were children or untried actions");
        }
      }
      let winner = node.simulate();
      node.backpropagate(winner == this.player);
    }

    return this.bestChild(0); // no exploration on the final evaluation
  }
}

type MCTSOptions = {
  explore: number,
  simulations: number,
  rolloutStrategy: AppliedStrategy,
  // intermediate evaluation function?
}

function useMCTS(options: MCTSOptions): AppliedStrategy {
  return function mcts(game: Game, roll: Roll): Result {

    let best = new MCTSNode(
      game,
      game.turn,
      options.rolloutStrategy,
      null, // parent
      roll,
      null, // move
      options.explore,
      options.simulations,
    ).evaluate();

    if (!best) {
      return null;
    }
    return [best.move, best.state]
  }
}

export { MCTSNode, useMCTS }
