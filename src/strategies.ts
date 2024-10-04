import type { Result } from './backgammon'

type Strategy = (options: Result[]) => Result;


const first = (options: Result[]) => options && options[0];
const second = (options: Result[]) => options && options[1] || options[0];
const last = (options: Result[]) => options && options[options.length - 1];
function random(options: Result[]): Result { 
  let choice = options[Math.floor(Math.random() * options.length)];
  return choice
}

var randi = 0;
const pseudorandom = (options: Result[]) => {
  return options && options[(randi++) % options.length]
}

var i = 0;
function cheapmod(options: Result[]): Result {
  i = (i & 0b00011111) + 1;
  const index = i & (options.length - 1);
  let choice = options && options[index]
  return choice
}

const Strategies = { first, second, last, random, pseudorandom, cheapmod }

export { Strategies }
