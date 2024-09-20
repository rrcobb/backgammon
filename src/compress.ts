// allow compressing and decompressing game states
// allow compressing/decompressing a series of moves -- a game history
// reading and writing these to files

import { Player, Game } from './game'

// Bit Representation:
// 24 positions, each has a color and count
// 2 bar representations, white and black counts
// doubling cube - owner bit and 
// inferred: whose turn, home/borne off pieces, die

type GameBinary = ArrayBuffer;

// function toBinary(game: Game): GameBinary {}
// function fromBinary(binary: GameBinary): Game {}
//
// type GameEncoded = ArrayBuffer;
// function compress(binary: GameBinary): GameCompressed {}
// function decompress(compressed: GameCompressed): GameBinary {}

// Huffman tree

