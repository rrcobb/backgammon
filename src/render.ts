import { Game, newGame, checkWinner, generateRoll, takeTurn, WHITE, BLACK, show } from './backgammon';
import {first, last, random, pseudorandom, cheapmod } from './strategies'

function render(game: Game): void {
  let board = document.getElementById("board");
  if (!board) { throw new Error("board element not found") }
  board.innerHTML = "";

  let home = document.createElement("div");
  home?.classList.add("home");

  // show count for pieces in home
  let blackHome = document.createElement("div");
  blackHome.classList.add("home-count");
  blackHome.textContent = `Black ${game.bHome}`;

  let whiteHome = document.createElement("div");
  whiteHome.classList.add("home-count");
  whiteHome.textContent = `White ${game.wHome}`;
 
  home.appendChild(blackHome);
  home.appendChild(whiteHome);

  let top = document.createElement("div");
  top.classList.add("top");
  let bottom = document.createElement("div");
  bottom.classList.add("bottom");
  board?.appendChild(home);
  board?.appendChild(top);
  board?.appendChild(bottom);

  // TODO:
  // - show the roll
  // - render something about the strategy
  // - show current pip count for each player

  game.positions.forEach((v: number, i: number) => {
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
      if (i === 6) {
        for (let i = 0; i < game.bBar; i++) {
          let piece = document.createElement("span");
          piece.classList.add("piece");
          piece.classList.add('b');
          bar.appendChild(piece);
        }
      } else {
        for (let i = 0; i < game.wBar; i++) {
          let piece = document.createElement("span");
          piece.classList.add("piece");
          piece.classList.add('w');
          bar.appendChild(piece);
        }
      }

      triangle.parentElement.insertBefore(bar, triangle);
    }
    let label = document.createElement('span')
    label.innerText += `${i + 1}`;
    label.classList.add('label')
    triangle.appendChild(label)

    let piecesContainer = document.createElement("div");
    piecesContainer.classList.add("pieces");
    triangle.appendChild(piecesContainer);

    const count = v & 0b00001111;
    const color = (v & WHITE) ? 'w' : 'b';
    for (let i = 0; i < count; i++) {
      let piece = document.createElement("span");
      piece.classList.add("piece");
      piece.classList.add(color);
      piecesContainer.appendChild(piece);
    }
  });

  let turnIndicator = document.createElement("div");
  turnIndicator.id = "turn-indicator";
  turnIndicator.textContent = game.turn === WHITE ? "White to play" : "Black to play";
  board.insertAdjacentElement('beforeend', turnIndicator);
}

const transcript: HTMLTextAreaElement = document.getElementById("transcript") as HTMLTextAreaElement;
function log(...rest: string[]) {
  rest.forEach(msg => {
    transcript.value = '\n' + msg + transcript?.value;
  })
}

function disableTurns() {
  (document.getElementById("play") as HTMLButtonElement).disabled = true;
  (document.getElementById("ten") as HTMLButtonElement).disabled = true;
}

function enableTurns() {
  (document.getElementById("play") as HTMLButtonElement).disabled = false;
  (document.getElementById("ten") as HTMLButtonElement).disabled = false;
}

var game;
document.addEventListener('DOMContentLoaded', () => {
  game = newGame();
  game.turn = WHITE;
  render(game);
  const whiteStrategy = cheapmod;
  const blackStrategy = random;

  document.getElementById("play")?.addEventListener("click", () => {
    const finished = checkWinner(game)
    if (finished) { disableTurns(); }
    const roll = generateRoll();
    const strat = game.turn == WHITE ? whiteStrategy : blackStrategy;
    const player = game.turn == WHITE ? 'w' : 'b'
    const [move, next] = takeTurn(game, roll, strat);
    if (move && move.length) {
      log(show(move))
    } else {
      log('no moves')
    }
    log(`${roll}`)
    log(player)
    log('\n')
    game = next
    render(game);
  });

  document.getElementById("ten")?.addEventListener("click", () => {
    for (let i = 0; i < 10; i++) {
      const finished = checkWinner(game)
      if (finished) { disableTurns(); break;}
      const roll = generateRoll();
      const strat = game.turn == WHITE ? whiteStrategy : blackStrategy;
      const player = game.turn == WHITE ? 'w' : 'b'
      const [move, next] = takeTurn(game, roll, strat);
      if (move && move.length) {
        log(show(move))
      } else {
        log('no moves')
      }
      log(`${roll}`)
      log(player)
      log('\n')
      game = next
    }
    render(game);
  });

  document.getElementById("new")?.addEventListener("click", () => {
    game = newGame();
    game.turn = WHITE;
    render(game);
    enableTurns();
  });
})
