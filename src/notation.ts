import { constants as c } from "./backgammon";
import type { Game, Move, Player } from "./backgammon";

/*
  Standard backgammon notation: each player numbers the points from their own side,
  1-6 in their home board up to 24, the bar is 25 ("bar"), and borne-off is "off".
  White moves from index 0 up to 23, so index i is white's point 24 - i.
  Black moves from 23 down to 0, so index i is black's point i + 1.
*/

function pointFor(index: number, player: Player): number {
  return player === c.WHITE ? 24 - index : index + 1;
}

function formatMove(move: Move, player: Player): string {
  const parts = move
    .filter((m) => m !== null)
    .map(([from, to]) => {
      const start = from === c.BAR ? "bar" : pointFor(from, player);
      const end = to === c.HOME ? "off" : pointFor(to, player);
      return `${start}/${end}`;
    });
  return parts.length ? parts.join(" ") : "(no move)";
}

// one line per player, from that player's side: points with checkers, then bar and off
function formatPosition(game: Game): string {
  const side = (player: Player, name: string, bar: number, off: number) => {
    const points: string[] = [];
    for (let i = 0; i < 24; i++) {
      const pos = game.positions[i];
      if ((pos & player) === player) points.push(`${pointFor(i, player)}x${pos & 0b1111}`);
    }
    // list from the back of the board to the front
    points.sort((a, b) => parseInt(b) - parseInt(a));
    const extras = [bar ? `bar x${bar}` : "", off ? `off x${off}` : ""].filter(Boolean);
    return `${name}: ${[...points, ...extras].join(" ")}`;
  };
  return [side(c.WHITE, "white", game.wBar, game.wHome), side(c.BLACK, "black", game.bBar, game.bHome)].join("\n");
}

export { pointFor, formatMove, formatPosition };
