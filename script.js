// backgammon game
// heuristic search ai

// board
// 24 spaces
// player w is playing 'forward' in the array
// player b is playing 'backward' in the array
const INITIAL = [
  // b homeboard
  ["w", "w"],
  [],
  [],
  [],
  [],
  ["b", "b", "b", "b", "b"],
  //
  [],
  ["b", "b", "b"],
  [],
  [],
  [],
  ["w", "w", "w", "w", "w"],
  //
  ["b", "b", "b", "b", "b"],
  [],
  [],
  [],
  ["w", "w", "w"],
  [],
  // w home board
  ["w", "w", "w", "w", "w"],
  [],
  [],
  [],
  [],
  ["b", "b"],
];

function newGame() {
  return {
    bar: [],
    wHome: [],
    bHome: [],
    positions: INITIAL.map(a => a.slice()), // quick and dirty deep copy
    cube: 1,
    turn: "w", // TODO: start
  };
}

let game = newGame();

function die() {
  return Math.ceil(Math.random() * 6);
}

function roll() {
  let [i, j] = [die(), die()];
  if (i == j) {
    return [i,i,i,i];
  } else {
    return [i,j];
  }
}

function permute(as, bs) {
  let results = [];
  as.forEach((a) => {
    bs.forEach((b) => {
      results.push([a, b]);
    });
  });
  return results;
}

function orderings(rolls) {
  // hack: we know that we only have one ordering if the die are equal, or if there's only one
  if (rolls.length < 2 || rolls[0] == rolls[1]) {
    return [rolls]
  } else {
    return [[rolls[0], rolls[1]], [rolls[1], rolls[0]]];
  }
}

// check destination is
//  in-bounds and not blocked
function valid(player, move, positions) {
  return (
    move[1] >= 0 &&
      move[1] < 24 && // inbounds
      (positions[move[1]].length < 2 || positions[move[1]][0] == player)
  );
}

function startingPositions(game) {
  return game.positions
    .map((v, i) => [v, i])
    .filter(([a, i]) => a.length > 0 && a[0] == game.turn)
    .map(([_, i]) => i);
}

function isBearingOff(starts, player) {
  if (starts.length == 0) { return false }
  // can bear off if all pieces are in the nearest section
  if (player == "w") {
    return starts.every(start => start > 17)
  } else {
    return starts.every(start => start < 6)
  }
}

// Generate all the valid moves given one die roll and a game board.
// Move: [start, end]
// returns Array<Move>
function validMoves(roll, game) {
  let player = game.turn;
  let barcount = game.bar.filter(p => p == player).length;
    // legal entrances get pieces off the bar first
  if (barcount > 0) {
    const start = player == 'b' ? 24 : -1;
    let entrance = ['bar', start + roll]
    if (valid(player, entrance, game.positions)) {
      return [entrance]
    } else {
      return []
    }
  }

  let starts = startingPositions(game)
  let moves = starts.map(p => [p, p + roll])
  moves = moves.filter(move => valid(player, move, game.positions));
  if (isBearingOff(starts, player)) {
    // can bear off a piece
    // piece is exactly n away from home
    // _or_ the highest one, if all are less than the roll off
    let bears = starts.filter(start => (start + roll == -1) || (start + roll == 24)).map(start => [start, 'home'])
    let furthest = player == "w" ? Math.min(...starts) : Math.max(...starts)
    console.log({player, furthest, roll, sum: roll + furthest})
    if ((roll + furthest < 0)  || (roll + furthest >= 24)) {
      bears = [[furthest, 'home']]
    }
    moves = moves.concat(bears)
  }
  return moves
}

function orderedValidPlays(game, rolls) {
  if (game.turn == "b") {
    rolls = rolls.map(r => -r)
  }
  // order of moves matters, but only for the case of two different die
  let ords = orderings(rolls)
  return ords.flatMap(rls => validPlays(game, rls))
}

// Rolls: list of rolled dies
// Play: list of start/finish pairs e.g. [(start1, end1), (start2, end2)]
// returns: list of plays
function validPlays(game, rolls) {
  if (rolls.length == 0) { return [] }
  let [toTry, ...rest] = rolls
  let results = []
  let moves = validMoves(toTry, game)
  for (let move of moves) {
    let imaginedWorld = structuredClone(game)
    update(imaginedWorld, [move]);
    let plays = validPlays(imaginedWorld, rest)
    if (plays.length > 0) {
      for (let play of plays) {
        results.push([move, ...play])
      }
    } else {
      results.push([move])
    }
  }
  return results
}

