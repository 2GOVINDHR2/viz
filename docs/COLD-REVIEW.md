# Cold Review of the Guided Path (Fix Round 2b)

## How the review was run

**Reviewer.** An agent that had not seen the implementation. Its inputs were limited to:
- `docs/NOVICE-DESIGN.md`;
- 46 full-page screenshots of the Guided path, covering all ten experiments at 4–6 positions each;
- an index giving the number of presses of *Next* before each shot.

It was told to read nothing else and not to run the app.

**Screenshots.** They were taken by `scripts/cold-review-shots.ts`:
- Each experiment was opened fresh, with every experiment unlocked.
- *Next* was pressed 0, 1, 4 and 12 times; experiment 6 got 0, 1, 3, 6, 9 and 14 presses, to reach the middle of the backward pass.
- Whenever a prediction was asked, its first option was clicked, as a learner would have to.

**Which screenshots are committed.** The reviewer saw the screens as they were *before* the fixes in §2. The images committed in `docs/screenshots/cold-review/` were regenerated *after* those fixes, with the same script, so that the folder shows the current state. Running the script on the commit before this round's fixes reproduces what the reviewer saw.

**What this is not.** It does not replace human review. It removes the obvious problems before the team spends their time.

**Point ids.** `E<exp>-S<shot>-<category><n>`:

| Letter | Meaning |
|---|---|
| i | what the learner can infer |
| n | what they cannot infer |
| t | a term met before it is taught |
| u | something on screen they cannot account for |
| d | a departure from NOVICE-DESIGN.md |

`S*` marks a point about the whole experiment; `X-` marks one that recurs across experiments.

---

## 1. The review (verbatim)

### Experiment 1: A single neuron (purpose-built)

**S0: as opened**
- **E1-S0-i1** The heading is a question I can follow: "Can one neuron learn AND — say 'yes' only when both inputs are 1?" There are three sliders, a small diagram, a table of four rows and a "Let it learn" button. I think I set the sliders, make a prediction, then press Next or "Let it learn".
- **E1-S0-i2** The table makes sense: inputs, "output", "right answer", "says". I can see the neuron is currently wrong on (1,0), which says "yes" when the answer is 0, and on (1,1), which says "no" when the answer is 1.
- **E1-S0-n1** I am never told what a "weight" or a "bias" is. They are just slider labels ("weight w₁", "bias b"). I can see they are knobs, but not what they mean.
- **E1-S0-n2** How does "output" turn into "says"? 0.6225 gives "yes" while 0.5 gives "no", so I guess the cut-off is "above 0.5". The screen never states that rule.
- **E1-S0-n3** There are two ways to move forward, "Next: one calculation" and "Let it learn". I can't tell how they relate. Does Next do the learning step by step? Does "Let it learn" skip Next?
- **E1-S0-n4** The prediction says "drag the bias slider and watch the table". Nothing tells me whether that will be checked or revealed, or whether Next has anything to do with it.
- **E1-S0-t1** "σ" in the node label "Σ + b then σ" is not explained. "Σ" is not explained to a non-maths reader either.
- **E1-S0-t2** Check question 1 asks "what is z?" The letter z appears nowhere else on the screen. The diagram says "Σ + b", not z.
- **E1-S0-t3** The "Next question" line says "squashes its sum with the sigmoid". This is the first time I see "sigmoid", and "squashes" has not been explained.
- **E1-S0-t4** The footer says "gradient-checked and verified against TensorFlow.js … recorded in a replayable trace." "Gradient" and "trace" are untaught, and "trace" is tool vocabulary that principle 4 keeps for expert mode.
- **E1-S0-u1** The output node is a box saying "out" and the neuron circle contains text ("Σ + b then σ") rather than a number. The legend promise "the number inside is the current value" is not kept here.
- **E1-S0-u2** Nothing marks a row as wrong. Row (1,0) "yes" against right answer 0 looks the same as a correct row; I had to compare the columns myself.
- **E1-S0-d1** The design calls for "a banner above the view" showing the phase. There is none on this screen.

**S1: after 1 press**
- **E1-S1-i1** "Setting up: the neuron starts with the weights w₁, w₂ you chose (0.5, -0.5)." The two lines get a yellow glow, so I guess they are the weights.
- **E1-S1-n1** The bias isn't mentioned, although I also "chose" it.
- **E1-S1-u1** The button says "one calculation", but this press calculated nothing. It only restated my slider values.

**S2: after 4 presses**
- **E1-S2-i1** "The neuron is about to look at the four examples, one at a time."
- **E1-S2-u1** Four presses of "one calculation" and the diagram has not changed since S1, apart from the glow going away. I don't know what presses 2 and 3 did. It feels like clicking through narration, not calculations.

**S3: after 12 presses**
- **E1-S3-i1** The input circles show 1 and 0, the neuron is ringed, and the output box shows 0.6225, which matches row (1,0) of the table. So one example has passed through.
- **E1-S3-n1** The narration says "Learning: the neuron works out which way to nudge its weights and bias to reduce the error." But the sliders still read 0.50 / −0.50 / 0.00, the table is unchanged and the diagram labels still say w₁ = 0.5. What was nudged, and by how much?
- **E1-S3-n2** Where did examples (0,0) and (0,1) go? After 12 presses I have only seen one example (1,0), and learning has apparently already started.
- **E1-S3-t1** The narration uses "error" without saying how it is measured. That is fine as plain English, but there is no number for it.
- **E1-S3-u1** The intermediate sum (w₁x₁ + w₂x₂ + b = 0.5) is never shown, so I can't check 0.6225 myself. This is exactly the "one calculation" I expected to see.
- **E1-S3-d1** The template's step 5, "the reveal: whether the prediction held, and why", never appears. My prediction ("all go up") is still just a selected button after 12 presses.

**Experiment-wide**
- **E1-S\*-d1** The template says to use "one plain sentence per step saying what just happened". The sentences here are plain, but several describe nothing that happened (S1, S2), and S3 describes a change I can't see.
- **E1-S\*-d2** Principle 4, "explained when first used", is broken for weight, bias, σ, z and sigmoid.

### Experiment 2: Activation functions (reduced workbench)

**S0: as opened**
- **E2-S0-i1** A curve "f(z)" in blue and a dashed "slope f′(z)" are plotted against z. There is a dropdown "sigmoid" and a "starting weight w 4.00" slider. I am meant to press Step or follow the Walkthrough.
- **E2-S0-n1** The goal paragraph is the first thing I read: "see how a saturated unit passes back almost no gradient … a large weight pushes z into the flat, saturated part of sigmoid and tanh". I understand almost none of it.
- **E2-S0-n2** "One input, one neuron, ten points of a step function." What step function? I never see the ten points.
- **E2-S0-n3** There are three different "next" controls: "Step ▶" on the left, "Run to the activation" and "Next ▶" in the Walkthrough, and "Step forward" (mentioned in the text). I don't know which one to use.
- **E2-S0-t1** These terms appear before being taught: "gradient", "passes back", "saturated", "tanh", "ReLU", "f′(z)" (derivative notation), "slope … the factor the gradient is multiplied by", "back-propagation" (check Q2), "epoch", "loss (log)", "accuracy", "batch gradient", "parameters", "dense", "L1.W", "[1×1]", "vanishing gradients" (heatmap caption).
- **E2-S0-t2** These tool terms appear, which principle 4 keeps for expert mode: "Instruction 0 / 4,922", "ACTIVATE instruction", "To breakpoint", "Position", "training run has 4,922 instructions", "trace".
- **E2-S0-u1** The loss chart's y-axis labels are clipped: "00×10⁻⁴", "00×10⁻⁸", ")0×10⁻¹²".
- **E2-S0-u2** "Gradient magnitude per layer" shows a blue gradient bar between "epoch 1" and "epoch 40" before anything has run. It looks like data but is presumably a colour legend.
- **E2-S0-u3** In the network diagram the neurons show "·" and the target box shows "target y / ℓ = ·". I can't tell what "ℓ" is.
- **E2-S0-u4** The banner "A purpose-built beginner screen … this is the full workbench with only the controls this experiment needs" contradicts itself ("full workbench" against "only the controls"). It also shows far more than one control.
- **E2-S0-d1** There is no prediction anywhere on this screen (template step 3).
- **E2-S0-d2** The screen opens as a dashboard of about 10 panels: Step-through, Try it, Network structure, Starting weights, network, activation chart, loss chart, accuracy chart, gradient heatmap, distributions, Walkthrough, What just happened, Inspector, Check. This breaks principles 1 and 2 ("never a dashboard", "one view to start"). The design does say these seven screens are reduced workbenches, but the "only the controls the experiment declares" promise reads as unmet.
- **E2-S0-d3** Check Q2, "During back-propagation its incoming weights receive… zero gradient", tests the content of experiment 6 in experiment 2.

