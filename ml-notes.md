# Notes

As I'm learning ML ideas to implement the strategies.

- in Qlearning / SARSA / eligibility traces: is there a notion of confidence returned from the learned value function? If not, could a factor be introduced?
  - idea being that low-confidence estimates should be updated harder by new evidence, but the estimator function should be updated more strongly
  - have to work out the details of what it would mean / how it affects predictions and convergence

## Ideas for things to implement

Some kind of RL/ML strategies:

- SARSA? 
  - it's not likely to converge quick enough
  - it's a precursor to a TD method
- Q-learning?
- Q* search? 
- CST? (https://en.wikipedia.org/wiki/Constructing_skill_trees)
- Some kind of attention? Transformer?
- Some kind of Deep RL?
- DQN? Double DQN? yeesh. 

In some sense, predicting the winner is _pretty_ similar to a strategy. Sort of a 'prediction is action' insight, huh?

## Reading / References

- [Sutton and Barto](http://www.incompleteideas.net/book/ebook/the-book.html)
- [TD-Gammon](https://bkgm.com/articles/tesauro/tdl.html)
- [BKG](https://www.bkgm.com/articles/Berliner/BKG-AProgramThatPlaysBackgammon/index.html)
- [sarsa wikipedia](https://en.wikipedia.org/wiki/State%E2%80%93action%E2%80%93reward%E2%80%93state%E2%80%93action)
- [q-learning wikipedia](https://en.wikipedia.org/wiki/Q-learning)? Function approximator / fuzzy rule-base? (game state gets too large to build a proper q-table...)
- q* search [paper](https://arxiv.org/abs/2102.04518) and [paper](https://icaps24.icaps-conference.org/program/workshops/prl-papers/9.pdf)
- [huggingface deep rl course](https://huggingface.co/learn/deep-rl-course/en/unit0/introduction)
- [huggingface course: deep-q algorithm](https://huggingface.co/learn/deep-rl-course/en/unit3/deep-q-algorithm)
- [dqn paper](https://arxiv.org/abs/1312.5602)
- [dqn tensorflow tutorial](https://www.tensorflow.org/agents/tutorials/0_intro_rl)
- [dqn tutorial](https://towardsdatascience.com/deep-q-learning-tutorial-mindqn-2a4c855abffc)


## Code, for ML in js...

- we're in the javascript world, famous for ML research... (not actually)
- https://github.com/trekhleb/micrograd-ts/tree/main
- https://github.com/eduardoleao052/js-pytorch
- https://github.com/torch-js/torch-js
- https://github.com/tensorflow/tfjs
