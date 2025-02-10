// small neural net implementation

// architecture:
//    feed a game into the first layer of the net
//    weighted mix of those bits passes through the layers
//    -- that's the feed-forward
//    then, we compare to some source of truth
//    and propagate the error backwards through the net
//    according to the contribution of each node's weight to the output, i.e. gradient descent

// and... we should also have some non-linear steps in between some of the layers
//   so that we can be a universal approximator, not just a linear function approximator
//   and we can use something like RELU for that?
//
//  and we do something like softmax at the output step
//
//
// design space questions:
//    - what's the representation of the game for the input?
//    - how wide / deep is our net?
//      - (is it one RELU between each layer?)
//    - what's the source of truth, for us to compute error against?
//    - how do we know if we're improving? how do we see progress? how do we detect if we're converging or diverging?


// network interface
//  output = net.forward(input)
//  -- compute loss --
//  -- update weights -- 
//  net.back(loss)
//
//  see https://cs.stanford.edu/people/karpathy/convnetjs/demo/rldemo.html