**S1: after 1 press**
- **E2-S1-i1** One weight line appears. "What just happened: The weights of layer 1 start at the values you chose".
- **E2-S1-n1** The weight is 4.00, which is large and positive, but the line is thin and pale. The legend says "line thickness = |weight|", so I expected a thick line.
- **E2-S1-u1** The "L1 weights" histogram appears with axis −4 to 4 and one bar at 4. The "L1 batch gradient" still says "not yet available". I can't read anything useful from a histogram of one value.
- **E2-S1-t1** "Show this step's numbers", "Phase: initialisation, layer 1": "initialisation" is jargon.

**S2: after 4 presses**
- **E2-S2-i1** The network panel is now outlined in yellow and the banner says "CONTROL · Mini-batch begins".
- **E2-S2-t1** "Mini-batch 0 begins with 10 examples. Each gets its own forward and backward pass; the parameters change only once, at the end of the batch." This uses mini-batch, forward/backward pass and parameters; according to the design, batch is taught in 5 and forward/backward in 6.
- **E2-S2-u1** The narration says "Mini-batch 0", while the status line under the network says "Epoch 1 of 40, batch 1". These are off by one and counted in different ways.
- **E2-S2-u2** The panel says "Each step is one calculation", but "Mini-batch begins" is not a calculation.
- **E2-S2-u3** The Walkthrough is still "1 of 4" with its "Run to the activation" button. It does not follow along with my Step presses.

**S3: after 12 presses**
- **E2-S3-i1** The input shows −4, the output 1.13×10⁻⁷, the target 0. On the activation chart the current point sits at z = −16 on the flat part. I take away "the curve is flat out here, so almost nothing gets through".
- **E2-S3-n1** This example is already essentially correct (prediction 1.13×10⁻⁷, target 0, loss 1.27×10⁻¹⁴). Am I supposed to conclude that saturation is bad, or just that there is nothing to fix? The example chosen to show "almost no gradient" is one where no correction is needed. I would draw the wrong lesson.
- **E2-S3-n2** How did 4.00 × (−4) give z = −16 with "b=0"? I can work it out, but the diagram doesn't show z anywhere.
- **E2-S3-t1** These terms appear before being taught: "Chain rule", "the gradient arriving at neuron 1's output (2.25×10⁻⁷)", "∂ℓ/∂z", "∂ℓ/∂a" (the label under the output node, "∂ℓ/∂a=2.53×10⁻¹⁴"?), "error signals", "Example loss", "BACKWARD PASS".
- **E2-S3-u1** The x-axis of the activation chart changed from −8…8 (S0 to S2) to −15…15 without comment.
- **E2-S3-u2** The input neuron is filled orange. The legend only says orange means a negative weight; nothing says neuron fill colour carries meaning.
- **E2-S3-u3** Two different tiny numbers sit by the output node: "1.13×10⁻⁷" inside the circle and "∂ℓ/∂z=2.53×10⁻¹⁴" (?) below it. The "What just happened" text says "the gradient arriving … (2.25×10⁻⁷)". I cannot match the three numbers to each other.
- **E2-S3-u4** Still "0 of 40 epochs complete", and the loss and accuracy charts are empty after 12 steps.
- **E2-S3-d1** The design's question for experiment 2 is "What other squashing functions are there, and why does the choice matter?" The screen never compares sigmoid with tanh or ReLU unless I change the dropdown, and nothing prompts me to.

### Experiment 3: Forward propagation (reduced workbench)

**S0: as opened**
- **E3-S0-i1** A 2→3→1 network diagram. A step-size selector "one calculation / one layer" with "one layer" selected. I think each press should show one layer's outputs.
- **E3-S0-t1** The goal text: "a 2-3-1 network on two Gaussian clusters", "features", "forward pass". "Gaussian clusters" is meaningless to me.
- **E3-S0-t2** "Hidden 1 (tanh)": tanh is not explained here, and experiment 2 only named it.
- **E3-S0-t3** In "Change the network" there is a "Learning rate 0.5" control, which belongs to experiment 5. "Epochs 10" belongs to experiment 7 ("one full pass") or 5. Check Q2's options "the loss" and "the gradients from the last step" come from experiments 4 and 5.
- **E3-S0-t4** "Decision boundary … predicted probability of class 1 … 50 % boundary" uses probability and class without introduction.
- **E3-S0-u1** The step-size selector has an empty third segment after "one layer".
- **E3-S0-u2** "0 of 20 epochs complete" and the charts' x-axis runs to 20, but the "Epochs" dropdown reads 10.
- **E3-S0-u3** There are two controls for the hidden-layer size: "Units in hidden layer 1: 3" under "Try it", and "Hidden 1: 3 / tanh" under "Change the network". Which one is "the" control?
- **E3-S0-u4** "Apply and restart" is greyed out, and nothing says why.
- **E3-S0-d1** There is no prediction.

**S1: after 1 press**
- **E3-S1-i1** The weights appear (blue solid, orange dashed) and "b=0" labels appear over the hidden neurons.
- **E3-S1-t1** "The biases of layer 1 start at zero. That is safe for biases: the random weights already make every neuron different." This answers a question I never had; it's for experts.
- **E3-S1-u1** I chose "one layer", but this press was "initialisation, layer 1" ("2 instructions executed"). A layer step meant setting up, not computing a layer.

**S2: after 4 presses**
- **E3-S2-u1** "Mini-batch 0 begins with 8 examples", while the status says "Epoch 1 of 20, batch 1". This is the same off-by-one as E2-S2-u1, and the 20 epochs contradict the dropdown's 10 again.
- **E3-S2-u2** Four "one layer" presses and no layer has produced any output yet. All the neurons still show "·".
- **E3-S2-t1** "mini-batch", "forward and backward pass" and "parameters" again appear before they are taught.

**S3: after 12 presses**
- **E3-S3-i1** Inputs −2.209 and −0.6358 are loaded (orange circles). "Training example #18 enters the network."
- **E3-S3-n1** The status line says "example 2 in the batch". What happened to example 1? I never saw a layer-by-layer forward pass for it, even though this experiment's question is exactly "How does an input travel through layers?"
- **E3-S3-n2** After 12 "one layer" steps I have still not seen a single hidden-layer value. The hidden neurons show "·".
- **E3-S3-t1** "Its features become the input layer's activations; its target y is held aside until the loss compares it with the prediction." This uses activations, loss and target, and "prediction" as the network's output, which clashes with "YOUR PREDICTION" meaning my guess on screens 1 and 6.
- **E3-S3-u1** The Walkthrough still shows "1 of 4 … Load the first example", although an example (the second one, apparently) is already loaded.
- **E3-S3-d1** The design says "one layer" is first offered in experiment 3, so I expected each press to move one layer forward. What I see is setup and control steps, then a whole example skipped. The promised step size doesn't behave as named.

### Experiment 4: Loss functions (reduced workbench)

**S0: as opened**
- **E4-S0-i1** A chart "Two losses for the same prediction (target y = 1)": squared error in blue, cross-entropy dashed, both falling to 0 at ŷ = 1. A "Loss function: cross-entropy" dropdown. I take away "the further the prediction is from 1, the larger the loss, and cross-entropy punishes more".
- **E4-S0-t1** The formula "−[y log ŷ + (1−y) log(1−ŷ)]" uses log without saying which base, and the notation ŷ (y-hat) is unexplained.
- **E4-S0-t2** "COMPUTE_LOSS" in the Walkthrough is tool/opcode vocabulary.
- **E4-S0-t3** "Interpret a loss value" assumes I know what a loss is. Experiment 4 should be where it is introduced, but no sentence defines it.
- **E4-S0-u1** The cross-entropy curve is cut off at 4 near ŷ = 0. It really goes to infinity, and the chart doesn't say it is truncated.
- **E4-S0-u2** Again, the step-size selector offers "one layer" for a network that has only one layer.
- **E4-S0-d1** There is no prediction.

**S1: after 1 press**
- **E4-S1-u1** "The biases of layer 1 start at zero. That is safe for biases: the random weights already make every neuron different." There is only one neuron, so "every neuron different" is meaningless here.

**S2: after 4 presses**
- **E4-S2-i1** Example #21 with inputs 0.2899 and 0.9817 and target 1 is loaded.
- **E4-S2-u1** The chart caption says "Step to a forward pass to place the current prediction on both curves", but the banner already reads "FORWARD PASS". No marker is placed.

