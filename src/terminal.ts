import { newGame, takeTurn, Win, allRolls } from './game'
import { toBinary, gameHistory, compress, decompress } from './compress'
import { runtimeStats } from './strategies'


const MEASURE_PERF = true;
let totalStart
if (MEASURE_PERF) {
  totalStart = performance.now();
}

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
    if (performance.now() - totalStart > 10000) break;
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

      if (i === 0 && false) {
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
    Total time: ${totalTime.toFixed(2)} ms
    Average game time: ${averageGameTime.toFixed(2)} ms
    Total turns: ${totalTurns}
    Average turns: ${totalTurns/gameTimes.length}
    Average turn time: ${averageTurnTime.toFixed(2)} ms
    `);
    // White (${wStrat}): ${wWins}
    // Black (${bStrat}): ${bWins}
  }
}

(1).times(() => playMany(1));

console.log(`Function stats:`)
for (let f in runtimeStats) {
  let calls = runtimeStats[f]
  let total = calls.reduce((a,b) => a+b,0)
  let count = calls.length;
  let avg = total / count;
  console.log(f, `: ${count} calls, ${avg.toFixed(4)}ms on average, ${total.toFixed(2)}ms in total`)
  if (calls.cacheMisses) {
    console.log(`\tmissed cache ${calls.cacheMisses}/${count} on calls (${(100*calls.cacheMisses/count).toFixed(3)}% miss)`);
  }
}

// histories.forEach(h => {
//   let compressed = compress(h);
//   let dec = decompress(compressed);
//   console.log(compressed, h);
//   console.log(bytesEqual(dec, h));
// });
