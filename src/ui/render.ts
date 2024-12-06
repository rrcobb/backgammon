import type { Player, Game, Move, Roll, Die, Result, Movement } from "../backgammon";
import { constants as c, helpers as h } from "../backgammon";
import { AppliedStrategy } from "../strategy/strategies";
import { renderHistory, renderInfo, renderPlayerTurn } from "./history";
import { showArrow, clearArrows } from './arrows'
import { saveGameHistoryToUrl, restoreFromUrl } from './url';
import { renderScoreboard, recordGame } from './scores';
import { setStrategy, renderStrategyConfig } from './strategy';
import { renderStrategicInfo } from './analysis';
import { playerUI, highlightValidSources } from './player'
import { sleep, setButtons, setupControls } from './controls'

type Turn = {turnNo: number, move: Move, player: string, roll: Roll, game: Game}
export type UIState = {
  whiteStrategy: AppliedStrategy | null;
  blackStrategy: AppliedStrategy | null;
  game: Game | null;
  turnNo: number | null;
  gameHistory: Turn[] | null;
  backCount: number | null;
}

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

function renderHome(game: Game) {
  const home = document.createElement("div");
  home.classList.add("home");

  const blackHome = document.createElement("div");
  blackHome.classList.add("home-count", "black-home");
  blackHome.textContent = `Black ${game.bHome}`;

  const whiteHome = document.createElement("div");
  whiteHome.classList.add("home-count", "white-home");
  whiteHome.textContent = `White ${game.wHome}`;

  home.appendChild(blackHome);
  home.appendChild(whiteHome);
  return home;
}

function renderBar(count: number, color: 'w' | 'b') {
  const bar = document.createElement("div");
  bar.classList.add("bar");
  
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.classList.add("piece", color);
    bar.appendChild(piece);
  }
  return bar;
}

function renderPosition(value: number, index: number) {
  const triangle = document.createElement("div");
  triangle.classList.add("angle", `position-${index}`, index % 2 == 0 ? "red" : "gray");

  const label = document.createElement("div");
  label.innerText = `${index + 1}`;
  label.classList.add("label");
  triangle.appendChild(label);

  const piecesContainer = document.createElement("div");
  piecesContainer.classList.add("pieces");
  
  const count = value & 0b00001111;
  const color = value & c.WHITE ? "w" : "b";
  
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.classList.add("piece", color);
    piecesContainer.appendChild(piece);
  }

  triangle.appendChild(piecesContainer);
  return triangle;
}

function renderMovement(game: Game, move: Move, board: HTMLElement) {
  const arrows = move.map(_ => []);
  const moveCountByPosition = {};
  
  // note: we're showing the previous move, the turn has updated
  const getBarElement = () => document.querySelector(game.turn == c.BLACK ? '.bottom .bar' : '.top .bar');
  const getHomeElement = () => document.querySelector(game.turn == c.BLACK ? '.white-home' : '.black-home');

  // First pass: Create ghosts and count moves
  for (let n in move) {
    const m = move[n];
    if (!m) continue;
    const [from, to] = m;
    moveCountByPosition[to] = (moveCountByPosition[to] || 0) + 1;
    
    const ghost = document.createElement("span");
    ghost.classList.add("piece", "ghost");
    
    let fromPieces = document.querySelector(`.position-${from} .pieces`);
    if (from == c.BAR) {
      fromPieces = getBarElement();
    }
    fromPieces.appendChild(ghost);
    arrows[n].push(ghost);
  }

  // Second pass: Connect arrows
  for (let n in move) {
    const m = move[n];
    if (!m) continue;
    const [from, to] = m;
    
    if (to == c.HOME) {
      const dest = getHomeElement();
      dest.classList.add('just-moved');
      arrows[n].push(dest);
    } else {
      const toPieces = document.querySelectorAll(`.position-${to} .pieces .piece`);
      const moveCount = moveCountByPosition[to];
      
      // Get the appropriate piece from the back, counting backward from total pieces
      const destIndex = toPieces.length - moveCount;
      const dest = toPieces[destIndex];
      moveCountByPosition[to]--;
      
      if (dest) {
        dest.classList.add('just-moved');
        arrows[n].push(dest);
      }
    }
  }

  const arrowContainer = document.createElement('div');
  arrowContainer.classList.add('arrow-container');
  board.insertAdjacentElement("beforeend", arrowContainer);
  arrows.forEach(([start, dest]) => start && dest && showArrow(start, dest, arrowContainer));
}

