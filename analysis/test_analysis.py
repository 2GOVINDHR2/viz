"""Hand-worked checks of the statistics pipeline (run: python3 -m unittest analysis/test_analysis.py).

Every expected value below was computed by hand (working shown in comments),
not by calling the function under test.
"""
from __future__ import annotations

import math
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.formula.api as smf
from statsmodels.stats.anova import anova_lm

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import importlib.util  # noqa: E402

import simulate  # noqa: E402
import stats as S  # noqa: E402

# Loaded by path: the bare name "analysis" would resolve to this directory when run from the repo root.
_spec = importlib.util.spec_from_file_location("dlv_analysis", HERE / "analysis.py")
A = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(A)


class SUS(unittest.TestCase):
    def frame(self, *rows):
        return pd.DataFrame([dict(zip(S.SUS_ITEMS, r)) for r in rows])

    def test_polarity_reversal(self):
        # All neutral (3): odd items 3−1 = 2, even items 5−3 = 2 → 10 × 2 × 2.5 = 50.
        # Best possible: odd 5 → 4, even 1 → 4 → 40 × 2.5 = 100. Worst: odd 1 → 0, even 5 → 0 → 0.
        # Agree with everything (all 5): odd 4 × 5 = 20, even 0 → 50 (acquiescence does not inflate the score).
        # Brooke-style example (4,2,4,2,…): every item contributes 3 → 30 × 2.5 = 75.
        df = self.frame([3] * 10, [5, 1] * 5, [1, 5] * 5, [5] * 10, [4, 2] * 5)
        self.assertEqual(S.sus_score(df).tolist(), [50.0, 100.0, 0.0, 50.0, 75.0])

    def test_grade_and_adjective(self):
        self.assertEqual(S.sus_grade(85), "A+")
        self.assertEqual(S.sus_grade(68), "C")
        # Adjectives are nearest Bangor anchors (means), not bands: 80 is nearer Excellent (85.5) than Good (71.4),
        # although a lower-bound reading would call it "Good".
        self.assertEqual(S.sus_adjective(72), "Good")
        self.assertEqual(S.sus_adjective(80), "Excellent")
        self.assertEqual(S.sus_adjective(40), "Poor")
        self.assertEqual(S.sus_adjective(25), "Awful")
        self.assertEqual(S.sus_adjective(60), "OK")  # 60 − 50.9 = 9.1 < 71.4 − 60 = 11.4
        self.assertEqual(S.sus_adjective(95), "Best imaginable")
        self.assertEqual([a for _, a in S.SUS_ADJECTIVE_ANCHORS],
                         ["Worst imaginable", "Awful", "Poor", "OK", "Good", "Excellent", "Best imaginable"])


