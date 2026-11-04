# Capability Inventory

**What this is (Fix Round 5, Part 0).** Every capability of every screen, read from the running build by `tests/e2e/capabilities.spec.ts`:
- every experiment, in both modes;
- in two states, as opened and part-way through the run;
- with every disclosure section open.

Numbers are shown as `#`, so an entry means the same capability whatever values the run holds.

**It is generated, not written by hand.** Regenerate it with `CAPTURE=1 npx playwright test tests/e2e/capabilities.spec.ts`, which also writes the JSON baseline (`reports/capability-inventory.json`).

**How it protects the baseline.** Without `CAPTURE`, the same test fails if any baseline capability is missing from the current build, unless `reports/capability-removed.json` lists it with the ADR that removed it. A capability can be removed deliberately; it cannot disappear silently.

**Totals:** 2090 capabilities over 20 screens.

**What it does not cover.** States that appear only after a particular interaction (a revealed prediction, a pinned comparison) are not captured here. They are covered by the e2e tests named in PROGRESS, Fix Round 5.

## activations (expert)

**Panels** (11)

- Check your understanding
- Execution controls
- Experiment panels
- Explanation
- Guided walkthrough
- Inspector
- Network structure view
- Neural execution view
- Starting weights and biases
- Training state view
- Try it

**Controls (data-control id, element, accessible name)** (70)

