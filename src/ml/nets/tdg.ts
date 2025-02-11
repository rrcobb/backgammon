// https://cs.stanford.edu/people/karpathy/convnetjs/index.html
import convnetjs from 'convnetjs'
import deepqlearn from 'convnetjs/build/deepqlearn.js'
import cnnutil from 'convnetjs/build/util.js'
globalThis.convnetjs = convnetjs;
globalThis.cnnutil = cnnutil;

import * as fc from "fast-check";
import { helpers as h, constants as c } from '../../backgammon'
import { Strategies } from '../../strategy/strategies.ts'
import { genGameWithHome, genGame } from '../../../test/helpers'

const input_size = 212

function initNet() {
  const layer_defs = [];
  layer_defs.push({type:'input', out_sx:1, out_sy:1, out_depth: input_size });
  // three fully connected layers
  layer_defs.push({type:'fc', num_neurons:40, activation:'relu'});
  layer_defs.push({type:'fc', num_neurons:40, activation:'relu'});
  layer_defs.push({type:'fc', num_neurons:40, activation:'relu'});

  // a regression for the output: did white win?
  // probability, between 0 and 1
  layer_defs.push({type: 'regression', num_neurons:1});
   
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

// params
const gamma = 0.8;
const lambda = 0.9; // trace decay
const k = 1000

function curriculum_strategy(net, training_status, game_count) {
  return Strategies.learned
}

function curriculum_game_setup(training_status, game_count) {
  if (game_count < 150) {
    let p1Home = Math.floor((150 - game_count) / 10)
    let p2Home = Math.max(0, p1Home - 1) // try to be one less than p1
    return genGameWithHome(p1Home, p2Home)
  }
  // start from scratch
  return h.newGame()
}

function train(net, max_games=k) {
  const trainer = new convnetjs.Trainer(net, {learning_rate:0.0001, l2_decay:0.00001, method: 'adadelta'});
  let game_count = 0;
  let start = Date.now()
  let end;
  let V = [];
  let training_status;
  let game = curriculum_game_setup(training_status, game_count)
  let game_lens = [];

  while (game_count < max_games) {
    const input = representation(game)
    const prediction = net.forward(input).w[0];
    V.push({input, prediction});
    const winner = h.checkWinner(game);

    if (winner) {
      game_count++;
      game = curriculum_game_setup(training_status, game_count)

      // training the net to predict chances of WHITE win, with 50/50 at 0
      const r = winner == c.WHITE ? 1 : -1;

      let decay = 1;
      let loss_window = [];
      let td_error_window = [];
      let target_window = [];
      // walk backwards through the history
      for (let t=V.length-1; t >=0; t--) {
        // td error: r + γV(s_t+1) - V(s_t)
        const next = (t == V.length-1) ? r : V[t+1].prediction
        const tderror = decay * (r + gamma * next - V[t].prediction);
        const target = Math.min(Math.max(V[t].prediction + tderror, -1), 1);

        training_status = trainer.train(V[t].input, [target]);
        loss_window.push(training_status.loss)
        td_error_window.push(tderror)
        target_window.push(target)
        decay = decay * lambda;
      }

      game_lens.push(V.length)
      // clear the history
      V = []

      const batch_size = 100;
      if (game_count % batch_size == 0) {
        end = Date.now()
        const batch_time = end - start;
        let avg_loss = loss_window.reduce((s, l) => s + l) / loss_window.length
        let avg_length = game_lens.reduce((s, l) => s + l) / game_lens.length
        console.log('game:', game_count, 'len:', avg_length, 'avg loss:', avg_loss.toFixed(2), 'time: ', batch_time, 'ms /batch', batch_time / batch_size, 'ms /game avg', td_error_window.map(n => n.toFixed(1)).join(','), target_window.length)
        game_lens = []
        start = Date.now()
      }
    } else {
      const roll = h.generateRoll();
      game = h.takeTurn(game, roll, curriculum_strategy(net, training_status, game_count))[1];
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


function checkNeuronWeights(net) {
  net.layers.forEach((layer, i) => {
    if (layer.layer_type !== 'fc') return;
    
    // Count tiny weights
    const dead = layer.filters.filter(f => 
      Object.values(f.w).every(w => Math.abs(w) < 1e-6)
    ).length;
    
    console.log(`Layer ${i}: ${dead}/${layer.filters.length} neurons have tiny weights`);
  });
}
checkNeuronWeights(net);
