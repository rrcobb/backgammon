import type { Player, Game, Move } from "../backgammon";
import { constants as c, helpers as h } from "../backgammon";
import { playFromHere, jumpToLatest, viewTurn } from './render'
import { containerHeader } from './_components';

function showDie(n: number): string {
  return ['⚀','⚁','⚂','⚃','⚄','⚅'][n-1];
}

function showRoll(roll: [number, number]): string {
  if (roll[0] === roll[1]) {
    // For doubles, show all four dice
    return new Array(4).fill(showDie(roll[0])).join('')
  }
  return showDie(roll[0]) + showDie(roll[1]);
}

function showPos(move, isHit) {
  const start = move[0] == c.BAR ? 'bar' : (1 + move[0]);
  const end = move[1] == c.HOME ? 'home' : (1 + move[1]);
  return start + "→" + end + (isHit ? '⊗' : '');
}

function showMoves(moves, turn, prev): string {
  let passes = 0
  let result = "";

  let hitLocs = [];
  if (checkHit(turn, prev)) {
    hitLocs = hitLocations(turn, prev);
  }

  for (let m in moves) {
    let move = moves[m];
    if (move) {
      const isHit = hitLocs.includes(move[1]);
      result += showPos(move, isHit);
    } else {
      passes +=1
      if (passes == moves.length) {
        return "no moves possible"
      }
      result += "pass";
    }
    if (+m < moves.length - 1) result += ",";
  }
  return result;
}

function identical(a, b) {
  return a[0] == b[0] && a[1] == b[1];
}

function chained(a, b) {
  return a[1] == b[0] || a[0] == b[1];
}

function groupMoves(_moves: Move[]): [Move[], number][] {
  const moves = _moves.filter(m => m !== null);
  if (moves.length === 0) return [];
  if (moves.length === 1) return [[moves, 1]];
  if (moves.length === 2) {
    let [a,b] = moves;
    if (identical(a, b)) return [[[a], 2]];
    if (chained(a,b)) return [[[a,b], 1]];
    return moves.map(m => [[m], 1])
  }

  // rolled doubles, have 3 or 4 moves
  let result: [Move[], number][] = [];
  let remaining = [...moves];
  
  while (remaining.length > 0) {
    const move = remaining[0];
    const chains = remaining.filter(m => chained(m, move));
    const count = remaining.filter(m => identical(m, move)).length;
    result.push([[move], count]);
    remaining = remaining.filter(m => !identical(m, move));
  }
  
  return result;
}

function describeLocation(point: number, player: string, to: boolean): string {
  if (point == c.BAR) return "the bar";
  if (point == c.HOME) return "home";
  return "" + (point + 1)
}

function describeRoll([d1, d2]: [number, number]): string {
  if (d1 === d2) {
    return `double ${d1}s`;
  }
  return `${d1}, ${d2}`;
}

function describeSequence(sequence, player) {
  if (sequence.length == 1) {
    let move = sequence[0];
    const fromDesc = describeLocation(move[0], player, false);
    const toDesc = describeLocation(move[1], player, true);
    return `from ${fromDesc} to ${toDesc}`;
  } else {
    let [first, ...rest] = sequence;
    const fromDesc = describeLocation(first[0], player, false);
    const toDesc = describeLocation(first[1], player, false);
    let description = `a piece from ${fromDesc} to ${toDesc}`
    for (let move of rest) {
      description += ` and then to ${describeLocation(move[1], player, false)}`
    }
    return description;
  }
}

function checkHit(turn, prev): boolean {
  if (!prev) return false;
  
  // Check if opponent's bar count increased
  let prevBarCount, newBarCount;
  if(turn.player === 'w') {
    prevBarCount = prev.game.bBar;
    newBarCount = turn.game.bBar;
  } else {
    prevBarCount = prev.game.wBar;
    newBarCount = turn.game.wBar;
  }
  
  return newBarCount > prevBarCount;
}

function hitLocations(turn, prev): number[] {
  const opponent = turn.player === 'w' ? c.BLACK : c.WHITE;
  const hits: number[] = [];
  
  // Check each position for disappeared opponent blots
  for (let pos = 0; pos < 24; pos++) {
    const prevBlot = (prev.game.positions[pos] ^ opponent) == 1;
    if (prevBlot) {
      const noOpponent = (turn.game.positions[pos] & opponent) != opponent;
      if (noOpponent) {
        hits.push(pos);
      }
    }
  }
  
  return hits;
}

function describeTurn(turn, prev): string {
  if (!turn.game) return `Game start. Players roll to determine who plays first.`;

  const player = turn.player === 'w' ? 'White' : 'Black';
  let description = `${player} rolled ${describeRoll(turn.roll)}. `;

  if (turn.turnNo === 1) {
    const [whiteRoll, blackRoll] = turn.roll;
    description = `White rolled ${whiteRoll}, Black rolled ${blackRoll}. ${player} goes first. `;
  }

  if (showMoves(turn.move, turn, prev) === "no moves possible") {
    return description + "No legal moves available.";
  }

  const groups = groupMoves(turn.move)
  let seenMulti = false;
  const sequenceDescriptions = groups.map((group, i) => {
    let [sequence, count] = group;
    if (count == 1) {
      if (seenMulti) {
        return `once piece ${describeSequence(sequence, turn.player)}`
      }
      return describeSequence(sequence, turn.player)
    } else {
      seenMulti = true;
      return `${count} pieces ${describeSequence(sequence, turn.player)}`
    }
  });

  if (sequenceDescriptions.length === 1) {
    description += "Moved " + sequenceDescriptions[0] + ".";
  } else if (sequenceDescriptions.length === 2) {
    description += "Moved " + sequenceDescriptions[0] + ' and ' + sequenceDescriptions[1] + ".";
  } else {
    const lastMove = sequenceDescriptions.pop();
    description += "Moved " + sequenceDescriptions.join(', ') + ', and ' + lastMove + ".";
  }

  if (checkHit(turn, prev)) {
    const hitLocs = hitLocations(turn, prev);
    let hitDesc = `Hit ${turn.player === 'w' ? 'Black' : 'White'}'s blot`
    hitDesc += hitLocs.map(pos => ` on ${pos + 1}`).join(' and');
    description += ` ${hitDesc}.`;
  }

  return description;
}

