import { constants as c, helpers as h } from "../backgammon";
import type { Game, Player, Roll } from "../backgammon";
import { MLP, toSafetensors, fromSafetensors } from "./mlp";
import { encode, INPUT_SIZE } from "./encoding";
import { useNet, moveValues } from "../strategy/net";
import { Strategies } from "../strategy/strategies";
import { compareTwo } from "../evals/tournament";

/*
  TD(λ) self-play, as in TD-Gammon 0.0.

  The net estimates P(white wins) from a position with a given player on roll.
  Both sides play the net's greedy move. After each move, the prediction for
  the previous position is pushed toward the prediction for the new one:

    δ = V(s') - V(s)          (or the outcome, 1 or 0, at the end of the game)
    e = λ e + ∇V(s)           eligibility trace, reset each game
    w = w + α δ e

  There's no discount (γ = 1) and no reward until the game ends.
*/

type TDConfig = {
  games: number;
  hidden: number;
  alpha: number;
  lambda: number;
  evalEvery: number; // games between evaluations and checkpoints
  evalPairs: number;
  out: string; // checkpoint path prefix
  resume?: string; // safetensors file to continue from
};

const other = (p: Player): Player => (p === c.WHITE ? c.BLACK : c.WHITE);

function trainGame(net: MLP, config: TDConfig, traces: Float32Array, grad: Float32Array, x: Float32Array): number {
  const { alpha, lambda } = config;
  const params = net.params;
  traces.fill(0);

  let [onRoll, roll]: [Player, Roll] = h.rollOff();
  let game: Game = h.newGame();
  game.turn = onRoll;

  // value and gradient for the current position
  let v = net.forward(encode(game, onRoll, x))[0];
  net.outputGradient(0, grad);
  for (let i = 0; i < params.length; i++) traces[i] = grad[i];

  let moves = 0;
  while (true) {
    moves++;
    // greedy move for the player on roll
    const options = h.validMoves(game, roll);
    const values = moveValues(net, options, x);
    let best = 0;
    for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
    const next = options[best][1];
    next.turn = other(onRoll);

    const winner = h.checkWinner(next);
    const target = winner ? (winner === c.WHITE ? 1 : 0) : net.forward(encode(next, next.turn, x))[0];
    const delta = target - v;
    for (let i = 0; i < params.length; i++) params[i] += alpha * delta * traces[i];
    if (winner) return moves;

    // move on: value and gradient at the new position, with the updated weights
    game = next;
    onRoll = next.turn;
    roll = h.generateRoll();
    v = net.forward(encode(game, onRoll, x))[0];
    net.outputGradient(0, grad);
    for (let i = 0; i < params.length; i++) traces[i] = lambda * traces[i] + grad[i];
  }
}

async function save(net: MLP, path: string, metadata: Record<string, string>) {
  await Bun.write(path, toSafetensors(net, metadata));
}

async function train(config: TDConfig) {
  let net: MLP;
  let startGames = 0;
  if (config.resume) {
    const loaded = fromSafetensors(new Uint8Array(await Bun.file(config.resume).arrayBuffer()));
    net = loaded.net;
    startGames = Number(loaded.metadata.games ?? 0);
    console.log(`resumed from ${config.resume} after ${startGames} games`);
  } else {
    net = new MLP([INPUT_SIZE, config.hidden, 1], ["sigmoid", "sigmoid"]).randomize(0.1);
  }

  const traces = new Float32Array(net.params.length);
  const grad = new Float32Array(net.params.length);
  const x = new Float32Array(INPUT_SIZE);
  console.log(
    `training ${config.games} games: ${net.sizes.join("-")} net, ${net.params.length} params, alpha ${config.alpha}, lambda ${config.lambda}`,
  );

  let start = performance.now();
  let moveCount = 0;
  for (let g = 1; g <= config.games; g++) {
    moveCount += trainGame(net, config, traces, grad, x);

    if (g % 1000 === 0) {
      const secs = (performance.now() - start) / 1000;
      console.log(`[game ${startGames + g}] ${(1000 / secs).toFixed(0)} games/s, ${(moveCount / 1000).toFixed(1)} moves/game`);
      start = performance.now();
      moveCount = 0;
    }

    if (g % config.evalEvery === 0 || g === config.games) {
      const total = startGames + g;
      // evaluate a frozen copy, so evaluation doesn't see later updates
      const player = useNet(net.clone());
      const pct = (r: { winRate: number; confidenceInterval: [number, number] }) =>
        `${(100 * r.winRate).toFixed(1)}% [${(100 * r.confidenceInterval[0]).toFixed(1)}, ${(100 * r.confidenceInterval[1]).toFixed(1)}]`;
      const vsRandom = compareTwo(player, Strategies.random, { pairs: config.evalPairs, seed: 11 });
      const vsLearned = compareTwo(player, Strategies.learned, { pairs: config.evalPairs, seed: 11 });
      console.log(`  eval after ${total} games: vs random ${pct(vsRandom)}, vs learned ${pct(vsLearned)}`);

      const metadata = { games: String(total), alpha: String(config.alpha), lambda: String(config.lambda) };
      await save(net, `${config.out}-g${total}.safetensors`, metadata);
      await save(net, `${config.out}-latest.safetensors`, metadata);
    }
  }
}

// bun src/ml/td.ts --games=100000 --hidden=40 --alpha=0.1 --lambda=0.7 --resume=checkpoints/x.safetensors
if (import.meta.main) {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v];
    }),
  );
  const hidden = Number(args.hidden ?? 40);
  await train({
    games: Number(args.games ?? 10000),
    hidden,
    alpha: Number(args.alpha ?? 0.1),
    lambda: Number(args.lambda ?? 0.7),
    evalEvery: Number(args.evalEvery ?? 5000),
    evalPairs: Number(args.evalPairs ?? 100),
    out: args.out ?? `checkpoints/td-h${hidden}`,
    resume: args.resume,
  });
}

export { train, trainGame, type TDConfig };
