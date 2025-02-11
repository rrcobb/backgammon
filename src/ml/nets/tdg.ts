// https://cs.stanford.edu/people/karpathy/convnetjs/index.html
import convnetjs from 'convnetjs'
import deepqlearn from 'convnetjs/build/deepqlearn.js'
import cnnutil from 'convnetjs/build/util.js'
globalThis.convnetjs = convnetjs;
globalThis.cnnutil = cnnutil;

import { helpers as h, constants as c } from '../../backgammon'
import { Strategies } from '../../strategy/strategies.ts'

const input_size = 212

function initNet() {
  const layer_defs = [];
  layer_defs.push({type:'input', out_sx:1, out_sy:1, out_depth: input_size });
  // three fully connected layers
  layer_defs.push({type:'fc', num_neurons:40, activation:'relu'});
  layer_defs.push({type:'fc', num_neurons:40, activation:'relu'});
  layer_defs.push({type:'fc', num_neurons:40, activation:'relu'});

  // a regression for the output: did white win?
  // probability, between -1 and 1
  layer_defs.push({type:'regression', num_neurons:1});
   
  // create a net out of it
  const net = new convnetjs.Net();
  net.makeLayers(layer_defs);
  return net
}

// turn a backgammon game representation into a nn input
// follows td-gammon: 212 'floats' that will actually be either 0 or 1
// 4 bits for white and 4 for black, for each game position (8 * 24 = 192)
// 4 bits each for white bar and black bar
// 6 bits for white home and black home
function representation(game) {
  const repr = new Array(input_size).fill(0);
  const len = game.positions.length
  // 24 spots on the board, each gets four 'bits' for each white and black
  for (let x = 0; x < len; x++) {
    let i = x * 8;
    let pos = game.positions[x]
    if (pos == 0) continue; // no one there, leave all these 0

    let count = pos & 0b1111;
    // "thermometer"
    if (pos & c.BLACK) {
      i += 4; // skip past the white spots, leave them 0
    }
    repr[i + 0] = 1
    repr[i + 1] = count > 1
    repr[i + 2] = count > 2
    repr[i + 3] = count > 3
  }

  // bar
  repr[len * 8] = game.wBar > 0;
  repr[len * 8 + 1] = game.wBar > 1;
  repr[len * 8 + 2] = game.wBar > 2;
  repr[len * 8 + 3] = game.wBar > 3;

  repr[len * 8 + 4] = game.bBar > 0;
  repr[len * 8 + 5] = game.bBar > 1;
  repr[len * 8 + 6] = game.bBar > 2;
  repr[len * 8 + 7] = game.bBar > 3;

  // home
  repr[len * 8 + 8] = game.wHome > 0;
  repr[len * 8 + 9] = game.wHome > 1;
  repr[len * 8 + 10] = game.wHome > 2;
  repr[len * 8 + 11] = game.wHome > 3;
  repr[len * 8 + 12] = game.wHome > 4;
  repr[len * 8 + 13] = game.wHome > 5;

  repr[len * 8 + 14] = game.bHome > 0;
  repr[len * 8 + 15] = game.bHome > 1;
  repr[len * 8 + 16] = game.bHome > 2;
  repr[len * 8 + 17] = game.bHome > 3;
  repr[len * 8 + 18] = game.bHome > 4;
  repr[len * 8 + 19] = game.bHome > 5;

  return new convnetjs.Vol(repr)
}

// gamma
const gamma = 0.8;

const k = 1000
function train(net, maxGames=1*k) {
  const trainer = new convnetjs.Trainer(net, {learning_rate:0.01, l2_decay:0.001, method: 'adadelta'});
  let game = h.newGame()
  let prev_prediction = null;
  let games = 0;
  let start = Date.now()
  let end;
  while (games < maxGames) {
    const input = representation(game)
    const prediction = net.forward(input).w[0];
    const winner = h.checkWinner(game);
    // can't update if there wasn't a prev_prediction
    if (prev_prediction) {
      // training the net to detect a WHITE win; take care with the predictions
      const r = winner ? (winner == c.WHITE ? 1 : -1) : 0;
      // td learning reward: r + γ(V(s_t+1) - V(s_t))
      const reward = r + gamma * (prediction - prev_prediction);
      var traininfo = trainer.train(input, [reward]);
    }

    if (winner) {
      games++;
      game = h.newGame();
      if (games % 10 == 0) {
        end = Date.now()
        const ten_game_time = end - start;
        console.log('game:', games, 'loss:', traininfo.loss.toFixed(2), 'time: ', ten_game_time, 'ms /10 games', ten_game_time / 10, 'ms /game avg')
        start = Date.now()
      }
    } else {
      prev_prediction = prediction;
      const roll = h.generateRoll();
      game = h.takeTurn(game, roll, Strategies.learned)[1];
    }
  }
}

const path = "src/ml/nets/convnet.json";
const file = Bun.file(path);

const net = initNet()
if (await file.exists()) {
  net.fromJSON(JSON.parse(await file.text()))
  console.log("loaded weights from ", path)
}
train(net)
await Bun.write(path, JSON.stringify(net.toJSON(), null, 2));
console.log("saved weights to ", path)