// move the pieces
function update(game, moves) {
  moves.forEach((m) => {
    let [origin, dest] = m;
    let piece;
    if (origin == "bar") {
      // if moving in from the bar, remove one of that color from the bar
      piece = game.bar.splice(game.bar.indexOf(game.turn), 1)[0];
    } else {
      piece = game.positions[origin].pop();
    }

    // TODO: remove assertion
    console.assert(piece == game.turn, { move: m, moves, turn: game.turn, positions: game.positions})

    // if bearing off, move to home
    if (dest == "home") {
      let playerHome = game.turn == "w" ? "wHome" : "bHome";
      game[playerHome].push(piece)
      return;
    }

    // if it's a hit, move whatever's in dest to the bar
    let hit = game.positions[dest].length > 0 && game.positions[dest][0] != game.turn;
    if (hit) {
      pieceHit = game.positions[dest].pop()
      game.bar.push(pieceHit);
    }

    game.positions[dest].push(piece);
  });
}

// decide on a move among the possible moves, based on the current state of the game
function choice(game, moves) {
  // todo: implement AI
  return moves[Math.floor(Math.random() * moves.length)];
}

function formatMove(move) {
  return `${isNaN(move[0]) ? move[0] : move[0] + 1}>${isNaN(move[1]) ? move[1] : move[1] + 1}`;
}

function formatTurn(player, roll, move, availableMoves) {
  return `\n${player} rolled ${roll}\n ${move.map(formatMove).join(', ')}\n`
}

const transcript = document.getElementById("transcript");
function log(msg) {
  transcript.value = msg + transcript.value;
}

function takeTurn(game) {
  let rolls = roll();
  let mvs = orderedValidPlays(game, rolls);
  if (mvs.length > 0) {
    let c = choice(game, mvs);
    update(game, c);
    if (game.bar.length > 0) {
      log(`bar: ${game.bar.toString()}\n`)
    }
    if (game.bHome.length > 0) {
      log(`bHome: ${game.bHome.length}\n`)
    }
    if (game.wHome.length > 0) {
      log(`wHome: ${game.wHome.length}\n`)
    }
    log(formatTurn(game.turn, rolls, c, mvs));
  } else {
    log(`\n${game.turn} rolled ${rolls}\nNo available moves.\n`)
  }
  game.turn = game.turn == "w" ? "b" : "w"; // next player's turn
}

function render(game) {
  let board = document.getElementById("board");
  board.innerHTML = "";
  let home = document.createElement("div");
  home.classList.add("home");
  let top = document.createElement("div");
  top.classList.add("top");
  let bottom = document.createElement("div");
  bottom.classList.add("bottom");
  board.appendChild(home);
  board.appendChild(top);
  board.appendChild(bottom);

  game.positions.forEach((v, i) => {
    let triangle = document.createElement("div");
    triangle.classList.add("angle");
    if (i % 2 == 0) {
      triangle.classList.add("red");
    } else {
      triangle.classList.add("gray");
    }
    if (i <= 11) {
      top.appendChild(triangle);
    } else {
      bottom.appendChild(triangle);
    }

    // The Bar
    if (i == 6 || i === 18) {
      let bar = document.createElement("div");
      bar.classList.add("bar");
      i == 6 && game.bar.forEach((p) => {
        let piece = document.createElement("span");
        piece.classList.add("piece");
        piece.classList.add(p);
        bar.appendChild(piece);
      });

      triangle.parentElement.insertBefore(bar, triangle);
    }

    triangle.innerText += `${i + 1}`;

    v.forEach((p) => {
      let piece = document.createElement("span");
      piece.classList.add("piece");
      piece.classList.add(p);
      triangle.appendChild(piece);
    });
  });
}

render(game);
document.getElementById("play").addEventListener("click", () => {
  takeTurn(game);
  // TODO: remove assertion
  game.positions.forEach(p => console.assert(p.length == 0 || p.reduce((m,v) => m == v && v), {msg: "constraint violated: two pieces of different colors", game}))
  render(game);
});
document.getElementById("ten").addEventListener("click", () => {
  for (let i = 0; i<10; i++) { takeTurn(game); }
  render(game);
});
document.getElementById("new").addEventListener("click", () => {
  game = newGame();
  render(game);
});