export function renderBoard(game: Game, move?: Move): void {
  const board = document.getElementById("board");
  board.innerHTML = "";

  const home = renderHome(game);
  const frame = document.createElement("div");
  frame.classList.add("frame");
  
  const top = document.createElement("div");
  top.classList.add("top");
  const bottom = document.createElement("div");
  bottom.classList.add("bottom");
  const right = document.createElement("div");
  right.classList.add("right");

  [home, frame, top, bottom, right].forEach(e => board.appendChild(e))

  game.positions.forEach((v, i) => {
    const triangle = renderPosition(v, i);
    const parent = i <= 11 ? top : bottom;
    parent.appendChild(triangle);
    
    if (i == 6 || i === 18) {
      const bar = renderBar(i === 6 ? game.bBar : game.wBar, i === 6 ? 'b' : 'w');
      parent.insertBefore(bar, triangle);
    }
    
  });

  if (move) {
    renderMovement(game, move, board);
  }

  const frameBottom = document.createElement("div");
  frameBottom.classList.add("frame-bottom");
  board.insertAdjacentElement("beforeend", frameBottom);
}

function renderRoll(roll) {
  const rollDiv = document.createElement("div");
  rollDiv.classList.add("roll");

  roll.forEach((die) => {
    const img = document.createElement("img");
    const ordinal = ["one", "two", "three", "four", "five", "six"][die - 1];
    img.src = `src/assets/dice/${ordinal}.svg`;
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
  if (turn?.game) renderStrategicInfo(turn?.game, turnHistory, state.whiteStrategy, state.blackStrategy);
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
  state.game.turn = (state.game.turn == c.BLACK ? c.WHITE : c.BLACK) as Player;
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

export function renderCurrentTurn() {
  if (!state.gameHistory) {console.log('no history'); return; }
  const turn = state.gameHistory[state.gameHistory.length - 1 - state.backCount];
  renderTurn(turn, state.gameHistory);
}

export function isHuman(strategy) {
  return strategy.sname === 'human'
}

async function getNextMove(game: Game, roll: Roll): Promise<Result> {
  const strat = state.game.turn == c.WHITE ? state.whiteStrategy : state.blackStrategy;
  
  if (isHuman(strat)) {
    playerUI.currentValidMoves = h.validMoves(game, roll);
    
    return new Promise(resolve => {
      let nextTurn = playerUI.currentValidMoves[0]
      if (!nextTurn || nextTurn[0] == null) {
        let next = nextTurn ? nextTurn[1] : h.cloneGame(state.game);
        next.turn = (state.game.turn == c.BLACK ? c.WHITE : c.BLACK) as Player;
        resolve([c.nullMove, next]); 
        return;
      }
      renderRoll(roll);
      renderPlayerTurn(roll);
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
  saveGameHistoryToUrl(state.gameHistory, state);

  const finished = h.checkWinner(state.game);
  if (finished) {
    const result = {
      winningStrategy: finished === c.WHITE ? state.whiteStrategy.sname : state.blackStrategy.sname,
      losingStrategy: finished === c.WHITE ? state.blackStrategy.sname : state.whiteStrategy.sname,
      numTurns: state.turnNo
    };
    recordGame(result);
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
  if (isHuman(state.whiteStrategy) || isHuman(state.blackStrategy)) {
    playTurn();
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
  renderStrategyConfig(state);
  setupControls();

  if (window.location.hash) {
    await restoreFromUrl(state)
  } else {
    initGame();
    setStrategy(c.WHITE, "learned", state);
    setStrategy(c.BLACK, "random", state);
  }
});
