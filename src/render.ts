import type { Player, Game, Move, Roll, Die } from "./backgammon";
import { constants as c, helpers as h } from "./backgammon";
import { Strategies } from "./strategies";
import { renderHistory, describeTurn } from "./history";
import { showArrow } from './arrows'
import { saveGameHistoryToUrl, restoreGameHistoryFromUrl } from './url';
import { renderScoreboard, recordGameResult } from './scores';

// globals
var game;
var turnNo;
var whiteStrategy;
var blackStrategy;
var gameHistory;
var backCount;

function strategyPicker(player: "white" | "black") {
  const div = document.createElement("div");
  div.classList.add('picker')
  div.classList.add(`${player}-picker`)

  const select = document.createElement("select");
  select.id = `${player}-strategy`;

  Object.keys(Strategies).forEach((strategy) => {
    const option = document.createElement("option");
    option.value = strategy;
    option.textContent = strategy;
    select.appendChild(option);
  });

  let label = document.createElement('label')
  label.innerText = player
  div.appendChild(label);
  div.appendChild(select);
  return div;
}

function setStrategy(player, stratName) {
  if (player == c.WHITE) {
    whiteStrategy = Strategies[stratName];
    whiteStrategy.sname = stratName;
    (document.getElementById("white-strategy") as HTMLSelectElement).value = stratName;
  } else {
    blackStrategy = Strategies[stratName];
    blackStrategy.sname = stratName;
    (document.getElementById("black-strategy") as HTMLSelectElement).value = stratName;
  }
}

function renderStrategyPickers() {
  let strategySection = document.getElementById("strategy-selectors");
  let whitePicker = strategyPicker("white");
  whitePicker.addEventListener("change", (e) => setStrategy(c.WHITE, (e.target as HTMLSelectElement).value));
  let blackPicker = strategyPicker("black");
  blackPicker.addEventListener("change", (e) => setStrategy(c.BLACK, (e.target as HTMLSelectElement).value));
  strategySection.insertAdjacentElement("afterbegin", whitePicker);
  strategySection.insertAdjacentElement("afterbegin", blackPicker);
}

function renderInfo(turn, turnHistory) {
  let info = "";
  if (!turn) {
    info = "New game. Players roll to determine who goes first."
  } else {
    // (viewing past turn / current turn)
    // turn 30 (current) or (turn 15 /  30) 
    const turnCount = turnHistory.length;
    const prev = turnHistory[turn.turnNo - 2];
    if (turnCount == turn.turnNo) {
      info += `Turn ${turn.turnNo}. `;
    } else {
      info += `(${turn.turnNo}/${turnCount}) `;
    }

    // last roll and move (turn description)
    info += describeTurn(turn, prev); 
    let winner = h.checkWinner(turn.game);
    if (winner) {
      info += (winner == c.WHITE ? " White" : " Black") + " wins!";
    } else {
      info += (turn.player == 'w' ? ' Black' : ' White') + ' to play.';
      // highlight game info
      //  - pieces on the bar
      //  - available moves
      //  - bearing off or not
    }
  }
  const infoDiv = document.getElementById('turn-info');
  infoDiv.textContent = info;
}

function renderBoard(game: Game, move?: Move): void {
  let board = document.getElementById("board");
  board.innerHTML = "";

  let home = document.createElement("div");
  home?.classList.add("home");

  // show count for pieces in home
  let blackHome = document.createElement("div");
  blackHome.classList.add("home-count");
  blackHome.classList.add("black-home");
  blackHome.textContent = `Black ${game.bHome}`;

  let whiteHome = document.createElement("div");
  whiteHome.classList.add("home-count");
  whiteHome.classList.add("white-home");
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
    triangle.classList.add(`position-${i}`);
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

    for (let piece of pieces) {
      piecesContainer.appendChild(piece);
    }
  });

  if (move) {
    let arrows = move.map(_ => [])
    let moveCountByPosition = {}
    // note: we're showing the previous move, the turn has updated, so this is reversed
    const getBarElement = () => document.querySelector(game.turn == c.BLACK ? '.bottom .bar' : '.top .bar');
    const getHomeElement = () => document.querySelector(game.turn == c.BLACK ? '.white-home' : '.black-home');

    for (let n in move) { 
        let m = move[n]
        if (!m) continue;
        let [from, to] = m;
        moveCountByPosition[to] = (moveCountByPosition[to] || 0) + 1
        let ghost = document.createElement("span");
        ghost.classList.add("piece", "ghost");
        let fromPieces = document.querySelector(`.position-${from} .pieces`);
        if (from == c.BAR) {
          fromPieces = getBarElement()
        }
        fromPieces.appendChild(ghost)
        arrows[n].push(ghost) 
    }
    
    for (let n in move) { 
        let m = move[n]
        if (!m) continue;
        let [from, to] = m;
        
        if (to == c.HOME) {
            let dest = getHomeElement();
            dest.classList.add('just-moved');
            arrows[n].push(dest)
        } else {
            let toPieces = document.querySelectorAll(`.position-${to} .pieces .piece`);
            let moveCount = moveCountByPosition[to]
            
            // Get the appropriate piece from the back, counting backward from total pieces
            let destIndex = toPieces.length - moveCount
            let dest = toPieces[destIndex]
            moveCountByPosition[to]--
            
            if (dest) {
                dest.classList.add('just-moved');
                arrows[n].push(dest)
            }
        }
    }
    
    const arrowContainer = document.createElement('div');
    arrowContainer.classList.add('arrow-container');
    board.insertAdjacentElement("beforeend", arrowContainer);
    arrows.forEach(([start, dest]) => start && dest && showArrow(start, dest, arrowContainer))
}

  let frameBottom = document.createElement("div");
  frameBottom.classList.add("frame-bottom");
  board.insertAdjacentElement("beforeend", frameBottom);
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

