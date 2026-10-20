import type { Player, Game, Move, Roll, Result } from "../backgammon";
import { constants as c, helpers as h } from "../backgammon";
import { Strategies } from "../strategy/strategies";
import type { AppliedStrategy } from "../strategy/strategies";
import { renderHistory, renderInfo, renderPlayerTurn } from "./history";
import { showArrow, clearArrows } from './arrows'
import { saveGameHistoryToUrl, restoreFromUrl } from './url';
import { renderScoreboard, recordGame } from './scores';
import { setStrategy, renderStrategyConfig } from './strategy';
import { renderStrategicInfo } from './analysis';
import { playerUI, highlightValidSources } from './player'
import { setButtons, setupControls } from './controls'
import { byId, find } from './_components'

// one played turn; player is who moved, and game is the position after the move
export type Turn = {turnNo: number, move: Move, player: 'w' | 'b', roll: Roll, game: Game}
export type UIState = {
  whiteStrategy: AppliedStrategy;
  blackStrategy: AppliedStrategy;
  game: Game;
  turnNo: number;
  gameHistory: Turn[];
  backCount: number; // how many turns back from the latest we're viewing
}

// the page sets the strategies on load, from the URL or the defaults
export const state: UIState = {
  whiteStrategy: Strategies.learned,
  blackStrategy: Strategies.random,
  game: h.newGame(),
  turnNo: 0,
  gameHistory: [],
  backCount: 0,
}

export const Settings = {
  delay: 80, // ms
}

export async function sleep(s: number) {
  await new Promise(resolve => setTimeout(resolve, s))
}

function renderHome(game: Game) {
  const home = document.createElement("div");
  home.classList.add("home");

  const blackHome = document.createElement("div");
  blackHome.classList.add("home-count", "black-home");
  blackHome.textContent = `${game.bHome}`;

  const whiteHome = document.createElement("div");
  whiteHome.classList.add("home-count", "white-home");
  whiteHome.textContent = `${game.wHome}`;

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
  const arrows: Element[][] = move.map(_ => []);
  const moveCountByPosition: Record<number, number> = {};
  
  // note: we're showing the previous move, the turn has updated
  const getBarElement = () => find(game.turn == c.BLACK ? '.bottom .bar' : '.top .bar');
  const getHomeElement = () => find(game.turn == c.BLACK ? '.white-home' : '.black-home');

  // First pass: Create ghosts and count moves
  for (let n = 0; n < move.length; n++) {
    const m = move[n];
    if (!m) continue;
    const [from, to] = m;
    moveCountByPosition[to] = (moveCountByPosition[to] || 0) + 1;
    
    const ghost = document.createElement("span");
    ghost.classList.add("piece", "ghost");
    
    const fromPieces = from == c.BAR ? getBarElement() : find(`.position-${from} .pieces`);
    fromPieces.appendChild(ghost);
    arrows[n].push(ghost);
  }

  // Second pass: Connect arrows
  for (let n = 0; n < move.length; n++) {
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
  const board = byId("board");
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

function renderRoll(roll: Roll) {
  const rollDiv = document.createElement("div");
  rollDiv.classList.add("roll");

  roll.forEach((die) => {
    const img = document.createElement("img");
    const ordinal = ["one", "two", "three", "four", "five", "six"][die - 1];
    img.src = `src/assets/dice/${ordinal}.svg`;
    img.alt = ordinal;
    rollDiv.appendChild(img);
  });

  byId("board").appendChild(rollDiv);
}

function renderTurn(turn: Turn | undefined, turnHistory: Turn[]) {
  renderScoreboard();
  renderBoard(turn?.game || state.game, turn?.move);
  if (turn?.roll) { renderRoll(turn.roll); }
  renderHistory(turnHistory, state.backCount);
  renderInfo(turn, turnHistory);
  renderStrategicInfo(turn, turnHistory, state.whiteStrategy, state.blackStrategy);
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

export function viewTurn(count: number) {
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
  state.game.turn = h.toMove(state.game) == c.BLACK ? c.WHITE : c.BLACK;
  state.turnNo = state.turnNo - state.backCount;
  state.backCount = 0;

  setButtons();
  renderCurrentTurn();
}

export function jumpToLatest() {
  state.backCount = 0;

  setButtons();
  renderCurrentTurn();
}

export function renderCurrentTurn() {
  const turn = state.gameHistory[state.gameHistory.length - 1 - state.backCount];
  renderTurn(turn, state.gameHistory);
}

export function isHuman(strategy: AppliedStrategy) {
  return strategy.sname === 'human'
}

const other = (p: Player): Player => (p === c.WHITE ? c.BLACK : c.WHITE);

async function getNextMove(game: Game, roll: Roll): Promise<Result> {
  const strat = state.game.turn == c.WHITE ? state.whiteStrategy : state.blackStrategy;
  
  if (isHuman(strat)) {
    playerUI.currentValidMoves = h.validMoves(game, roll);
    
    return new Promise(resolve => {
      let nextTurn = playerUI.currentValidMoves[0]
      // no legal move: validMoves returns a single pass, [null, null]
      if (!nextTurn || nextTurn[0].every((m) => m === null)) {
        let next = nextTurn ? nextTurn[1] : h.cloneGame(state.game);
        next.turn = other(h.toMove(state.game));
        resolve([c.nullMove, next]); 
        return;
      }
      renderRoll(roll);
      renderPlayerTurn(roll);
      highlightValidSources();
      playerUI.humanMoveCallback = (result: Result) => {
        const [move, next] = result;
        next.turn = other(h.toMove(state.game));
        resolve([move, next]);
      };
    });
  }
  
  return h.takeTurn(game, roll, strat);
}

async function handleTurn(roll: Roll) {
  state.turnNo++;
  const player = h.toMove(state.game) == c.WHITE ? "w" : "b";

  const [move, next] = await getNextMove(state.game, roll);

  state.game = next;

  const turn: Turn = {turnNo: state.turnNo, move, player, roll, game: state.game}
  state.gameHistory.push(turn) 
  saveGameHistoryToUrl(state.gameHistory, state);

  const finished = h.checkWinner(state.game);
  if (finished) {
    const name = (s: AppliedStrategy) => s.sname ?? "unknown";
    const result = {
      winningStrategy: name(finished === c.WHITE ? state.whiteStrategy : state.blackStrategy),
      losingStrategy: name(finished === c.WHITE ? state.blackStrategy : state.whiteStrategy),
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
