import type { Player, Game, Move, Roll, Die, Result, Movement } from "../backgammon";
import { constants as c, helpers as h } from "../backgammon";
import { AppliedStrategy } from "../strategy/strategies";
import { renderHistory, renderInfo } from "./history";
import { showArrow, clearArrows } from './arrows'
import { saveGameHistoryToUrl, restoreFromUrl } from './url';
import { renderScoreboard, recordGameResult } from './scores';
import { setStrategy, renderStrategyPickers } from './strategy';
import { playerUI, highlightValidSources } from './player'
import { setButtons, setupControls } from './controls'

type Turn = {turnNo: number, move: Move, player: string, roll: Roll, game: Game}
export type UIState = {
  whiteStrategy: AppliedStrategy | null;
  blackStrategy: AppliedStrategy | null;
  game: Game | null;
  turnNo: number | null;
  gameHistory: Turn[] | null;
  backCount: number | null;
}

// global state
export const state: UIState = {
  whiteStrategy: null,
  blackStrategy: null,
  game: null,
  turnNo: null,
  gameHistory: null,
  backCount: null,
}

export const Settings = {
  delay: 0.3, // seconds
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
    const getBarElement = () => document.querySelector(state.game.turn == c.BLACK ? '.bottom .bar' : '.top .bar');
    const getHomeElement = () => document.querySelector(state.game.turn == c.BLACK ? '.white-home' : '.black-home');

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
    img.src = `src/ui/dice/${ordinal}.svg`;
    img.alt = ordinal;
    rollDiv.appendChild(img);
  });

  const board = document.getElementById("board");
  board.appendChild(rollDiv);
}

function renderTurn(turn, turnHistory) {
  renderScoreboard();
  renderBoard(turn?.game || state.game, turn?.move);
  if (turn?.roll) { renderRoll(turn.roll); }
  renderHistory(turnHistory, state.backCount);
  renderInfo(turn, turnHistory);
}

function initGame() {
  state.turnNo = 0;
  state.gameHistory = [];
  state.game = h.newGame();
  state.backCount = 0;
}

export function newGame() {
  window.location.hash = "";
  initGame()
  renderCurrentTurn()
  setButtons();
}

export function back() {
  if (state.backCount < state.gameHistory.length - 1) {
    viewTurn(state.backCount+1);
  }
}

function forward() {
  viewTurn(state.backCount-1);
}

export function viewTurn(count) {
  state.backCount = count;
  let nextTurn = state.gameHistory[state.gameHistory.length - 1 - state.backCount];
  if (!nextTurn) throw new Error("no turn available");
  
  renderTurn(nextTurn, state.gameHistory);
  setButtons();
}

export function playFromHere() {
  // actually go back to the game shown
  state.gameHistory = state.gameHistory.slice(0, state.gameHistory.length - state.backCount);
  let target = state.gameHistory[state.gameHistory.length - 1];
  state.game = target.game
  state.turnNo = state.turnNo - state.backCount;
  state.backCount = 0;

  setButtons();
  renderCurrentTurn();
}

export function jumpToLatest() {
  state.backCount = 0;
  let currentTurn = state.gameHistory[state.gameHistory.length - 1];

  setButtons();
  renderCurrentTurn();
}

function renderCurrentTurn() {
  if (!state.gameHistory) {console.log('no history'); return; }
  const turn = state.gameHistory[state.gameHistory.length - 1 - state.backCount];
  renderTurn(turn, state.gameHistory);
}

async function getNextMove(game: Game, roll: Roll): Promise<Result> {
  const strat = state.game.turn == c.WHITE ? state.whiteStrategy : state.blackStrategy;
  
  if (strat.sname === 'human') {
    playerUI.currentValidMoves = h.validMoves(game, roll);
    return new Promise(resolve => {
      renderRoll(roll);
      highlightValidSources();
      playerUI.humanMoveCallback = (result: Result) => {
        const [move, next] = result;
        next.turn = (state.game.turn == c.BLACK ? c.WHITE : c.BLACK) as Player;
        resolve([move, next]);
      };
    });
  }
  
  return h.takeTurn(game, roll, strat);
}

async function handleTurn(roll: Roll) {
  state.turnNo++;
  const player = state.game.turn == c.WHITE ? "w" : "b";

  const [move, next] = await getNextMove(state.game, roll);

  state.game = next;

  const turn: Turn = {turnNo: state.turnNo, move, player, roll, game: state.game}
  state.gameHistory.push(turn) 
  saveGameHistoryToUrl(state.gameHistory);

  const finished = h.checkWinner(state.game);
  if (finished) {
    const result = {
      winningStrategy: finished === c.WHITE ? state.whiteStrategy.sname : state.blackStrategy.sname,
      losingStrategy: finished === c.WHITE ? state.blackStrategy.sname : state.whiteStrategy.sname
    };
    recordGameResult(result);
  }

  renderCurrentTurn();
  setButtons();
}

export async function playTurn() {
  const finished = h.checkWinner(state.game);
  if (finished) { return; }

  if (!state.game.turn) {
    // Handle roll-off to start the game
    const [winner, roll] = h.rollOff();
    state.game.turn = winner;
    await handleTurn(roll);
  } else {
    await handleTurn(h.generateRoll());
  }
}

export async function play() {
  if (state.backCount == 0) {
    await playTurn();
  } else {
    forward();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  renderStrategyPickers(state);
  setStrategy(c.WHITE, "learned", state);
  setStrategy(c.BLACK, "balanced", state);

  if (window.location.hash) {
    await restoreFromUrl(state)
  } else {
    initGame();
  }

  renderCurrentTurn();
  setupControls();
  setButtons();
});