function renderTurn(turn, turnHistory, backCount) {
  renderScoreboard();
  renderBoard(turn?.game || game, turn?.move);
  if (turn?.roll) { renderRoll(turn.roll); }
  renderHistory(turnHistory, backCount);
  renderInfo(turn, turnHistory);
}

function enable(elid) {
  (document.getElementById(elid) as HTMLButtonElement).disabled = false;
}
function disable (elid) {
  (document.getElementById(elid) as HTMLButtonElement).disabled = true;
}

// buttons are:
// - current
// - back
// - play
// - fast
// - end
function setButtons() {
  const finished = h.checkWinner(game);
  const current = backCount == 0;
  const start = backCount >= gameHistory.length - 1; 

  // play button is active unless we are at the end of the game
  if (finished && current) { disable("play") }
  else { enable("play") }

  // can walk backwards unless we are at the start
  if (start) { disable("back") }
  else { enable("back") }
  
  // can jump if we are current and not finished
  if (current && !finished) {
    enable("fast"); enable("end");
  } else {
    disable("fast"); disable("end");
  }

  // can go to current if we are not current
  if (current) { disable("current") } 
  else { enable("current") } 
}

function initGame() {
  turnNo = 0;
  gameHistory = [];
  game = h.newGame();
  backCount = 0;
}

function newGame() {
  window.location.hash = "";
  initGame()
  renderCurrentTurn()
  setButtons();
}

function back() {
  viewTurn(backCount+1);
}

function forward() {
  viewTurn(backCount-1);
}

export function viewTurn(count) {
  backCount = count;
  let nextTurn = gameHistory[gameHistory.length - 1 - backCount];
  if (!nextTurn) throw new Error("no turn available");
  
  renderTurn(nextTurn, gameHistory, backCount);
  setButtons();
}

export function playFromHere() {
  // actually go back to the game shown
  gameHistory = gameHistory.slice(0, gameHistory.length - backCount);
  let target = gameHistory[gameHistory.length - 1];
  game = target.game
  turnNo = turnNo - backCount;
  backCount = 0;

  setButtons();
  renderCurrentTurn();
}

export function jumpToLatest() {
  backCount = 0;
  let currentTurn = gameHistory[gameHistory.length - 1];

  setButtons();
  renderCurrentTurn();
}

function renderCurrentTurn() {
  if (!gameHistory) {console.log('no history'); return; }
  const turn = gameHistory[gameHistory.length - 1 - backCount];
  renderTurn(turn, gameHistory, backCount);
}

function handleTurn(roll: Roll) {
  turnNo++;
  const strat = game.turn == c.WHITE ? whiteStrategy : blackStrategy;
  const player = game.turn == c.WHITE ? "w" : "b";
  const [move, next] = h.takeTurn(game, roll, strat);
  game = next;

  const turn = {turnNo, move, player, roll, game}
  gameHistory.push(turn) 
  saveGameHistoryToUrl(gameHistory);

  const finished = h.checkWinner(game);
  if (finished) {
    const result = {
      winningStrategy: finished === c.WHITE ? whiteStrategy.sname : blackStrategy.sname,
      losingStrategy: finished === c.WHITE ? blackStrategy.sname : whiteStrategy.sname
    };
    recordGameResult(result);
  }

  renderCurrentTurn();
  setButtons();
}

function playTurn() {
  const finished = h.checkWinner(game);
  if (finished) { return; }

  if (!game.turn) {
    // Handle roll-off to start the game
    const [winner, roll] = h.rollOff();
    game.turn = winner;
    handleTurn(roll);
  } else {
    handleTurn(h.generateRoll());
  }
}

function play() {
  if (backCount == 0) {
    playTurn();
  } else {
    forward();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  renderStrategyPickers();
  setStrategy(c.WHITE, "learned");
  setStrategy(c.BLACK, "balanced");

  if (window.location.hash) {
    let urlHistory = await restoreGameHistoryFromUrl(window.location.hash);
    gameHistory = urlHistory;
    let last = gameHistory[gameHistory.length - 1];
    game = last.game;
    turnNo = last.turnNo;
    backCount = 0;
    console.log("game restored at turn", last.turnNo)
  } else {
    initGame();
  }

  renderCurrentTurn();
  setButtons();

  document.getElementById("fast")?.addEventListener("click", () => {
    for (let i = 0; i < 10; i++) {
      playTurn();
    }
  });
  document.getElementById('end')?.addEventListener('click', () => {
    while (!h.checkWinner(game)) {
      playTurn();
    }
  })
  document.getElementById("play")?.addEventListener("click", play);
  document.getElementById("back")?.addEventListener('click', back);
  document.getElementById("newgame")?.addEventListener("click", newGame);
  document.getElementById("current")?.addEventListener("click", jumpToLatest);
});
