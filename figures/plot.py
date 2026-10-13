#!/usr/bin/env python3
"""Plots the data-driven figures from the CSVs written by scripts/gen-figures.ts.

Vector output (PDF with embedded TrueType fonts, SVG), no UI chrome, greyscale-safe:
series are distinguished by line style and marker, never by colour alone.
"""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

HERE = Path(__file__).resolve().parent
plt.rcParams.update({"pdf.fonttype": 42, "ps.fonttype": 42, "svg.fonttype": "path", "font.family": "DejaVu Sans", "font.size": 9,
                     "axes.spines.top": False, "axes.spines.right": False, "savefig.bbox": "tight"})


def save(fig, name):
    for ext in ("pdf", "svg"):
        fig.savefig(HERE / f"{name}.{ext}")
    plt.close(fig)


# Loss curve (XOR experiment): loss and accuracy in two stacked panels sharing the epoch axis (no dual y-axis).
d = pd.read_csv(HERE / "loss-curve.csv")
fig, (ax, ax2) = plt.subplots(2, 1, figsize=(4.2, 3.6), sharex=True, gridspec_kw={"height_ratios": [2.2, 1]}, layout="constrained")
ax.plot(d.epoch, d.train_loss_running, color="black", lw=1.4, label="training loss (running mean over epoch)")
ax.plot(d.epoch, d.eval_loss, color="0.45", lw=1.4, ls="--", label="loss after epoch (all 4 examples)")
ax.set_ylabel("Binary cross-entropy")
ax.set_yscale("log")
ax.legend(frameon=False, fontsize=7.5, loc="lower left")
ax2.step(d.epoch, d.eval_accuracy * 100, where="post", color="black", lw=1.2)
ax2.set_ylabel("Accuracy (%)")
ax2.set_ylim(0, 105)
ax2.set_yticks([0, 50, 100])
ax2.set_xlabel("Epoch")
save(fig, "loss-curve")

# Parity overlay: DL-VizLab vs TensorFlow.js from identical initial weights and batch order.
p = pd.read_csv(HERE / "parity-overlay.csv")
models = [("xor-mlp", "2-4-1 MLP on XOR (SGD)"), ("cnn", "CNN conv–pool–conv–pool–dense (momentum)")]
fig, axes = plt.subplots(2, 2, figsize=(7.4, 4.4), gridspec_kw={"height_ratios": [3, 1.4]}, sharex="col", layout="constrained")
for k, (m, title) in enumerate(models):
    s = p[p.model == m]
    ax = axes[0, k]
    ax.plot(s.step, s.dlvizlab_loss, color="black", lw=2.2, label="DL-VizLab (float64)")
    ax.plot(s.step, s.tfjs_loss, color="white", lw=0.9, ls=(0, (3, 2)), label="TensorFlow.js (float32)")
    ax.plot(s.step, s.tfjs_loss, color="0.55", lw=0.9, ls=(0, (3, 2)))
    ax.set_title(title, fontsize=9)
    ax.set_ylabel("Batch loss")
    ax.legend(frameon=False, fontsize=7.5)
    bx = axes[1, k]
    bx.semilogy(s.step, s.abs_diff.clip(lower=1e-12), color="black", lw=0.8, label="|loss difference|")
    bx.semilogy(s.step, s.max_param_abs_diff.clip(lower=1e-12), color="0.5", lw=0.8, ls="--", label="max |parameter difference|")
    bx.set_xlabel("Training step")
    bx.set_ylabel("Abs. diff.")
    bx.set_ylim(1e-11, 1e-3)
    bx.axhline(1e-4, color="0.3", lw=0.6, ls=":")
    bx.text(s.step.max(), 1.6e-4, "tolerance floor 10⁻⁴", ha="right", va="bottom", fontsize=6.5, color="0.3")
    bx.legend(frameon=False, fontsize=6.5, loc="lower right", ncols=2)
save(fig, "parity-overlay")

# Vanishing gradients: weight-gradient norm by layer depth.
v = pd.read_csv(HERE / "vanishing-gradients.csv")
fig, ax = plt.subplots(figsize=(4.2, 2.8))
for act, style in (("sigmoid", dict(color="black", marker="o", ls="-")), ("relu", dict(color="0.5", marker="s", ls="--"))):
    s = v[v.activation == act]
    ax.semilogy(s.layer, s.mean_weight_grad_norm, lw=1.2, ms=4.5, mfc="white", label=f"{act} hidden layers", **style)
ax.set_xlabel("Layer (1 = nearest the input)")
ax.set_ylabel("‖∂L/∂W‖ (mean over batches)")
ax.legend(frameon=False, fontsize=7.5)
save(fig, "vanishing-gradients")
print("plots written")
