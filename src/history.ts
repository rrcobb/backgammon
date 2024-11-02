import type { Player, Game, Move } from "./backgammon";
import { constants as c, helpers as h } from "./backgammon";

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

function showPos(move) {
  const start = move[0] == c.BAR ? 'bar' : (1 + move[0]);
  const end = move[1] == c.HOME ? 'home' : (1 + move[1]);
  return start + "→" + end;
}

function showMoves(moves): string {
  let passes = 0
  let result = "";
  for (let m in moves) {
    let move = moves[m];
    if (move) {
      result += showPos(move)
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

function describeTurn(turn): string {
  const player = turn.player === 'w' ? 'White' : 'Black';
  let description = `${player} rolled ${describeRoll(turn.roll)}. `;

  if (showMoves(turn.move) === "no moves possible") {
    return description + "No legal moves available.";
  }

  const groups = groupMoves(turn.move)
  const sequenceDescriptions = groups.map((group, i) => {
    let [sequence, count] = group;
    if (count == 1) {
      return describeSequence(sequence, turn.player)
    } else {
      return `${count} pieces ${describeSequence(sequence, turn.player)}`
    }
  });

  if (sequenceDescriptions.length === 1) {
    return description + "Moved " + sequenceDescriptions[0] + ".";
  }

  if (sequenceDescriptions.length === 2) {
    return description + "Moved " + sequenceDescriptions[0] + ' and ' + sequenceDescriptions[1] + ".";
  }

  const lastMove = sequenceDescriptions.pop();
  return description + "Moved " + sequenceDescriptions.join(', ') + ', and ' + lastMove + ".";
}

function renderHistory(gameHistory) {
  const history = document.getElementById("history");
  history.innerHTML = ""; // clear first
  gameHistory.slice().reverse().forEach((turn, index) => {
    const turnDiv = document.createElement('div');
    turnDiv.classList.add('history-turn');
    turnDiv.classList.add(turn.player === 'w' ? 'white-turn' : 'black-turn');

    if (index === 0) {
      if (h.checkWinner(turn.game)) {
        turnDiv.classList.add('winning-turn');
        const winnerBanner = document.createElement('div');
        winnerBanner.classList.add('winner-banner');
        winnerBanner.innerText = `${turn.player === 'w' ? 'White' : 'Black'} wins!`;
        history.appendChild(winnerBanner);
      } else {
        // detailed description for this turn
        const descriptionDiv = document.createElement('div');
        const description = describeTurn(turn);
        descriptionDiv.classList.add('turn-description');
        descriptionDiv.classList.add(turn.player === 'w' ? 'white-turn' : 'black-turn');
        descriptionDiv.innerText = description;
        history.appendChild(descriptionDiv);
      }
    }

    if (turn.roll == null) {
      return
    }

    const num = document.createElement('span')
    num.innerText = turn.turnNo
    num.classList.add('turn-number')
    turnDiv.appendChild(num);

    const rollSpan = document.createElement('span');
    rollSpan.innerText = showRoll(turn.roll);
    rollSpan.classList.add('turn-roll')
    turnDiv.appendChild(rollSpan);

    const moves = document.createElement('span');
    const movesText = showMoves(turn.move);
    moves.innerText = movesText;
    moves.classList.add('turn-moves');
    if (movesText === "no moves possible") {
      moves.classList.add('no-moves');
    } else if (movesText.includes(' pass')) {
      moves.classList.add('has-passes');
    }
    turnDiv.appendChild(moves)

    history.appendChild(turnDiv);
  });
}

export { renderHistory }