function renderHistory(gameHistory, backCount=0) {
  // Create or get content wrapper
  const container = document.getElementById("history-container");
  const historyEl = document.getElementById("turn-history");
  let content = historyEl.querySelector('.section-content');
  if (!content) {
    historyEl.innerHTML = '';
    
    // Add header outside content area
    const header = containerHeader("Timeline", historyEl);
    historyEl.appendChild(header);
    
    // Create content wrapper
    content = document.createElement('div');
    content.classList.add('section-content');

    // default closed
    content.classList.add('collapsed');
    container.classList.add('collapsed'); 

    historyEl.appendChild(content);
  }

  // Clear just the content
  content.innerHTML = '';

  if (gameHistory.length == 0) {
    const startDiv = renderTurn({player: 'b', turnNo: 'start', roll: null}, null, 0, backCount);
    content.appendChild(startDiv);
  }

  const reverseChronology = gameHistory.slice().reverse();
  reverseChronology.forEach((turn, index) => {
    const prev = reverseChronology[index + 1]
    const turnDiv = renderTurn(turn, prev, index, backCount);

    if (index === 0) {
      if (turn.game && h.checkWinner(turn.game)) {
        turnDiv.classList.add('winning-turn');
        const winnerBanner = document.createElement('div');
        winnerBanner.classList.add('winner-banner');
        winnerBanner.innerText = `${turn.player === 'w' ? 'White' : 'Black'} wins!`;
        content.appendChild(winnerBanner);
      }
    }

    content.appendChild(turnDiv);
  });
  addHistoryControls(content, backCount);
}

function addHistoryControls(historyEl, backCount) {
  const controls = document.createElement('div');
  controls.classList.add('history-controls');

  const isShowingLatest = backCount == 0;
  
  const playFromHereButton = document.createElement('button');
  playFromHereButton.innerText = 'Play from here';
  playFromHereButton.classList.add('history-control');
  playFromHereButton.addEventListener('click', () => playFromHere());
  if (isShowingLatest) playFromHereButton.disabled = true;
  
  const jumpLatestButton = document.createElement('button');
  jumpLatestButton.innerText = '↪ Back to latest';
  jumpLatestButton.classList.add('history-control');
  jumpLatestButton.addEventListener('click', () => jumpToLatest());
  if (isShowingLatest) jumpLatestButton.disabled = true;
  
  controls.appendChild(jumpLatestButton);
  controls.appendChild(playFromHereButton);
  historyEl.appendChild(controls);
}

function renderTurn(turn, prev, index, backCount) {
  const hitOpponent = checkHit(turn, prev);
    
  const turnDiv = document.createElement('div');

  turnDiv.classList.add('history-turn');
  turnDiv.classList.add(turn.player === 'w' ? 'white-turn' : 'black-turn');

  const num = document.createElement('span')
  num.innerText = turn.turnNo
  num.classList.add('turn-number')
  turnDiv.appendChild(num);

  const rollSpan = document.createElement('span');
  rollSpan.innerText = turn.roll ? showRoll(turn.roll) : '';
  rollSpan.classList.add('turn-roll')
  turnDiv.appendChild(rollSpan);

  const moves = document.createElement('span');
  const movesText = showMoves(turn.move, turn, prev);
  moves.innerText = movesText;
  moves.classList.add('turn-moves');
  if (movesText === "no moves possible") {
    moves.classList.add('no-moves');
  } else if (movesText.includes(' pass')) {
    moves.classList.add('has-passes');
  }
  turnDiv.appendChild(moves)

  const isCurrentTurn = index == backCount
  if (isCurrentTurn) {
    turnDiv.classList.add('history-current');
    turnDiv.classList.add('expanded');
    const descDiv = document.createElement('div');
    descDiv.classList.add('turn-description');
    descDiv.innerText = describeTurn(turn, prev);
    turnDiv.appendChild(descDiv);
  }

  const indicator = document.createElement('span');
  indicator.classList.add('expand-indicator');
  indicator.innerText = isCurrentTurn ? '◉' : '○';
  turnDiv.appendChild(indicator);
  turnDiv.addEventListener('click', () => viewTurn(index));

  return turnDiv
}

function renderInfo(turn, turnHistory) {
  let info = "";
  if (!turn) {
    info = "New game. Players roll to determine who goes first."
  } else {
    // viewing past turn / current turn
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
      // note the inversion; turn.player is the previous turn
      if (turn.game.wBar && turn.player == 'b') info += ` White has ${turn.game.wBar} on the bar.`;
      if (turn.game.bBar && turn.player == 'w') info += ` Black has ${turn.game.bBar} on the bar.`;
    }
  }
  const infoDiv = document.getElementById('turn-info');
  infoDiv.textContent = info;
}

function renderPlayerTurn(roll) {
  const infoDiv = document.getElementById('turn-info');
  const playerTurn = document.createElement('div');
  playerTurn.style.marginTop = '8px';
  playerTurn.textContent = `Your turn! You rolled ${describeRoll(roll)}.`;
  infoDiv.appendChild(playerTurn);
}

export { renderHistory, renderInfo, renderPlayerTurn }