class EffectSizes(unittest.TestCase):
    def test_partial_eta_squared_uses_effect_plus_error_denominator(self):
        # One-way: A = [1,2,3], B = [4,5,6]; grand mean 3.5.
        # SS_between = 3(2−3.5)² + 3(5−3.5)² = 13.5; SS_within = 2 + 2 = 4 → η²ₚ = 13.5/17.5.
        self.assertAlmostEqual(S.partial_eta_squared(13.5, 4.0), 13.5 / 17.5, places=12)

    def test_ancova_condition_ss_is_adjusted_for_the_covariate(self):
        # The condition SS in the ANCOVA must equal the drop in residual SS when condition
        # is added to a model that already contains the pre-test (computed here by least squares).
        rng = np.random.default_rng(3)
        n = 30
        df = pd.DataFrame({"condition": np.repeat(["C1", "C2", "C3"], n // 3), "pre": rng.normal(50, 10, n)})
        df["post"] = 10 + 0.8 * df.pre + df.condition.map({"C1": 0, "C2": 3, "C3": 8}) + rng.normal(0, 5, n)
        X0 = np.column_stack([np.ones(n), df.pre])
        X1 = np.column_stack([X0, df.condition == "C2", df.condition == "C3"]).astype(float)
        rss = lambda X: float(np.sum((df.post - X @ np.linalg.lstsq(X, df.post, rcond=None)[0]) ** 2))  # noqa: E731
        ss_cond, ss_err = rss(X0) - rss(X1), rss(X1)
        tab = anova_lm(smf.ols("post ~ C(condition) + pre", data=df).fit(), typ=2)
        self.assertAlmostEqual(tab.loc["C(condition)", "sum_sq"], ss_cond, places=8)
        self.assertAlmostEqual(tab.loc["Residual", "sum_sq"], ss_err, places=8)
        # Partial η² differs from classical η² = SS_cond / SS_total whenever the covariate explains variance.
        ss_total = float(np.sum((df.post - df.post.mean()) ** 2))
        self.assertGreater(S.partial_eta_squared(ss_cond, ss_err), ss_cond / ss_total)

    def test_hedges_g(self):
        # x = [1,2,3], y = [4,5,6]: s_p = 1, d = −3, J = 1 − 3/(4·6 − 9) = 0.8 → g = −2.4.
        g, lo, hi = S.hedges_g(np.array([1, 2, 3]), np.array([4, 5, 6]))
        self.assertAlmostEqual(g, -2.4, places=12)
        self.assertLess(lo, g)
        self.assertGreater(hi, g)

    def test_dz(self):
        # diffs = [1,2,3]: mean 2, sd 1 → d_z = 2.
        dz, lo, hi = S.cohens_dz(np.array([0, 0, 0]), np.array([1, 2, 3]))
        self.assertAlmostEqual(dz, 2.0, places=12)
        self.assertTrue(lo < 2 < hi)

    def test_eta_ci_lower_bound_is_zero_for_a_non_significant_f(self):
        # F(2, 57) = 0.5 is below the critical value, so the CI's lower bound is 0 and the upper bound positive.
        lo, hi = S.partial_eta_squared_ci(0.5, 2, 57, 60)
        self.assertEqual(lo, 0.0)
        self.assertGreater(hi, 0.0)
        # A large F excludes zero.
        lo, _ = S.partial_eta_squared_ci(12.0, 2, 57, 60)
        self.assertGreater(lo, 0.0)


class StrictJson(unittest.TestCase):
    def test_results_are_strict_json(self):
        import json
        o = {"a": float("nan"), "b": [np.float64("inf"), np.bool_(True), np.int64(3)], "c": (1.5, None)}
        self.assertEqual(json.loads(json.dumps(A._finite(o), allow_nan=False)), {"a": None, "b": [None, True, 3], "c": [1.5, None]})


class Reliability(unittest.TestCase):
    def test_cronbach_alpha_worked_example(self):
        # Items (columns): variances 1.6667, 1.5833, 1.6667 → Σ = 4.9167.
        # Totals [8,10,14,5]: variance 14.25. α = 3/2 · (1 − 4.9167/14.25) = 0.98246.
        X = np.array([[2, 3, 3], [3, 3, 4], [4, 5, 5], [1, 2, 2]])
        self.assertAlmostEqual(S.cronbach_alpha(X), 1.5 * (1 - (5 / 3 + 19 / 12 + 5 / 3) / 14.25), places=10)

    def test_alpha_is_one_for_identical_items(self):
        X = np.array([[1, 1], [2, 2], [4, 4]])
        self.assertAlmostEqual(S.cronbach_alpha(X), 1.0, places=12)


class Corrections(unittest.TestCase):
    def test_holm(self):
        # Sorted: .01×3 = .03; .03×2 = .06; .04×1 = .04 → monotone max .06.
        self.assertEqual([round(p, 10) for p in S.holm([0.01, 0.04, 0.03])], [0.03, 0.06, 0.06])

    def test_dunn_worked_example(self):
        # Ranks 1..6; mean ranks 2 and 5; SE = √(6·7/12 · (1/3 + 1/3)) = √(7/3); z = −3/√(7/3).
        d = S.dunn(np.array([1, 2, 3, 4, 5, 6]), np.array(list("aaabbb")))
        self.assertAlmostEqual(d.z.iloc[0], -3 / math.sqrt(7 / 3), places=10)

    def test_normalized_gain(self):
        self.assertAlmostEqual(S.normalized_gain(40, 70), 0.5)
        self.assertTrue(math.isnan(S.normalized_gain(100, 100)))

    def test_apa_p(self):
        self.assertEqual(S.fmt_p(0.0004), "< .001")
        self.assertEqual(S.fmt_p(0.0421), "= .042")
        self.assertEqual(S.fmt_pv(0.5), ".500")
        self.assertEqual(S.fmt_r(0.147), ".147")


class MatchedScale(unittest.TestCase):
    """Pre/post comparisons use only the 20 items administered in both tests; transfer items are separate."""

    def test_matched_scale_is_the_twenty_administered_core_items(self):
        self.assertEqual(len(A.MATCHED), 20)
        self.assertEqual(len(A.TRANSFER), 4)
        self.assertFalse(set(A.MATCHED) & set(A.TRANSFER))
        self.assertNotIn("CI18", A.MATCHED)

    def test_transfer_answers_never_enter_pre_post_scores(self):
        rows = []
        for phase in ("pre", "post"):
            for k in A.MATCHED:
                rows.append(dict(participant_id="P-1", phase=phase, item_id=k, correct=0, transfer=0))
        for k in A.TRANSFER:
            rows.append(dict(participant_id="P-1", phase="post", item_id=k, correct=1, transfer=1))
        # A response to a non-matched core item (e.g. from an older form) must not count either.
        rows.append(dict(participant_id="P-1", phase="post", item_id="CI99", correct=1, transfer=0))
        participants = pd.DataFrame([dict(participant_id="P-1", condition="C1", familiarity=2, prior_ml_course=0,
                                          stratum="low", completed=1, withdrawn=0)])
        s = A.score(pd.DataFrame(rows), participants)
        self.assertEqual((s.pre[0], s.post[0], s.transfer[0]), (0.0, 0.0, 100.0))

    def test_simulated_exports_use_identical_item_sets_pre_and_post(self):
        d = simulate.simulate(30, 7)
        r = d["responses_long"]
        pre = set(r[(r.phase == "pre")].item_id)
        post_core = set(r[(r.phase == "post") & (r.transfer == 0)].item_id)
        self.assertEqual(pre, set(A.MATCHED))
        self.assertEqual(post_core, set(A.MATCHED))
        self.assertEqual(set(r[r.transfer == 1].item_id), set(A.TRANSFER))


class Selection(unittest.TestCase):
    def test_assumption_failure_selects_the_nonparametric_test_before_testing(self):
        # Wildly unequal residual spread across conditions must flip the primary analysis.
        rng = np.random.default_rng(1)
        n = 90
        cond = np.repeat(["C1", "C2", "C3"], n // 3)
        pre = rng.normal(50, 10, n)
        noise = rng.normal(0, 1, n) * np.select([cond == "C1", cond == "C2"], [1, 2], 25)
        df = pd.DataFrame({"condition": cond, "pre": pre, "post": 20 + 0.6 * pre + noise})
        checks, _ = A.assumptions(df)
        self.assertLess(checks.levene_p, 0.05)
        self.assertFalse(checks.parametric_ok)

    def test_full_pipeline_on_simulated_data_produces_every_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            data, out = Path(tmp) / "d", Path(tmp) / "o"
            data.mkdir()
            for name, df in simulate.simulate(45, 5).items():
                df.to_csv(data / f"{name}.csv", index=False)
            (data / "SIMULATED").write_text("x")
            res = A.run(data, out)
            tables = sorted(p.name for p in (out / "tables").glob("*.csv"))
            figs = sorted(p.name for p in (out / "figures").glob("*.pdf"))
            self.assertEqual(len(tables), 17)  # T01–T16 plus the exploratory per-concept appendix T17
            self.assertEqual(len(figs), 6)
            self.assertTrue(res["simulated"])
            self.assertIn(A.WATERMARK, (out / "report.md").read_text())
            for tex in (out / "tables").glob("*.tex"):
                self.assertIn("ILLUSTRATIVE", tex.read_text())

    def test_two_condition_fallback_design(self):
        with tempfile.TemporaryDirectory() as tmp:
            data, out = Path(tmp) / "d", Path(tmp) / "o"
            data.mkdir()
            for name, df in simulate.simulate(40, 9, "two_condition").items():
                df.to_csv(data / f"{name}.csv", index=False)
            res = A.run(data, out)
            self.assertEqual(res["design"]["conditions"], ["C1", "C3"])
            self.assertFalse(res["simulated"])  # no SIMULATED marker written here → no watermark
            self.assertEqual(len(res["pairwise"]), 1)


if __name__ == "__main__":
    unittest.main()
