# Cold Review: Dismissed and Logged Points

The **84 points** logged as known gaps and the **37 points** recorded as needing no action, from `docs/COLD-REVIEW.md`, listed in one place for the team to scan. (Fix Round 2b reported 82; a recount of the point ids, including the two whole-experiment points E1-S\*-d1 and E1-S\*-d2, gives 84.) Each line gives the reviewer's point, in its first sentence, and the one-line reason it was not fixed.

This page does not re-adjudicate anything. The *Status* column says only whether a change made after the review (Fix Round 2c) now touches the point:
- ADR-052 is the D2 correction.
- ADR-053 is semantic novice stepping.

Full point texts and responses are in `docs/COLD-REVIEW.md`; the gap entries are in `docs/KNOWN-GAPS.md`.

## Logged as known gaps (84)

| Point | The reviewer said | Reason not fixed | Status |
|---|---|---|---|
| E1-S0-n1 | I am never told what a "weight" or a "bias" is. | KG-R2b-1: weight, bias, σ and "sigmoid" each need a plain sentence where they first appear. | open |
| E1-S*-d2 | Principle 4, "explained when first used", is broken for weight, bias, σ, z and sigmoid. | KG-R2b-1: weight, bias, σ and "sigmoid" each need a plain sentence where they first appear. | open |
| E1-S0-t1 | "σ" in the node label "Σ + b then σ" is not explained. | KG-R2b-1: weight, bias, σ and "sigmoid" each need a plain sentence where they first appear. | open |
| E1-S0-t3 | The "Next question" line says "squashes its sum with the sigmoid". | KG-R2b-1: weight, bias, σ and "sigmoid" each need a plain sentence where they first appear. | open |
| E1-S0-t2 | Check question 1 asks "what is z?" The letter z appears nowhere else on the screen. | KG-R2b-1: the default screen never names the sum z; label it on the diagram. | open |
| E1-S0-n3 | There are two ways to move forward, "Next: one calculation" and "Let it learn". | KG-R2b-1: say how Next and Let it learn relate, and when the prediction is checked. | open |
| E1-S0-n4 | The prediction says "drag the bias slider and watch the table". | KG-R2b-1: say how Next and Let it learn relate, and when the prediction is checked. | open |
| E1-S0-u1 | The output node is a box saying "out" and the neuron circle contains text ("Σ + b then σ") rather than a number. | KG-R2b-1: the circle shows the formula, the value is in the box; say so or move the value. | open |
| E1-S0-u2 | Nothing marks a row as wrong. | KG-R2b-1: mark wrong rows with ✗ and text. | open |
| E1-S1-n1 | The bias isn't mentioned, although I also "chose" it. | KG-R2b-1: the set-up narration should name the bias too. | open |
| E1-S1-u1 | The button says "one calculation", but this press calculated nothing. | KG-R2b-2: step labels did not match what a step does. | addressed (ADR-053) |
| E1-S2-u1 | Four presses of "one calculation" and the diagram has not changed since S1, apart from the glow going away. | KG-R2b-2: step labels did not match what a step does. | addressed (ADR-053) |
| E1-S*-d1 | The template says to use "one plain sentence per step saying what just happened". | KG-R2b-2: step labels did not match what a step does. | addressed (ADR-053) |
| E1-S3-n1 | The narration says "Learning: the neuron works out which way to nudge its weights and bias to reduce the error." But the sliders still read 0.50 / … | KG-R2b-2: twelve "one calculation" presses reach the backward step; sliders show starting, not current, values. | step landing addressed (ADR-053); slider point open |
| E1-S3-n2 | Where did examples (0,0) and (0,1) go? | KG-R2b-2: twelve "one calculation" presses reach the backward step; sliders show starting, not current, values. | step landing addressed (ADR-053); slider point open |
| E1-S3-u1 | The intermediate sum (w₁x₁ + w₂x₂ + b = 0.5) is never shown, so I can't check 0.6225 myself. | KG-R2b-2: twelve "one calculation" presses reach the backward step; sliders show starting, not current, values. | step landing addressed (ADR-053); slider point open |
| E1-S3-t1 | The narration uses "error" without saying how it is measured. | KG-R2b-1: give the error a number in plain words. | open |
| E2-S0-u2 | "Gradient magnitude per layer" shows a blue gradient bar between "epoch 1" and "epoch 40" before anything has run. | KG-R2b-4: an empty heat map draws its legend; say "no data yet". | open |
| E2-S0-u3 | In the network diagram the neurons show "·" and the target box shows "target y / ℓ = ·". | KG-R2b-4: ℓ and ∂ labels need plain-words names on the Guided path. | open |
| E2-S3-u3 | Two different tiny numbers sit by the output node: "1.13×10⁻⁷" inside the circle and "∂ℓ/∂z=2.53×10⁻¹⁴" (?) below it. | KG-R2b-4: ℓ and ∂ labels need plain-words names on the Guided path. | open |
| E2-S1-n1 | The weight is 4.00, which is large and positive, but the line is thin and pale. | KG-R2b-4: thickness is relative to the largest weight; the legend should say so. | open |
| E2-S1-u1 | The "L1 weights" histogram appears with axis −4 to 4 and one bar at 4. | KG-R2b-4: thickness is relative to the largest weight; the legend should say so. | open |
| E2-S3-n1 | This example is already essentially correct (prediction 1.13×10⁻⁷, target 0, loss 1.27×10⁻¹⁴). | KG-R2b-3: saturation is shown on an example already answered correctly. | open |
| E3-S0-u1 | The step-size selector has an empty third segment after "one layer". | KG-R2b-4: the segmented control reserves an empty third slot. | open |
| E3-S1-u1 | I chose "one layer", but this press was "initialisation, layer 1" ("2 instructions executed"). | KG-R2b-2: a layer step stopped at set-up and end-of-example instructions. | addressed (ADR-053) |
| E3-S2-u2 | Four "one layer" presses and no layer has produced any output yet. | KG-R2b-2: a layer step stopped at set-up and end-of-example instructions. | addressed (ADR-053) |
| E3-S3-n1 | The status line says "example 2 in the batch". | KG-R2b-2: a layer step stopped at set-up and end-of-example instructions. | addressed (ADR-053) |
| E3-S3-n2 | After 12 "one layer" steps I have still not seen a single hidden-layer value. | KG-R2b-2: a layer step stopped at set-up and end-of-example instructions. | addressed (ADR-053) |
| E3-S3-d1 | The design says "one layer" is first offered in experiment 3, so I expected each press to move one layer forward. | KG-R2b-2: a layer step stopped at set-up and end-of-example instructions. | addressed (ADR-053) |
| X-t1 | "Prediction" means two different things: my guess (YOUR PREDICTION) and the network's output ("Prediction 0.5694"). | KG-R2b-1: call the network's output "the network's answer", keep "prediction" for the learner's guess. | open |
| E4-S0-u1 | The cross-entropy curve is cut off at 4 near ŷ = 0. | KG-R2b-4: the curve is capped at 4; the cap should be stated. | open |
| E4-S0-u2 | Again, the step-size selector offers "one layer" for a network that has only one layer. | KG-R2b-3: "one layer" in a one-layer network is offered for curriculum continuity. | open |
| E4-S2-u1 | The chart caption says "Step to a forward pass to place the current prediction on both curves", but the banner already reads "FORWARD PASS". | KG-R2b-4: the marker appears at the loss step; the caption should say so. | open |
| E4-S3-n1 | The chart flipped to "(target y = 0)" and the curves are now mirrored, rising to the right. | KG-R2b-3: the target flips without being announced. | open |
| E4-S3-n2 | The marked example is #2 in the batch. | KG-R2b-3: the target flips without being announced. | open |
| E5-S0-n1 | I never see the 50 points or the line. | KG-R2b-5: a view of the 50 points and the line is a new view, not built this round. | open |
| E5-S0-n2 | Why are w and b now the axes of a map? | KG-R2b-5: a view of the 50 points and the line is a new view, not built this round. | open |
| E5-S0-n3 | "Loss after 40 passes with η = 0.3, B = 50: 0.00827" is shown before I do anything. | KG-R2b-5: the η = 0.3 result is the reference for the prediction; label it as such. | open |
| E5-S0-t1 | "η" is used in the button labels, and "the learning rate η" is given as a title, not an explanation. | KG-R2b-1: η, gradient and ℓ against L need a sentence each; show b's step too. | open |
| E5-S0-t2 | "Loss surface L(w, b)": experiment 4 used "ℓ", and now it is "L". | KG-R2b-1: η, gradient and ℓ against L need a sentence each; show b's step too. | open |
| E5-S3-t1 | "gradient" is used as a number ("gradient −1.214") without ever saying it means "slope of the loss in the w direction". | KG-R2b-1: η, gradient and ℓ against L need a sentence each; show b's step too. | open |
| E5-S3-n1 | "each parameter moved by −η × its averaged gradient". | KG-R2b-1: η, gradient and ℓ against L need a sentence each; show b's step too. | open |
| E5-S0-t3 | In the Check questions: "θ ← θ − η·∂L/∂θ" (θ and ∂ never introduced), "epochs", "batch size", "noisier gradient estimate". | KG-R2b-3: self-check notation and the early exposure of batch go to curriculum review. | open |
| E5-S0-d1 | The design says batch size is a "second control (on request)", but the batch concept is already exposed by the step selector, "B = 50" and check Q3. | KG-R2b-3: self-check notation and the early exposure of batch go to curriculum review. | open |
| E5-S0-u1 | The step selector offers "one example / one batch". | KG-R2b-2: with B = 50 one batch is one pass, and both loss wordings name one quantity. | open |
| E5-S3-n2 | S2 reported "Loss over all points: 3.69" and S3 reports "Loss on this batch: 1.112". | KG-R2b-2: with B = 50 one batch is one pass, and both loss wordings name one quantity. | open |
| E5-S1-u1 | The button says "one batch", but this press was setup only. | KG-R2b-2: step labels did not match what a step does. | addressed (ADR-053) |
| E5-S2-u1 | It took 4 presses of "Next: one batch" to make one move. | KG-R2b-2: step labels did not match what a step does. | addressed (ADR-053) |
| E5-S3-d1 | I saw no prediction, because I never changed the learning rate (the design asks for one only then). | KG-R2b-5: the learning-rate prediction is asked only after the learner changes the rate; prompt the first change. | open |
| E6-S0-n1 | The prediction asks what "this example" will do to the weight, but no example is shown yet: the inputs and target are "·". | KG-R2b-1: the prediction is asked before an example is visible. | open |
| E6-S0-n2 | Which line is "input 1 → hidden neuron 1"? | KG-R2b-4: the followed line is not distinct before initialisation; label it. | open |
| E6-S0-d1 | The design says "Click a line (a weight) in the network to follow it". | KG-R2b-4: the followed line is not distinct before initialisation; label it. | open |
| E6-S0-u1 | The "forward / backward / update" step selector has no "Step size" label, unlike the other screens. | KG-R2b-4: add the "Step size" label. | open |
| E6-S1-u1 | The step was labelled "forward / backward / update", but this press was "setting up". | KG-R2b-2: the first example's forward pass was passed between shots. | addressed (ADR-053) |
| E6-S2-u1 | "Between examples." and the banner "CONTROL · Mini-batch begins". | KG-R2b-2: the first example's forward pass was passed between shots. | addressed (ADR-053) |
| E6-S3-u4 | The forward pass for this example was skipped: the shot jumps from "Between examples" (S2) straight to backward, so I never saw the example go forw… | KG-R2b-2: the first example's forward pass was passed between shots. | addressed (ADR-053) |
| E6-S3-u3 | Neuron fills vary from white to dark blue (0.2687 is pale, 0.7843 dark) and the inputs are orange. | KG-R2b-4: neuron fill colour has no legend. | open |
| E6-S4-u3 | I never saw the update phase: no "update" banner, and no "dotted overlays show each weight's change" (from the legend) in any of the six shots. | KG-R2b-5: show η so −η × gradient can be computed. | open |
| E6-S4-n1 | By how much did the weight move? | KG-R2b-5: show η so −η × gradient can be computed. | open |
| E6-S4-n2 | The question in the heading, "which weights are to blame, and by how much?", is answered only for the one weight I follow, and the comparison ("by … | KG-R2b-5: a comparison with the layer's other gradients would answer "by how much". | open |
| E7-S1-u1 | "one full pass" is selected, yet this press did "4 instructions … initialisation, layer 2". | KG-R2b-2: "What just happened" and "What changed" cover different scopes; label them. | open |
| D1-S1-u1 | "The biases of layer 9 start at zero", while "What changed" lists "L1.W was initialised. | KG-R2b-2: "What just happened" and "What changed" cover different scopes; label them. | open |
| D1-S2-u3 | "What just happened" talks about layer 2's weight gradients being averaged, while "What changed" says "L1.b changed: … −3.74×10⁻⁹". | KG-R2b-2: "What just happened" and "What changed" cover different scopes; label them. | open |
| E7-S2-u3 | The decision-boundary plot has no axis labels. | KG-R2b-4: decision plot axis labels; minus sign inside dark circles. | open |
| E7-S2-u4 | Hidden-neuron values such as "−0.9121" sit in dark orange circles with the minus sign at the edge of the circle, so they read at a glance as positive. | KG-R2b-4: decision plot axis labels; minus sign inside dark circles. | open |
| E8-S2-u2 | The INPUT still says "Load an example to see it." After 4 "one layer" presses I haven't seen a digit. | KG-R2b-2: the feature maps were passed between shots at "one layer". | addressed (ADR-053) |
| E8-S3-u2 | I never saw the feature maps. | KG-R2b-2: the feature maps were passed between shots at "one layer". | addressed (ADR-053) |
| E8-S3-u5 | The Walkthrough is still "1 of 6 … Load the first digit", although a digit is loaded. | KG-R2b-6: the walkthrough does not follow the step buttons. | open |
| X-u1 | The Walkthrough never advances past "1 of N", and its suggestion becomes stale (E2-S2-u3, E3-S3-u1, E8-S3-u5). | KG-R2b-6: the walkthrough does not follow the step buttons. | open |
| D1-S0-u1 | The network diagram is cut off on the right. | KG-R2b-4: no scroll cue on the deep network diagram. | open |
| D1-S2-n1 | "Almost stopped learning" happens in the very first batch, before any learning. | KG-R2b-3: "almost stopped learning" on the first backward pass should read "can barely learn". | open |
| D1-S2-u1 | The ∂ℓ/∂z labels under the neurons overlap each other and are illegible (for example "∂ℓ/∂z=6.58×10⁻⁷" printed over the next label). | KG-R2b-4: gradient labels overlap in narrow columns. | open |
| D1-S2-u2 | The batch-gradient histograms show L1 and L2 only. | KG-R2b-4: batch-gradient histograms fill in accumulation order; caption it. | open |
| D1-S2-u4 | "one full pass" is selected but the run stopped mid-batch at the breakpoint. | KG-R2b-2: a breakpoint re-fires on every press on the Guided path. | open |
| D1-S3-u1 | Instruction 2,741, still "Epoch 1 of 20, batch 2", and "0 of 20 epochs complete". | KG-R2b-2: a breakpoint re-fires on every press on the Guided path. | open |
| D1-S3-u2 | The "What just happened" text is word-for-word the same as in S2 ("The gradients of the weights of layer 2 from the 16 examples…"), so I can't tell… | KG-R2b-2: a breakpoint re-fires on every press on the Guided path. | open |
| D2-S0-u1 | The η = 0.95 curve is a smooth, steady decline, with no zig-zag or overshoot visible, yet it is captioned "overshoots back and forth". | KG-R2b-7: the η = 0.95 caption described the parameter, not the loss curve shown. | addressed (ADR-052) |
| D2-S3-u1 | At the "too large" rate the main run shows no overshoot at all: the weight rises monotonically and the loss falls monotonically. | KG-R2b-7: the η = 0.95 caption described the parameter, not the loss curve shown. | addressed (ADR-052) |
| D2-S0-u2 | Experiment 5 offered η = 0.9; here it is 0.95. | KG-R2b-7: "passes" (40) and "epochs" (30) for the same η = 0.3 result. | open |
| D2-S0-u3 | Experiment 5 said "Loss after 40 passes with η = 0.3 … 0.00827". | KG-R2b-7: "passes" (40) and "epochs" (30) for the same η = 0.3 result. | open |
| D2-S2-u2 | "L1.W changed … 1.597 → 1.898". | KG-R2b-4: line thickness is relative. | open |
| D2-S2-u3 | The heatmap colour scale reads "0.317 … 2.431"; in S3 it reads "2.51×10⁻⁵ … 2.431". | KG-R2b-4: the heat-map scale rescales over the run. | open |
| X-u6 | Line thickness doesn't visibly track \|weight\| (E2-S1-n1, D2-S2-u2), and neuron fill colour is used without a legend. | KG-R2b-4: line thickness and fill colour. | open |
| X-t2 | "∂ℓ/∂a", "∂ℓ/∂z", "ℓ", "L", "θ" and "ŷ" are used freely from experiment 2 onward and never introduced in words on any screen I saw. | KG-R2b-1: two meanings of "prediction"; ∂ notation used without words. | open |

## No action (37)

| Point | The reviewer said | Reason |
|---|---|---|
| E1-S0-i1 | The heading is a question I can follow: "Can one neuron learn AND — say 'yes' only when both inputs are 1?" There are three sliders, a small diagra… | Inference matches the intent. |
| E1-S0-i2 | The table makes sense: inputs, "output", "right answer", "says". | Inference matches the intent. |
| E1-S1-i1 | "Setting up: the neuron starts with the weights w₁, w₂ you chose (0.5, -0.5)." The two lines get a yellow glow, so I guess they are the weights. | Inference matches the intent. |
| E1-S2-i1 | "The neuron is about to look at the four examples, one at a time." | Inference matches the intent. |
| E1-S3-i1 | The input circles show 1 and 0, the neuron is ringed, and the output box shows 0.6225, which matches row (1,0) of the table. | Inference matches the intent. |
| E2-S0-i1 | A curve "f(z)" in blue and a dashed "slope f′(z)" are plotted against z. | Inference matches the intent. |
| E2-S1-i1 | One weight line appears. | Inference matches the intent. |
| E2-S2-i1 | The network panel is now outlined in yellow and the banner says "CONTROL · Mini-batch begins". | Inference matches the intent. |
| E2-S3-i1 | The input shows −4, the output 1.13×10⁻⁷, the target 0. | Inference matches the intent. |
| E3-S0-i1 | A 2→3→1 network diagram. | Inference matches the intent. |
| E3-S1-i1 | The weights appear (blue solid, orange dashed) and "b=0" labels appear over the hidden neurons. | Inference matches the intent. |
| E3-S3-i1 | Inputs −2.209 and −0.6358 are loaded (orange circles). | Inference matches the intent. |
| E4-S0-i1 | A chart "Two losses for the same prediction (target y = 1)": squared error in blue, cross-entropy dashed, both falling to 0 at ŷ = 1. | Inference matches the intent. |
| E4-S2-i1 | Example #21 with inputs 0.2899 and 0.9817 and target 1 is loaded. | Inference matches the intent. |
| E4-S3-i1 | A marker sits on both curves at ŷ = 0.5694: squared error 0.3242, cross-entropy 0.8426. | Inference matches the intent. |
| E5-S0-i1 | The question is clear: "How does a model find the best straight line through 50 points? | Inference matches the intent; the worked step works. |
| E5-S1-i1 | A dot appears at the start position. | Inference matches the intent; the worked step works. |
| E5-S2-i1 | The dot has moved once, along a line, to w = −0.7707, b = 0.01216. | Inference matches the intent; the worked step works. |
| E5-S3-i1 | About 4 dots form a path curving toward the ×. | Inference matches the intent; the worked step works. |
| E6-S0-i1 | The question is clear: "Which of its weights are to blame, and by how much? | Inference matches the intent. |
| E6-S1-i1 | "Setting up: every weight and bias gets its starting value." The followed weight is now dark solid blue with a glow. | Inference matches the intent. |
| E6-S3-i1 | A BACKWARD PASS banner. | Inference matches the intent. |
| E6-S4-i1 | The reveal: "× Not this time. | Inference matches the intent. |
| E6-S0-t3 | "The update moves a weight by −η × its gradient": η is now assumed, which is fair after experiment 5, but "update" as a phase name is new here. | "Update" is introduced by the step-size label. |
| E7-S0-i1 | The Walkthrough states it plainly: "XOR is 1 when exactly one input is 1. | Inference matches the intent. |
| E7-S2-i1 | A decision-boundary plot appears with four markers and a diagonal line. | Inference matches the intent. |
| E7-S3-i1 | Epoch 11 of 150, loss 0.65, accuracy 75%. | Inference matches the intent. |
| E8-S0-i1 | Placeholders for INPUT, KERNELS (L1), FEATURE MAPS, AFTER POOLING and PREDICTION, plus "Load a digit" in the Walkthrough. | Inference matches the intent. |
| E8-S1-i1 | Four 3×3 grids of signed numbers appear, coloured orange for negative and blue for positive. | Inference matches the intent. |
| E8-S3-i1 | A handwritten "0" (example 216) is shown, with four small blue "after pooling" images and a prediction bar chart (digit 0 at 38.55%, 1 at 29.68%, 2… | Inference matches the intent. |
| D1-S0-i1 | A deep network of 8 sigmoid hidden layers. | Inference matches the intent. |
| D1-S2-i1 | A yellow notice: "Paused: every element of the gradient of L2.W is below 0.0001 (largest 0.00000154) — this layer has almost stopped learning." Thi… | Inference matches the intent. |
| D2-S0-i1 | Four small loss curves: η = 0.02 "too small", 0.3 "good", 0.95 (main run) "too large: overshoots back and forth", 1.1 "divergent". | Inference matches the intent. |
| D2-S2-i1 | Epoch 3. | Inference matches the intent. |
| D2-S3-i1 | Epoch 11, loss about 0.76 and falling smoothly. | Inference matches the intent. |
| D2-S3-u2 | The status line shows the same example (x = 0.8097, target 0.632) at the end of every epoch. | The status line shows the example at the cursor; whether the order is shuffled is checked under KG-R2b-7. |
| X-d4 | "Every screen has a Reset experiment control." It is present on all of them, which satisfies the design. | Reset experiment is on every screen. |
