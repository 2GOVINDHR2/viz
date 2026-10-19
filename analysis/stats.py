"""Statistical building blocks for the DL-VizLab study analysis.

Each function is small, pure and covered by analysis/test_analysis.py, which
checks it against worked examples computed by hand.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy import optimize, stats

# --------------------------------------------------------------------------- formatting (APA 7)


def fmt_p(p: float) -> str:
    """APA p-value: no leading zero, three decimals, '< .001' below that."""
    if p is None or (isinstance(p, float) and math.isnan(p)):
        return "—"
    if p < 0.001:
        return "< .001"
    return "= " + f"{p:.3f}".lstrip("0")


def fmt_pv(p: float) -> str:
    """p-value for a table cell: '.042', '< .001'."""
    return fmt_p(p).removeprefix("= ")


def fmt_r(x: float, digits: int = 3) -> str:
    """Statistics bounded by 1 (r, η², α, power) have no leading zero in APA style."""
    s = f"{x:.{digits}f}"
    return s.replace("0.", ".", 1) if abs(x) < 1 else s


def fmt(x: float, digits: int = 2) -> str:
    return "—" if x is None or (isinstance(x, float) and math.isnan(x)) else f"{x:.{digits}f}"


# --------------------------------------------------------------------------- scoring


SUS_ITEMS = [f"sus{q:02d}" for q in range(1, 11)]


def sus_recode(df: pd.DataFrame) -> pd.DataFrame:
    """Contribution of each item (0–4): odd (positive) items score − 1, even (negative) items 5 − score."""
    out = pd.DataFrame(index=df.index)
    for q, col in enumerate(SUS_ITEMS, start=1):
        out[col] = df[col] - 1 if q % 2 == 1 else 5 - df[col]
    return out


def sus_score(df: pd.DataFrame) -> pd.Series:
    """SUS score 0–100 (Brooke, 1996): sum of recoded contributions × 2.5."""
    return sus_recode(df).sum(axis=1) * 2.5


# Curved grading scale: Sauro, J. & Lewis, J. R. (2016). Quantifying the User Experience (2nd ed.), Morgan Kaufmann,
# ch. 8 (the Sauro–Lewis curved grading scale). The cut-offs below match the published reproduction of that table
# (A+ 84.1–100 … D 51.7–62.6, F 0–51.6); the book itself has not been checked page by page (Fix Round 1, A6).
# Adjective anchors: Bangor, A., Kortum, P. & Miller, J. (2009). Determining what individual SUS scores mean: adding
# an adjective rating scale. Journal of Usability Studies 4(3), 114–123. The paper reports the MEAN SUS score of
# products given each adjective, not boundaries; using those means as lower cut-offs (below) is an interpretive
# convention, and the 'Awful' anchor is omitted. Both points are reported with Table 11 (DATA-DICTIONARY).
SUS_GRADES = [(84.1, "A+"), (80.8, "A"), (78.9, "A−"), (77.2, "B+"), (74.1, "B"), (72.6, "B−"), (71.1, "C+"), (65.0, "C"), (62.7, "C−"), (51.7, "D"), (0.0, "F")]
SUS_ADJECTIVES = [(90.9, "Best imaginable"), (85.5, "Excellent"), (71.4, "Good"), (50.9, "OK"), (35.7, "Poor"), (0.0, "Worst imaginable")]


def sus_grade(score: float) -> str:
    return next(g for t, g in SUS_GRADES if score >= t)


def sus_adjective(score: float) -> str:
    return next(a for t, a in SUS_ADJECTIVES if score >= t)


def normalized_gain(pre: float, post: float) -> float:
    """Hake's normalised gain for one learner, in percentage points: (post − pre)/(100 − pre). Undefined at pre = 100."""
    return float("nan") if pre >= 100 else (post - pre) / (100 - pre)


def class_gain(pre_mean: float, post_mean: float) -> float:
    """Class-average normalised gain ⟨g⟩ computed from group means (Hake, 1998)."""
    return normalized_gain(pre_mean, post_mean)


# --------------------------------------------------------------------------- reliability


def cronbach_alpha(items: np.ndarray) -> float:
    """α = k/(k−1) · (1 − Σ var(item) / var(total)), sample variances (ddof = 1). Rows = respondents."""
    x = np.asarray(items, dtype=float)
    k = x.shape[1]
    item_var = x.var(axis=0, ddof=1).sum()
    total_var = x.sum(axis=1).var(ddof=1)
    return float("nan") if total_var == 0 else k / (k - 1) * (1 - item_var / total_var)


def alpha_ci(alpha: float, n: int, k: int, level: float = 0.95) -> tuple[float, float]:
    """Feldt (1965) confidence interval for Cronbach's α."""
    df1, df2 = n - 1, (n - 1) * (k - 1)
    lo = 1 - (1 - alpha) * stats.f.ppf((1 + level) / 2, df1, df2)
    hi = 1 - (1 - alpha) * stats.f.ppf((1 - level) / 2, df1, df2)
    return lo, hi


# --------------------------------------------------------------------------- effect sizes


