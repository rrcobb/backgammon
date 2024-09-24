import type { Result } from './backgammon'

type Strategy = (options: Result[]) => Result;


const first = (options: Result[]) => options && options[0];
const second = (options: Result[]) => options && options[1] || options[0];
const last = (options: Result[]) => options && options[options.length - 1];
const random = (options: Result[]) => options && options[Math.floor(Math.random() * options.length)];

var randi = 0;
const pseudorandom = (options: Result[]) => {
  return options && options[(randi++) % options.length]
}

var i = 0;
const cheapmod = (options: Result[]) => {
  i = (i & 0b00011111) + 1;
  const index = i ^ options.length;
  return options && options[index]
}

export { first, second, last, random, pseudorandom, cheapmod }
