import { newGame, takeTurn } from './game'
import { toBinary, gameHistory, compress, decompress } from './compress'

function doGame() {

  let game = newGame();
  let turns = [];
  while (!takeTurn(game, s => {})) {
    turns.push(toBinary(game))
  }

  return gameHistory(turns);
}

let histories = [];

Number.prototype.times = function (fn) { 
  for (let i = 0; i < this; i++) { 
    fn(i)
  }
}

;(10).times((i) => {
  if (i % 25 == 0) {
    console.log("game: ", i);
  }
  histories.push(doGame())
})

function bytesEqual(a, b) {
  if (a.length != b.length) { 
    console.log('lengths differ', 'a was', a.length, 'b was', b.length);
    return false
  }
  for (let i in a) {
    if (a[i] != b[i]) { 
      console.log('at ', i, 'a was', a[i], 'b was', b[i]);
      return false
    }
  }
  return true;
}

histories.forEach(h => {
  let compressed = compress(h);
  let dec = decompress(compressed);
  console.log(compressed, h);
  console.log(bytesEqual(dec, h));
});
