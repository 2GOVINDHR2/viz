#!/usr/bin/env python3
"""Generate synthetic study exports for pipeline validation.

The data follow docs/DATA-DICTIONARY.md exactly. Responses come from a
three-parameter logistic item-response model (guessing floor 0.25 for
four-option items) with a latent ability that rises between pre- and post-test
by a condition-specific amount. These numbers are invented: they exist only to
prove that the analysis pipeline runs end to end and produces every table and
figure. Every output directory carries a SIMULATED marker that forces
watermarking.

Usage: python3 analysis/simulate.py --n 60 --out analysis/sim/n60 [--seed 1]
"""
from __future__ import annotations

import argparse
import json
import string
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = json.loads((ROOT / "src/study/config/concept-inventory.json").read_text())

# Latent learning gains (in ability units) per condition — illustrative only.
GAIN = {"C1": 0.35, "C2": 0.55, "C3": 0.85}



def _simulated_novice(rng, e: float) -> dict:
    """Fix Round 2 telemetry features (mode, going deeper, predictions, step sizes) for a simulated C3 participant."""
    made = int(rng.poisson(6 * min(e, 1.5)))
    resolved = int(rng.binomial(made, 0.8))
    early = int(rng.binomial(resolved // 2, 0.45))
    late = int(rng.binomial(resolved - resolved // 2, 0.6))
    return {
        "mode_switches": int(rng.poisson(1.5 * e)), "deeper_opens": int(rng.poisson(5 * e)),
        "predictions_made": made, "predictions_revised": int(rng.poisson(0.5)),
        "predictions_resolved": resolved, "predictions_correct": early + late,
        "prediction_accuracy_early": round(early / (resolved // 2), 3) if resolved >= 2 else None,
        "prediction_accuracy_late": round(late / (resolved - resolved // 2), 3) if resolved >= 2 else None,
        "granularities_offered": int(min(6, 2 + rng.poisson(2 * e))), "granularities_used": int(min(6, 1 + rng.poisson(2 * e))),
    }

def participant_code(rng: np.random.Generator) -> str:
    alphabet = string.ascii_uppercase + "234567"  # RFC 4648 base-32, as Study Mode uses
    return "P-" + "".join(rng.choice(list(alphabet), 8))


def simulate(n: int, seed: int, design: str = "three_condition") -> dict[str, pd.DataFrame]:
    rng = np.random.default_rng(seed)
    # Fix Round 2 features draw from their own stream, so adding them left every earlier simulated value unchanged.
    rng_novice = np.random.default_rng([seed, 2])
    conditions = ["C1", "C2", "C3"] if design == "three_condition" else ["C1", "C3"]
    items = [i for i in INVENTORY["items"] if not i.get("retired")]
    transfer = [i for i in INVENTORY["transfer_items"] if not i.get("retired")]
    # Item difficulties: harder for 'apply', easier for 'recall'.
    level_shift = {"recall": -0.6, "understand": 0.0, "apply": 0.5}
    difficulty = {i["id"]: level_shift[i["bloom"]] + rng.normal(0, 0.4) for i in items + transfer}

    rows, resp, sus, tlx, tel, events, fb = [], [], [], [], [], [], []
    # Over-recruit slightly so that after withdrawals/incompletes about n complete.
    n_recruited = int(round(n * 1.08)) + 1
    familiarity = rng.integers(1, 6, n_recruited)
    strata = np.where(familiarity <= 2, "low", "high")
    # Stratified permuted-block randomisation, as Study Mode does.
    assigned = np.empty(n_recruited, dtype=object)
    for s in ("low", "high"):
        idx = np.flatnonzero(strata == s)
        blocks = np.concatenate([rng.permutation(conditions) for _ in range(len(idx) // len(conditions) + 1)])
        assigned[idx] = blocks[: len(idx)]

    for k in range(n_recruited):
        pid = participant_code(rng)
        cond = assigned[k]
        consented = rng.random() > 0.03
        withdrawn = consented and rng.random() < 0.03
        completed = consented and not withdrawn and rng.random() > 0.02
        prior = int(rng.random() < 0.35)
        theta = rng.normal(-0.4 + 0.25 * (familiarity[k] - 3) + 0.4 * prior, 0.8)
        base = dict(
            participant_id=pid, study_id="SIM", design=design, condition=cond if consented else "",
            assignment="stratified_random", stratum=strata[k], consented=int(consented), withdrawn=int(withdrawn),
            completed=int(completed),
        )
        if not consented or withdrawn:
            rows.append(base)
            continue
        base.update(
            year_of_study=int(rng.integers(1, 5)), prior_ml_course=prior,
            programming_years=rng.choice(["none", "lt1", "1to3", "gt3"], p=[0.05, 0.25, 0.5, 0.2]),
            familiarity=int(familiarity[k]), pre_duration_s=round(float(rng.normal(540, 90)), 1),
            intervention_duration_s=1800.0 + round(float(rng.normal(0, 20)), 1),
            post_duration_s=round(float(rng.normal(600, 100)), 1) if completed else None,
        )
        rows.append(base)
        engagement = rng.normal(0, 1)  # drives both telemetry and (a little) learning in C3
        gain = GAIN[cond] + (0.25 * engagement if cond == "C3" else 0) + rng.normal(0, 0.35)
        phases = [("pre", theta, items)] + ([("post", theta + gain, items + transfer)] if completed else [])
        for phase, ability, its in phases:
            order = rng.permutation(len(its))
            for pos, j in enumerate(order, start=1):
                it = its[j]
                p = 0.25 + 0.75 / (1 + np.exp(-(1.4 * (ability - difficulty[it["id"]]))))
                correct = int(rng.random() < p)
                chosen = it["answer"] if correct else int(rng.choice([o for o in range(4) if o != it["answer"]]))
                resp.append(dict(
                    participant_id=pid, phase=phase, item_id=it["id"], position=pos, chosen=chosen, correct=correct,
                    latency_ms=int(rng.lognormal(9.6, 0.4)), concept=it["concept"], bloom=it["bloom"],
                    transfer=int(bool(it.get("transfer"))),
                ))
        if not completed:
            continue
        if cond in ("C2", "C3"):
            sat = rng.normal(0.9 if cond == "C3" else 0.5, 0.8)
            r = {"participant_id": pid}
            for q in range(1, 11):
                lean = sat if q % 2 == 1 else -sat  # odd items positive, even items negative
                r[f"sus{q:02d}"] = int(np.clip(np.round(3 + lean + rng.normal(0, 0.7)), 1, 5))
            sus.append(r)
            load = rng.normal(50 if cond == "C3" else 45, 15)
            tlx.append({
                "participant_id": pid,
                **{s: int(np.clip(5 * np.round((load + rng.normal(0, 12) + off) / 5), 0, 100))
                   for s, off in [("mental", 10), ("physical", -30), ("temporal", -5), ("performance", -10), ("effort", 5), ("frustration", -15)]},
            })
        if cond == "C3":
            e = np.exp(engagement * 0.5)
            g = {lvl: int(rng.poisson(w * e)) for lvl, w in [("operation", 60), ("layer", 45), ("phase", 20), ("sample", 15), ("batch", 8), ("epoch", 5)]}
            tel.append({
                "participant_id": pid, "steps_total": sum(g.values()), **{f"steps_{k}": v for k, v in g.items()},
                "back_steps": int(rng.poisson(12 * e)), "jumps": int(rng.poisson(4 * e)),
                "view_switches": int(rng.poisson(25 * e)), "param_edits": int(rng.poisson(6 * e)),
                "breakpoints_set": int(rng.poisson(2 * e)), "explanation_opens": int(rng.poisson(30 * e)),
                "explanation_detailed_share": round(float(rng.beta(2, 3)), 3),
                "experiments_started": int(min(9, rng.poisson(5 * e) + 1)), "experiments_completed": int(min(9, rng.poisson(4 * e))),
                "walkthrough_steps": int(rng.poisson(15 * e)), "active_time_s": round(float(min(1800, rng.normal(1350, 200) * min(e, 1.3))), 1),
                "idle_gaps": int(rng.poisson(2 / e)),
                **_simulated_novice(rng_novice, e),
            })
            t = 0
            for _ in range(int(rng.poisson(20))):
                t += int(rng.exponential(60_000))
                events.append({"participant_id": pid, "t_ms": t, "event": "step", "detail": json.dumps({"granularity": "layer", "direction": 1})})
        for prompt in ("helped", "confusing", "suggestions"):
            fb.append({"participant_id": pid, "prompt": prompt, "text": f"[simulated {prompt} response]"})

    return {
        "participants": pd.DataFrame(rows), "responses_long": pd.DataFrame(resp), "sus": pd.DataFrame(sus),
        "tlx": pd.DataFrame(tlx), "telemetry": pd.DataFrame(tel), "telemetry_events": pd.DataFrame(events),
        "feedback": pd.DataFrame(fb),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--n", type=int, required=True, help="target number of completing participants")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--design", choices=["three_condition", "two_condition"], default="three_condition")
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)
    for name, df in simulate(a.n, a.seed, a.design).items():
        df.to_csv(a.out / f"{name}.csv", index=False)
    (a.out / "SIMULATED").write_text("Synthetic data generated by analysis/simulate.py. Not real participants.\n")
    print(f"wrote simulated export to {a.out}")


if __name__ == "__main__":
    main()
