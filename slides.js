import Reveal from 'reveal.js';
import Markdown from 'reveal.js/plugin/markdown';
import Highlight from 'reveal.js/plugin/highlight';

let deck = new Reveal({
  plugins: [Markdown, Highlight],
  hash: true,
});
deck.initialize({hash: true});