**S3: after 12 presses**
- **E4-S3-i1** A marker sits on both curves at ŷ = 0.5694: squared error 0.3242, cross-entropy 0.8426. I can read that cross-entropy is larger here. This is the clearest moment in experiments 2 to 4.
- **E4-S3-n1** The chart flipped to "(target y = 0)" and the curves are now mirrored, rising to the right. Nothing points out the flip, so I would think the chart changed for no reason.
- **E4-S3-n2** The marked example is #2 in the batch. The loss for example 1 (target 1) was never shown in these shots, so I missed the case that matches the opening chart.
- **E4-S3-t1** "Back-propagation starts at the loss: 2.322 says how fast the loss changes as the output rises." Also "∂ℓ/∂a=2.322" and "output gradients ∂ℓ/∂a". These are rate of change and partial-derivative notation, belonging to experiments 5 and 6.
- **E4-S3-u1** The text says "Layer 1: output gradients". To me the output is layer 1, so "Layer 1" and "output" are the same thing named twice.
- **E4-S3-u2** "The run trains with cross-entropy", yet the left-hand loss chart is still empty ("0 of 30 epochs").
- **E4-S3-d1** Back-propagation (experiment 6) is narrated in experiment 4, which breaks principle 4.

### Experiment 5: Gradient descent (purpose-built)

**S0: as opened**
- **E5-S0-i1** The question is clear: "How does a model find the best straight line through 50 points? It starts with a bad line and walks downhill…". I see a contour plot with axes "weight w" and "bias b", an × at the minimum, and learning-rate buttons "η = 0.02 / 0.3 / 0.9 / 1.1".
- **E5-S0-n1** **I never see the 50 points or the line.** The whole question is about a line through points, but the only view is an abstract (w, b) contour plot. I can't connect "a bad line" to a dot at (−1.5, 1.5).
- **E5-S0-n2** Why are w and b now the axes of a map? Nothing explains that each point on the map is one possible line.
- **E5-S0-n3** "Loss after 40 passes with η = 0.3, B = 50: 0.00827" is shown before I do anything. It gives away the result I am about to be asked to predict.
- **E5-S0-t1** "η" is used in the button labels, and "the learning rate η" is given as a title, not an explanation.
- **E5-S0-t2** "Loss surface L(w, b)": experiment 4 used "ℓ", and now it is "L". "least-squares fit", "parameters", "update" and "Contours" are also unexplained.
- **E5-S0-t3** In the Check questions: "θ ← θ − η·∂L/∂θ" (θ and ∂ never introduced), "epochs", "batch size", "noisier gradient estimate". "B = 50" is shorthand for batch size, which is only offered "on request".
- **E5-S0-u1** The step selector offers "one example / one batch". With B = 50 = all the points, "one batch" is the same as "one full pass", but I am not told that.
- **E5-S0-d1** The design says batch size is a "second control (on request)", but the batch concept is already exposed by the step selector, "B = 50" and check Q3.

**S1: after 1 press**
- **E5-S1-i1** A dot appears at the start position. "Setting up the run. Now w = −1.5, b = 1.5."
- **E5-S1-u1** The button says "one batch", but this press was setup only.

**S2: after 4 presses**
- **E5-S2-i1** The dot has moved once, along a line, to w = −0.7707, b = 0.01216. "End of a full pass over the 50 points … Loss over all points: 3.69." I can see it walking downhill across the contours. This works well.
- **E5-S2-u1** It took 4 presses of "Next: one batch" to make one move. I can't tell what presses 2 and 3 did, or why "one batch" isn't one move.

**S3: after 12 presses**
- **E5-S3-i1** About 4 dots form a path curving toward the ×. The narration gives a worked step: "For w: gradient −1.214, so w moves by −η × −1.214 = 0.3642, from 0.2653 to 0.6295." I can check 0.3 × 1.214 = 0.3642. This is good.
- **E5-S3-n1** "each parameter moved by −η × its averaged gradient". Averaged over what? I am also told nothing about b's step, only w's.
- **E5-S3-n2** S2 reported "Loss over all points: 3.69" and S3 reports "Loss on this batch: 1.112". Are these the same quantity? With one batch of all 50 points they should be, but the different wording makes me think they are different.
- **E5-S3-t1** "gradient" is used as a number ("gradient −1.214") without ever saying it means "slope of the loss in the w direction". It's a step forward that the sign is linked to "downhill", but the word itself still isn't defined on screen.
- **E5-S3-d1** I saw no prediction, because I never changed the learning rate (the design asks for one only then). The core "how big should each step be?" comparison therefore never happens on the default path unless I go looking for it.
- **E5-S3-d2** There is no phase banner, though the design says "The current phase … is shown by a banner above the view".

### Experiment 6: Back-propagation (purpose-built)