- back (button): ◀ Back
- breakpoint:deadRelu (checkbox): a ReLU unit is inactive for a whole epoch
- breakpoint:exploding (checkbox): a gradient explodes (any /g/ > #)
- breakpoint:gradInit (checkbox): back-propagation starts (each example)
- breakpoint:lossIncrease (checkbox): the epoch loss rises by more than # %
- breakpoint:lossPlateau (checkbox): the epoch loss stops decreasing
- breakpoint:nonFinite (checkbox): NaN or infinity appears
- breakpoint:vanishing (checkbox): a layer’s gradient vanishes (all /g/ < #⁻⁴)
- chart:heatmap (rect): Epoch # weights into the output layer: gradient size #
- chart:pick (svg): Accuracy per epoch. training set: latest #.
- chart:pick (svg): Accuracy per epoch. training set: no data yet.
- chart:pick (svg): Loss per epoch. training (running mean): latest #; evaluation (end of epoch): latest #.
- chart:pick (svg): Loss per epoch. training (running mean): no data yet; evaluation (end of epoch): no data yet.
- chart:table (summary): Table view of the epoch data
- explain:detailed (button): Detailed
- explain:maths (button): Show the maths
- explain:novice (button): Simple
- explain:numbers (button): Show this step's numbers
- export:caption (textarea): Caption
- export:csv (button): Forward pass — step: download CSV data
- export:csv (button): Network architecture: download CSV data
- export:csv (button): The training run as a trace of instructions: download CSV data
- export:mode (button): Colour
- export:mode (button): Greyscale
- export:mode (button): High contrast
- export:open (summary): Export figures
- export:pdf (button): Forward pass — step: save as PDF via the print dialog
- export:pdf (button): Network architecture: save as PDF via the print dialog
- export:pdf (button): The training run as a trace of instructions: save as PDF via the print dialog
- export:refresh (button): Refresh at current position
- export:svg (button): Forward pass — step: download SVG
- export:svg (button): Network architecture: download SVG
- export:svg (button): The training run as a trace of instructions: download SVG
- export:zip (button): All figures (.zip)
- param:L1.b (button): Biases of the output layerL#.b[#]▸
- param:L1.W (button): Weights into the output layerL#.W[#×#]▸
- params (section): Starting weights and biases
- play (button): ▶▶ Run
- reset-experiment (button): ↺ Reset experiment
- rewind (button): ⏮ Start
- scrub (range): Position
- select:edge (g): Weight from Input unit # to Output (sigmoid) unit #: #
- select:unit (g): Input, unit #: not yet computed
- select:unit (g): Input, unit #: value #
- select:unit (g): Output (sigmoid), unit #: not yet computed
- select:unit (g): Output (sigmoid), unit #: value # gradient #, bias #
- selfcheck:ac1 (radio): every z equally
- selfcheck:ac1 (radio): large positive z, where the output is largest
- selfcheck:ac1 (radio): z = # where it equals #
- selfcheck:ac2 (radio): a negative gradient, because z is negative
- selfcheck:ac2 (radio): the same gradient as an active unit
- selfcheck:ac2 (radio): zero gradient from this example
- speed (range): Speed
- step (button): Step ▶
- step-size:batch (button): Batch
- step-size:epoch (button): Epoch
- step-size:layer (button): Layer
- step-size:operation (button): Operation
- step-size:phase (button): Phase
- step-size:sample (button): Example
- structure:expand (button): L#dense · sigmoid→ [#]# params▸
- to-breakpoint (button): ⇥ To breakpoint
- tryit:0 (select): Activation
- tryit:1 (text): starting weight w
- tryit:1:slider (range): starting weight w (drag)
- tryit:2 (text): input x of the first example
- walkthrough:hide (button): Hide
- walkthrough:next (button): Next ▶
- walkthrough:prev (button): ◀ Previous
- walkthrough:show-me (button): Run to the activation

**Disclosure sections** (2)

- Export figures
- Table view of the epoch data

**Information shown (headings, captions, legends)** (23)

- figcaption: Accuracy per epoch
- figcaption: Activation function: sigmoid
- figcaption: Gradient magnitude per layer, by epoch
- figcaption: L# batch gradient
- figcaption: L# weights
- figcaption: Loss per epoch
- h2: Check your understanding
- h2: Export figures
- h2: Inspector
- h2: Network structure
- h2: Starting weights and biases
- h2: Step through training
- h2: Training so far
- h2: Try it
- h2: Walkthrough · # of #
- h2: What just happened
- h3: Distributions at this point
- h3: What changed since the previous step
- legend: #. A ReLU unit has z = # for an example. During back-propagation its incoming weights receive…
- legend: #. The sigmoid’s slope σ′(z) is largest at…
- legend: Pause automatically when…
- legend: Step size
- p: positive weight (solid) negative weight (dashed) · line thickness = /weight/ · number in each neuron = its current value

## activations (novice)

**Panels** (11)

- Check your understanding
- Execution controls
- Experiment panels
- Explanation
- Guided walkthrough
- Inspector
- Network structure view
- Neural execution view
- Starting weights and biases
- Training state view
- Try it

**Controls (data-control id, element, accessible name)** (49)

- back (button): ◀ Back
- breakpoint:deadRelu (checkbox): a ReLU unit is inactive for a whole epoch
- breakpoint:exploding (checkbox): a gradient explodes (any /g/ > #)
- breakpoint:gradInit (checkbox): back-propagation starts (each example)
- breakpoint:lossIncrease (checkbox): the epoch loss rises by more than # %
- breakpoint:lossPlateau (checkbox): the epoch loss stops decreasing
- breakpoint:nonFinite (checkbox): NaN or infinity appears
- breakpoint:vanishing (checkbox): a layer’s gradient vanishes (all /g/ < #⁻⁴)
- chart:heatmap (rect): Epoch # weights into the output layer: gradient size #
- chart:pick (svg): Accuracy per epoch. training set: latest #.
- chart:pick (svg): Accuracy per epoch. training set: no data yet.
- chart:pick (svg): Loss per epoch. training (running mean): latest #; evaluation (end of epoch): latest #.
- chart:pick (svg): Loss per epoch. training (running mean): no data yet; evaluation (end of epoch): no data yet.
- chart:table (summary): Table view of the epoch data
- explain:detailed (button): Detailed
- explain:maths (button): Show the maths
- explain:novice (button): Simple
- explain:numbers (button): Show this step's numbers
- more-controls (summary): More controls: pause automatically
- param:L1.b (button): Biases of the output layer[#]▸
- param:L1.W (button): Weights into the output layer[#×#]▸
- params (section): Starting weights and biases
- play (button): ▶▶ Run
- reset-experiment (button): ↺ Reset experiment
- rewind (button): ⏮ Start
- scrub (range): Position
- select:edge (g): Weight from Input unit # to Output (sigmoid) unit #: #
- select:unit (g): Input, unit #: not yet computed
- select:unit (g): Input, unit #: value #
- select:unit (g): Output (sigmoid), unit #: not yet computed
- select:unit (g): Output (sigmoid), unit #: value # gradient #, bias #
- selfcheck:ac1 (radio): every z equally
- selfcheck:ac1 (radio): large positive z, where the output is largest
- selfcheck:ac1 (radio): z = # where it equals #
- selfcheck:ac2 (radio): a negative gradient, because z is negative
- selfcheck:ac2 (radio): the same gradient as an active unit
- selfcheck:ac2 (radio): zero gradient from this example
- speed (range): Speed
- step (button): Step ▶
- structure:expand (button): The output layerdense · sigmoid→ [#]# params▸
- to-breakpoint (button): ⇥ To breakpoint
- tryit:0 (select): Activation
- tryit:1 (text): starting weight w
- tryit:1:slider (range): starting weight w (drag)
- tryit:2 (text): input x of the first example
- walkthrough:hide (button): Hide
- walkthrough:next (button): Next ▶
- walkthrough:prev (button): ◀ Previous
- walkthrough:show-me (button): Run to the activation

**Disclosure sections** (2)

- More controls: pause automatically
- Table view of the epoch data

**Information shown (headings, captions, legends)** (21)

- figcaption: Accuracy per epoch
- figcaption: Activation function: sigmoid
- figcaption: Gradient magnitude per layer, by epoch
- figcaption: L# batch gradient
- figcaption: L# weights
- figcaption: Loss per epoch
- h2: Check your understanding
- h2: Inspector
- h2: Network structure
- h2: Starting weights and biases
- h2: Step through training
- h2: Training so far
- h2: Try it
- h2: Walkthrough · # of #
- h2: What just happened
- h3: Distributions at this point
- h3: What changed since the previous step
- legend: #. A ReLU unit has z = # for an example. During back-propagation its incoming weights receive…
- legend: #. The sigmoid’s slope σ′(z) is largest at…
- legend: Pause automatically when…
- p: positive weight (solid) negative weight (dashed) · line thickness = /weight/ · number in each neuron = its current value

## backpropagation (expert)

**Panels** (10)

- Check your understanding
- Execution controls
- Explanation
- Guided walkthrough
- Inspector
- Network structure view
- Neural execution view
- Starting weights and biases
- Training state view
- Try it

**Controls (data-control id, element, accessible name)** (87)

- arch:activation (select): Activation of hidden layer #relutanhsigmoidlinear
- arch:add (button): + add hidden layer
- arch:apply (button): Apply and restart
- arch:epochs (text): Epochs
- arch:lr (text): Learning rate
- arch:remove (button): Remove hidden layer #
- arch:restore (button): restore defaults
- arch:width (text): Width of hidden layer #
- back (button): ◀ Back
- breakpoint:deadRelu (checkbox): a ReLU unit is inactive for a whole epoch
- breakpoint:exploding (checkbox): a gradient explodes (any /g/ > #)
- breakpoint:gradInit (checkbox): back-propagation starts (each example)
- breakpoint:lossIncrease (checkbox): the epoch loss rises by more than # %
- breakpoint:lossPlateau (checkbox): the epoch loss stops decreasing
- breakpoint:nonFinite (checkbox): NaN or infinity appears
- breakpoint:vanishing (checkbox): a layer’s gradient vanishes (all /g/ < #⁻⁴)
- chart:heatmap (rect): Epoch # weights into hidden layer #: gradient size #
- chart:heatmap (rect): Epoch # weights into the output layer: gradient size #
- chart:pick (svg): Accuracy per epoch. training set: latest #.
- chart:pick (svg): Accuracy per epoch. training set: no data yet.
- chart:pick (svg): Loss per epoch. training (running mean): latest #; evaluation (end of epoch): latest #.
- chart:pick (svg): Loss per epoch. training (running mean): no data yet; evaluation (end of epoch): no data yet.
- chart:table (summary): Table view of the epoch data
- explain:detailed (button): Detailed
- explain:maths (button): Show the maths
- explain:novice (button): Simple
- explain:numbers (button): Show this step's numbers
- export:caption (textarea): Caption
- export:csv (button): Forward pass — gaussians: download CSV data
- export:csv (button): Network architecture: download CSV data
- export:csv (button): The training run as a trace of instructions: download CSV data
- export:mode (button): Colour
- export:mode (button): Greyscale
- export:mode (button): High contrast
- export:open (summary): Export figures
- export:pdf (button): Forward pass — gaussians: save as PDF via the print dialog
- export:pdf (button): Network architecture: save as PDF via the print dialog
- export:pdf (button): The training run as a trace of instructions: save as PDF via the print dialog
- export:refresh (button): Refresh at current position
- export:svg (button): Forward pass — gaussians: download SVG
- export:svg (button): Network architecture: download SVG
- export:svg (button): The training run as a trace of instructions: download SVG
- export:zip (button): All figures (.zip)
- param:L1.b (button): Biases of hidden layer #L#.b[#]▸
- param:L1.W (button): Weights into hidden layer #L#.W[#×#]▸
- param:L2.b (button): Biases of the output layerL#.b[#]▸
- param:L2.W (button): Weights into the output layerL#.W[#×#]▸
- params (section): Starting weights and biases
- play (button): ▶▶ Run
- reset-experiment (button): ↺ Reset experiment
- rewind (button): ⏮ Start
- scrub (range): Position
- select:edge (g): Weight from Hidden # (sigmoid) unit # to Output (sigmoid) unit #: #
- select:edge (g): Weight from Input unit # to Hidden # (sigmoid) unit #: #
- select:unit (g): Hidden # (sigmoid), unit #: not yet computed
- select:unit (g): Hidden # (sigmoid), unit #: value #, gradient #, bias #
- select:unit (g): Input, unit #: not yet computed
- select:unit (g): Input, unit #: value #
- select:unit (g): Output (sigmoid), unit #: not yet computed
- select:unit (g): Output (sigmoid), unit #: value #, gradient #, bias #
- selfcheck:bp1 (radio): layer #’s error signal and layer #’s weights
- selfcheck:bp1 (radio): layer #’s weights only
- selfcheck:bp1 (radio): the input features
- selfcheck:bp2 (radio): Because the forward pass changed the inputs
- selfcheck:bp2 (radio): Each layer’s gradient needs the gradient of the layer after it
- selfcheck:bp2 (radio): It is arbitrary
- speed (range): Speed
- step (button): Step ▶
- step-size:batch (button): Batch
- step-size:epoch (button): Epoch
- step-size:layer (button): Layer
- step-size:operation (button): Operation
- step-size:phase (button): Phase
- step-size:sample (button): Example
- structure:expand (button): L#dense · sigmoid→ [#]# params▸
- to-breakpoint (button): ⇥ To breakpoint
- tryit:0 (select): Activation of layer #
- tryit:1 (text): feature # of the first example
- tryit:2 (text): feature # of the first example
- tryit:3 (text): target of the first example (from # to #)
- tryit:4 (text): Learning rate η
- tryit:5 (text): Random seed (the starting point of the random numbers)
- tryit:more (summary): More settings
- walkthrough:hide (button): Hide
- walkthrough:next (button): Next ▶
- walkthrough:prev (button): ◀ Previous
- walkthrough:show-me (button): Run to the start of back-propagation

**Disclosure sections** (3)

- Export figures
- More settings
- Table view of the epoch data

**Information shown (headings, captions, legends)** (25)

- figcaption: Accuracy per epoch
- figcaption: Decision boundary
- figcaption: Decision boundary after epoch #
- figcaption: Gradient magnitude per layer, by epoch
- figcaption: L# batch gradient
- figcaption: L# weights
- figcaption: Loss per epoch
- h2: Check your understanding
- h2: Export figures
- h2: Inspector
- h2: Network structure
- h2: Starting weights and biases
- h2: Step through training
- h2: Training so far
- h2: Try it
- h2: Walkthrough · # of #
- h2: What just happened
- h3: Distributions at this point
- h3: What changed since the previous step
- legend: #. The gradient that reaches layer #’s output is computed from…
- legend: #. Why is the backward pass done from the output towards the input?
- legend: Change the network (restarts training)
- legend: Pause automatically when…
- legend: Step size
- p: positive weight (solid) negative weight (dashed) · line thickness = /weight/ · number in each neuron = its current value

## backpropagation (novice)

**Panels** (8)

- Check your understanding
- Going deeper
- Inspector
- Neural execution view
- Starting weights and biases
- The network
- Training state view
- Your settings

**Controls (data-control id, element, accessible name)** (44)

- back (button): ◀ Back
- chart:pick (svg): Accuracy per epoch. training set: no data yet.
- chart:pick (svg): Loss per epoch. training (running mean): no data yet; evaluation (end of epoch): no data yet.
- chart:table (summary): Table view of the epoch data
- deeper:activation (button): ▾ Try another activation
- deeper:activation-select (select): Hidden activation sigmoidtanhrelu
- deeper:expert (button): ⧉ Open the full workbench (expert mode)
- deeper:maths (button): ▾ Show the maths
- deeper:numbers (button): ▾ Show the numbers
- deeper:second-view (button): ▾ Add the training charts
- deeper:settings (button): ▾ Change the weights, the example and the learning rate
- inspector:clear (button): Clear
- param:L1.b (button): Biases of hidden layer #[#]▸
- param:L1.W (button): Weights into hidden layer #[#×#]▸
- param:L2.b (button): Biases of the output layer[#]▸
- param:L2.W (button): Weights into the output layer[#×#]▸
- params (section): Starting weights and biases
- predict:option (button): ○ down
- predict:option (button): ○ hardly at all
- predict:option (button): ○ up
- reset-experiment (button): ↺ Reset experiment
- select:edge (g): Weight from Hidden # (sigmoid) unit # to Output (sigmoid) unit #: #
- select:edge (g): Weight from Input unit # to Hidden # (sigmoid) unit #: #
- select:unit (g): Hidden # (sigmoid), unit #: not yet computed
- select:unit (g): Hidden # (sigmoid), unit #: value #, bias #
- select:unit (g): Input, unit #: not yet computed
- select:unit (g): Input, unit #: value #
- select:unit (g): Output (sigmoid), unit #: not yet computed
- select:unit (g): Output (sigmoid), unit #: value #, bias #
- selfcheck:bp1 (radio): layer #’s error signal and layer #’s weights
- selfcheck:bp1 (radio): layer #’s weights only
- selfcheck:bp1 (radio): the input features
- selfcheck:bp2 (radio): Because the forward pass changed the inputs
- selfcheck:bp2 (radio): Each layer’s gradient needs the gradient of the layer after it
- selfcheck:bp2 (radio): It is arbitrary
- step (button): Next: forward / backward / update ▶
- step-size:layer (button): one layer
- step-size:operation (button): one calculation
- step-size:phase (button): forward / backward / update
- tryit:1 (text): feature # of the first example
- tryit:2 (text): feature # of the first example
- tryit:3 (text): target of the first example (from # to #)
- tryit:4 (text): Learning rate η
- tryit:5 (text): Random seed (the starting point of the random numbers)

**Disclosure sections** (7)

- going deeper: Add the training charts
- going deeper: Change the weights, the example and the learning rate
- going deeper: Open the full workbench (expert mode)
- going deeper: Show the maths
- going deeper: Show the numbers
- going deeper: Try another activation
- Table view of the epoch data

**Information shown (headings, captions, legends)** (22)

- figcaption: Accuracy per epoch
- figcaption: Decision boundary
- figcaption: Gradient magnitude per layer, by epoch
- figcaption: L# batch gradient
- figcaption: L# weights
- figcaption: Loss per epoch
- h2: Check your understanding
- h2: Starting weights and biases
- h2: The network gets an example a little wrong. Which of its weights are to blame, and by how much? Follow the error backwar
- h2: Training so far
- h2: Weight from input # to layer # neuron #
- h3: Connected elements
- h3: Distributions at this point
- h3: Follow one weight
- h3: Going deeper
- h3: In the trace
- h3: The chain rule for the weight from input # to hidden neuron # for example # the last one worked back through
- h3: The chain rule for the weight from input # to hidden neuron # for this example
- legend: #. The gradient that reaches layer #’s output is computed from…
- legend: #. Why is the backward pass done from the output towards the input?
- legend: Your prediction This example will push the weight you are following…
- p: positive weight (solid) negative weight (dashed) · line thickness = /weight/ · number in each neuron = its current value

## cnn-mnist (expert)

**Panels** (9)

- Check your understanding
- Convolution view
- Execution controls
- Explanation
- Guided walkthrough
- Inspector
- Network structure view
- Training state view
- Try it

**Controls (data-control id, element, accessible name)** (75)

- back (button): ◀ Back
- breakpoint:deadRelu (checkbox): a ReLU unit is inactive for a whole epoch
- breakpoint:exploding (checkbox): a gradient explodes (any /g/ > #)
- breakpoint:gradInit (checkbox): back-propagation starts (each example)
- breakpoint:lossIncrease (checkbox): the epoch loss rises by more than # %
- breakpoint:lossPlateau (checkbox): the epoch loss stops decreasing
- breakpoint:nonFinite (checkbox): NaN or infinity appears
- breakpoint:vanishing (checkbox): a layer’s gradient vanishes (all /g/ < #⁻⁴)
- chart:heatmap (rect): Epoch # kernels of hidden layer #: gradient size #
- chart:heatmap (rect): Epoch # weights into the output layer: gradient size #
- chart:pick (svg): Accuracy per epoch. training set: latest #; held-out test: latest #.
- chart:pick (svg): Accuracy per epoch. training set: no data yet.
- chart:pick (svg): Loss per epoch. training (running mean): latest #; evaluation (end of epoch): latest #; held-out test: latest #.
- chart:pick (svg): Loss per epoch. training (running mean): no data yet; evaluation (end of epoch): no data yet.
- chart:table (summary): Table view of the epoch data
- explain:detailed (button): Detailed
- explain:maths (button): Show the maths
- explain:novice (button): Simple
- explain:numbers (button): Show this step's numbers
- export:caption (textarea): Caption
- export:csv (button): Convolution feature maps — mnist#: download CSV data
- export:csv (button): Network architecture: download CSV data
- export:csv (button): The training run as a trace of instructions: download CSV data
- export:mode (button): Colour
- export:mode (button): Greyscale
- export:mode (button): High contrast
- export:open (summary): Export figures
- export:pdf (button): Convolution feature maps — mnist#: save as PDF via the print dialog
- export:pdf (button): Network architecture: save as PDF via the print dialog
- export:pdf (button): The training run as a trace of instructions: save as PDF via the print dialog
- export:refresh (button): Refresh at current position
- export:svg (button): Convolution feature maps — mnist#: download SVG
- export:svg (button): Network architecture: download SVG
- export:svg (button): The training run as a trace of instructions: download SVG
- export:zip (button): All figures (.zip)
- play (button): ▶▶ Run
- reset-experiment (button): ↺ Reset experiment
- rewind (button): ⏮ Start
- scrub (range): Position
- select:cell (svg): Channel #: #×# activations; click a cell to place the window. Selected cell none; arrow keys move it.
- select:cell (svg): Channel #: #×# activations; click a cell to place the window. Selected cell row # column #; arrow keys move it.
- selfcheck:cn1 (radio): # × #
- selfcheck:cn2 (radio): Each kernel’s # weights are shared across every position of the image
- selfcheck:cn2 (radio): Only the image border is connected
- selfcheck:cn2 (radio): Pooling removes most of the weights
- selfcheck:cn3 (radio): equally to all four positions
- selfcheck:cn3 (radio): nowhere, because pooling has no weights
- selfcheck:cn3 (radio): only to the position that held the maximum
- speed (range): Speed
- step (button): Step ▶
- step-size:batch (button): Batch
- step-size:epoch (button): Epoch
- step-size:layer (button): Layer
- step-size:operation (button): Operation
- step-size:phase (button): Phase
- step-size:sample (button): Example
- structure:expand (button): L#conv#d · relu→ [#×#×#]# params▸
- structure:expand (button): L#dense · softmax→ [#]# params▸
- structure:expand (button): L#flatten→ [#]no params▸
- structure:expand (button): L#pool→ [#×#×#]no params▸
- to-breakpoint (button): ⇥ To breakpoint
- tryit:0 (select): Activation of layer #
- tryit:1 (text): Learning rate η
- tryit:2 (text): Number of kernels
- tryit:3 (text): Kernel size (pixels per side)
- tryit:4 (text): Stride (pixels the window moves)
- tryit:5 (text): Padding (zero pixels added at each edge)
- tryit:6 (text): Batch size B
- tryit:7 (text): Epochs (passes over the data)
- tryit:8 (text): Random seed (the starting point of the random numbers)
- tryit:more (summary): More settings
- walkthrough:hide (button): Hide
- walkthrough:next (button): Next ▶
- walkthrough:prev (button): ◀ Previous
- walkthrough:show-me (button): Load a digit

**Disclosure sections** (3)

- Export figures
- More settings
- Table view of the epoch data

**Information shown (headings, captions, legends)** (28)

- figcaption: Accuracy per epoch
- figcaption: Gradient magnitude per layer, by epoch
- figcaption: L# batch gradient
- figcaption: L# weights
- figcaption: Loss per epoch
- h2: Check your understanding
- h2: Export figures
- h2: Inspector
- h2: Network structure
- h2: Step through training
- h2: Training so far
- h2: Try it
- h2: Walkthrough · # of #
- h2: What just happened
- h3: After pooling
- h3: Distributions at this point
- h3: Feature maps (after activation)
- h3: Feature maps (convolution output u)
- h3: Input
- h3: Kernels (L#)
- h3: Prediction
- h3: What changed since the previous step
- legend: #. A # × # kernel slides over a # × # image with stride # and no padding. How large is the feature map?
- legend: #. During back-propagation, a # × # max-pooling layer sends each gradient…
- legend: #. Why does this convolutional layer have only # × # + # = # parameters?
- legend: Pause automatically when…
- legend: Step size
- p: Orange = negative, blue = positive (each map scaled to its own largest magnitude); input pixels in grey. Click a feature

## cnn-mnist (novice)

**Panels** (9)

- Check your understanding
- Convolution view
- Execution controls
- Explanation
- Guided walkthrough
- Inspector
- Network structure view
- Training state view
- Try it

**Controls (data-control id, element, accessible name)** (60)

- back (button): ◀ Back
- breakpoint:deadRelu (checkbox): a ReLU unit is inactive for a whole epoch
- breakpoint:exploding (checkbox): a gradient explodes (any /g/ > #)
- breakpoint:gradInit (checkbox): back-propagation starts (each example)
- breakpoint:lossIncrease (checkbox): the epoch loss rises by more than # %
- breakpoint:lossPlateau (checkbox): the epoch loss stops decreasing
- breakpoint:nonFinite (checkbox): NaN or infinity appears
- breakpoint:vanishing (checkbox): a layer’s gradient vanishes (all /g/ < #⁻⁴)
- chart:heatmap (rect): Epoch # kernels of hidden layer #: gradient size #
- chart:heatmap (rect): Epoch # weights into the output layer: gradient size #
- chart:pick (svg): Accuracy per epoch. training set: latest #; held-out test: latest #.
- chart:pick (svg): Accuracy per epoch. training set: no data yet.
- chart:pick (svg): Loss per epoch. training (running mean): latest #; evaluation (end of epoch): latest #; held-out test: latest #.
- chart:pick (svg): Loss per epoch. training (running mean): no data yet; evaluation (end of epoch): no data yet.
- chart:table (summary): Table view of the epoch data
- explain:detailed (button): Detailed
- explain:maths (button): Show the maths
- explain:novice (button): Simple
- explain:numbers (button): Show this step's numbers
- more-controls (summary): More controls: pause automatically
- play (button): ▶▶ Run
- reset-experiment (button): ↺ Reset experiment
- rewind (button): ⏮ Start
- scrub (range): Position
- select:cell (svg): Channel #: #×# activations; click a cell to place the window. Selected cell none; arrow keys move it.
- select:cell (svg): Channel #: #×# activations; click a cell to place the window. Selected cell row # column #; arrow keys move it.
- selfcheck:cn1 (radio): # × #
- selfcheck:cn2 (radio): Each kernel’s # weights are shared across every position of the image
- selfcheck:cn2 (radio): Only the image border is connected
- selfcheck:cn2 (radio): Pooling removes most of the weights
- selfcheck:cn3 (radio): equally to all four positions
- selfcheck:cn3 (radio): nowhere, because pooling has no weights
- selfcheck:cn3 (radio): only to the position that held the maximum
- speed (range): Speed
- step (button): Step ▶
- step-size:batch (button): one batch
- step-size:epoch (button): one full pass
- step-size:layer (button): one layer
- step-size:operation (button): one calculation
- step-size:phase (button): forward / backward / update
- step-size:sample (button): one example
- structure:expand (button): Hidden layer #conv#d · relu→ [#×#×#]# params▸
- structure:expand (button): Hidden layer #flatten→ [#]no params▸
- structure:expand (button): Hidden layer #pool→ [#×#×#]no params▸
- structure:expand (button): The output layerdense · softmax→ [#]# params▸
- to-breakpoint (button): ⇥ To breakpoint
- tryit:0 (select): Activation of layer #
- tryit:1 (text): Learning rate η
- tryit:2 (text): Number of kernels
- tryit:3 (text): Kernel size (pixels per side)
- tryit:4 (text): Stride (pixels the window moves)
- tryit:5 (text): Padding (zero pixels added at each edge)
- tryit:6 (text): Batch size B
- tryit:7 (text): Epochs (passes over the data)
- tryit:8 (text): Random seed (the starting point of the random numbers)
- tryit:more (summary): More settings
- walkthrough:hide (button): Hide
- walkthrough:next (button): Next ▶
- walkthrough:prev (button): ◀ Previous
- walkthrough:show-me (button): Load a digit

**Disclosure sections** (3)

- More controls: pause automatically
- More settings
- Table view of the epoch data

**Information shown (headings, captions, legends)** (27)

- figcaption: Accuracy per epoch
- figcaption: Gradient magnitude per layer, by epoch
- figcaption: L# batch gradient
- figcaption: L# weights
- figcaption: Loss per epoch
- h2: Check your understanding
- h2: Inspector
- h2: Network structure
- h2: Step through training
- h2: Training so far
- h2: Try it
- h2: Walkthrough · # of #
- h2: What just happened
- h3: After pooling
- h3: Distributions at this point
- h3: Feature maps (after activation)
- h3: Feature maps (convolution output u)
- h3: Input
- h3: Kernels (L#)
- h3: Prediction
- h3: What changed since the previous step
- legend: #. A # × # kernel slides over a # × # image with stride # and no padding. How large is the feature map?
- legend: #. During back-propagation, a # × # max-pooling layer sends each gradient…
- legend: #. Why does this convolutional layer have only # × # + # = # parameters?
- legend: Pause automatically when…
- legend: Step size
- p: Orange = negative, blue = positive (each map scaled to its own largest magnitude); input pixels in grey. Click a feature

## forward-propagation (expert)

**Panels** (10)

- Check your understanding
- Execution controls
- Explanation
- Guided walkthrough
- Inspector
- Network structure view
- Neural execution view
- Starting weights and biases
- Training state view
- Try it

**Controls (data-control id, element, accessible name)** (84)

- arch:activation (select): Activation of hidden layer #relutanhsigmoidlinear
- arch:add (button): + add hidden layer
- arch:apply (button): Apply and restart
- arch:epochs (text): Epochs
- arch:lr (text): Learning rate
- arch:remove (button): Remove hidden layer #
- arch:restore (button): restore defaults
- arch:width (text): Width of hidden layer #
- back (button): ◀ Back
- breakpoint:deadRelu (checkbox): a ReLU unit is inactive for a whole epoch
- breakpoint:exploding (checkbox): a gradient explodes (any /g/ > #)
- breakpoint:gradInit (checkbox): back-propagation starts (each example)
- breakpoint:lossIncrease (checkbox): the epoch loss rises by more than # %
- breakpoint:lossPlateau (checkbox): the epoch loss stops decreasing
- breakpoint:nonFinite (checkbox): NaN or infinity appears
- breakpoint:vanishing (checkbox): a layer’s gradient vanishes (all /g/ < #⁻⁴)
- chart:heatmap (rect): Epoch # weights into hidden layer #: gradient size #
- chart:heatmap (rect): Epoch # weights into the output layer: gradient size #
- chart:pick (svg): Accuracy per epoch. training set: latest #.
- chart:pick (svg): Accuracy per epoch. training set: no data yet.
- chart:pick (svg): Loss per epoch. training (running mean): latest #; evaluation (end of epoch): latest #.
- chart:pick (svg): Loss per epoch. training (running mean): no data yet; evaluation (end of epoch): no data yet.
- chart:table (summary): Table view of the epoch data
- explain:detailed (button): Detailed
- explain:maths (button): Show the maths
- explain:novice (button): Simple
- explain:numbers (button): Show this step's numbers
- export:caption (textarea): Caption
- export:csv (button): Forward pass — gaussians: download CSV data
- export:csv (button): Network architecture: download CSV data
- export:csv (button): The training run as a trace of instructions: download CSV data
- export:mode (button): Colour
- export:mode (button): Greyscale
- export:mode (button): High contrast
- export:open (summary): Export figures
- export:pdf (button): Forward pass — gaussians: save as PDF via the print dialog
- export:pdf (button): Network architecture: save as PDF via the print dialog
- export:pdf (button): The training run as a trace of instructions: save as PDF via the print dialog
- export:refresh (button): Refresh at current position
- export:svg (button): Forward pass — gaussians: download SVG
- export:svg (button): Network architecture: download SVG
- export:svg (button): The training run as a trace of instructions: download SVG
- export:zip (button): All figures (.zip)
- param:L1.b (button): Biases of hidden layer #L#.b[#]▸
- param:L1.W (button): Weights into hidden layer #L#.W[#×#]▸
- param:L2.b (button): Biases of the output layerL#.b[#]▸
- param:L2.W (button): Weights into the output layerL#.W[#×#]▸
- params (section): Starting weights and biases
- play (button): ▶▶ Run
- reset-experiment (button): ↺ Reset experiment
- rewind (button): ⏮ Start
- scrub (range): Position
- select:edge (g): Weight from Hidden # (tanh) unit # to Output (sigmoid) unit #: #
- select:edge (g): Weight from Input unit # to Hidden # (tanh) unit #: #
- select:unit (g): Hidden # (tanh), unit #: not yet computed
- select:unit (g): Hidden # (tanh), unit #: value #, gradient #, bias #
- select:unit (g): Input, unit #: not yet computed
- select:unit (g): Input, unit #: value #
- select:unit (g): Output (sigmoid), unit #: not yet computed
- select:unit (g): Output (sigmoid), unit #: value #, gradient #, bias #
- selfcheck:fp1 (radio): #
- selfcheck:fp2 (radio): layer #’s outputs and layer #’s weights and biases
- selfcheck:fp2 (radio): the gradients from the last step
- selfcheck:fp2 (radio): the loss
- speed (range): Speed
- step (button): Step ▶
- step-size:batch (button): Batch
- step-size:epoch (button): Epoch
- step-size:layer (button): Layer
- step-size:operation (button): Operation
- step-size:phase (button): Phase
- step-size:sample (button): Example
- structure:expand (button): L#dense · sigmoid→ [#]# params▸
- structure:expand (button): L#dense · tanh→ [#]# params▸
- to-breakpoint (button): ⇥ To breakpoint
- tryit:0 (text): Units in hidden layer #
- tryit:1 (text): feature # of the first example
- tryit:2 (text): feature # of the first example
- tryit:3 (text): Random seed (the starting point of the random numbers)
- tryit:more (summary): More settings
- walkthrough:hide (button): Hide
- walkthrough:next (button): Next ▶
- walkthrough:prev (button): ◀ Previous
- walkthrough:show-me (button): Load the first example

**Disclosure sections** (3)

- Export figures
- More settings
- Table view of the epoch data

**Information shown (headings, captions, legends)** (25)

- figcaption: Accuracy per epoch
- figcaption: Decision boundary
- figcaption: Decision boundary after epoch #
- figcaption: Gradient magnitude per layer, by epoch
- figcaption: L# batch gradient
- figcaption: L# weights
- figcaption: Loss per epoch
- h2: Check your understanding
- h2: Export figures
- h2: Inspector
- h2: Network structure
- h2: Starting weights and biases
- h2: Step through training
- h2: Training so far
- h2: Try it
- h2: Walkthrough · # of #
- h2: What just happened
- h3: Distributions at this point
- h3: What changed since the previous step
- legend: #. Layer # has # neurons and the input has # features. How many weights does layer # have (not counting biases)?
- legend: #. To compute layer #’s output you need…
- legend: Change the network (restarts training)
- legend: Pause automatically when…
- legend: Step size
- p: positive weight (solid) negative weight (dashed) · line thickness = /weight/ · number in each neuron = its current value

## forward-propagation (novice)

**Panels** (10)

- Check your understanding
- Execution controls
- Explanation
- Guided walkthrough
- Inspector
- Network structure view
- Neural execution view
- Starting weights and biases
- Training state view
- Try it

**Controls (data-control id, element, accessible name)** (65)

- arch:activation (select): Activation of hidden layer #relutanhsigmoidlinear
- arch:add (button): + add hidden layer
- arch:apply (button): Apply and restart
- arch:epochs (text): Epochs
- arch:lr (text): Learning rate
- arch:remove (button): Remove hidden layer #
- arch:restore (button): restore defaults
- arch:width (text): Width of hidden layer #
- back (button): ◀ Back
- breakpoint:deadRelu (checkbox): a ReLU unit is inactive for a whole epoch
- breakpoint:exploding (checkbox): a gradient explodes (any /g/ > #)
- breakpoint:gradInit (checkbox): back-propagation starts (each example)
- breakpoint:lossIncrease (checkbox): the epoch loss rises by more than # %
- breakpoint:lossPlateau (checkbox): the epoch loss stops decreasing
- breakpoint:nonFinite (checkbox): NaN or infinity appears
- breakpoint:vanishing (checkbox): a layer’s gradient vanishes (all /g/ < #⁻⁴)
- chart:heatmap (rect): Epoch # weights into hidden layer #: gradient size #
- chart:heatmap (rect): Epoch # weights into the output layer: gradient size #
- chart:pick (svg): Accuracy per epoch. training set: latest #.
- chart:pick (svg): Accuracy per epoch. training set: no data yet.
- chart:pick (svg): Loss per epoch. training (running mean): latest #; evaluation (end of epoch): latest #.
- chart:pick (svg): Loss per epoch. training (running mean): no data yet; evaluation (end of epoch): no data yet.
- chart:table (summary): Table view of the epoch data
- explain:detailed (button): Detailed
- explain:maths (button): Show the maths
- explain:novice (button): Simple
- explain:numbers (button): Show this step's numbers
- more-controls (summary): More controls: pause automatically
- param:L1.b (button): Biases of hidden layer #[#]▸
- param:L1.W (button): Weights into hidden layer #[#×#]▸
- param:L2.b (button): Biases of the output layer[#]▸
- param:L2.W (button): Weights into the output layer[#×#]▸
- params (section): Starting weights and biases
- play (button): ▶▶ Run
- reset-experiment (button): ↺ Reset experiment
- rewind (button): ⏮ Start
- scrub (range): Position
- select:edge (g): Weight from Hidden # (tanh) unit # to Output (sigmoid) unit #: #
- select:edge (g): Weight from Input unit # to Hidden # (tanh) unit #: #
- select:unit (g): Hidden # (tanh), unit #: not yet computed
- select:unit (g): Hidden # (tanh), unit #: value #, gradient #, bias #
- select:unit (g): Input, unit #: not yet computed
- select:unit (g): Input, unit #: value #
- select:unit (g): Output (sigmoid), unit #: not yet computed
- select:unit (g): Output (sigmoid), unit #: value #, gradient #, bias #
- selfcheck:fp1 (radio): #
- selfcheck:fp2 (radio): layer #’s outputs and layer #’s weights and biases
- selfcheck:fp2 (radio): the gradients from the last step
- selfcheck:fp2 (radio): the loss
- speed (range): Speed
- step (button): Step ▶
- step-size:layer (button): one layer
- step-size:operation (button): one calculation
- structure:expand (button): Hidden layer #dense · tanh→ [#]# params▸
- structure:expand (button): The output layerdense · sigmoid→ [#]# params▸
- to-breakpoint (button): ⇥ To breakpoint
- tryit:0 (text): Units in hidden layer #
- tryit:1 (text): feature # of the first example
- tryit:2 (text): feature # of the first example
- tryit:3 (text): Random seed (the starting point of the random numbers)
- tryit:more (summary): More settings
- walkthrough:hide (button): Hide
- walkthrough:next (button): Next ▶
- walkthrough:prev (button): ◀ Previous
- walkthrough:show-me (button): Load the first example

**Disclosure sections** (3)

- More controls: pause automatically
- More settings
- Table view of the epoch data

**Information shown (headings, captions, legends)** (24)

- figcaption: Accuracy per epoch
- figcaption: Decision boundary
- figcaption: Decision boundary after epoch #
- figcaption: Gradient magnitude per layer, by epoch
- figcaption: L# batch gradient
- figcaption: L# weights
- figcaption: Loss per epoch
- h2: Check your understanding
- h2: Inspector
- h2: Network structure
- h2: Starting weights and biases
- h2: Step through training
- h2: Training so far
- h2: Try it
- h2: Walkthrough · # of #
- h2: What just happened
- h3: Distributions at this point
- h3: What changed since the previous step
- legend: #. Layer # has # neurons and the input has # features. How many weights does layer # have (not counting biases)?
- legend: #. To compute layer #’s output you need…
- legend: Change the network (restarts training)
- legend: Pause automatically when…
- legend: Step size
- p: positive weight (solid) negative weight (dashed) · line thickness = /weight/ · number in each neuron = its current value

## gradient-descent (expert)

**Panels** (10)

- Check your understanding
- Execution controls
- Experiment panels
- Explanation
- Guided walkthrough
- Inspector
- Network structure view
- Neural execution view
- Training state view
- Try it

**Controls (data-control id, element, accessible name)** (72)

- back (button): ◀ Back
- breakpoint:deadRelu (checkbox): a ReLU unit is inactive for a whole epoch
- breakpoint:exploding (checkbox): a gradient explodes (any /g/ > #)
- breakpoint:gradInit (checkbox): back-propagation starts (each example)
- breakpoint:lossIncrease (checkbox): the epoch loss rises by more than # %
- breakpoint:lossPlateau (checkbox): the epoch loss stops decreasing
- breakpoint:nonFinite (checkbox): NaN or infinity appears
- breakpoint:vanishing (checkbox): a layer’s gradient vanishes (all /g/ < #⁻⁴)
- chart:heatmap (rect): Epoch # weights into the output layer: gradient size #
- chart:pick (svg): Loss per epoch. training (running mean): latest #; evaluation (end of epoch): latest #.
- chart:pick (svg): Loss per epoch. training (running mean): no data yet; evaluation (end of epoch): no data yet.
- chart:table (summary): Table view of the epoch data
- explain:detailed (button): Detailed
- explain:maths (button): Show the maths
- explain:novice (button): Simple
- explain:numbers (button): Show this step's numbers
- export:caption (textarea): Caption
- export:csv (button): Forward pass — line: download CSV data
- export:csv (button): Network architecture: download CSV data
- export:csv (button): The training run as a trace of instructions: download CSV data
- export:mode (button): Colour
- export:mode (button): Greyscale
- export:mode (button): High contrast
- export:open (summary): Export figures
- export:pdf (button): Forward pass — line: save as PDF via the print dialog
- export:pdf (button): Network architecture: save as PDF via the print dialog
- export:pdf (button): The training run as a trace of instructions: save as PDF via the print dialog
- export:refresh (button): Refresh at current position
- export:svg (button): Forward pass — line: download SVG
- export:svg (button): Network architecture: download SVG
- export:svg (button): The training run as a trace of instructions: download SVG
- export:zip (button): All figures (.zip)
- play (button): ▶▶ Run
- reset-experiment (button): ↺ Reset experiment
- rewind (button): ⏮ Start
- scrub (range): Position
- select:edge (g): Weight from Input unit # to Output (linear) unit #: #
- select:unit (g): Input, unit #: not yet computed
- select:unit (g): Input, unit #: value #
- select:unit (g): Output (linear), unit #: not yet computed
- select:unit (g): Output (linear), unit #: value #, gradient #, bias #
- selfcheck:gd1 (radio): Because the loss is negative
- selfcheck:gd1 (radio): The gradient points uphill; we want to go downhill
- selfcheck:gd1 (radio): To keep the parameters small
- selfcheck:gd2 (radio): lower the learning rate
- selfcheck:gd2 (radio): raise the learning rate
- selfcheck:gd2 (radio): train for more epochs
- selfcheck:gd3 (radio): # update instead of # each more accurate
- selfcheck:gd3 (radio): # updates instead of # each based on a noisier gradient estimate
- selfcheck:gd3 (radio): Nothing changes, because the same # points are used
- speed (range): Speed
- step (button): Step ▶
- step-size:batch (button): Batch
- step-size:epoch (button): Epoch
- step-size:layer (button): Layer
- step-size:operation (button): Operation
- step-size:phase (button): Phase
- step-size:sample (button): Example
- structure:expand (button): L#dense · linear→ [#]# params▸
- to-breakpoint (button): ⇥ To breakpoint
- tryit:0 (text): Learning rate η
- tryit:1 (text): Batch size B
- tryit:2 (text): starting weight w
- tryit:2:slider (range): starting weight w (drag)
- tryit:3 (text): starting bias b
- tryit:3:slider (range): starting bias b (drag)
- tryit:4 (text): Epochs (passes over the data)
- tryit:more (summary): More settings
- walkthrough:hide (button): Hide
- walkthrough:next (button): Next ▶
- walkthrough:prev (button): ◀ Previous
- walkthrough:show-me (button): Step one batch

**Disclosure sections** (3)

- Export figures
- More settings
- Table view of the epoch data

**Information shown (headings, captions, legends)** (22)

- figcaption: Gradient magnitude per layer, by epoch
- figcaption: L# batch gradient
- figcaption: L# weights
- figcaption: Loss per epoch
- figcaption: Loss surface L(w, b) and the path of gradient descent
- h2: Check your understanding
- h2: Export figures
- h2: Inspector
- h2: Network structure
- h2: Step through training
- h2: Training so far
- h2: Try it
- h2: Walkthrough · # of #
- h2: What just happened
- h3: Distributions at this point
- h3: What changed since the previous step
- legend: #. The loss grows larger after every step. The most likely fix is to…
- legend: #. The update rule is θ ← θ − η·∂L/∂θ. Why the minus sign?
- legend: #. You change the batch size from # to # on these # points. What happens in each epoch?
- legend: Pause automatically when…
- legend: Step size
- p: positive weight (solid) negative weight (dashed) · line thickness = /weight/ · number in each neuron = its current value

## gradient-descent (novice)

**Panels** (5)

- Check your understanding
- Going deeper
- The loss surface
- Training state view
- Your settings

**Controls (data-control id, element, accessible name)** (33)

- back (button): ◀ Back
- chart:heatmap (rect): Epoch # weights into the output layer: gradient size #
- chart:pick (svg): Loss per epoch. training (running mean): latest #; evaluation (end of epoch): latest #.
- chart:pick (svg): Loss per epoch. training (running mean): no data yet; evaluation (end of epoch): no data yet.
- chart:table (summary): Table view of the epoch data
- deeper:expert (button): ⧉ Open the full workbench (expert mode)
- deeper:maths (button): ▾ Show the maths
- deeper:numbers (button): ▾ Show the numbers
- deeper:second-view (button): ▾ Add the loss-per-pass chart
- deeper:settings (button): ▾ Change the starting point and the passes
- jump-end (button): Jump to the end
- lr (button): η = #
- lr-typed (text): …or type any learning rate η
- passed (details): On the way: the network was checked on all the examples (#); pass # over the examples began.A check on all the examples 
- play (button): ▶ Watch it walk
- reset-experiment (button): ↺ Reset experiment
- selfcheck:gd1 (radio): Because the loss is negative
- selfcheck:gd1 (radio): The gradient points uphill; we want to go downhill
- selfcheck:gd1 (radio): To keep the parameters small
- selfcheck:gd2 (radio): lower the learning rate
- selfcheck:gd2 (radio): raise the learning rate
- selfcheck:gd2 (radio): train for more epochs
- selfcheck:gd3 (radio): # update instead of # each more accurate
- selfcheck:gd3 (radio): # updates instead of # each based on a noisier gradient estimate
- selfcheck:gd3 (radio): Nothing changes, because the same # points are used
- step (button): Next: one batch ▶
- step-size:batch (button): one batch
- step-size:sample (button): one example
- tryit:2 (text): starting weight w
- tryit:2:slider (range): starting weight w (drag)
- tryit:3 (text): starting bias b
- tryit:3:slider (range): starting bias b (drag)
- tryit:4 (text): Epochs (passes over the data)

**Disclosure sections** (7)

- going deeper: Add the loss-per-pass chart
- going deeper: Change the starting point and the passes
- going deeper: Open the full workbench (expert mode)
- going deeper: Show the maths
- going deeper: Show the numbers
- On the way: the network was checked on all the examples (#); pass # over the examples began.
- Table view of the epoch data

**Information shown (headings, captions, legends)** (15)

- caption: Loss over all # points after each pass
- figcaption: Gradient magnitude per layer, by epoch
- figcaption: L# batch gradient
- figcaption: L# weights
- figcaption: Loss per epoch
- figcaption: Loss surface L(w, b) and the path of gradient descent
- h2: Check your understanding
- h2: How does a model find the best straight line through # points? It starts with a bad line and walks downhill on its loss,
- h2: Training so far
- h3: Distributions at this point
- h3: Going deeper
- h3: Step size: the learning rate η
- legend: #. The loss grows larger after every step. The most likely fix is to…
- legend: #. The update rule is θ ← θ − η·∂L/∂θ. Why the minus sign?
- legend: #. You change the batch size from # to # on these # points. What happens in each epoch?

## loss (expert)

**Panels** (10)

- Check your understanding
- Execution controls
- Experiment panels
- Explanation
- Guided walkthrough
- Inspector
- Network structure view
- Neural execution view
- Training state view
- Try it

**Controls (data-control id, element, accessible name)** (69)

- back (button): ◀ Back
- breakpoint:deadRelu (checkbox): a ReLU unit is inactive for a whole epoch
- breakpoint:exploding (checkbox): a gradient explodes (any /g/ > #)
- breakpoint:gradInit (checkbox): back-propagation starts (each example)
- breakpoint:lossIncrease (checkbox): the epoch loss rises by more than # %
- breakpoint:lossPlateau (checkbox): the epoch loss stops decreasing
- breakpoint:nonFinite (checkbox): NaN or infinity appears
- breakpoint:vanishing (checkbox): a layer’s gradient vanishes (all /g/ < #⁻⁴)
- chart:heatmap (rect): Epoch # weights into the output layer: gradient size #
- chart:pick (svg): Accuracy per epoch. training set: latest #.
- chart:pick (svg): Accuracy per epoch. training set: no data yet.
- chart:pick (svg): Loss per epoch. training (running mean): latest #; evaluation (end of epoch): latest #.
- chart:pick (svg): Loss per epoch. training (running mean): no data yet; evaluation (end of epoch): no data yet.
- chart:table (summary): Table view of the epoch data
- explain:detailed (button): Detailed
- explain:maths (button): Show the maths
- explain:novice (button): Simple
- explain:numbers (button): Show this step's numbers
- export:caption (textarea): Caption
- export:csv (button): Forward pass — gaussians: download CSV data
- export:csv (button): Network architecture: download CSV data
- export:csv (button): The training run as a trace of instructions: download CSV data
- export:mode (button): Colour
- export:mode (button): Greyscale
- export:mode (button): High contrast
- export:open (summary): Export figures
- export:pdf (button): Forward pass — gaussians: save as PDF via the print dialog
- export:pdf (button): Network architecture: save as PDF via the print dialog
- export:pdf (button): The training run as a trace of instructions: save as PDF via the print dialog
- export:refresh (button): Refresh at current position
- export:svg (button): Forward pass — gaussians: download SVG
- export:svg (button): Network architecture: download SVG
- export:svg (button): The training run as a trace of instructions: download SVG
- export:zip (button): All figures (.zip)
- play (button): ▶▶ Run
- reset-experiment (button): ↺ Reset experiment
- rewind (button): ⏮ Start
- scrub (range): Position
- select:edge (g): Weight from Input unit # to Output (sigmoid) unit #: #
- select:unit (g): Input, unit #: not yet computed
- select:unit (g): Input, unit #: value #
- select:unit (g): Output (sigmoid), unit #: not yet computed
- select:unit (g): Output (sigmoid), unit #: value #, gradient #, bias #
- selfcheck:lo1 (radio): They are equal
- selfcheck:lo1 (radio): ŷ = #
- selfcheck:lo2 (radio): the accuracy is # %
- selfcheck:lo2 (radio): the network has stopped learning
- selfcheck:lo2 (radio): the prediction equals the target
- speed (range): Speed
- step (button): Step ▶
- step-size:batch (button): Batch
- step-size:epoch (button): Epoch
- step-size:layer (button): Layer
- step-size:operation (button): Operation
- step-size:phase (button): Phase
- step-size:sample (button): Example
- structure:expand (button): L#dense · sigmoid→ [#]# params▸
- to-breakpoint (button): ⇥ To breakpoint
- tryit:0 (select): Loss function
- tryit:1 (text): Calculator: prediction ŷ
- tryit:1:slider (range): Calculator: prediction ŷ (drag)
- tryit:2 (text): Calculator: target y
- tryit:2:slider (range): Calculator: target y (drag)
- tryit:3 (text): Random seed (the starting point of the random numbers)
- tryit:more (summary): More settings
- walkthrough:hide (button): Hide
- walkthrough:next (button): Next ▶
- walkthrough:prev (button): ◀ Previous
- walkthrough:show-me (button): Run to the loss

**Disclosure sections** (3)

- Export figures
- More settings
- Table view of the epoch data

**Information shown (headings, captions, legends)** (25)

- figcaption: Accuracy per epoch
- figcaption: Decision boundary
- figcaption: Decision boundary after epoch #
- figcaption: Gradient magnitude per layer, by epoch
- figcaption: L# batch gradient
- figcaption: L# weights
- figcaption: Loss per epoch
- figcaption: Two losses for the same prediction (target y = #)
- h2: Check your understanding
- h2: Export figures
- h2: Inspector
- h2: Network structure
- h2: Step through training
- h2: Training so far
- h2: Try it
- h2: Walkthrough · # of #
- h2: What just happened
- h3: Calculator
- h3: Distributions at this point
- h3: What changed since the previous step
- legend: #. A loss of exactly # means…
- legend: #. For a target of # which prediction has the larger cross-entropy loss?
- legend: Pause automatically when…
- legend: Step size
- p: positive weight (solid) negative weight (dashed) · line thickness = /weight/ · number in each neuron = its current value

## loss (novice)

**Panels** (10)

- Check your understanding
- Execution controls
- Experiment panels
- Explanation
- Guided walkthrough
- Inspector
- Network structure view
- Neural execution view
- Training state view
- Try it

**Controls (data-control id, element, accessible name)** (50)

- back (button): ◀ Back
- breakpoint:deadRelu (checkbox): a ReLU unit is inactive for a whole epoch
- breakpoint:exploding (checkbox): a gradient explodes (any /g/ > #)
- breakpoint:gradInit (checkbox): back-propagation starts (each example)
- breakpoint:lossIncrease (checkbox): the epoch loss rises by more than # %
- breakpoint:lossPlateau (checkbox): the epoch loss stops decreasing
- breakpoint:nonFinite (checkbox): NaN or infinity appears
- breakpoint:vanishing (checkbox): a layer’s gradient vanishes (all /g/ < #⁻⁴)
- chart:heatmap (rect): Epoch # weights into the output layer: gradient size #
- chart:pick (svg): Accuracy per epoch. training set: latest #.
- chart:pick (svg): Accuracy per epoch. training set: no data yet.
- chart:pick (svg): Loss per epoch. training (running mean): latest #; evaluation (end of epoch): latest #.
- chart:pick (svg): Loss per epoch. training (running mean): no data yet; evaluation (end of epoch): no data yet.
- chart:table (summary): Table view of the epoch data
- explain:detailed (button): Detailed
- explain:maths (button): Show the maths
- explain:novice (button): Simple
- explain:numbers (button): Show this step's numbers
- more-controls (summary): More controls: pause automatically
- play (button): ▶▶ Run
- reset-experiment (button): ↺ Reset experiment
- rewind (button): ⏮ Start
- scrub (range): Position
- select:edge (g): Weight from Input unit # to Output (sigmoid) unit #: #
- select:unit (g): Input, unit #: not yet computed
- select:unit (g): Input, unit #: value #
- select:unit (g): Output (sigmoid), unit #: not yet computed
- select:unit (g): Output (sigmoid), unit #: value #, gradient #, bias #
- selfcheck:lo1 (radio): They are equal
- selfcheck:lo1 (radio): ŷ = #
- selfcheck:lo2 (radio): the accuracy is # %
- selfcheck:lo2 (radio): the network has stopped learning
- selfcheck:lo2 (radio): the prediction equals the target
- speed (range): Speed
- step (button): Step ▶
- step-size:layer (button): one layer
- step-size:operation (button): one calculation
- structure:expand (button): The output layerdense · sigmoid→ [#]# params▸
- to-breakpoint (button): ⇥ To breakpoint
- tryit:0 (select): Loss function
- tryit:1 (text): Calculator: prediction ŷ
- tryit:1:slider (range): Calculator: prediction ŷ (drag)
- tryit:2 (text): Calculator: target y
- tryit:2:slider (range): Calculator: target y (drag)
- tryit:3 (text): Random seed (the starting point of the random numbers)
- tryit:more (summary): More settings
- walkthrough:hide (button): Hide
- walkthrough:next (button): Next ▶
- walkthrough:prev (button): ◀ Previous
- walkthrough:show-me (button): Run to the loss

**Disclosure sections** (3)

- More controls: pause automatically
- More settings
- Table view of the epoch data

**Information shown (headings, captions, legends)** (24)

- figcaption: Accuracy per epoch
- figcaption: Decision boundary
- figcaption: Decision boundary after epoch #
- figcaption: Gradient magnitude per layer, by epoch
- figcaption: L# batch gradient
- figcaption: L# weights
- figcaption: Loss per epoch
- figcaption: Two losses for the same prediction (target y = #)
- h2: Check your understanding
- h2: Inspector
- h2: Network structure
- h2: Step through training
- h2: Training so far
- h2: Try it
- h2: Walkthrough · # of #
- h2: What just happened
- h3: Calculator
- h3: Distributions at this point
- h3: What changed since the previous step
- legend: #. A loss of exactly # means…
- legend: #. For a target of # which prediction has the larger cross-entropy loss?
- legend: Pause automatically when…
- legend: Step size
- p: positive weight (solid) negative weight (dashed) · line thickness = /weight/ · number in each neuron = its current value

## lr-pathology (expert)

**Panels** (10)

- Check your understanding
- Execution controls
- Experiment panels
- Explanation
- Guided walkthrough
- Inspector
- Network structure view
- Neural execution view
- Training state view
- Try it

**Controls (data-control id, element, accessible name)** (65)

- back (button): ◀ Back
- breakpoint:deadRelu (checkbox): a ReLU unit is inactive for a whole epoch
- breakpoint:exploding (checkbox): a gradient explodes (any /g/ > #)
- breakpoint:gradInit (checkbox): back-propagation starts (each example)
- breakpoint:lossIncrease (checkbox): the epoch loss rises by more than # %
- breakpoint:lossPlateau (checkbox): the epoch loss stops decreasing
- breakpoint:nonFinite (checkbox): NaN or infinity appears
- breakpoint:vanishing (checkbox): a layer’s gradient vanishes (all /g/ < #⁻⁴)
- chart:heatmap (rect): Epoch # weights into the output layer: gradient size #
- chart:pick (svg): Loss per epoch. training (running mean): latest #; evaluation (end of epoch): latest #.
- chart:pick (svg): Loss per epoch. training (running mean): no data yet; evaluation (end of epoch): no data yet.
- chart:table (summary): Table view of the epoch data
- explain:detailed (button): Detailed
- explain:maths (button): Show the maths
- explain:novice (button): Simple
- explain:numbers (button): Show this step's numbers
- export:caption (textarea): Caption
- export:csv (button): Forward pass — line: download CSV data
- export:csv (button): Network architecture: download CSV data
- export:csv (button): The training run as a trace of instructions: download CSV data
- export:mode (button): Colour
- export:mode (button): Greyscale
- export:mode (button): High contrast
- export:open (summary): Export figures
- export:pdf (button): Forward pass — line: save as PDF via the print dialog
- export:pdf (button): Network architecture: save as PDF via the print dialog
- export:pdf (button): The training run as a trace of instructions: save as PDF via the print dialog
- export:refresh (button): Refresh at current position
- export:svg (button): Forward pass — line: download SVG
- export:svg (button): Network architecture: download SVG
- export:svg (button): The training run as a trace of instructions: download SVG
- export:zip (button): All figures (.zip)
- play (button): ▶▶ Run
- reset-experiment (button): ↺ Reset experiment
- rewind (button): ⏮ Start
- scrub (range): Position
- select:edge (g): Weight from Input unit # to Output (linear) unit #: #
- select:unit (g): Input, unit #: not yet computed
- select:unit (g): Input, unit #: value #
- select:unit (g): Output (linear), unit #: not yet computed
- select:unit (g): Output (linear), unit #: value #, gradient #, bias #
- selfcheck:lr1 (radio): a little too large
- selfcheck:lr1 (radio): exactly right
- selfcheck:lr1 (radio): too small
- selfcheck:lr2 (radio): NaN
- selfcheck:lr2 (radio): oscillating
- selfcheck:lr2 (radio): still decreasing slowly, far from its minimum
- speed (range): Speed
- step (button): Step ▶
- step-size:batch (button): Batch
- step-size:epoch (button): Epoch
- step-size:layer (button): Layer
- step-size:operation (button): Operation
- step-size:phase (button): Phase
- step-size:sample (button): Example
- structure:expand (button): L#dense · linear→ [#]# params▸
- to-breakpoint (button): ⇥ To breakpoint
- tryit:0 (text): Learning rate η
- tryit:1 (text): Compared learning rate #
- tryit:2 (text): Compared learning rate #
- tryit:3 (text): Compared learning rate #
- tryit:4 (text): Compared learning rate #
- walkthrough:hide (button): Hide
- walkthrough:next (button): Next ▶
- walkthrough:prev (button): ◀ Previous

**Disclosure sections** (2)

- Export figures
- Table view of the epoch data

**Information shown (headings, captions, legends)** (22)

- figcaption: Gradient magnitude per layer, by epoch
- figcaption: L# batch gradient
- figcaption: L# weights
- figcaption: Loss per epoch
- figcaption: Loss surface L(w, b) and the path of gradient descent
- figcaption: The same model trained with # learning rates
- h2: Check your understanding
- h2: Export figures
- h2: Inspector
- h2: Network structure
- h2: Step through training
- h2: Training so far
- h2: Try it
- h2: Walkthrough · # of #
- h2: What just happened
- h3: Distributions at this point
- h3: What changed since the previous step
- legend: #. The loss falls every epoch, but more slowly than with a smaller learning rate, and the path of the parameters swings 
- legend: #. With a learning rate that is far too small, after many epochs the loss is…
- legend: Pause automatically when…
- legend: Step size
- p: positive weight (solid) negative weight (dashed) · line thickness = /weight/ · number in each neuron = its current value

## lr-pathology (novice)

**Panels** (10)

- Check your understanding
- Execution controls
- Experiment panels
- Explanation
- Guided walkthrough
- Inspector
- Network structure view
- Neural execution view
- Training state view
- Try it

**Controls (data-control id, element, accessible name)** (50)

- back (button): ◀ Back
- breakpoint:deadRelu (checkbox): a ReLU unit is inactive for a whole epoch
- breakpoint:exploding (checkbox): a gradient explodes (any /g/ > #)
- breakpoint:gradInit (checkbox): back-propagation starts (each example)
- breakpoint:lossIncrease (checkbox): the epoch loss rises by more than # %
- breakpoint:lossPlateau (checkbox): the epoch loss stops decreasing
- breakpoint:nonFinite (checkbox): NaN or infinity appears
- breakpoint:vanishing (checkbox): a layer’s gradient vanishes (all /g/ < #⁻⁴)
- chart:heatmap (rect): Epoch # weights into the output layer: gradient size #
- chart:pick (svg): Loss per epoch. training (running mean): latest #; evaluation (end of epoch): latest #.
- chart:pick (svg): Loss per epoch. training (running mean): no data yet; evaluation (end of epoch): no data yet.
- chart:table (summary): Table view of the epoch data
- explain:detailed (button): Detailed
- explain:maths (button): Show the maths
- explain:novice (button): Simple
- explain:numbers (button): Show this step's numbers
- more-controls (summary): More controls: pause automatically
- play (button): ▶▶ Run
- reset-experiment (button): ↺ Reset experiment
- rewind (button): ⏮ Start
- scrub (range): Position
- select:edge (g): Weight from Input unit # to Output (linear) unit #: #
- select:unit (g): Input, unit #: not yet computed
- select:unit (g): Input, unit #: value #
- select:unit (g): Output (linear), unit #: not yet computed
- select:unit (g): Output (linear), unit #: value #, gradient #, bias #
- selfcheck:lr1 (radio): a little too large
- selfcheck:lr1 (radio): exactly right
- selfcheck:lr1 (radio): too small
- selfcheck:lr2 (radio): NaN
- selfcheck:lr2 (radio): oscillating
- selfcheck:lr2 (radio): still decreasing slowly, far from its minimum
- speed (range): Speed
- step (button): Step ▶
- step-size:batch (button): one batch
- step-size:epoch (button): one full pass
- step-size:layer (button): one layer
- step-size:operation (button): one calculation
- step-size:phase (button): forward / backward / update
- step-size:sample (button): one example
- structure:expand (button): The output layerdense · linear→ [#]# params▸
- to-breakpoint (button): ⇥ To breakpoint
- tryit:0 (text): Learning rate η
- tryit:1 (text): Compared learning rate #
- tryit:2 (text): Compared learning rate #
- tryit:3 (text): Compared learning rate #
- tryit:4 (text): Compared learning rate #
- walkthrough:hide (button): Hide
- walkthrough:next (button): Next ▶
- walkthrough:prev (button): ◀ Previous

**Disclosure sections** (2)

- More controls: pause automatically
- Table view of the epoch data

**Information shown (headings, captions, legends)** (21)

- figcaption: Gradient magnitude per layer, by epoch
- figcaption: L# batch gradient
- figcaption: L# weights
- figcaption: Loss per epoch
- figcaption: Loss surface L(w, b) and the path of gradient descent
- figcaption: The same model trained with # learning rates
- h2: Check your understanding
- h2: Inspector
- h2: Network structure
- h2: Step through training
- h2: Training so far
- h2: Try it
- h2: Walkthrough · # of #
- h2: What just happened
- h3: Distributions at this point
- h3: What changed since the previous step
- legend: #. The loss falls every epoch, but more slowly than with a smaller learning rate, and the path of the parameters swings 
- legend: #. With a learning rate that is far too small, after many epochs the loss is…
- legend: Pause automatically when…
- legend: Step size
- p: positive weight (solid) negative weight (dashed) · line thickness = /weight/ · number in each neuron = its current value

## single-neuron (expert)

**Panels** (12)

- Check your understanding
- Compare two points
- Execution controls
- Explanation
- Guided walkthrough
- Inspector
- Network structure view
- Neural execution view
- Starting weights and biases
- The trace
- Training state view
- Try it

**Controls (data-control id, element, accessible name)** (113)

- back (button): ◀ Back
- breakpoint:deadRelu (checkbox): a ReLU unit is inactive for a whole epoch
- breakpoint:exploding (checkbox): a gradient explodes (any /g/ > #)
- breakpoint:gradInit (checkbox): back-propagation starts (each example)
- breakpoint:lossIncrease (checkbox): the epoch loss rises by more than # %
- breakpoint:lossPlateau (checkbox): the epoch loss stops decreasing
- breakpoint:nonFinite (checkbox): NaN or infinity appears
- breakpoint:vanishing (checkbox): a layer’s gradient vanishes (all /g/ < #⁻⁴)
- chart:heatmap (rect): Epoch # weights into the output layer: gradient size #
- chart:pick (svg): Accuracy per epoch. training set: latest #.
- chart:pick (svg): Accuracy per epoch. training set: no data yet.
- chart:pick (svg): Loss per epoch. training (running mean): latest #; evaluation (end of epoch): latest #.
- chart:pick (svg): Loss per epoch. training (running mean): no data yet; evaluation (end of epoch): no data yet.
- chart:table (summary): Table view of the epoch data
- compare:pin (button): Pin this point as A
- explain:detailed (button): Detailed
- explain:maths (button): Show the maths
- explain:novice (button): Simple
- explain:numbers (button): Show this step's numbers
- export:caption (textarea): Caption
- export:csv (button): Forward pass — and: download CSV data
- export:csv (button): Network architecture: download CSV data
- export:csv (button): The training run as a trace of instructions: download CSV data
- export:mode (button): Colour
- export:mode (button): Greyscale
- export:mode (button): High contrast
- export:open (summary): Export figures
- export:pdf (button): Forward pass — and: save as PDF via the print dialog
- export:pdf (button): Network architecture: save as PDF via the print dialog
- export:pdf (button): The training run as a trace of instructions: save as PDF via the print dialog
- export:refresh (button): Refresh at current position
- export:svg (button): Forward pass — and: download SVG
- export:svg (button): Network architecture: download SVG
- export:svg (button): The training run as a trace of instructions: download SVG
- export:zip (button): All figures (.zip)
- param:L1.b (button): Biases of the output layerL#.b[#]▸
- param:L1.W (button): Weights into the output layerL#.W[#×#]▸
- params (section): Starting weights and biases
- play (button): ▶▶ Run
- reset-experiment (button): ↺ Reset experiment
- rewind (button): ⏮ Start
- scrub (range): Position
- select:edge (g): Weight from Input unit # to Output (sigmoid) unit #: #
- select:unit (g): Input, unit #: not yet computed
- select:unit (g): Input, unit #: value #
- select:unit (g): Output (sigmoid), unit #: not yet computed
- select:unit (g): Output (sigmoid), unit #: value #, gradient #, bias #
- selfcheck:sn1 (radio): #
- selfcheck:sn2 (radio): decreases
- selfcheck:sn2 (radio): increases
- selfcheck:sn2 (radio): is unchanged unless an input is non-zero
- selfcheck:sn3 (radio): has become positive, close to w₁
- selfcheck:sn3 (radio): is still #: only the bias changes
- selfcheck:sn3 (radio): is still negative
- speed (range): Speed
- step (button): Step ▶
- step-size:batch (button): Batch
- step-size:epoch (button): Epoch
- step-size:layer (button): Layer
- step-size:operation (button): Operation
- step-size:phase (button): Phase
- step-size:sample (button): Example
- structure:expand (button): L#dense · sigmoid→ [#]# params▸
- to-breakpoint (button): ⇥ To breakpoint
- trace:epoch (select): Epoch any#
- trace:find (button): Find
- trace:kind (select): Kind anyINIT_PARAMEPOCH_BEGINBATCH_BEGINLOAD_INPUTMATMULADD_BIASACTIVATEFORWARD_LAYER_ENDCOMPUTE_LOSSGRAD_INITGRAD_ACTIV
- trace:layer (select): Layer anyL# (the output layer)
- trace:phase (select): Phase anyinitforwardlossbackwardupdateevalcontrol
- trace:row (button): ##Add the bias of each unit (or channel).ADD_BIASL# · forward · epoch #
- trace:row (button): ##Add the step to the parameter.APPLY_UPDATEL# · update · epoch #
- trace:row (button): ##Apply the activation function element-wise (softmax: per row).ACTIVATEL# · forward · epoch #
- trace:row (button): ##Average the per-example losses over the mini-batch.LOSS_REDUCE— · loss · epoch #
- trace:row (button): ##Average this parameter's per-example gradients over the mini-batch.GRAD_ACCUMULATEL# · update · epoch #
- trace:row (button): ##Compare this example's prediction with its target.COMPUTE_LOSS— · loss · epoch #
- trace:row (button): ##End of the mini-batch; parameters have been updated.BATCH_END— · control · epoch #
- trace:row (button): ##End of the pass; summarise its losses and per-parameter gradient and weight magnitudes.EPOCH_END— · control · epoch #
- trace:row (button): ##Evaluate the current model on the whole training set (no learning).EVAL_BEGIN— · eval · epoch #
- trace:row (button): ##Initialise one parameter tensor from a seeded distribution.INIT_PARAML# · init
- trace:row (button): ##Load one training example and its target.LOAD_INPUT— · forward · epoch #
- trace:row (button): ##Marks the end of one layer in the backward pass.BACKWARD_LAYER_ENDL# · backward · epoch #
- trace:row (button): ##Marks the end of one layer in the forward pass.FORWARD_LAYER_ENDL# · forward · epoch #
- trace:row (button): ##Multiply the incoming activations by the layer weight matrix.MATMULL# · forward · epoch #
- trace:row (button): ##Multiply the upstream gradient by the activation's derivative.GRAD_ACTIVATEL# · backward · epoch #
- trace:row (button): ##Report evaluation loss and accuracy (and the decision boundary for #-D data).EVAL_END— · eval · epoch #
- trace:row (button): ##Scale the (momentum-smoothed) gradient by −η to get the step.COMPUTE_UPDATEL# · update · epoch #
- trace:row (button): ##Start a mini-batch.BATCH_BEGIN— · control · epoch #
- trace:row (button): ##Start a pass over the training set (in a freshly shuffled order).EPOCH_BEGIN— · control · epoch #
- trace:row (button): ##Start back-propagation: the gradient of the loss with respect to the network output.GRAD_INIT— · backward · epoch #
- trace:row (button): ##The bias gradient is the upstream gradient (summed over a channel's positions).GRAD_BIASL# · backward · epoch #
- trace:row (button): ##Weight gradient: outer product of the layer input and the upstream gradient.GRAD_MATMUL_WL# · backward · epoch #
- trace:threshold (input): Gradient magnitude threshold
- trace:when (select): Below or above
- tryit:0 (text): starting weight w₁
- tryit:0:slider (range): starting weight w₁ (drag)
- tryit:1 (text): starting weight w₂
- tryit:1:slider (range): starting weight w₂ (drag)
- tryit:10 (text): input x₂ of example #
- tryit:11 (text): Random seed (the starting point of the random numbers)
- tryit:2 (text): starting bias b
- tryit:2:slider (range): starting bias b (drag)
- tryit:3 (text): input x₁ of example #
- tryit:4 (text): input x₂ of example #
- tryit:5 (text): input x₁ of example #
- tryit:6 (text): input x₂ of example #
- tryit:7 (text): input x₁ of example #
- tryit:8 (text): input x₂ of example #
- tryit:9 (text): input x₁ of example #
- tryit:more (summary): More settings
- walkthrough:hide (button): Hide
- walkthrough:next (button): Next ▶
- walkthrough:prev (button): ◀ Previous
- walkthrough:show-me (button): Load the first example

**Disclosure sections** (3)

- Export figures
- More settings
- Table view of the epoch data

**Information shown (headings, captions, legends)** (27)

- figcaption: Accuracy per epoch
- figcaption: Decision boundary
- figcaption: Decision boundary after epoch #
- figcaption: Gradient magnitude per layer, by epoch
- figcaption: L# batch gradient
- figcaption: L# weights
- figcaption: Loss per epoch
- h2: Check your understanding
- h2: Compare two points of the run
- h2: Export figures
- h2: Inspector
- h2: Network structure
- h2: Starting weights and biases
- h2: Step through training
- h2: The trace: every instruction of this run
- h2: Training so far
- h2: Try it
- h2: Walkthrough · # of #
- h2: What just happened
- h3: Distributions at this point
- h3: What changed since the previous step
- legend: #. If you increase the bias b while keeping the weights fixed, the neuron’s output for every input…
- legend: #. Let it learn from the starting settings (w₁ = #, w₂ = #, b = #). By the end of learning, the second weight w₂…
- legend: #. With x = (# #), w = (#, #) and b = # what is z?
- legend: Pause automatically when…
- legend: Step size
- p: positive weight (solid) negative weight (dashed) · line thickness = /weight/ · number in each neuron = its current value

## single-neuron (novice)

**Panels** (5)

- A worked example
- Check your understanding
- Going deeper
- The neuron
- Your settings

**Controls (data-control id, element, accessible name)** (41)

- back (button): ◀ Back
- deeper:expert (button): ⧉ Open the full workbench (expert mode)
- deeper:maths (button): ▾ Show the maths
- deeper:numbers (button): ▾ Show the numbers
- deeper:second-view (button): ▾ Add the decision line
- deeper:settings (button): ▾ Change the examples
- learn (button): Let it learn
- passed (details): On the way: that part of the calculation is finished; the error for this example was measured (#).That part of the calcu
- predict:option (button): ○ all four: “yes” only for (# #)
- predict:option (button): ○ all go down
- predict:option (button): ○ all go up
- predict:option (button): ○ stay the same
- predict:option (button): ○ three of the four
- predict:option (button): ○ two or fewer
- reset-experiment (button): ↺ Reset experiment
- row:pin (button): show example (# #) in the diagram
- selfcheck:sn1 (radio): #
- selfcheck:sn2 (radio): decreases
- selfcheck:sn2 (radio): increases
- selfcheck:sn2 (radio): is unchanged unless an input is non-zero
- selfcheck:sn3 (radio): has become positive, close to w₁
- selfcheck:sn3 (radio): is still #: only the bias changes
- selfcheck:sn3 (radio): is still negative
- solution (button): Show me settings that work
- step (button): Next: one calculation ▶
- tryit:0 (text): weight w₁
- tryit:0:slider (range): weight w₁ (drag)
- tryit:1 (text): weight w₂
- tryit:1:slider (range): weight w₂ (drag)
- tryit:10 (text): input x₂ of example #
- tryit:11 (text): Random seed (the starting point of the random numbers)
- tryit:2 (text): bias b
- tryit:2:slider (range): bias b (drag)
- tryit:3 (text): input x₁ of example #
- tryit:4 (text): input x₂ of example #
- tryit:5 (text): input x₁ of example #
- tryit:6 (text): input x₂ of example #
- tryit:7 (text): input x₁ of example #
- tryit:8 (text): input x₂ of example #
- tryit:9 (text): input x₁ of example #
- worked:dismiss (button): Got it: let me try

**Disclosure sections** (6)

- going deeper: Add the decision line
- going deeper: Change the examples
- going deeper: Open the full workbench (expert mode)
- going deeper: Show the maths
- going deeper: Show the numbers
- On the way: that part of the calculation is finished; the error for this example was measured (#).

**Information shown (headings, captions, legends)** (14)

- caption: Every value, with your settings
- caption: With your settings: the neuron’s output for each example (point at a row to see it in the diagram)
- figcaption: A solid line is a positive weight and a dashed line a negative one; the thicker the line, the larger the weight.
- figcaption: Example (# #) with your settings. A solid line is a positive weight and a dashed line a negative one; the thicker the li
- h2: Can one neuron learn AND — say “yes” only when both inputs are #? Set its two weights and its bias, then let it learn.
- h2: Check your understanding
- h3: A worked example: the neuron’s answer for x₁ = # x₂ = #
- h3: Going deeper
- h3: Your settings
- legend: #. If you increase the bias b while keeping the weights fixed, the neuron’s output for every input…
- legend: #. Let it learn from the starting settings (w₁ = #, w₂ = #, b = #). By the end of learning, the second weight w₂…
- legend: #. With x = (# #), w = (#, #) and b = # what is z?
- legend: Prediction about learning Once it has learned, on how many of the four examples will the neuron be right?
- legend: Prediction about the bias If you make the bias b larger, the neuron’s four outputs will…

## vanishing-gradients (expert)

**Panels** (10)

- Check your understanding
- Execution controls
- Explanation
- Guided walkthrough
- Inspector
- Network structure view
- Neural execution view
- Starting weights and biases
- Training state view
- Try it

**Controls (data-control id, element, accessible name)** (100)

- arch:activation (select): Activation of hidden layer #relutanhsigmoidlinear
- arch:add (button): + add hidden layer
- arch:apply (button): Apply and restart
- arch:epochs (text): Epochs
- arch:lr (text): Learning rate
- arch:remove (button): Remove hidden layer #
- arch:restore (button): restore defaults
- arch:width (text): Width of hidden layer #
- back (button): ◀ Back
- breakpoint:deadRelu (checkbox): a ReLU unit is inactive for a whole epoch
- breakpoint:exploding (checkbox): a gradient explodes (any /g/ > #)
- breakpoint:gradInit (checkbox): back-propagation starts (each example)
- breakpoint:lossIncrease (checkbox): the epoch loss rises by more than # %
- breakpoint:lossPlateau (checkbox): the epoch loss stops decreasing
- breakpoint:nonFinite (checkbox): NaN or infinity appears
- breakpoint:vanishing (checkbox): a layer’s gradient vanishes (all /g/ < #⁻⁴)
- chart:heatmap (rect): Epoch # weights into hidden layer #: gradient size #
- chart:heatmap (rect): Epoch # weights into the output layer: gradient size #
- chart:pick (svg): Accuracy per epoch. training set: latest #.
- chart:pick (svg): Accuracy per epoch. training set: no data yet.
- chart:pick (svg): Loss per epoch. training (running mean): latest #; evaluation (end of epoch): latest #.
- chart:pick (svg): Loss per epoch. training (running mean): no data yet; evaluation (end of epoch): no data yet.
- chart:table (summary): Table view of the epoch data
- explain:detailed (button): Detailed
- explain:maths (button): Show the maths
- explain:novice (button): Simple
- explain:numbers (button): Show this step's numbers
- export:caption (textarea): Caption
- export:csv (button): Forward pass — circles: download CSV data
- export:csv (button): Network architecture: download CSV data
- export:csv (button): The training run as a trace of instructions: download CSV data
- export:mode (button): Colour
- export:mode (button): Greyscale
- export:mode (button): High contrast
- export:open (summary): Export figures
- export:pdf (button): Forward pass — circles: save as PDF via the print dialog
- export:pdf (button): Network architecture: save as PDF via the print dialog
- export:pdf (button): The training run as a trace of instructions: save as PDF via the print dialog
- export:refresh (button): Refresh at current position
- export:svg (button): Forward pass — circles: download SVG
- export:svg (button): Network architecture: download SVG
- export:svg (button): The training run as a trace of instructions: download SVG
- export:zip (button): All figures (.zip)
- param:L1.b (button): Biases of hidden layer #L#.b[#]▸
- param:L1.W (button): Weights into hidden layer #L#.W[#×#]▸
- param:L2.b (button): Biases of hidden layer #L#.b[#]▸
- param:L2.W (button): Weights into hidden layer #L#.W[#×#]▸
- param:L3.b (button): Biases of hidden layer #L#.b[#]▸
- param:L3.W (button): Weights into hidden layer #L#.W[#×#]▸
- param:L4.b (button): Biases of hidden layer #L#.b[#]▸
- param:L4.W (button): Weights into hidden layer #L#.W[#×#]▸
- param:L5.b (button): Biases of hidden layer #L#.b[#]▸
- param:L5.W (button): Weights into hidden layer #L#.W[#×#]▸
- param:L6.b (button): Biases of hidden layer #L#.b[#]▸
- param:L6.W (button): Weights into hidden layer #L#.W[#×#]▸
- param:L7.b (button): Biases of hidden layer #L#.b[#]▸
- param:L7.W (button): Weights into hidden layer #L#.W[#×#]▸
- param:L8.b (button): Biases of hidden layer #L#.b[#]▸
- param:L8.W (button): Weights into hidden layer #L#.W[#×#]▸
- param:L9.b (button): Biases of the output layerL#.b[#]▸
- param:L9.W (button): Weights into the output layerL#.W[#×#]▸
- params (section): Starting weights and biases
- play (button): ▶▶ Run
- reset-experiment (button): ↺ Reset experiment
- rewind (button): ⏮ Start
- scrub (range): Position
- select:edge (g): Weight from Hidden # (sigmoid) unit # to Hidden # (sigmoid) unit #: #
- select:edge (g): Weight from Hidden # (sigmoid) unit # to Output (sigmoid) unit #: #
- select:edge (g): Weight from Input unit # to Hidden # (sigmoid) unit #: #
- select:unit (g): Hidden # (sigmoid), unit #: not yet computed
- select:unit (g): Hidden # (sigmoid), unit #: value #, gradient #, bias #
- select:unit (g): Input, unit #: not yet computed
- select:unit (g): Input, unit #: value #
- select:unit (g): Output (sigmoid), unit #: not yet computed
- select:unit (g): Output (sigmoid), unit #: value #, gradient #, bias #
- selfcheck:vg1 (radio): Each layer multiplies the gradient by σ′(z) ≤ #
- selfcheck:vg1 (radio): The early layers have fewer weights
- selfcheck:vg1 (radio): The learning rate is smaller for early layers
- selfcheck:vg2 (radio): Adding more sigmoid layers
- selfcheck:vg2 (radio): Training for more epochs
- selfcheck:vg2 (radio): Using ReLU in the hidden layers
- speed (range): Speed
- step (button): Step ▶
- step-size:batch (button): Batch
- step-size:epoch (button): Epoch
- step-size:layer (button): Layer
- step-size:operation (button): Operation
- step-size:phase (button): Phase
- step-size:sample (button): Example
- structure:expand (button): L#dense · sigmoid→ [#]# params▸
- to-breakpoint (button): ⇥ To breakpoint
- tryit:0 (select): Hidden activations
- tryit:1 (text): Hidden layers (depth)
- tryit:2 (text): Starting-weight scale (# = the usual size)
- tryit:3 (text): Random seed (the starting point of the random numbers)
- tryit:more (summary): More settings
- walkthrough:hide (button): Hide
- walkthrough:next (button): Next ▶
- walkthrough:prev (button): ◀ Previous
- walkthrough:show-me (button): Run to the breakpoint

**Disclosure sections** (3)

- Export figures
- More settings
- Table view of the epoch data

**Information shown (headings, captions, legends)** (25)

- figcaption: Accuracy per epoch
- figcaption: Decision boundary
- figcaption: Decision boundary after epoch #
- figcaption: Gradient magnitude per layer, by epoch
- figcaption: L# batch gradient
- figcaption: L# weights
- figcaption: Loss per epoch
- h2: Check your understanding
- h2: Export figures
- h2: Inspector
- h2: Network structure
- h2: Starting weights and biases
- h2: Step through training
- h2: Training so far
- h2: Try it
- h2: Walkthrough · # of #
- h2: What just happened
- h3: Distributions at this point
- h3: What changed since the previous step
- legend: #. Which change most directly reduces vanishing gradients here?
- legend: #. Why do gradients shrink layer by layer in a deep sigmoid network?
- legend: Change the network (restarts training)
- legend: Pause automatically when…
- legend: Step size
- p: positive weight (solid) negative weight (dashed) · line thickness = /weight/ · number in each neuron = its current value

## vanishing-gradients (novice)

**Panels** (10)

- Check your understanding
- Execution controls
- Explanation
- Guided walkthrough
- Inspector
- Network structure view
- Neural execution view
- Starting weights and biases
- Training state view
- Try it

**Controls (data-control id, element, accessible name)** (86)

- arch:activation (select): Activation of hidden layer #relutanhsigmoidlinear
- arch:add (button): + add hidden layer
- arch:apply (button): Apply and restart
- arch:epochs (text): Epochs
- arch:lr (text): Learning rate
- arch:remove (button): Remove hidden layer #
- arch:restore (button): restore defaults
- arch:width (text): Width of hidden layer #
- back (button): ◀ Back
- breakpoint:deadRelu (checkbox): a ReLU unit is inactive for a whole epoch
- breakpoint:exploding (checkbox): a gradient explodes (any /g/ > #)
- breakpoint:gradInit (checkbox): back-propagation starts (each example)
- breakpoint:lossIncrease (checkbox): the epoch loss rises by more than # %
- breakpoint:lossPlateau (checkbox): the epoch loss stops decreasing
- breakpoint:nonFinite (checkbox): NaN or infinity appears
- breakpoint:vanishing (checkbox): a layer’s gradient vanishes (all /g/ < #⁻⁴)
- chart:heatmap (rect): Epoch # weights into hidden layer #: gradient size #
- chart:heatmap (rect): Epoch # weights into the output layer: gradient size #
- chart:pick (svg): Accuracy per epoch. training set: latest #.
- chart:pick (svg): Accuracy per epoch. training set: no data yet.
- chart:pick (svg): Loss per epoch. training (running mean): latest #; evaluation (end of epoch): latest #.
- chart:pick (svg): Loss per epoch. training (running mean): no data yet; evaluation (end of epoch): no data yet.
- chart:table (summary): Table view of the epoch data
- explain:detailed (button): Detailed
- explain:maths (button): Show the maths
- explain:novice (button): Simple
- explain:numbers (button): Show this step's numbers
- more-controls (summary): More controls: pause automatically
- param:L1.b (button): Biases of hidden layer #[#]▸
- param:L1.W (button): Weights into hidden layer #[#×#]▸
- param:L2.b (button): Biases of hidden layer #[#]▸
- param:L2.W (button): Weights into hidden layer #[#×#]▸
- param:L3.b (button): Biases of hidden layer #[#]▸
- param:L3.W (button): Weights into hidden layer #[#×#]▸
- param:L4.b (button): Biases of hidden layer #[#]▸
- param:L4.W (button): Weights into hidden layer #[#×#]▸
- param:L5.b (button): Biases of hidden layer #[#]▸
- param:L5.W (button): Weights into hidden layer #[#×#]▸
- param:L6.b (button): Biases of hidden layer #[#]▸
- param:L6.W (button): Weights into hidden layer #[#×#]▸
- param:L7.b (button): Biases of hidden layer #[#]▸
- param:L7.W (button): Weights into hidden layer #[#×#]▸
- param:L8.b (button): Biases of hidden layer #[#]▸
- param:L8.W (button): Weights into hidden layer #[#×#]▸
- param:L9.b (button): Biases of the output layer[#]▸
- param:L9.W (button): Weights into the output layer[#×#]▸
- params (section): Starting weights and biases
- play (button): ▶▶ Run
- reset-experiment (button): ↺ Reset experiment
- rewind (button): ⏮ Start
- scrub (range): Position
- select:edge (g): Weight from Hidden # (sigmoid) unit # to Hidden # (sigmoid) unit #: #
- select:edge (g): Weight from Hidden # (sigmoid) unit # to Output (sigmoid) unit #: #
- select:edge (g): Weight from Input unit # to Hidden # (sigmoid) unit #: #
- select:unit (g): Hidden # (sigmoid), unit #: not yet computed
- select:unit (g): Hidden # (sigmoid), unit #: value #, gradient #, bias #
- select:unit (g): Input, unit #: not yet computed
- select:unit (g): Input, unit #: value #
- select:unit (g): Output (sigmoid), unit #: not yet computed
- select:unit (g): Output (sigmoid), unit #: value #, gradient #, bias #
- selfcheck:vg1 (radio): Each layer multiplies the gradient by σ′(z) ≤ #
- selfcheck:vg1 (radio): The early layers have fewer weights
- selfcheck:vg1 (radio): The learning rate is smaller for early layers
- selfcheck:vg2 (radio): Adding more sigmoid layers
- selfcheck:vg2 (radio): Training for more epochs
- selfcheck:vg2 (radio): Using ReLU in the hidden layers
- speed (range): Speed
- step (button): Step ▶
- step-size:batch (button): one batch
- step-size:epoch (button): one full pass
- step-size:layer (button): one layer
- step-size:operation (button): one calculation
- step-size:phase (button): forward / backward / update
- step-size:sample (button): one example
- structure:expand (button): Hidden layer #dense · sigmoid→ [#]# params▸
- structure:expand (button): The output layerdense · sigmoid→ [#]# params▸
- to-breakpoint (button): ⇥ To breakpoint
- tryit:0 (select): Hidden activations
- tryit:1 (text): Hidden layers (depth)
- tryit:2 (text): Starting-weight scale (# = the usual size)
- tryit:3 (text): Random seed (the starting point of the random numbers)
- tryit:more (summary): More settings
- walkthrough:hide (button): Hide
- walkthrough:next (button): Next ▶
- walkthrough:prev (button): ◀ Previous
- walkthrough:show-me (button): Run to the breakpoint

**Disclosure sections** (3)

- More controls: pause automatically
- More settings
- Table view of the epoch data

**Information shown (headings, captions, legends)** (24)

- figcaption: Accuracy per epoch
- figcaption: Decision boundary
- figcaption: Decision boundary after epoch #
- figcaption: Gradient magnitude per layer, by epoch
- figcaption: L# batch gradient
- figcaption: L# weights
- figcaption: Loss per epoch
- h2: Check your understanding
- h2: Inspector
- h2: Network structure
- h2: Starting weights and biases
- h2: Step through training
- h2: Training so far
- h2: Try it
- h2: Walkthrough · # of #
- h2: What just happened
- h3: Distributions at this point
- h3: What changed since the previous step
- legend: #. Which change most directly reduces vanishing gradients here?
- legend: #. Why do gradients shrink layer by layer in a deep sigmoid network?
- legend: Change the network (restarts training)
- legend: Pause automatically when…
- legend: Step size
- p: positive weight (solid) negative weight (dashed) · line thickness = /weight/ · number in each neuron = its current value

## xor-mlp (expert)

**Panels** (10)

- Check your understanding
- Execution controls
- Explanation
- Guided walkthrough
- Inspector
- Network structure view
- Neural execution view
- Starting weights and biases
- Training state view
- Try it

**Controls (data-control id, element, accessible name)** (86)

- arch:activation (select): Activation of hidden layer #relutanhsigmoidlinear
- arch:add (button): + add hidden layer
- arch:apply (button): Apply and restart
- arch:epochs (text): Epochs
- arch:lr (text): Learning rate
- arch:remove (button): Remove hidden layer #
- arch:restore (button): restore defaults
- arch:width (text): Width of hidden layer #
- back (button): ◀ Back
- breakpoint:deadRelu (checkbox): a ReLU unit is inactive for a whole epoch
- breakpoint:exploding (checkbox): a gradient explodes (any /g/ > #)
- breakpoint:gradInit (checkbox): back-propagation starts (each example)
- breakpoint:lossIncrease (checkbox): the epoch loss rises by more than # %
- breakpoint:lossPlateau (checkbox): the epoch loss stops decreasing
- breakpoint:nonFinite (checkbox): NaN or infinity appears
- breakpoint:vanishing (checkbox): a layer’s gradient vanishes (all /g/ < #⁻⁴)
- chart:heatmap (rect): Epoch # weights into hidden layer #: gradient size #
- chart:heatmap (rect): Epoch # weights into the output layer: gradient size #
- chart:pick (svg): Accuracy per epoch. training set: latest #.
- chart:pick (svg): Accuracy per epoch. training set: no data yet.
- chart:pick (svg): Loss per epoch. training (running mean): latest #; evaluation (end of epoch): latest #.
- chart:pick (svg): Loss per epoch. training (running mean): no data yet; evaluation (end of epoch): no data yet.
- chart:table (summary): Table view of the epoch data
- explain:detailed (button): Detailed
- explain:maths (button): Show the maths
- explain:novice (button): Simple
- explain:numbers (button): Show this step's numbers
- export:caption (textarea): Caption
- export:csv (button): Forward pass — xor: download CSV data
- export:csv (button): Network architecture: download CSV data
- export:csv (button): The training run as a trace of instructions: download CSV data
- export:mode (button): Colour
- export:mode (button): Greyscale
- export:mode (button): High contrast
- export:open (summary): Export figures
- export:pdf (button): Forward pass — xor: save as PDF via the print dialog
- export:pdf (button): Network architecture: save as PDF via the print dialog
- export:pdf (button): The training run as a trace of instructions: save as PDF via the print dialog
- export:refresh (button): Refresh at current position
- export:svg (button): Forward pass — xor: download SVG
- export:svg (button): Network architecture: download SVG
- export:svg (button): The training run as a trace of instructions: download SVG
- export:zip (button): All figures (.zip)
- param:L1.b (button): Biases of hidden layer #L#.b[#]▸
- param:L1.W (button): Weights into hidden layer #L#.W[#×#]▸
- param:L2.b (button): Biases of the output layerL#.b[#]▸
- param:L2.W (button): Weights into the output layerL#.W[#×#]▸
- params (section): Starting weights and biases
- play (button): ▶▶ Run
- reset-experiment (button): ↺ Reset experiment
- rewind (button): ⏮ Start
- scrub (range): Position
- select:edge (g): Weight from Hidden # (tanh) unit # to Output (sigmoid) unit #: #
- select:edge (g): Weight from Input unit # to Hidden # (tanh) unit #: #
- select:unit (g): Hidden # (tanh), unit #: not yet computed
- select:unit (g): Hidden # (tanh), unit #: value #, gradient #, bias #
- select:unit (g): Input, unit #: not yet computed
- select:unit (g): Input, unit #: value #
- select:unit (g): Output (sigmoid), unit #: not yet computed
- select:unit (g): Output (sigmoid), unit #: value #, gradient #, bias #
- selfcheck:xo1 (radio): Its decision boundary is a straight line, and XOR’s classes are not linearly separable
- selfcheck:xo1 (radio): Its learning rate is too small
- selfcheck:xo1 (radio): XOR has too few examples
- selfcheck:xo2 (radio): learn XOR faster
- selfcheck:xo2 (radio): need more epochs but succeed
- selfcheck:xo2 (radio): still fail on XOR
- speed (range): Speed
- step (button): Step ▶
- step-size:batch (button): Batch
- step-size:epoch (button): Epoch
- step-size:layer (button): Layer
- step-size:operation (button): Operation
- step-size:phase (button): Phase
- step-size:sample (button): Example
- structure:expand (button): L#dense · sigmoid→ [#]# params▸
- structure:expand (button): L#dense · tanh→ [#]# params▸
- to-breakpoint (button): ⇥ To breakpoint
- tryit:0 (text): Units in hidden layer #
- tryit:1 (text): Learning rate η
- tryit:2 (select): Activation of layer #
- tryit:3 (text): Epochs (passes over the data)
- tryit:4 (text): Random seed (the starting point of the random numbers)
- tryit:more (summary): More settings
- walkthrough:hide (button): Hide
- walkthrough:next (button): Next ▶
- walkthrough:prev (button): ◀ Previous

**Disclosure sections** (3)

- Export figures
- More settings
- Table view of the epoch data

**Information shown (headings, captions, legends)** (25)

- figcaption: Accuracy per epoch
- figcaption: Decision boundary
- figcaption: Decision boundary after epoch #
- figcaption: Gradient magnitude per layer, by epoch
- figcaption: L# batch gradient
- figcaption: L# weights
- figcaption: Loss per epoch
- h2: Check your understanding
- h2: Export figures
- h2: Inspector
- h2: Network structure
- h2: Starting weights and biases
- h2: Step through training
- h2: Training so far
- h2: Try it
- h2: Walkthrough · # of #
- h2: What just happened
- h3: Distributions at this point
- h3: What changed since the previous step
- legend: #. If the hidden layer used the linear (identity) activation, the network would…
- legend: #. Why can a single neuron not learn XOR?
- legend: Change the network (restarts training)
- legend: Pause automatically when…
- legend: Step size
- p: positive weight (solid) negative weight (dashed) · line thickness = /weight/ · number in each neuron = its current value

## xor-mlp (novice)

**Panels** (10)

- Check your understanding
- Execution controls
- Explanation
- Guided walkthrough
- Inspector
- Network structure view
- Neural execution view
- Starting weights and biases
- Training state view
- Try it

**Controls (data-control id, element, accessible name)** (71)

- arch:activation (select): Activation of hidden layer #relutanhsigmoidlinear
- arch:add (button): + add hidden layer
- arch:apply (button): Apply and restart
- arch:epochs (text): Epochs
- arch:lr (text): Learning rate
- arch:remove (button): Remove hidden layer #
- arch:restore (button): restore defaults
- arch:width (text): Width of hidden layer #
- back (button): ◀ Back
- breakpoint:deadRelu (checkbox): a ReLU unit is inactive for a whole epoch
- breakpoint:exploding (checkbox): a gradient explodes (any /g/ > #)
- breakpoint:gradInit (checkbox): back-propagation starts (each example)
- breakpoint:lossIncrease (checkbox): the epoch loss rises by more than # %
- breakpoint:lossPlateau (checkbox): the epoch loss stops decreasing
- breakpoint:nonFinite (checkbox): NaN or infinity appears
- breakpoint:vanishing (checkbox): a layer’s gradient vanishes (all /g/ < #⁻⁴)
- chart:heatmap (rect): Epoch # weights into hidden layer #: gradient size #
- chart:heatmap (rect): Epoch # weights into the output layer: gradient size #
- chart:pick (svg): Accuracy per epoch. training set: latest #.
- chart:pick (svg): Accuracy per epoch. training set: no data yet.
- chart:pick (svg): Loss per epoch. training (running mean): latest #; evaluation (end of epoch): latest #.
- chart:pick (svg): Loss per epoch. training (running mean): no data yet; evaluation (end of epoch): no data yet.
- chart:table (summary): Table view of the epoch data
- explain:detailed (button): Detailed
- explain:maths (button): Show the maths
- explain:novice (button): Simple
- explain:numbers (button): Show this step's numbers
- more-controls (summary): More controls: pause automatically
- param:L1.b (button): Biases of hidden layer #[#]▸
- param:L1.W (button): Weights into hidden layer #[#×#]▸
- param:L2.b (button): Biases of the output layer[#]▸
- param:L2.W (button): Weights into the output layer[#×#]▸
- params (section): Starting weights and biases
- play (button): ▶▶ Run
- reset-experiment (button): ↺ Reset experiment
- rewind (button): ⏮ Start
- scrub (range): Position
- select:edge (g): Weight from Hidden # (tanh) unit # to Output (sigmoid) unit #: #
- select:edge (g): Weight from Input unit # to Hidden # (tanh) unit #: #
- select:unit (g): Hidden # (tanh), unit #: not yet computed
- select:unit (g): Hidden # (tanh), unit #: value #, gradient #, bias #
- select:unit (g): Input, unit #: not yet computed
- select:unit (g): Input, unit #: value #
- select:unit (g): Output (sigmoid), unit #: not yet computed
- select:unit (g): Output (sigmoid), unit #: value #, gradient #, bias #
- selfcheck:xo1 (radio): Its decision boundary is a straight line, and XOR’s classes are not linearly separable
- selfcheck:xo1 (radio): Its learning rate is too small
- selfcheck:xo1 (radio): XOR has too few examples
- selfcheck:xo2 (radio): learn XOR faster
- selfcheck:xo2 (radio): need more epochs but succeed
- selfcheck:xo2 (radio): still fail on XOR
- speed (range): Speed
- step (button): Step ▶
- step-size:batch (button): one batch
- step-size:epoch (button): one full pass
- step-size:layer (button): one layer
- step-size:operation (button): one calculation
- step-size:phase (button): forward / backward / update
- step-size:sample (button): one example
- structure:expand (button): Hidden layer #dense · tanh→ [#]# params▸
- structure:expand (button): The output layerdense · sigmoid→ [#]# params▸
- to-breakpoint (button): ⇥ To breakpoint
- tryit:0 (text): Units in hidden layer #
- tryit:1 (text): Learning rate η
- tryit:2 (select): Activation of layer #
- tryit:3 (text): Epochs (passes over the data)
- tryit:4 (text): Random seed (the starting point of the random numbers)
- tryit:more (summary): More settings
- walkthrough:hide (button): Hide
- walkthrough:next (button): Next ▶
- walkthrough:prev (button): ◀ Previous

**Disclosure sections** (3)

- More controls: pause automatically
- More settings
- Table view of the epoch data

**Information shown (headings, captions, legends)** (24)

- figcaption: Accuracy per epoch
- figcaption: Decision boundary
- figcaption: Decision boundary after epoch #
- figcaption: Gradient magnitude per layer, by epoch
- figcaption: L# batch gradient
- figcaption: L# weights
- figcaption: Loss per epoch
- h2: Check your understanding
- h2: Inspector
- h2: Network structure
- h2: Starting weights and biases
- h2: Step through training
- h2: Training so far
- h2: Try it
- h2: Walkthrough · # of #
- h2: What just happened
- h3: Distributions at this point
- h3: What changed since the previous step
- legend: #. If the hidden layer used the linear (identity) activation, the network would…
- legend: #. Why can a single neuron not learn XOR?
- legend: Change the network (restarts training)
- legend: Pause automatically when…
- legend: Step size
- p: positive weight (solid) negative weight (dashed) · line thickness = /weight/ · number in each neuron = its current value
