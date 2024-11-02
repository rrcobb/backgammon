import type { Player, Game } from "./backgammon";
import { constants as c, helpers as h } from "./backgammon";
import { Strategies } from "./strategies";
import { renderHistory } from "./history";

// globals
var game;
var whiteStrategy;
var blackStrategy;
var gameHistory;
var turnNo;

function strategyPicker(player: "white" | "black") {
  const div = document.createElement("div");
  const select = document.createElement("select");
  select.id = `${player}-strategy`;

  Object.keys(Strategies).forEach((strategy) => {
    const option = document.createElement("option");
    option.value = strategy;
    option.textContent = strategy;
    select.appendChild(option);
  });

  div.appendChild(document.createTextNode(player));
  div.appendChild(select);
  return div;
}

function setStrategy(player, stratName) {
  if (player == c.WHITE) {
    whiteStrategy = Strategies[stratName];
    (document.getElementById("white-strategy") as HTMLSelectElement).value = stratName;
  } else {
    blackStrategy = Strategies[stratName];
    (document.getElementById("black-strategy") as HTMLSelectElement).value = stratName;
  }
}

function renderStrategySection() {
  let strategySection = document.getElementById("strategy");
  strategySection.innerHTML = "";
  let title = document.createElement("span");
  title.appendChild(document.createTextNode("Strategies"));
  strategySection.appendChild(title);
  let whitePicker = strategyPicker("white");
  whitePicker.addEventListener("change", (e) => setStrategy(c.WHITE, (e.target as HTMLSelectElement).value));
  let blackPicker = strategyPicker("black");
  blackPicker.addEventListener("change", (e) => setStrategy(c.BLACK, (e.target as HTMLSelectElement).value));
  strategySection.appendChild(whitePicker);
  strategySection.appendChild(blackPicker);
}

function showWinner(player: Player) {
  let indicator = document.getElementById("turn-indicator");
  let name = player == c.WHITE ? "White" : "Black";
  indicator.textContent = `${name} wins!`;
}

function render(game: Game, move?: Move): void {
  let board = document.getElementById("board");
  if (!board) {
    throw new Error("board element not found");
  }
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

  let frame = document.createElement("div")
  frame.classList.add("frame")

  let top = document.createElement("div");
  top.classList.add("top");
  let bottom = document.createElement("div");
  bottom.classList.add("bottom");
  let right = document.createElement("div")
  right.classList.add("right")

  board?.appendChild(home);
  board?.appendChild(frame)
  board?.appendChild(top);
  board?.appendChild(bottom);
  board?.appendChild(right);

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
          piece.classList.add("b");
          bar.appendChild(piece);
        }
      } else {
        for (let i = 0; i < game.wBar; i++) {
          let piece = document.createElement("span");
          piece.classList.add("piece");
          piece.classList.add("w");
          bar.appendChild(piece);
        }
      }

      triangle.parentElement.insertBefore(bar, triangle);
    }
    let label = document.createElement("div");
    label.innerText += `${i + 1}`;
    label.classList.add("label");
    triangle.appendChild(label);

    let piecesContainer = document.createElement("div");
    piecesContainer.classList.add("pieces");
    triangle.appendChild(piecesContainer);

    const count = v & 0b00001111;
    const color = v & c.WHITE ? "w" : "b";
    const pieces = [];

    for (let i = 0; i < count; i++) {
      let piece = document.createElement("span");
      piece.classList.add("piece");
      piece.classList.add(color);
      pieces.push(piece)
    }
    if (move) {
      let moved = 0;
      for (let m of move) { 
        if (!m) continue;
        let [from, to] = m;
        if (from == i) {
          let ghost = document.createElement("span");
          ghost.classList.add("piece", "ghost");
          pieces.push(ghost);
        } else if (to == i) {
          // add back to front
          let justMoved = pieces[pieces.length - (++moved)]
          if (justMoved) {
            justMoved.classList.add('just-moved');
          }
        }
      }
    }
    for (let piece of pieces) {
      piecesContainer.appendChild(piece);
    }
  });

  let turnIndicator = document.createElement("div");
  turnIndicator.id = "turn-indicator";
  let turnSpan = document.createElement('span');
  turnSpan.innerText = game.turn === c.WHITE ? "White to play" : "Black to play";
  turnIndicator.appendChild(turnSpan);
  board.insertAdjacentElement("beforeend", turnIndicator);
}

function renderRoll(roll) {
  const rollDiv = document.createElement("div");
  rollDiv.classList.add("roll");

  roll.forEach((die) => {
    const img = document.createElement("img");
    const ordinal = ["one", "two", "three", "four", "five", "six"][die - 1];
    img.src = `src/dice/${ordinal}.svg`;
    img.alt = ordinal;
    rollDiv.appendChild(img);
  });

  const board = document.getElementById("board");
  board.appendChild(rollDiv);
}

function disableTurns() {
  (document.getElementById("play") as HTMLButtonElement).disabled = true;
  (document.getElementById("ten") as HTMLButtonElement).disabled = true;
}

function enableTurns() {
  (document.getElementById("play") as HTMLButtonElement).disabled = false;
  (document.getElementById("ten") as HTMLButtonElement).disabled = false;
}

function initGame() {
  turnNo = 0;
  gameHistory = [];
  game = h.newGame();
  game.turn = c.WHITE; // white goes first, for now
  gameHistory.push({turnNo: 0, move: null, roll: null, turn: game.turn, game});
  render(game);
  enableTurns();
}

function playTurn() {
  if (h.checkWinner(game)) return;
  turnNo++;
  const roll = h.generateRoll();
  const strat = game.turn == c.WHITE ? whiteStrategy : blackStrategy;
  const player = game.turn == c.WHITE ? "w" : "b";
  const [move, next] = h.takeTurn(game, roll, strat);


  const finished = h.checkWinner(next);
  game = next;
  gameHistory.push({turnNo, move, player, roll, game}) 
  render(game, move);
  renderRoll(roll);
  renderHistory(gameHistory);
  if (finished) {
    showWinner(finished);
    disableTurns();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderStrategySection();
  setStrategy(c.WHITE, "learned");
  setStrategy(c.BLACK, "balanced");
  initGame();

  document.getElementById("play")?.addEventListener("click", playTurn);

  document.getElementById("ten")?.addEventListener("click", () => {
    for (let i = 0; i < 10; i++) {
      playTurn();
    }
  });

  document.getElementById("new")?.addEventListener("click", initGame);
});