**S0: as opened**
- **E6-S0-i1** The question is clear: "Which of its weights are to blame, and by how much? Follow the error backwards". "You are following the weight from input 1 to hidden neuron 1." There is a prediction (up / down / hardly at all) and a numbered list "The chain rule for the weight … for this example" with four factors and "Multiply them: ·".
- **E6-S0-n1** The prediction asks what "this example" will do to the weight, but no example is shown yet: the inputs and target are "·". I am predicting blind.
- **E6-S0-n2** Which line is "input 1 → hidden neuron 1"? Before initialisation all the lines are equally pale. One is faintly greenish, but nothing labels it.
- **E6-S0-t1** These terms appear before being taught: "∂ℓ/∂z_out", "error signal", "chain rule" (the experiment's subject, but never explained in words), "slope of hidden neuron 1's activation at its z", "weight-gradient step".
- **E6-S0-t2** "w²" reads as "w squared". I guess it means "layer-2 weight", but superscript-for-layer is never explained.
- **E6-S0-t3** "The update moves a weight by −η × its gradient": η is now assumed, which is fair after experiment 5, but "update" as a phase name is new here.
- **E6-S0-u1** The "forward / backward / update" step selector has no "Step size" label, unlike the other screens.
- **E6-S0-d1** The design says "Click a line (a weight) in the network to follow it". The instruction is present ("Click any line"), but the followed line isn't visually distinct enough at this point to see what is being followed.

**S1: after 1 press**
- **E6-S1-i1** "Setting up: every weight and bias gets its starting value." The followed weight is now dark solid blue with a glow. Good.
- **E6-S1-u1** The step was labelled "forward / backward / update", but this press was "setting up".

**S2: after 3 presses**
- **E6-S2-u1** "Between examples." and the banner "CONTROL · Mini-batch begins". Three presses of a "whole phase" button and no phase (forward, backward or update) has happened. "Between examples" before the first example is odd.

**S3: after 6 presses**
- **E6-S3-i1** A BACKWARD PASS banner. All neurons have values, the target is 0, and the output is 0.6282 with ℓ = 0.9894. "∂ℓ/∂a=2.69" is under the output. "The backward pass starts at the loss: how much does the loss change if the answer changes?" This question is a good plain-English gloss.
- **E6-S3-u1** **The four chain-rule factors are still "·" and "Multiply them: ·".** The backward pass has started and factor 1 ("error signal at the output") should exist (the screen shows 2.69 or 0.6282 next to the output), but the list doesn't fill in.
- **E6-S3-u2** "∂ℓ/∂a = 2.69" sits under the output node, while factor 1 is labelled "∂ℓ/∂z_out". I am shown a and z and can't tell which is which, or why the number on screen is not the one in the list.
- **E6-S3-u3** Neuron fills vary from white to dark blue (0.2687 is pale, 0.7843 dark) and the inputs are orange. Fill colour isn't explained in the legend.
- **E6-S3-u4** The forward pass for this example was skipped: the shot jumps from "Between examples" (S2) straight to backward, so I never saw the example go forward.

**S4: after 9 presses**
- **E6-S4-i1** The reveal: "× Not this time. You predicted 'up'; what happened: 'down'. Its gradient for this example is 0.06962, so the update moves it by −η × 0.06962: down." The sign logic is spelled out, which I can follow after experiment 5.
- **E6-S4-u1** **The reveal says "multiplying the factors on the right", but the factors on the right are all still "·" and "Multiply them: ·".** The design's core promise for this screen, "chain-rule factors … appearing one by one … Their product is checked against the gradient the engine computed", is not visible in any shot.
- **E6-S4-u2** The reveal is about the previous example (target 0, inputs −0.9217 and −0.517), but the diagram now shows a different example: "FORWARD PASS · Loss · compare with target", inputs 1.748 and 2.149, target 1, output 0.5265. "this example" in the reveal no longer refers to what is on screen.
- **E6-S4-u3** I never saw the update phase: no "update" banner, and no "dotted overlays show each weight's change" (from the legend) in any of the six shots. All "b=0" labels are unchanged.
- **E6-S4-n1** By how much did the weight move? η isn't shown on this screen, so I can't compute −η × 0.06962.
- **E6-S4-n2** The question in the heading, "which weights are to blame, and by how much?", is answered only for the one weight I follow, and the comparison ("by how much" relative to others) never appears.

**S5: after 14 presses**
- **E6-S5-u1** Another example (inputs −1.79 and −1.034, target 0) is in its backward pass. The factors are still "·", and the old reveal for the first example is still showing beside it.
- **E6-S5-d1** The design's step-size guidance says "Start with whole phases; use smaller steps in the backward pass." With the default coarse step, the moment the factors appear is evidently stepped over, so the default path doesn't deliver the experiment.

### Experiment 7: XOR needs a hidden layer (reduced workbench)

**S0: as opened**
- **E7-S0-i1** The Walkthrough states it plainly: "XOR is 1 when exactly one input is 1. No straight line separates the two classes — a single neuron cannot learn it." I understand the claim.
- **E7-S0-t1** The goal text: "non-linearity", "full-batch gradient descent", "Defaults chosen by a recorded sweep: 20 of 20 seeds solve XOR within 100 epochs; with 2 hidden units only 9 of 20 do." "Seeds" and "recorded sweep" are developer language.
- **E7-S0-t2** Check Q1, "linearly separable", and Q2, "linear (identity) activation".
- **E7-S0-u1** The learning rate appears twice, under "Try it" (η = 1) and under "Change the network" (1), as do the hidden units (4 and 4).
- **E7-S0-u2** The decision-boundary panel, the view that answers this experiment's question, is the 6th panel down in the middle column, below three charts.
- **E7-S0-d1** There is no prediction, though "can a hidden layer learn XOR?" is the ideal place for one.

**S1: after 1 press**
- **E7-S1-u1** "one full pass" is selected, yet this press did "4 instructions … initialisation, layer 2". The narration talks about layer 2's biases, but "What changed" lists L1.W and L1.b ("2 more in the detailed view").

**S2: after 4 presses**
- **E7-S2-i1** A decision-boundary plot appears with four markers and a diagonal line. Loss is about 0.68 and accuracy 75%.
- **E7-S2-u1** "Epoch 2 is over", while the status says "Epoch 3 of 150" and "Completed epochs: 2 → 3". Is it epoch 2 or 3?
- **E7-S2-u2** **The decision boundary is a single straight line**, the exact thing the screen just told me can't solve XOR. Nothing tells me it will bend later. A novice would conclude the hidden layer doesn't help.
- **E7-S2-u3** The decision-boundary plot has no axis labels. I have to guess which corner is (0,0), (0,1) and so on, and which marker is the "ringed current example".
- **E7-S2-u4** Hidden-neuron values such as "−0.9121" sit in dark orange circles with the minus sign at the edge of the circle, so they read at a glance as positive.
- **E7-S2-t1** "∂ℓ/∂z=…" is printed under every neuron, and "Last evaluation: loss 0.6759, accuracy 75%". "Evaluation" is new.

**S3: after 12 presses**
- **E7-S3-i1** Epoch 11 of 150, loss 0.65, accuracy 75%. The boundary is still a straight line.
- **E7-S3-n1** At one pass per press I would need about 100+ presses to see XOR solved. The three-minute target can't be met by stepping. Should I press Run? Nothing says so.
- **E7-S3-u1** The accuracy chart dips sharply to about 50% for an early epoch and back to 75%, with no comment.
- **E7-S3-u2** The "Gradient magnitude per layer" colour scale reads "0.02865 … 0.09675". The colours aren't explained beyond "pale top row under dark bottom row = vanishing gradients", which is experiment D1's topic.
- **E7-S3-d1** The goal says "watch the decision boundary form", but in the shots it never forms (no reveal).

### Experiment 8: A CNN on handwritten digits (reduced workbench)

**S0: as opened**
- **E8-S0-i1** Placeholders for INPUT, KERNELS (L1), FEATURE MAPS, AFTER POOLING and PREDICTION, plus "Load a digit" in the Walkthrough. I expect to see a digit go through the stages.
- **E8-S0-t1** The goal text: "convolution, weight sharing and pooling", "CNN", "MNIST", "held out for testing", "3×3 kernels slide over each image", "max-pooling halves each feature map", "dense softmax layer". Almost every noun is untaught.
- **E8-S0-t2** "FEATURE MAPS (CONVOLUTION OUTPUT U)": what is U? Also "channel 1…4", "conv2d · relu", "[4×26×26]", "flatten [676]".
- **E8-S0-t3** In the Check questions: "stride 1 and no padding", "max-pooling layer sends each gradient", "back-propagation".
- **E8-S0-u1** "Click a feature-map cell to place the window." What window?
- **E8-S0-d1** There is no prediction.

**S1: after 1 press**
- **E8-S1-i1** Four 3×3 grids of signed numbers appear, coloured orange for negative and blue for positive. The colour plus number satisfies "colour is never the only carrier".
- **E8-S1-n1** I don't know what these 9 numbers do to an image.
- **E8-S1-u1** "The biases of layer 1 start at zero. That is safe for biases: the random weights already make every neuron different." This is the same boilerplate as in experiments 3, 4 and 7. There are no "neurons" here as I understand them.

**S2: after 4 presses**
- **E8-S2-u1** "Mini-batch 0 begins with 20 examples" against "Epoch 1 of 3, batch 1": the same off-by-one.
- **E8-S2-u2** The INPUT still says "Load an example to see it." After 4 "one layer" presses I haven't seen a digit.

**S3: after 12 presses**
- **E8-S3-i1** A handwritten "0" (example 216) is shown, with four small blue "after pooling" images and a prediction bar chart (digit 0 at 38.55%, 1 at 29.68%, 2 at 31.77%). "Loss for this example: ℓ = 0.9533." I can see the network is nearly guessing.
- **E8-S3-u1** **The status line dumps all 784 pixel values** ("Input x = [0, 0, 0, …, 0.9922, …]"), about 40 lines of numbers that push the rest of the page far down. This is unusable for me.
- **E8-S3-u2** I never saw the feature maps. The section that was "FEATURE MAPS (CONVOLUTION OUTPUT U)" is now titled "ERROR SIGNAL ∂ℓ/∂z PER CHANNEL" and says "not computed yet". The forward stage that answers "how does a network look at an image?" was stepped past.
- **E8-S3-u3** "Window at (1, 1), kernel 1: u = 0 = 0; z = u + b = 0 (trace: 0)". "u = 0 = 0" looks like a formatting bug, and "trace" is tool vocabulary.
- **E8-S3-u4** "The error signal has passed back through layer 4; layer 3 is next. Watch how its size (1.073) changes from layer to layer." Layer 3 is "flatten" with "no params", so what would I watch?
- **E8-S3-u5** The Walkthrough is still "1 of 6 … Load the first digit", although a digit is loaded.
- **E8-S3-t1** "weight gradients ∂ℓ/∂W, bias gradients ∂ℓ/∂b", "output gradients ∂ℓ/∂a". The notation is getting denser without explanation.

### D1: Vanishing gradients (reduced workbench)

**S0: as opened**
- **D1-S0-i1** A deep network of 8 sigmoid hidden layers. The Walkthrough says "The breakpoint 'a layer's gradient vanishes' is on. Run to it." I am meant to press "Run to the breakpoint".
- **D1-S0-t1** "Diagnose vanishing gradients", "circles dataset", "heatmap … shows layer 1's gradient orders of magnitude below layer 9's", and "breakpoint" (tool vocabulary). In the Check: "σ′(z) ≤ 0.25".
- **D1-S0-u1** **The network diagram is cut off on the right.** Only Input and Hidden 1 to Hidden 4 are visible; Hidden 5 to 8 and the output are clipped out of the panel with no scroll indication.
- **D1-S0-u2** "0 of 20 epochs complete", while the "Epochs" dropdown reads 10. This is the same mismatch as in experiment 3.
- **D1-S0-u3** The left column holds about 30 controls: 8 "Hidden n" rows with remove links, 18 "Starting weights and biases" rows, learning rate and epochs. There is also a "Try it" dropdown "Hidden activations", the experiment's real single control, which is easy to miss.
- **D1-S0-d1** There is no prediction, though "will layer 1 learn?" is the obvious one.

**S1: after 1 press**
- **D1-S1-u1** "The biases of layer 9 start at zero", while "What changed" lists "L1.W was initialised. L1.b was initialised." (18 instructions executed). Layer 9 or layer 1?
- **D1-S1-u2** Eighteen weight histograms appear, which is noise for me.

**S2: after 4 presses**
- **D1-S2-i1** A yellow notice: "Paused: every element of the gradient of L2.W is below 0.0001 (largest 0.00000154) — this layer has almost stopped learning." This is the experiment's key moment, and I get the gist: layer 2's numbers are tiny.
- **D1-S2-n1** "Almost stopped learning" happens in the very first batch, before any learning. How is that a sign of stopping?
- **D1-S2-u1** The ∂ℓ/∂z labels under the neurons overlap each other and are illegible (for example "∂ℓ/∂z=6.58×10⁻⁷" printed over the next label).
- **D1-S2-u2** The batch-gradient histograms show L1 and L2 only. L3 to L9 batch gradients say "not yet available", although the backward pass must already have computed them on its way down to layer 2.
- **D1-S2-u3** "What just happened" talks about layer 2's weight gradients being averaged, while "What changed" says "L1.b changed: … −3.74×10⁻⁹". This is the same mismatch between narration and change list as in D1-S1-u1.
- **D1-S2-u4** "one full pass" is selected but the run stopped mid-batch at the breakpoint. The selected step size doesn't do what it says.
- **D1-S2-t1** "Examples that disagree partly cancel out; agreement makes a strong, reliable step." This is mini-batch averaging, taught nowhere on the path.

**S3: after 12 presses**
- **D1-S3-u1** Instruction 2,741, still "Epoch 1 of 20, batch 2", and "0 of 20 epochs complete". The Gradient-magnitude heatmap that the goal text tells me to read is still empty. The breakpoint stops every press, so I can never get the overview.
- **D1-S3-u2** The "What just happened" text is word-for-word the same as in S2 ("The gradients of the weights of layer 2 from the 16 examples…"), so I can't tell whether anything progressed.
- **D1-S3-d1** The design's question, "Why do deep networks with some activations stop learning?", needs a sigmoid against ReLU comparison. No shot shows ReLU, and nothing prompts the switch.

### D2: Learning-rate pathology (reduced workbench)

**S0: as opened**
- **D2-S0-i1** Four small loss curves: η = 0.02 "too small", 0.3 "good", 0.95 (main run) "too large: overshoots back and forth", 1.1 "divergent". "The same line-fitting problem as experiment 5." I can follow this.
- **D2-S0-u1** **The η = 0.95 curve is a smooth, steady decline**, with no zig-zag or overshoot visible, yet it is captioned "overshoots back and forth". Its final loss (0.01939) is barely worse than "good" (0.008275). Check Q1 asks me to recognise a curve that "zig-zags up and down", which I have not been shown.
- **D2-S0-u2** Experiment 5 offered η = 0.9; here it is 0.95. It is "the same problem" but with different rates, so I can't carry my experiment 5 results over.
- **D2-S0-u3** Experiment 5 said "Loss after 40 passes with η = 0.3 … 0.00827". Here "η = 0.3 … final 0.008275" comes after 30 epochs. Is it the same run? Are passes the same as epochs?
- **D2-S0-t1** The Check option "NaN" is never explained, and "evaluation loss … (log scale)" is new.
- **D2-S0-d1** There is no prediction, though "what happens at η = 1.1?" is the natural one. The answers are printed up front ("final 3.48×10⁵").

**S1: after 1 press**
- **D2-S1-u1** "The biases of layer 1 start at the values you chose instead of random ones". I chose nothing: this screen has no starting-weight controls.
- **D2-S1-u2** The weight line is orange dashed (−1.5) with "b=1.5". These are experiment 5's starting values, which is consistent, but nothing tells me so.

**S2: after 4 presses**
- **D2-S2-i1** Epoch 3. The loss chart shows training and evaluation curves falling from about 9 to 3.
- **D2-S2-u1** "Epoch 2 is over" against "Completed epochs: 2 → 3" and "Epoch 3 of 30": the same epoch-numbering confusion as in experiment 7.
- **D2-S2-u2** "L1.W changed … 1.597 → 1.898". The weight is now positive and large, yet its line is thin and pale blue. It doesn't look like |w| ≈ 1.9.
- **D2-S2-u3** The heatmap colour scale reads "0.317 … 2.431"; in S3 it reads "2.51×10⁻⁵ … 2.431". The scale rescales between shots, so the colours can't be compared over time.

**S3: after 12 presses**
- **D2-S3-i1** Epoch 11, loss about 0.76 and falling smoothly. The weight is creeping (2.041 → 2.048).
- **D2-S3-u1** At the "too large" rate the main run shows no overshoot at all: the weight rises monotonically and the loss falls monotonically. The experiment's central claim about η = 0.95 isn't shown in its own run.
- **D2-S3-u2** The status line shows the same example (x = 0.8097, target 0.632) at the end of every epoch. I'd wonder whether the data ever changes.

### Problems that recur across experiments 2, 3, 4, 7, 8, D1 and D2
- **X-u1** The Walkthrough never advances past "1 of N", and its suggestion becomes stale (E2-S2-u3, E3-S3-u1, E8-S3-u5).
- **X-u2** The loss-chart y-axis tick labels are clipped ("00×10⁻⁴", ")0×10⁻¹²") on every reduced workbench.
- **X-u3** Two ways of counting batches and epochs: "Mini-batch 0" against "batch 1", and "Epoch 2 is over" against "Epoch 3 of …" (E2-S2-u1, E3-S2-u1, E8-S2-u1, E7-S2-u1, D2-S2-u1).
- **X-u4** "Epochs 10" in the dropdown against "0 of 20 epochs" on the chart (E3, D1).
- **X-u5** The boilerplate "The biases of layer N start at zero. That is safe for biases…" appears on screens where it is wrong or irrelevant (E4-S1-u1, D1-S1-u1, D2-S1-u1).
- **X-u6** Line thickness doesn't visibly track |weight| (E2-S1-n1, D2-S2-u2), and neuron fill colour is used without a legend.
- **X-t1** "Prediction" means two different things: my guess (YOUR PREDICTION) and the network's output ("Prediction 0.5694").
- **X-t2** "∂ℓ/∂a", "∂ℓ/∂z", "ℓ", "L", "θ" and "ŷ" are used freely from experiment 2 onward and never introduced in words on any screen I saw.
- **X-d1** The tool vocabulary that principle 4 keeps for expert mode appears everywhere: "Instruction n / N", "breakpoint", "Position", "ACTIVATE", "COMPUTE_LOSS", "trace", "Phase: control".
- **X-d2** In 7 of 10 experiments there is no prediction (template step 3) and no reveal (template step 5).
- **X-d3** Unlocking ("An experiment unlocks when the previous one's self-check has been answered"): all ten tabs look equally available in every shot, with no lock indicator, even though no check had been answered.
- **X-d4** "Every screen has a Reset experiment control." It is present on all of them, which satisfies the design.

### Top problems (ranked by the reviewer)
1. **Experiment 6's central mechanism is never shown.** The chain-rule factors stay "·" and "Multiply them: ·" through 14 presses. The reveal refers to "the factors on the right" while they are blank, and it appears while a different example is on screen. The design's "factors appearing one by one … product checked against the engine" can't be seen. (E6-S3-u1, E6-S4-u1, E6-S4-u2, E6-S5-u1, E6-S5-d1)
2. **Experiment 5 never shows the 50 points or the line.** The question is "best straight line through 50 points", but the only view is an abstract (w, b) contour map with no link back to a line. (E5-S0-n1, E5-S0-n2)
3. **Step buttons don't do what their labels say.** "one calculation", "one layer", "one batch", "forward/backward/update" and "one full pass" are spent on setup, "Mini-batch begins", "Between examples" or breakpoints. In experiment 3, 12 "one layer" presses never show a hidden-layer value and skip a whole example. (E1-S1-u1, E1-S2-u1, E3-S1-u1, E3-S2-u2, E3-S3-n1, E3-S3-d1, E5-S1-u1, E5-S2-u1, E6-S1-u1, E6-S2-u1, E7-S1-u1, D1-S2-u4)
4. **Vocabulary runs ahead of the curriculum.** Gradient, back-propagation, chain rule, mini-batch, forward/backward pass, ∂ℓ/∂a and ∂ℓ/∂z appear from experiment 2 onward. Experiment 2's goal and check, and experiment 4's narration, are really about experiment 6. Experiment 3 exposes learning rate and epochs. (E2-S0-t1, E2-S0-d3, E2-S2-t1, E2-S3-t1, E3-S0-t3, E3-S2-t1, E4-S3-t1, E4-S3-d1, X-t2)
5. **Experiment 1 never explains what a weight, bias, σ or z is.** It asks for z in the check, shows no intermediate sum, and its "Learning:" step changes nothing visible. My prediction is never revealed. (E1-S0-n1, E1-S0-t1, E1-S0-t2, E1-S3-n1, E1-S3-u1, E1-S3-d1)
6. **The reduced workbenches are dashboards.** About 10 panels, about 30 controls in D1, duplicated controls, and tool vocabulary (instruction, breakpoint, trace, ACTIVATE, COMPUTE_LOSS) on the default novice path. This breaks principles 1, 2, 4 and 5. (E2-S0-d2, E2-S0-t2, E3-S0-u3, E7-S0-u1, D1-S0-u3, X-d1)
7. **D2 contradicts itself.** The "too large: overshoots back and forth" run (η = 0.95) is a smooth monotone decline, and its own main run shows no overshoot, while the check asks about zig-zags. (D2-S0-u1, D2-S3-u1)
8. **Experiment 7 only ever shows a straight decision boundary.** That is exactly the failure the experiment says a hidden layer fixes, and about 100 presses would be needed to see it bend. The plot has no axis labels. (E7-S2-u2, E7-S2-u3, E7-S3-n1, E7-S3-d1)
9. **Experiment 8 dumps 784 raw pixel values** into the status line, and the feature maps, the answer to "how does a network look at an image", are stepped past without being shown. (E8-S3-u1, E8-S3-u2, E8-S3-u3)
10. **D1's diagram is clipped to 4 of 8 hidden layers.** Its gradient labels overlap illegibly, the breakpoint stops every press so the promised heatmap stays empty, and the narration and change list disagree about which layer changed. (D1-S0-u1, D1-S2-u1, D1-S2-u3, D1-S3-u1, D1-S3-u2, D1-S1-u1)
11. **Predictions are missing from 7 of 10 experiments.** Where present, they are either unanchored (experiment 6 asks about "this example" before one exists) or spoiled (experiment 5 shows the final loss up front, and D2 prints every final loss). (X-d2, E6-S0-n1, E5-S0-n3, D2-S0-d1, E1-S0-n4)
12. **Counting and numbering inconsistencies erode trust in "every number comes from the actual run".** These include "Mini-batch 0" against "batch 1", "Epoch 2 is over" against "Epoch 3", "Epochs 10" against "0 of 20", and experiment 5's 40 passes against D2's 30 epochs for the same η = 0.3 result. (X-u3, X-u4, E3-S0-u2, D2-S0-u3, D2-S0-u2)
13. **The Walkthrough is frozen at "1 of N"** and gives stale instructions. There are three competing "next" controls (Step, Run to …, Next). (X-u1, E2-S0-n3, E3-S3-u1, E8-S3-u5)
14. **The visual encoding doesn't match its legend.** A weight of 4.0 or 1.9 is drawn thin and pale, neuron fill colour has no legend, minus signs sit at the edge of dark circles, the loss-axis labels are clipped, and the cross-entropy curve is truncated at 4 without saying so. (E2-S1-n1, D2-S2-u2, E6-S3-u3, E7-S2-u4, X-u2, E4-S0-u1)
15. **Experiments 2 and 4 pick confusing demonstration examples.** Experiment 2 shows saturation on an example that is already correct. Experiment 4 silently flips the chart from target 1 to target 0, so the curves mirror without comment. (E2-S3-n1, E4-S3-n1)

---

## 2. Responses

### The response codes

| Code | Meaning |
|---|---|
| **FIXED** | Changed in this round; visible in the regenerated screenshots |
| **SCHEDULED** | Belongs to the purpose-built screens for experiments 2, 3, 4, 7, 8, D1 and D2, scheduled for November–December (`docs/DESIGN-SCOPE.md`, Status). The reviewer is right that the reduced workbench is a dashboard; the design document says these seven screens are reduced workbenches, not finished novice screens. |
| **GAP** | Accepted and not fixed in this round; added to `docs/KNOWN-GAPS.md` (KG-R2b-*) with the proposed fix |
| **ARTEFACT** | Produced by how the screenshots were taken, not by the screen |
| **NOTED** | An inference that matches the intent; no action |

### The fixes made from this review

| Point(s) | Fix |
|---|---|
| **E6-S3-u1, E6-S4-u1, E6-S5-u1, E6-S5-d1** (the top problem) | Whole-phase steps land at the *start* of each phase, before that example's factors are computed. The backward pass is then followed by the update, so the factors were computed and immediately stepped past. The chain now keeps the last completed example's factors on show, labelled "for example N, the last one worked back through", until the next example computes its own first factor. In the regenerated shot `6-backpropagation-4.jpg`, the four factors and their product (0.06962) appear, with "✓ the same" against the engine's gradient. |
| **E6-S4-u2** | The reveal now says "For the example you predicted on, its gradient is …", so it no longer claims to be about the example now on screen. |
| **E6-S0-t2** | "w²" removed; the factor reads "weight from hidden neuron j to the output". |
| **E6-S0-t1** (part), **E6-S3-u2** (part) | Factor 1 reads "error signal at the output: how fast the loss changes as the output neuron's sum changes", in words instead of ∂ℓ/∂z_out. The ∂ℓ/∂a label under the output node remains (GAP KG-R2b-4). |
| **X-u3, E2-S2-u1, E3-S2-u1, E8-S2-u1, E7-S2-u1, D2-S2-u1** | The epoch and mini-batch narration counted from 0 while the status line counts from 1. Both now count from 1 ("Mini-batch 1 begins"; "Epoch 3 is over" when the status says epoch 3). |
| **X-u4, E3-S0-u2, E3-S2-u1** (the 20-against-10 part), **D1-S0-u2** | A real defect. The learning-rate and epoch selects lacked the run's own value (20 epochs) among their choices, so the browser showed the first choice (10). Applying the structure editor would then silently have trained for 10 epochs. The current value is now always one of the choices. |
| **X-u2, E2-S0-u1** | Log-axis ticks at powers of ten are drawn as 10⁻⁴, 10⁻⁸, and so on; "1.00×10⁻¹²" did not fit the axis margin. |
| **E8-S3-u1** | A vector longer than 16 values is summarised in the status line ("784 values (151 non-zero)") instead of listed. |
| **E8-S3-u3** (the formatting part) | With every pixel under the window zero, the computation reads "u = 0 (every pixel under the window is 0)" instead of "u = 0 = 0". |
| **X-u5, E3-S1-t1, E4-S1-u1, E8-S1-u1, D2-S1-u1** | The two set-up sentences are rewritten. Zero biases: "start at zero. The weights start at different random values, so that is enough to make the units differ." Fixed starting values: "start at fixed values chosen for this experiment … so every run starts from the same place." The second no longer says "you chose" on screens with no such control. |
| **E1-S0-n2** | The table header reads "says (yes if output > 0.5)". |
| **E1-S0-t4** | On the Guided path the footer reads "Every number on this page comes from actually running the network, not from an illustration." The engine/TensorFlow.js/trace wording is kept for expert mode. |
| **X-d4** | Confirmed: Reset experiment is on every screen (this round's defect 3; invariant A requires it). |

### Every point, by experiment

**Experiment 1**

| Point | Response |
|---|---|
| E1-S0-i1, E1-S0-i2, E1-S1-i1, E1-S2-i1, E1-S3-i1 | NOTED. These inferences are the intended ones. |
| E1-S0-n1, E1-S\*-d2, E1-S0-t1, E1-S0-t3 | GAP KG-R2b-1. Weight, bias, σ and "sigmoid" need one plain sentence each where they first appear (weight = how strongly an input counts; bias = a shift that applies whatever the inputs are; σ = the squashing function, drawn). Proposed wording is in KG-R2b-1. The vocabulary test only checks terms against the curriculum order, not that each is *explained* on first use; this is a test gap too. |
| E1-S0-t2 | GAP KG-R2b-1. The self-check asks for z, but the default screen never names the sum z; the "Show the numbers" table does ("z (sum + b)"). Fix: label the sum z on the diagram. The self-check items are not inventory items, so they may change. |
| E1-S0-n2 | FIXED. |
| E1-S0-n3, E1-S0-n4 | GAP KG-R2b-1. The screen should say that *Next* walks through one pass by hand and that *Let it learn* runs many passes, and that the prediction is checked when the bias slider moves. |
| E1-S0-t4 | FIXED. |
| E1-S0-u1 | GAP KG-R2b-1. The neuron circle shows its formula; the output value is in the "out" box and the table. Fix: put the current output in the circle or say "the output appears in the box". |
| E1-S0-u2 | GAP KG-R2b-1. Mark wrong rows (✗ and text, not colour alone). |
| E1-S0-d1 | Agreed, as a design-document inaccuracy. The phase banner belongs to the network view; experiment 1's diagram does not use it. NOVICE-DESIGN.md is corrected to say the banner appears in the network diagrams of experiments 3 onward. |
| E1-S1-n1 | GAP KG-R2b-1. The set-up narration should name the bias too. |
| E1-S1-u1, E1-S2-u1, E1-S\*-d1 | GAP KG-R2b-2, the step-label problem (top problem 3). |
| E1-S3-n1, E1-S3-n2, E1-S3-u1 | GAP KG-R2b-2. At "one calculation", twelve presses reach the first example's backward step. The weighted sum is computed at an earlier press than the one shown, and the sliders show the learner's *starting* settings, not the current weights. Fix: show the current weights beside the sliders once learning starts, and show the sum in the narration of its step. |
| E1-S3-t1 | GAP KG-R2b-1. Give the error a number on the screen (the loss is introduced in experiment 4, so "how far the output is from the right answer"). |
| E1-S3-d1 | ARTEFACT. Experiment 1's reveal is triggered by moving the bias slider, which the screenshot script does not do. The e2e test `1 single neuron: … prediction and reveal` covers it ("Your prediction held"). |

**Experiment 2**

| Point | Response |
|---|---|
| E2-S0-i1, E2-S1-i1, E2-S2-i1, E2-S3-i1 | NOTED. |
| E2-S0-n1, E2-S0-n2, E2-S0-n3, E2-S0-t1, E2-S0-t2, E2-S0-u4, E2-S0-d1, E2-S0-d2, E2-S0-d3, E2-S1-t1, E2-S2-t1, E2-S2-u2, E2-S2-u3, E2-S3-t1, E2-S3-d1 | SCHEDULED. The purpose-built screen will have one question, one activation choice, a prediction ("which activation lets the signal through at z = −16?") and no workbench vocabulary. E2-S0-d3, a self-check about back-propagation in experiment 2, goes to the curriculum review in KG-R2b-3. |
| E2-S0-u1 | FIXED. |
| E2-S0-u2 | GAP KG-R2b-4. An empty heat map draws its colour legend; it should say "no data yet". |
| E2-S0-u3, E2-S3-u3 | GAP KG-R2b-4. Network-diagram labels (ℓ, ∂ℓ/∂a, ∂ℓ/∂z) need plain-words names on the Guided path. |
| E2-S1-n1, E2-S1-u1 | GAP KG-R2b-4. Line thickness is scaled relative to the largest weight in the network, so a single weight of 4 is drawn at the maximum for this model, which still reads as thin. The legend should say "relative". A one-value histogram is noise: SCHEDULED. |
| E2-S2-u1 | FIXED (X-u3). |
| E2-S3-n1 | GAP KG-R2b-3. A good point. The saturated example is one already answered correctly, so "no gradient" reads as "nothing to fix". The purpose-built screen should pick a *wrong* example in saturation. |
| E2-S3-n2, E2-S3-u1, E2-S3-u2, E2-S3-u4 | SCHEDULED, plus KG-R2b-4 for the fill-colour legend (u2). The chart's x-range follows the current z, which reached −16; the axis change should be stated. |

**Experiment 3**

| Point | Response |
|---|---|
| E3-S0-i1, E3-S1-i1, E3-S3-i1 | NOTED. |
| E3-S0-t1, E3-S0-t2, E3-S0-t3, E3-S0-t4, E3-S0-u3, E3-S0-u4, E3-S0-d1, E3-S2-t1, E3-S3-t1, E3-S3-u1 | SCHEDULED. E3-S0-u3 (two width controls) and E3-S0-t3 (learning rate and epochs exposed in experiment 3) are a declared-surface question: the structure editor is declared for experiment 3. KG-R2b-3 proposes declaring it for the expert path only, until experiment 5. |
| E3-S0-u1 | GAP KG-R2b-4. The segmented control reserves a third slot. |
| E3-S0-u2, E3-S2-u1 | FIXED (X-u3, X-u4). |
| E3-S1-t1 | FIXED (X-u5): the sentence is rewritten. |
| E3-S1-u1, E3-S2-u2, E3-S3-n1, E3-S3-n2, E3-S3-d1 | GAP KG-R2b-2. A "layer" step stops at every layer-scoped instruction, including set-up and the end-of-example instructions. "example 2 in the batch" at S3 means the first example's forward pass was passed in presses 5–11. |
| X-t1 (from E3-S3-t1) | GAP KG-R2b-1. On the Guided path, the network's output should be called "the network's answer", keeping "prediction" for the learner's guess. |

**Experiment 4**

| Point | Response |
|---|---|
| E4-S0-i1, E4-S2-i1, E4-S3-i1 | NOTED. |
| E4-S0-t1, E4-S0-t2, E4-S0-t3, E4-S0-d1, E4-S3-t1, E4-S3-u1, E4-S3-u2, E4-S3-d1 | SCHEDULED. E4-S0-t3, that experiment 4 never defines a loss in a sentence, is the most important of these for the purpose-built screen. |
| E4-S0-u1 | GAP KG-R2b-4. The y-axis is capped at 4 by design; the cap should be stated ("cut off at 4; it rises without limit"). |
| E4-S0-u2 | GAP KG-R2b-3. "one layer" in a one-layer network is a surface choice for curriculum continuity; on the purpose-built screen it should not be offered. |
| E4-S1-u1 | FIXED. |
| E4-S2-u1 | GAP KG-R2b-4. The marker appears at the loss instruction, which is later in the forward pass than the banner suggests; the caption should say "reach the loss step". |
| E4-S3-n1, E4-S3-n2 | GAP KG-R2b-3. The chart follows the current example's target; the flip to y = 0 must be announced. |

**Experiment 5**

| Point | Response |
|---|---|
| E5-S0-i1, E5-S1-i1, E5-S2-i1, E5-S3-i1 | NOTED. E5-S2-i1 and E5-S3-i1 confirm that the worked step works. |
| E5-S0-n1, E5-S0-n2 | GAP KG-R2b-5, top problem 2. Accepted. The second view should be the 50 points with the current line, linked to the dot on the map ("each point on this map is one line"). It is not built in this round because it is a new view, not a fix. |
| E5-S0-n3 | GAP KG-R2b-5. The η = 0.3 result is the reference the predictions are made *against* ("compared with η = 0.3…"), so it is shown on purpose. The reviewer's reading, that it looks like a spoiler, suggests labelling it "the starting setting, for comparison". |
| E5-S0-t1, E5-S0-t2, E5-S3-t1, E5-S3-n1 | GAP KG-R2b-1. "Learning rate η: how big each downhill step is" needs to appear before the buttons. "gradient" needs one sentence ("the slope of the loss in the w direction"). ℓ against L (one example against the average) needs a sentence. The b step should be shown with the w step. |
| E5-S0-t3, E5-S0-d1 | GAP KG-R2b-3. The self-check uses θ and ∂ notation, and batch is exposed before it is requested. Self-check items are not inventory items; they go to the curriculum review. |
| E5-S0-u1, E5-S3-n2 | GAP KG-R2b-2. With B = 50, "one batch" equals "one full pass", and the two loss wordings name the same quantity; the screen should say so. |
| E5-S1-u1, E5-S2-u1 | GAP KG-R2b-2. |
| E5-S3-d1 | Agreed. The learning-rate prediction is asked only when the learner changes the rate. The screen should prompt the first change ("try a bigger step"). KG-R2b-5. |
| E5-S3-d2 | Same as E1-S0-d1: the banner belongs to the network diagram, and NOVICE-DESIGN.md is corrected. |

**Experiment 6**

| Point | Response |
|---|---|
| E6-S0-i1, E6-S1-i1, E6-S3-i1, E6-S4-i1 | NOTED. |
| E6-S3-u1, E6-S4-u1, E6-S5-u1, E6-S5-d1 | FIXED (above). |
| E6-S4-u2 | FIXED (above). |
| E6-S0-t2 | FIXED. |
| E6-S0-t1, E6-S3-u2 | Partly FIXED (factor 1 in words); the rest is GAP KG-R2b-1, which asks for one sentence on "chain rule" and on "slope of the activation". |
| E6-S0-n1 | GAP KG-R2b-1. The prediction is asked before the first example is loaded. Fix: ask it once the forward pass of the example has run, with the example's inputs and target visible. |
| E6-S0-n2, E6-S0-d1 | GAP KG-R2b-4. Before initialisation all weights are 0, so the followed line has nothing to be distinct from; it should also be labelled. |
| E6-S0-t3 | NOTED. "Update" is the phase name of this experiment's step size; the step-size label introduces it. |
| E6-S0-u1 | GAP KG-R2b-4. Add the "Step size" label to this screen's selector. |
| E6-S1-u1, E6-S2-u1, E6-S3-u4 | GAP KG-R2b-2. The forward pass of the first example is one phase step; it was passed at press 4–5. |
| E6-S3-u3 | GAP KG-R2b-4 (the fill-colour legend). |
| E6-S4-u3, E6-S4-n1 | GAP KG-R2b-5. The update happens after a batch, and with the default step the shots did not land on it. η should be shown on the screen so that −η × gradient can be computed. |
| E6-S4-n2 | GAP KG-R2b-5. "By how much, relative to the others" is answered only by the "hardly at all" option's 2 % rule. A small bar of every weight's gradient in the layer would answer it. |

**Experiments 7, 8, D1 and D2**

| Point | Response |
|---|---|
| E7-S0-i1, E7-S2-i1, E7-S3-i1, E8-S0-i1, E8-S1-i1, E8-S3-i1, D1-S0-i1, D1-S2-i1, D2-S0-i1, D2-S2-i1, D2-S3-i1 | NOTED. |
| E7-S0-t1, E7-S0-t2, E7-S0-u1, E7-S0-u2, E7-S0-d1, E7-S2-t1, E7-S3-n1, E7-S3-u2, E7-S3-d1 | SCHEDULED. A purpose-built screen leads with the decision boundary and a prediction, and runs epochs with *Run*. The "recorded sweep … seeds" text is developer language and moves to expert mode. |
| E7-S1-u1, D1-S1-u1, D1-S2-u3 | GAP KG-R2b-2. "What just happened" narrates the *last* instruction of a multi-instruction step, while "What changed" lists *everything* the step changed; the two headings should say so. |
| E7-S2-u1 | FIXED (X-u3). |
| E7-S2-u2, E7-S3-u1 | SCHEDULED. The straight boundary early in training is the honest state of the run. The screen must say "the boundary bends as the hidden layer learns; run on to see it". |
| E7-S2-u3, E7-S2-u4 | GAP KG-R2b-4: axis labels on the decision plot, and the minus sign inside dark circles. |
| E8-S0-t1, E8-S0-t2, E8-S0-t3, E8-S0-u1, E8-S0-d1, E8-S1-n1, E8-S3-t1, E8-S3-u4 | SCHEDULED. |
| E8-S1-u1 | FIXED (X-u5). |
| E8-S2-u1 | FIXED (X-u3). |
| E8-S2-u2, E8-S3-u2 | GAP KG-R2b-2. At "one layer", the forward pass of the first digit was passed between the shots; the feature maps exist at presses 6–9. |
| E8-S3-u1 | FIXED. |
| E8-S3-u3 | FIXED for "u = 0 = 0". "(trace: …)" is expert vocabulary: SCHEDULED. |
| E8-S3-u5, X-u1, E2-S2-u3, E3-S3-u1 | GAP KG-R2b-6. The walkthrough is a separate guided sequence advanced by its own *Next*; it does not follow the step buttons. On the reduced workbench it should either follow the cursor or be the only stepping control. |
| D1-S0-t1, D1-S0-u3, D1-S0-d1, D1-S1-u2, D1-S2-t1, D1-S3-d1 | SCHEDULED. |
| D1-S0-u1 | GAP KG-R2b-4. The diagram scrolls horizontally, with no visible cue. Fix: a scroll hint, or fit the nine columns to the panel width. |
| D1-S0-u2 | FIXED (X-u4). |
| D1-S2-n1 | GAP KG-R2b-3. It is the first backward pass, so "has almost stopped learning" should read "can barely learn: its gradient is almost zero". |
| D1-S2-u1 | GAP KG-R2b-4. Gradient labels overlap in narrow columns; hide them below a column width. |
| D1-S2-u2 | GAP KG-R2b-4. "Batch gradient" histograms fill when the batch's gradients are *accumulated*, which runs from the last layer down; at the pause only L1 and L2 had been accumulated in that order. The caption should say so. |
| D1-S2-u4, D1-S3-u1, D1-S3-u2 | GAP KG-R2b-2. A breakpoint stops a step early by design, but on the Guided path it should fire once and then step normally. As it is, every press re-stops at the next vanishing layer, which is why the narration repeats. |
| D2-S0-u1, D2-S3-u1 | GAP KG-R2b-7. Accepted, top problem 7. At η = 0.95 the *weight* overshoots its optimum and oscillates, but the loss falls monotonically, so the caption "overshoots back and forth" describes the parameter, not the curve shown. Either the caption changes, or the rate moves closer to the 1.0 stability edge. Changing the rate changes a registry configuration that the C1 slides and the validation report depend on, so it is logged rather than changed in this round. |
| D2-S0-u2, D2-S0-u3 | GAP KG-R2b-7. Experiment 5 runs 40 passes and D2 runs 30 epochs; "pass" and "epoch" are the same thing on two screens. Both points go to the curriculum review. |
| D2-S0-t1, D2-S0-d1 | SCHEDULED. |
| D2-S1-u1 | FIXED (X-u5). |
| D2-S1-u2 | SCHEDULED: "the same starting line as experiment 5". |
| D2-S2-u1 | FIXED (X-u3). |
| D2-S2-u2 | GAP KG-R2b-4 (relative line thickness, as E2-S1-n1). |
| D2-S2-u3 | GAP KG-R2b-4. The heat-map scale follows the data seen so far; it should be fixed over the run. |
| D2-S3-u2 | NOTED. The status line shows the example at the cursor, which at each epoch's end is the last example of the shuffled order; that it repeats suggests the order is not shuffled in this configuration. KG-R2b-7 checks it. |

**Cross-cutting**

| Point | Response |
|---|---|
| X-u1 | GAP KG-R2b-6. |
| X-u2, X-u3, X-u4, X-u5 | FIXED. |
| X-u6 | GAP KG-R2b-4. |
| X-t1, X-t2 | GAP KG-R2b-1. |
| X-d1, X-d2 | SCHEDULED. |
| X-d3 | ARTEFACT. The script unlocks every experiment so that each can be photographed; a fresh learner sees the locks. |
| X-d4 | NOTED. |

### The top problems, as ranked by the reviewer

| # | Response |
|---|---|
| 1 | FIXED |
| 2 | GAP KG-R2b-5 |
| 3 | GAP KG-R2b-2, the most important open item. The step sizes are honest about the trace (every stop is a real instruction) but not about the label. Proposal: on the Guided path, set-up and control instructions are passed without stopping, so that "one layer" always lands on a layer's computation. This is a navigator option, not a trace change. |
| 4 | SCHEDULED, plus KG-R2b-1 and KG-R2b-3 |
| 5 | GAP KG-R2b-1, plus ARTEFACT for the reveal |
| 6 | SCHEDULED |
| 7 | GAP KG-R2b-7 |
| 8 | SCHEDULED |
| 9 | FIXED (the dump), plus GAP KG-R2b-2 (stepping past) |
| 10 | GAP KG-R2b-4 and KG-R2b-2 |
| 11 | SCHEDULED, plus KG-R2b-1 and KG-R2b-5 |
| 12 | FIXED, except D2-S0-u3 (KG-R2b-7) |
| 13 | GAP KG-R2b-6 |
| 14 | GAP KG-R2b-4, plus FIXED (the axis labels) |
| 15 | GAP KG-R2b-3 |

### Counts

These counts are computed from the point ids above. Each point is counted once, under the first code given in its row.

| Total points | 218 (15 of them ranked) |
|---|---|
| i (can infer) | 34 |
| n (cannot infer) | 29 |
| t (term before taught) | 40 |
| u (unaccountable) | 90 |
| d (departure from design) | 25 |

| Response | Points |
|---|---|
| NOTED | 37 |
| FIXED (2 of them in part) | 28 |
| Design document corrected (E1-S0-d1, E5-S3-d2) | 2 |
| SCHEDULED | 67 |
| GAP | 82 |
| ARTEFACT | 2 |
