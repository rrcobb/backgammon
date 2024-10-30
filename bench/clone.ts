import { run, bench, compact, summary, group } from "mitata";
import { helpers as h, constants as c } from "../src/backgammon.ts";

// everything is a primitive except the positions typedarray
// copy is relatively cheap...
// but what's the cheapest?
function spread(game: Game): Game {
  return { ...game, positions: new Uint8Array(game.positions) };
}

function clone(game: Game): Game {
  return structuredClone(game);
}

function assign(game: Game): Game {
  const obj = Object.assign({}, game);
  obj.positions = new Uint8Array(obj.positions);
  return obj;
}

function literal(game: Game): Game {
  return {
    bBar: game.bBar,
    wBar: game.wBar,
    bHome: game.bHome,
    wHome: game.wHome,
    turn: game.turn,
    positions: new Uint8Array(game.positions),
    cube: game.cube,
  };
}

summary(() => {
  const initial = h.newGame();
  initial.turn = c.WHITE;

  bench("newgame", () => {
    const game = h.newGame();
  });

  bench("spread", () => {
    spread(initial);
  });

  bench("literal", () => {
    literal(initial);
  });

  bench("structured clone", () => {
    clone(initial);
  });

  bench("Object.assign", () => {
    assign(initial);
  });
});

await run();
