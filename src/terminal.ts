import { newGame, takeTurn, Win, allRolls } from './game'
import { toBinary, gameHistory, compress, decompress } from './compress'

const MEASURE_PERF = true;

function doGame() {
  let game = newGame();
  let turns = [];
  let turnTimes = [];
  let turnStart;
  let winner;
  while (true) {
    if (MEASURE_PERF) {
      turnStart = performance.now();
    }
    winner = takeTurn(game, s => {});
    if (MEASURE_PERF) {
      const turnEnd = performance.now();
      turnTimes.push(turnEnd - turnStart);
    }
    turns.push(toBinary(game));
    if (winner) break;
  }
  return { gameHistory: gameHistory(turns), winner, turnTimes };
}

let histories = [];
let gameTimes = [];
let totalTurns = 0;

type Times = (fn: (i: number) => any) => void;
declare global {
    interface Number {
          times: Times;
    }
}

Number.prototype.times = function (fn) { 
  for (let i = 0; i < this; i++) { 
    fn(i);
  }
};

let totalStart
if (MEASURE_PERF) {
  totalStart = performance.now();
}

const wins = [];

function playMany(n: number) {
  n.times((i) => {
    let gameStart, gameEnd;
    if (MEASURE_PERF) {
      gameStart = performance.now();
    }
    const { gameHistory, turnTimes, winner } = doGame();
    if (MEASURE_PERF) {
      gameEnd = performance.now();
    }

    histories.push(gameHistory);
    if (MEASURE_PERF) {
      gameTimes.push(gameEnd - gameStart);
      totalTurns += turnTimes.length;
      wins.push(winner)

      if (i === 0) {
        console.log(`First game stats:
        Winner: ${winner}
        Turns: ${turnTimes.length}
        Total time: ${gameEnd - gameStart} ms
        Average turn time: ${(gameEnd - gameStart) / turnTimes.length} ms`);
      }
    }
  });

  if (MEASURE_PERF) {
    const totalEnd = performance.now();

    const totalTime = totalEnd - totalStart;
    const averageGameTime = gameTimes.reduce((a, b) => a + b, 0) / gameTimes.length;
    const averageTurnTime = totalTime / totalTurns;
    const wWins = wins.filter(v => v == 'w').length;
    const bWins = wins.filter(v => v == 'b').length;
    const wStrat = newGame().wStrategy;
    const bStrat = newGame().bStrategy;

    console.log(`Overall stats:
    Total time: ${totalTime} ms
    Average game time: ${averageGameTime} ms
    Total turns: ${totalTurns}
    Average turns: ${totalTurns/gameTimes.length}
    Average turn time: ${averageTurnTime} ms
    White (${wStrat}): ${wWins}
    Black (${bStrat}): ${bWins}`);
  }
}

(1).times(() => playMany(50));

// histories.forEach(h => {
//   let compressed = compress(h);
//   let dec = decompress(compressed);
//   console.log(compressed, h);
//   console.log(bytesEqual(dec, h));
// });