def hedges_g(x: np.ndarray, y: np.ndarray) -> tuple[float, float, float]:
    """Hedges' g for two independent groups with a 95% CI (normal approximation to the SE of d)."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    n1, n2 = len(x), len(y)
    sp = math.sqrt(((n1 - 1) * x.var(ddof=1) + (n2 - 1) * y.var(ddof=1)) / (n1 + n2 - 2))
    d = (x.mean() - y.mean()) / sp
    j = 1 - 3 / (4 * (n1 + n2) - 9)
    g = j * d
    se = math.sqrt((n1 + n2) / (n1 * n2) + g**2 / (2 * (n1 + n2)))
    return g, g - 1.96 * se, g + 1.96 * se


def cohens_dz(pre: np.ndarray, post: np.ndarray) -> tuple[float, float, float]:
    """Paired-samples effect size d_z = mean(diff)/sd(diff), with a 95% CI from the noncentral t."""
    diff = np.asarray(post, float) - np.asarray(pre, float)
    n = len(diff)
    dz = diff.mean() / diff.std(ddof=1)
    t = dz * math.sqrt(n)
    lo, hi = noncentral_t_ci(t, n - 1)
    return dz, lo / math.sqrt(n), hi / math.sqrt(n)


def noncentral_t_ci(t: float, df: int, level: float = 0.95) -> tuple[float, float]:
    """CI for the noncentrality parameter of an observed t by inverting the noncentral t CDF."""
    a = (1 - level) / 2

    def cdf(nc: float) -> float:
        # scipy's noncentral t can return NaN far in the tails; there the CDF is 1 (nc ≪ t) or 0 (nc ≫ t).
        v = stats.nct.cdf(t, df, nc)
        return (1.0 if nc < t else 0.0) if math.isnan(v) else v

    def solve(target: float) -> float:
        f = lambda nc: cdf(nc) - target  # noqa: E731
        lo, hi = t - 10, t + 10
        while f(lo) < 0:
            lo -= 10
        while f(hi) > 0:
            hi += 10
        return optimize.brentq(f, lo, hi)

    return solve(1 - a), solve(a)


def partial_eta_squared(ss_effect: float, ss_error: float) -> float:
    return ss_effect / (ss_effect + ss_error)


def partial_eta_squared_ci(f: float, df1: int, df2: int, n_total: int, level: float = 0.95) -> tuple[float, float]:
    """CI for partial η² by inverting the noncentral F (Steiger, 2004): for each CI bound on λ, η² = λ/(λ + N)."""
    a = (1 - level) / 2

    def lam(target: float) -> float:
        g = lambda nc: stats.ncf.cdf(f, df1, df2, nc) - target  # noqa: E731
        if g(0) < 0:
            return 0.0
        hi = 10.0
        while g(hi) > 0:
            hi *= 2
        return optimize.brentq(g, 0, hi)

    lo_l, hi_l = lam(1 - a), lam(a)
    return lo_l / (lo_l + n_total), hi_l / (hi_l + n_total)


# --------------------------------------------------------------------------- tests


def holm(pvals: list[float]) -> list[float]:
    """Holm–Bonferroni step-down adjusted p-values (monotone, capped at 1)."""
    m = len(pvals)
    order = np.argsort(pvals)
    adj = np.empty(m)
    running = 0.0
    for rank, i in enumerate(order):
        running = max(running, (m - rank) * pvals[i])
        adj[i] = min(1.0, running)
    return adj.tolist()


def dunn(values: np.ndarray, groups: np.ndarray) -> pd.DataFrame:
    """Dunn's (1964) pairwise rank test with tie correction; Holm-adjusted p-values; effect r = z/√N."""
    values = np.asarray(values, float)
    groups = np.asarray(groups)
    n = len(values)
    ranks = stats.rankdata(values)
    _, counts = np.unique(values, return_counts=True)
    tie = (counts**3 - counts).sum() / (12 * (n - 1))
    labels = sorted(set(groups))
    rows = []
    for i, a in enumerate(labels):
        for b in labels[i + 1 :]:
            ra, rb = ranks[groups == a], ranks[groups == b]
            se = math.sqrt((n * (n + 1) / 12 - tie) * (1 / len(ra) + 1 / len(rb)))
            z = (ra.mean() - rb.mean()) / se
            rows.append(dict(a=a, b=b, z=z, p=2 * stats.norm.sf(abs(z)), r=z / math.sqrt(n)))
    df = pd.DataFrame(rows)
    df["p_holm"] = holm(df["p"].tolist())
    return df


@dataclass
class AssumptionChecks:
    shapiro_w: float
    shapiro_p: float
    levene_f: float
    levene_p: float
    slopes_f: float
    slopes_p: float
    slopes_df: tuple[int, int]

    @property
    def parametric_ok(self) -> bool:
        return self.shapiro_p >= 0.05 and self.levene_p >= 0.05 and self.slopes_p >= 0.05

    def reasons(self) -> list[str]:
        r = []
        if self.shapiro_p < 0.05:
            r.append("ANCOVA residuals are not normally distributed (Shapiro–Wilk)")
        if self.levene_p < 0.05:
            r.append("residual variances differ between conditions (Levene)")
        if self.slopes_p < 0.05:
            r.append("the pre-test slope differs between conditions (homogeneity of regression slopes)")
        return r
