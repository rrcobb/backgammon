import type { Result, Player, Game, Roll } from "./backgammon";
import type { Strategy } from "./strategies";
import { helpers as h, constants as c } from "./backgammon";

function maxBy<T>(list: T[], func: (a: T) => number) {
  let max = null;
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

const EXPLORE = 0.3;
const SIMULATIONS = 100;

class MCTSNode {
  rolloutStrategy: Strategy;
  state: Game;
  player: Player;
  parent: MCTSNode | undefined;
  visitCount: number;
  wins: number;
  losses: number;
  children: MCTSNode[];
  roll?: Roll;
  untriedActions: Result[];

  constructor(state: Game, player: Player, rolloutStrategy: Strategy, parent?: MCTSNode, roll?: Roll) {
    this.rolloutStrategy = rolloutStrategy;
    this.state = state;
    this.player = player;
    this.parent = parent;
    this.roll = roll;

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
    let action = this.untriedActions.pop();
    let next = action[1];
    let child = new MCTSNode(next, this.player, this.rolloutStrategy, this);
    this.children.push(child);
    return child;
  }

  fullyExpanded(): boolean {
    return this.untriedActions.length == 0;
  }

  // find the best child node using the ucb/t formula
  bestChild(explore: number = EXPLORE): MCTSNode {
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
      const options = h.validMoves(current, roll);
      if (!options.length || !options[0].length) { 
        current.turn = (current.turn == c.BLACK ? c.WHITE : c.BLACK) as Player;
        continue;
      }
      const action = this.rolloutStrategy(options);
      current = action[1]; // we have [move, Game] as the Result of a strategy
      current.turn = (current.turn == c.BLACK ? c.WHITE : c.BLACK) as Player;
      winner = h.checkWinner(current)
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
    for (let i = 0; i < SIMULATIONS; i++) {
      let node = this.select();
      let winner = node.simulate();
      node.backpropagate(winner == this.player);
    }

    return this.bestChild(0); // no exploration on the final evaluation
  }
}

export { MCTSNode }
