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
  - we shouldn't do naive sarsa
- Q-learning?
- Q* search? 
- [CST](https://en.wikipedia.org/wiki/Constructing_skill_trees)?
- Some kind of attention? Transformers?
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

- we're in the javascript world, famous for ML research... (not actually) (but kinda?)
- https://github.com/trekhleb/micrograd-ts/tree/main
  - todo: reimplement from the video
- https://github.com/eduardoleao052/js-pytorch
  - todo: implement with this
- https://github.com/torch-js/torch-js
  - try with this as well
- https://github.com/tensorflow/tfjs
  - and also this?

Doing just a raw array of floats is also okay for baby stuff.

## genetics

I did genetic learning, and it seemed to do good?

Or maybe we got a curriculum learning effect from running against some bad opponents in the 'normal' learn-factors process... or something.

Now, the learned weights are kicking the crap out of 'balanced', which is neat to see. Expectimax also seems like it is a plus, though it's a litttttle bit unclear. learned is realllly well trained against balanced - I wonder if it's overfit to beating that strategy in particular?

## neural net!

rough design:
- inputs are bits that represent the game
- net should have... 2? 3? 4? 5? layers of MLP
- output should be... a percent chance that the side is winning?
- gradient descent, but weighted by the amount the percent was off
- curriculum learning, in that we start with the endgame / bearing off, then move to earlier and earlier games
- self-play? play against particular opponents?

first version: tdg.ts (td-gammon using convnet.js)
- 3 hidden layers (40 units each)

- it maybe sort of trains? It at least shows some weights!
- interestingly: narrower fully-connected mlp layers (40 vs 100) are much faster, even if there are more of them
- the loss doesn't go down fast, so it would (I think) take a ton of training to converge

TODO:
- Add TD(λ) as discussed

- implement and switch to self-play mode
- curriculum learning

also:
- Track win rates in windows (e.g. every 100 games)
- Monitor hidden layer activations for dead neurons
- Add evaluation against fixed opponent
- Track average position evaluation
