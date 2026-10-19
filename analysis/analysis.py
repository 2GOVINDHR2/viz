#!/usr/bin/env python3
"""DL-VizLab study analysis pipeline.

Reads a Study Mode export (docs/DATA-DICTIONARY.md) and writes every table and
figure the paper's results section needs to an output directory:

    tables/T*.csv, tables/T*.tex     publication tables (tidy CSV + booktabs LaTeX)
    figures/F*.pdf, figures/F*.svg   vector figures, embedded fonts, greyscale-safe
    results.json                     every number, for traceability
    report.md                        all tables with captions, in reporting order

The primary test is selected *before* it is run, from the assumption checks:
one-way ANCOVA (post-test, pre-test covariate) when residual normality,
homogeneity of variance and homogeneity of regression slopes all hold;
otherwise Kruskal–Wallis on gain scores with Dunn's Holm-corrected pairwise
tests. The selection and its reasons are reported either way, and the other
analysis is reported as a sensitivity check.

If the input directory contains a file named SIMULATED, every table caption and
figure is watermarked "ILLUSTRATIVE — simulated data, pipeline validation only."

Usage: python3 analysis/analysis.py <export_dir> <output_dir> [--png]
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
import statsmodels.formula.api as smf  # noqa: E402
from scipy import stats  # noqa: E402
from statsmodels.stats.anova import anova_lm  # noqa: E402
from statsmodels.stats.power import FTestAnovaPower, TTestIndPower  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
import stats as S  # noqa: E402

INVENTORY = json.loads((Path(__file__).resolve().parents[1] / "src/study/config/concept-inventory.json").read_text())
ITEMS = {i["id"]: i for i in INVENTORY["items"] + INVENTORY["transfer_items"]}
# Retired items are neither administered nor scored; responses to them (from older exports) are dropped.
RETIRED = {k for k, i in ITEMS.items() if i.get("retired")}
CLUSTERS = list(INVENTORY["clusters"])
# The matched scale: the administered core items, identical in pre- and post-test. Pre, post, gains, the ANCOVA and
# Cronbach's α use only these. Transfer items are post-test only and are analysed separately.
MATCHED = sorted(i["id"] for i in INVENTORY["items"] if not i.get("retired"))
TRANSFER = sorted(i["id"] for i in INVENTORY["transfer_items"] if not i.get("retired"))
WATERMARK = "ILLUSTRATIVE — simulated data, pipeline validation only."
COND_LABEL = {"C1": "C1 Control", "C2": "C2 Baseline", "C3": "C3 DL-VizLab"}
MARKERS = {"C1": "o", "C2": "s", "C3": "^"}
GREYS = {"C1": "0.85", "C2": "0.6", "C3": "0.3"}
HATCH = {"C1": "", "C2": "//", "C3": "xx"}

plt.rcParams.update({
    "pdf.fonttype": 42, "ps.fonttype": 42, "svg.fonttype": "path", "font.family": "DejaVu Sans", "font.size": 9,
    "axes.spines.top": False, "axes.spines.right": False, "savefig.bbox": "tight", "figure.dpi": 150,
    # Byte-stable output, so regenerated figures only differ when their content does.
    "svg.hashsalt": "dl-vizlab",
})
NO_DATE = {"pdf": {"CreationDate": None}, "svg": {"Date": None}, "png": {}}


# =============================================================================== I/O


class Report:
    """Collects tables, figures and numbers; writes them all at the end."""

    def __init__(self, out: Path, simulated: bool, png: bool = False):
        self.png = png
        self.out = out
        self.simulated = simulated
        self.results: dict = {"simulated": simulated}
        self.sections: list[str] = []
        (out / "tables").mkdir(parents=True, exist_ok=True)
        (out / "figures").mkdir(parents=True, exist_ok=True)

    def caption(self, text: str) -> str:
        return f"{text} {WATERMARK}" if self.simulated else text

    def table(self, tid: str, title: str, df: pd.DataFrame, note: str = "") -> None:
        cap = self.caption(title)
        df.to_csv(self.out / "tables" / f"{tid}.csv", index=False)
        (self.out / "tables" / f"{tid}.tex").write_text(to_latex(df, cap, tid, note))
        md = f"**Table {int(tid[1:])}.** {cap}\n\n{to_markdown(df)}\n"
        if note:
            md += f"\n*Note.* {note}\n"
        self.sections.append(md)

    def figure(self, fid: str, title: str, fig: plt.Figure) -> None:
        cap = self.caption(title)
        if self.simulated:
            fig.text(0.5, 0.5, "ILLUSTRATIVE — SIMULATED", fontsize=22, color="0.75", alpha=0.35, ha="center", va="center", rotation=25, zorder=0)
        for ext in ("pdf", "svg", *(("png",) if self.png else ())):
            fig.savefig(self.out / "figures" / f"{fid}.{ext}", metadata=NO_DATE[ext])
        plt.close(fig)
        self.sections.append(f"**Figure {int(fid[1:])}.** {cap} (`figures/{fid}.pdf`, `figures/{fid}.svg`)\n")

    def text(self, md: str) -> None:
        self.sections.append(md)

    def write(self) -> None:
        (self.out / "results.json").write_text(json.dumps(_finite(self.results), indent=2, default=_json_default, allow_nan=False) + "\n")
        head = f"# Analysis report\n\n{'> ' + WATERMARK if self.simulated else ''}\n\n"
        (self.out / "report.md").write_text(head + "\n".join(self.sections))


def _finite(o):
    """Strict JSON: NaN and ±inf (e.g. a statistic undefined for a tiny group) become null.

    Floats keep 12 significant digits: least-squares results differ in the last
    bits between BLAS builds, and the file must be byte-stable across machines
    (CI regenerates it and fails on any change)."""
    if isinstance(o, dict):
        return {k: _finite(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_finite(v) for v in o]
    if isinstance(o, (float, np.floating)):
        return float(f"{float(o):.12g}") if math.isfinite(o) else None
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, np.bool_):
        return bool(o)
    return o


def _json_default(o):
    if isinstance(o, np.bool_):
        return bool(o)
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return None if math.isnan(o) else float(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    if isinstance(o, tuple):
        return list(o)
    raise TypeError(type(o))


def _latex_escape(s: str) -> str:
    return (str(s).replace("\\", "\\textbackslash{}").replace("&", "\\&").replace("%", "\\%").replace("_", "\\_")
            .replace("#", "\\#").replace("η²ₚ", "$\\eta^2_p$").replace("χ²", "$\\chi^2$").replace("ε²", "$\\varepsilon^2$")
            .replace("⟨g⟩", "$\\langle g\\rangle$").replace("ρ", "$\\rho$").replace("α", "$\\alpha$").replace("−", "--")
            .replace("≥", "$\\geq$").replace("<", "$<$").replace("×", "$\\times$").replace("Δ", "$\\Delta$"))


def to_latex(df: pd.DataFrame, caption: str, label: str, note: str = "") -> str:
    cols = "l" + "r" * (len(df.columns) - 1)
    lines = ["\\begin{table}[htbp]", "\\centering", "\\small", f"\\caption{{{_latex_escape(caption)}}}", f"\\label{{tab:{label}}}",
             f"\\begin{{tabular}}{{{cols}}}", "\\toprule", " & ".join(_latex_escape(c) for c in df.columns) + " \\\\", "\\midrule"]
    for _, row in df.iterrows():
        lines.append(" & ".join(_latex_escape(v) for v in row.values) + " \\\\")
    lines += ["\\bottomrule", "\\end{tabular}"]
    if note:
        lines.append(f"\\par\\smallskip\\footnotesize\\textit{{Note.}} {_latex_escape(note)}")
    lines.append("\\end{table}")
    return "\n".join(lines) + "\n"


def to_markdown(df: pd.DataFrame) -> str:
    head = "| " + " | ".join(map(str, df.columns)) + " |"
    sep = "|" + "|".join("---" for _ in df.columns) + "|"
    body = ["| " + " | ".join(str(v) for v in r) + " |" for r in df.itertuples(index=False)]
    return "\n".join([head, sep, *body])


def msd(x: pd.Series, d: int = 1) -> str:
    x = x.dropna()
    return "—" if len(x) == 0 else f"{x.mean():.{d}f} ({x.std(ddof=1):.{d}f})" if len(x) > 1 else f"{x.mean():.{d}f}"


# =============================================================================== data


def load(d: Path) -> dict[str, pd.DataFrame]:
    out = {}
    for name in ("participants", "responses_long", "sus", "tlx", "telemetry"):
        f = d / f"{name}.csv"
        out[name] = pd.read_csv(f) if f.exists() and f.stat().st_size > 1 else pd.DataFrame()
    r = out["responses_long"]
    if len(r):
        r = r[~r.item_id.isin(RETIRED)].copy()
        # The reporting cluster comes from the inventory, so exports need not carry it.
        r["cluster"] = r.item_id.map(lambda k: ITEMS[k]["cluster"])
        out["responses_long"] = r
    return out


def score(responses: pd.DataFrame, participants: pd.DataFrame) -> pd.DataFrame:
    """Per completing participant: pre and post percentages on the matched 20-item scale (the same items in both
    tests), the post-test-only transfer percentage, raw gain and normalised gain."""
    core = responses[responses.item_id.isin(MATCHED)]
    pct = core.groupby(["participant_id", "phase"]).correct.mean().unstack() * 100
    tr = responses[responses.item_id.isin(TRANSFER) & (responses.phase == "post")].groupby("participant_id").correct.mean() * 100
    done = participants[(participants.completed == 1) & (participants.withdrawn == 0)]
    df = done[["participant_id", "condition", "familiarity", "prior_ml_course", "stratum"]].merge(pct.reset_index(), on="participant_id")
    df["transfer"] = df.participant_id.map(tr)
    df["gain"] = df.post - df.pre
    df["ngain"] = [S.normalized_gain(a, b) for a, b in zip(df.pre, df.post)]
    return df.dropna(subset=["pre", "post"]).reset_index(drop=True)


# =============================================================================== analyses


def consort(R: Report, p: pd.DataFrame, scored: pd.DataFrame, conds: list[str]) -> None:
    flow = {"opened": len(p), "declined": int((p.consented == 0).sum()), "randomised": int(((p.consented == 1) & p.condition.notna() & (p.condition != "")).sum()), "arms": {}}
    for c in conds:
        a = p[p.condition == c]
        flow["arms"][c] = {"allocated": len(a), "withdrew": int(a.withdrawn.sum()), "incomplete": int(((a.completed == 0) & (a.withdrawn == 0)).sum()), "analysed": int((scored.condition == c).sum())}
    R.results["flow"] = flow

    fig, ax = plt.subplots(figsize=(6.4, 3.8))
    ax.axis("off")
    box = dict(boxstyle="square,pad=0.4", fc="white", ec="black", lw=0.8)
    ax.text(0.5, 0.95, f"Opened consent screen (n = {flow['opened']})", ha="center", va="top", bbox=box)
    ax.text(0.9, 0.82, f"Declined (n = {flow['declined']})", ha="center", va="center", bbox=box)
    ax.annotate("", xy=(0.78, 0.82), xytext=(0.5, 0.82), arrowprops=dict(arrowstyle="->", lw=0.8))
    ax.text(0.5, 0.72, f"Consented and randomised (n = {flow['randomised']})", ha="center", va="top", bbox=box)
    ax.annotate("", xy=(0.5, 0.74), xytext=(0.5, 0.88), arrowprops=dict(arrowstyle="->", lw=0.8))
    for k, c in enumerate(conds):
        x = (k + 0.5) / len(conds)
        a = flow["arms"][c]
        ax.annotate("", xy=(x, 0.52), xytext=(0.5, 0.62), arrowprops=dict(arrowstyle="->", lw=0.8))
        ax.text(x, 0.5, f"{COND_LABEL[c]}\nallocated n = {a['allocated']}", ha="center", va="top", bbox=box, fontsize=8)
        ax.text(x, 0.3, f"withdrew n = {a['withdrew']}\ndid not complete n = {a['incomplete']}", ha="center", va="top", fontsize=7.5)
        ax.text(x, 0.08, f"analysed n = {a['analysed']}", ha="center", va="top", bbox=box, fontsize=8)
    R.figure("F1", "Participant flow (CONSORT-style).", fig)


def characteristics(R: Report, p: pd.DataFrame, scored: pd.DataFrame, conds: list[str]) -> None:
    d = p[p.participant_id.isin(scored.participant_id)]
    rows = []
    rows.append(["n", *[str(int((d.condition == c).sum())) for c in conds], ""])
    groups = [d[d.condition == c] for c in conds]
    f_year = stats.f_oneway(*[g.year_of_study.dropna() for g in groups])
    rows.append(["Year of study, M (SD)", *[msd(g.year_of_study) for g in groups], f"F: {S.fmt_pv(f_year.pvalue)}"])
    ct = pd.crosstab(d.condition, d.prior_ml_course)
    chi = stats.chi2_contingency(ct) if ct.shape[1] > 1 else None
    rows.append(["Prior ML course, %", *[f"{100 * g.prior_ml_course.mean():.0f}" for g in groups], f"χ²: {S.fmt_pv(chi.pvalue)}" if chi else ""])
    ct2 = pd.crosstab(d.condition, d.programming_years)
    chi2 = stats.chi2_contingency(ct2)
    for lvl, lab in [("none", "none"), ("lt1", "< 1 year"), ("1to3", "1–3 years"), ("gt3", "> 3 years")]:
        rows.append([f"Programming: {lab}, %", *[f"{100 * (g.programming_years == lvl).mean():.0f}" for g in groups], f"χ²: {S.fmt_pv(chi2.pvalue)}" if lvl == "none" else ""])
    kw = stats.kruskal(*[g.familiarity for g in groups])
    rows.append(["Familiarity (1–5), M (SD)", *[msd(g.familiarity) for g in groups], f"H: {S.fmt_pv(kw.pvalue)}"])
    sc = [scored[scored.condition == c] for c in conds]
    f_pre = stats.f_oneway(*[g.pre for g in sc])
    rows.append(["Pre-test %, M (SD)", *[msd(g.pre) for g in sc], f"F: {S.fmt_pv(f_pre.pvalue)}"])
    R.results["baseline"] = {"year_p": f_year.pvalue, "prior_ml_p": chi.pvalue if chi else None, "programming_p": chi2.pvalue, "familiarity_p": kw.pvalue, "pre_F": f_pre.statistic, "pre_p": f_pre.pvalue}
    R.table("T01", "Participant characteristics by condition, with tests of baseline equivalence.", pd.DataFrame(rows, columns=["Characteristic", *[COND_LABEL[c] for c in conds], "Test p"]),
            "Analysed participants only. One-way ANOVA (F), χ² test of independence, Kruskal–Wallis (H).")


def descriptives(R: Report, scored: pd.DataFrame, conds: list[str]) -> None:
    rows = []
    for c in conds:
        g = scored[scored.condition == c]
        rows.append([COND_LABEL[c], len(g), msd(g.pre), f"{g.pre.median():.1f}", msd(g.post), f"{g.post.median():.1f}", msd(g.gain), msd(g.transfer)])
    R.results["descriptives"] = {c: {k: float(scored[scored.condition == c][k].mean()) for k in ("pre", "post", "gain", "transfer")} for c in conds}
    R.table("T02", "Concept-inventory scores (% correct) before and after the intervention.", pd.DataFrame(rows, columns=["Condition", "n", "Pre M (SD)", "Pre Mdn", "Post M (SD)", "Post Mdn", "Gain M (SD)", "Transfer M (SD)"]))


def assumptions(scored: pd.DataFrame) -> tuple[S.AssumptionChecks, object]:
    model = smf.ols("post ~ C(condition) + pre", data=scored).fit()
    resid = model.resid
    sw = stats.shapiro(resid)
    lev = stats.levene(*[resid[scored.condition == c] for c in sorted(scored.condition.unique())], center="mean")
    full = smf.ols("post ~ C(condition) * pre", data=scored).fit()
    cmp = anova_lm(model, full)
    checks = S.AssumptionChecks(sw.statistic, sw.pvalue, lev.statistic, lev.pvalue, float(cmp.F.iloc[1]), float(cmp["Pr(>F)"].iloc[1]),
                                (int(cmp.df_diff.iloc[1]), int(cmp.df_resid.iloc[1])))
    return checks, model


def report_assumptions(R: Report, a: S.AssumptionChecks) -> None:
    rows = [
        ["Normality of ANCOVA residuals", "Shapiro–Wilk", f"W = {a.shapiro_w:.3f}", S.fmt_pv(a.shapiro_p), "met" if a.shapiro_p >= 0.05 else "violated"],
        ["Homogeneity of variance", "Levene", f"F = {a.levene_f:.2f}", S.fmt_pv(a.levene_p), "met" if a.levene_p >= 0.05 else "violated"],
        ["Homogeneity of regression slopes", "condition × pre-test", f"F({a.slopes_df[0]}, {a.slopes_df[1]}) = {a.slopes_f:.2f}", S.fmt_pv(a.slopes_p), "met" if a.slopes_p >= 0.05 else "violated"],
    ]
    primary = "one-way ANCOVA" if a.parametric_ok else "Kruskal–Wallis on gain scores with Dunn's tests"
    R.results["assumptions"] = {**a.__dict__, "parametric_ok": a.parametric_ok, "primary": primary, "reasons": a.reasons()}
    note = f"Primary analysis selected from these checks before testing: {primary}."
    if a.reasons():
        note += " Reason: " + "; ".join(a.reasons()) + "."
    R.table("T03", "Assumption checks for the primary analysis.", pd.DataFrame(rows, columns=["Assumption", "Test", "Statistic", "p", "Verdict"]), note)


def design_rows(model, conds: list[str], pre: float) -> np.ndarray:
    """Design-matrix rows (one per condition) at a given pre-test value, built from the fitted model's column names."""
    names = model.model.exog_names
    X = np.zeros((len(conds), len(names)))
    for i, c in enumerate(conds):
        for j, n in enumerate(names):
            if n == "Intercept":
                X[i, j] = 1
            elif n == "pre":
                X[i, j] = pre
            elif n == f"C(condition)[T.{c}]":
                X[i, j] = 1
    return X


def ancova(R: Report, scored: pd.DataFrame, model, conds: list[str], primary: bool) -> None:
    tab = anova_lm(model, typ=2)
    ss_c, ss_e = tab.loc["C(condition)", "sum_sq"], tab.loc["Residual", "sum_sq"]
    df1, df2 = int(tab.loc["C(condition)", "df"]), int(tab.loc["Residual", "df"])
    F, p = tab.loc["C(condition)", "F"], tab.loc["C(condition)", "PR(>F)"]
    eta = S.partial_eta_squared(ss_c, ss_e)
    lo, hi = S.partial_eta_squared_ci(F, df1, df2, len(scored))
    eta_pre = S.partial_eta_squared(tab.loc["pre", "sum_sq"], ss_e)
    rows = [
        ["Pre-test (covariate)", f"{tab.loc['pre', 'sum_sq']:.1f}", int(tab.loc["pre", "df"]), f"{tab.loc['pre', 'sum_sq'] / tab.loc['pre', 'df']:.1f}", f"{tab.loc['pre', 'F']:.2f}", S.fmt_pv(tab.loc["pre", "PR(>F)"]), S.fmt_r(eta_pre)],
        ["Condition", f"{ss_c:.1f}", df1, f"{ss_c / df1:.1f}", f"{F:.2f}", S.fmt_pv(p), f"{S.fmt_r(eta)} [{S.fmt_r(lo)}, {S.fmt_r(hi)}]"],
        ["Residual", f"{ss_e:.1f}", df2, f"{ss_e / df2:.1f}", "", "", ""],
    ]
    apa = f"F({df1}, {df2}) = {F:.2f}, p {S.fmt_p(p)}, η²ₚ = {S.fmt_r(eta)}, 95% CI [{S.fmt_r(lo)}, {S.fmt_r(hi)}]"
    R.results["ancova"] = {"F": F, "df1": df1, "df2": df2, "p": p, "partial_eta_sq": eta, "eta_ci": [lo, hi], "apa": apa, "primary": primary}
    R.table("T04", f"One-way ANCOVA on post-test score with pre-test as covariate{' (primary analysis)' if primary else ' (sensitivity analysis; assumptions not met)'}.",
            pd.DataFrame(rows, columns=["Source", "SS", "df", "MS", "F", "p", "η²ₚ [95% CI]"]), f"Type II sums of squares. {apa}.")

    # Estimated marginal means at the grand-mean pre-test score.
    X = design_rows(model, conds, scored.pre.mean())
    beta, V = model.params.values, model.cov_params().values
    emm = X @ beta
    se = np.sqrt(np.einsum("ij,jk,ik->i", X, V, X))
    tcrit = stats.t.ppf(0.975, model.df_resid)
    rows = [[COND_LABEL[c], f"{m:.2f}", f"{s:.2f}", f"[{m - tcrit * s:.2f}, {m + tcrit * s:.2f}]"] for c, m, s in zip(conds, emm, se)]
    R.results["emm"] = {c: {"mean": m, "se": s, "ci": [m - tcrit * s, m + tcrit * s]} for c, m, s in zip(conds, emm, se)}
    R.table("T05", f"Estimated marginal means of post-test score (%), adjusted to the mean pre-test score ({scored.pre.mean():.1f}%).",
            pd.DataFrame(rows, columns=["Condition", "EMM", "SE", "95% CI"]))

    # Pairwise contrasts of EMMs, Holm-corrected, with adjusted Hedges' g.
    sd_post = math.sqrt(sum((len(g) - 1) * g.post.var(ddof=1) for _, g in scored.groupby("condition")) / (len(scored) - len(conds)))
    rows, raw = [], []
    pairs = [(a, b) for i, a in enumerate(conds) for b in conds[i + 1:]]
    for a, b in pairs:
        ia, ib = conds.index(a), conds.index(b)
        c = X[ib] - X[ia]
        diff = float(c @ beta)
        s = float(np.sqrt(c @ V @ c))
        t = diff / s
        raw.append(2 * stats.t.sf(abs(t), model.df_resid))
        na, nb = (scored.condition == a).sum(), (scored.condition == b).sum()
        j = 1 - 3 / (4 * (na + nb) - 9)
        g = j * diff / sd_post
        gse = math.sqrt((na + nb) / (na * nb) + g**2 / (2 * (na + nb)))
        rows.append([f"{COND_LABEL[b]} − {COND_LABEL[a]}", f"{diff:.2f}", f"{s:.2f}", f"t({int(model.df_resid)}) = {t:.2f}", None, f"{g:.2f} [{g - 1.96 * gse:.2f}, {g + 1.96 * gse:.2f}]"])
    adj = S.holm(raw)
    for r, p_raw, p_adj in zip(rows, raw, adj):
        r[4] = S.fmt_pv(p_adj)
    R.results["pairwise"] = [{"contrast": r[0], "diff": float(r[1]), "p": p_raw, "p_holm": pa, "g": r[5]} for r, p_raw, pa in zip(rows, raw, adj)]
    R.table("T06", "Pairwise comparisons of adjusted post-test means.", pd.DataFrame(rows, columns=["Contrast", "Δ adjusted", "SE", "t", "p (Holm)", "Hedges' g [95% CI]"]),
            "Hedges' g uses the pooled within-condition SD of the post-test.")


def nonparametric(R: Report, scored: pd.DataFrame, conds: list[str], primary: bool) -> None:
    groups = [scored[scored.condition == c].gain for c in conds]
    h = stats.kruskal(*groups)
    n = len(scored)
    eps2 = h.statistic / (n - 1)
    dn = S.dunn(scored.gain.values, scored.condition.values)
    apa = f"H({len(conds) - 1}) = {h.statistic:.2f}, p {S.fmt_p(h.pvalue)}, ε² = {S.fmt_r(eps2)}"
    R.results["kruskal"] = {"H": h.statistic, "df": len(conds) - 1, "p": h.pvalue, "epsilon_sq": eps2, "apa": apa, "primary": primary,
                            "dunn": dn.to_dict(orient="records")}
    rows = [[f"{COND_LABEL[r.b]} vs {COND_LABEL[r.a]}", f"{-r.z:.2f}", S.fmt_pv(r.p), S.fmt_pv(r.p_holm), f"{-r.r:.2f}"] for r in dn.itertuples()]
    R.table("T07", f"Kruskal–Wallis test on gain scores with Dunn's pairwise tests{' (primary analysis)' if primary else ' (sensitivity analysis)'}.",
            pd.DataFrame(rows, columns=["Comparison", "z", "p", "p (Holm)", "r"]), f"{apa}. Positive z: the first-named condition gained more.")


def within(R: Report, scored: pd.DataFrame, conds: list[str]) -> None:
    rows, res = [], {}
    for c in conds:
        g = scored[scored.condition == c]
        t = stats.ttest_rel(g.post, g.pre)
        dz, lo, hi = S.cohens_dz(g.pre.values, g.post.values)
        w = stats.wilcoxon(g.post, g.pre, zero_method="wilcox")
        z = stats.norm.isf(w.pvalue / 2) * np.sign((g.post - g.pre).median() or 1)
        r = z / math.sqrt(len(g))
        cg = S.class_gain(g.pre.mean(), g.post.mean())
        rows.append([COND_LABEL[c], f"t({len(g) - 1}) = {t.statistic:.2f}", S.fmt_pv(t.pvalue), f"{dz:.2f} [{lo:.2f}, {hi:.2f}]", f"{w.statistic:.0f}", S.fmt_pv(w.pvalue), f"{r:.2f}", msd(g.ngain.dropna() * 1, 2), S.fmt_r(cg, 2)])
        res[c] = {"t": t.statistic, "p": t.pvalue, "dz": dz, "dz_ci": [lo, hi], "W": w.statistic, "wilcoxon_p": w.pvalue, "r": r, "ngain_mean": g.ngain.mean(), "class_gain": cg}
    R.results["within"] = res
    R.table("T08", "Within-condition change from pre- to post-test.", pd.DataFrame(rows, columns=["Condition", "Paired t", "p", "d_z [95% CI]", "Wilcoxon W", "p", "r", "⟨g⟩ M (SD)", "Class ⟨g⟩"]),
            "⟨g⟩ = (post − pre)/(100 − pre) per participant (participants at ceiling on the pre-test excluded); class ⟨g⟩ computed from condition means (Hake, 1998).")


def gains_by(R: Report, responses: pd.DataFrame, scored: pd.DataFrame, conds: list[str], key: str, tid: str, fid: str, label: str) -> None:
    r = responses[(responses.transfer == 0) & responses.participant_id.isin(scored.participant_id)].copy()
    r["condition"] = r.participant_id.map(scored.set_index("participant_id").condition)
    pc = r.groupby([key, "condition", "phase"]).correct.mean().unstack("phase") * 100
    pc["ngain"] = [S.normalized_gain(a, b) for a, b in zip(pc["pre"], pc["post"])]
    order = {"concept": INVENTORY["concepts"], "cluster": CLUSTERS, "bloom": INVENTORY["bloom_levels"]}[key]
    levels = [lv for lv in order if lv in set(r[key])]
    n_items = r.groupby(key).item_id.nunique()
    rows = []
    for lv in levels:
        row = [f"{lv.replace('_', ' ')} ({n_items[lv]} items)"]
        for c in conds:
            x = pc.loc[(lv, c)] if (lv, c) in pc.index else None
            row.append("—" if x is None else f"{x['pre']:.0f} → {x['post']:.0f} ({x['ngain']:.2f})")
        rows.append(row)
    R.results[f"gain_by_{key}"] = {f"{lv}|{c}": pc.loc[(lv, c)].to_dict() for lv in levels for c in conds if (lv, c) in pc.index}
    exploratory = key == "concept"
    title = f"Percentage correct before → after, with normalised gain, by {label}."
    if exploratory:
        title = f"Exploratory appendix: {title[0].lower()}{title[1:]}"
    R.table(tid, title, pd.DataFrame(rows, columns=[label.capitalize(), *[COND_LABEL[c] for c in conds]]),
            "Exploratory only: most concepts rest on one to three items, too few for reliable per-concept gains; "
            "clusters and Bloom levels are the reporting units." if exploratory else "")
    if exploratory:
        return

    fig, ax = plt.subplots(figsize=(5.2 if key == "cluster" else 4.0, 3.0))
    w = 0.8 / len(conds)
    x = np.arange(len(levels))
    for k, c in enumerate(conds):
        vals = [pc.loc[(lv, c)]["ngain"] if (lv, c) in pc.index else np.nan for lv in levels]
        ax.bar(x + (k - (len(conds) - 1) / 2) * w, vals, w, color=GREYS[c], edgecolor="black", hatch=HATCH[c], lw=0.6, label=COND_LABEL[c])
    ax.set_xticks(x, [lv.replace("_", " ") for lv in levels], fontsize=7.5)
    ax.set_ylabel(r"Normalised gain $\langle g\rangle$")
    ax.axhline(0, color="black", lw=0.6)
    ax.legend(frameon=False, fontsize=7.5, ncols=len(conds))
    R.figure(fid, f"Normalised gain by {label} and condition.", fig)


def reliability(R: Report, responses: pd.DataFrame, sus: pd.DataFrame, scored: pd.DataFrame) -> None:
    rows, res = [], {}
    r = responses[responses.item_id.isin(MATCHED) & responses.participant_id.isin(scored.participant_id)]
    for phase in ("pre", "post"):
        m = r[r.phase == phase].pivot_table(index="participant_id", columns="item_id", values="correct").dropna()
        a = S.cronbach_alpha(m.values)
        lo, hi = S.alpha_ci(a, len(m), m.shape[1])
        rows.append([f"Concept inventory ({phase}-test)", len(m), m.shape[1], f"{S.fmt_r(a, 2)} [{S.fmt_r(lo, 2)}, {S.fmt_r(hi, 2)}]"])
        res[f"inventory_{phase}"] = {"alpha": a, "ci": [lo, hi], "n": len(m)}
    if len(sus):
        rec = S.sus_recode(sus[sus.participant_id.isin(scored.participant_id)])
        a = S.cronbach_alpha(rec.values)
        lo, hi = S.alpha_ci(a, len(rec), 10)
        rows.append(["System Usability Scale", len(rec), 10, f"{S.fmt_r(a, 2)} [{S.fmt_r(lo, 2)}, {S.fmt_r(hi, 2)}]"])
        res["sus"] = {"alpha": a, "ci": [lo, hi], "n": len(rec)}
    R.results["reliability"] = res
    R.table("T15", "Internal consistency (Cronbach's α with Feldt 95% CI).", pd.DataFrame(rows, columns=["Instrument", "n", "Items", "α [95% CI]"]),
            f"Inventory: the matched {len(MATCHED)}-item scale administered in both tests, scored 0/1 (α equals KR-20); the "
            f"{len(TRANSFER)} transfer items are too few for a meaningful α and are not included. SUS items after polarity recoding.")


def sus_analysis(R: Report, sus: pd.DataFrame, scored: pd.DataFrame) -> None:
    s = sus[sus.participant_id.isin(scored.participant_id)].copy()
    if s.empty:
        return
    s["score"] = S.sus_score(s)
    s["condition"] = s.participant_id.map(scored.set_index("participant_id").condition)
    conds = sorted(s.condition.unique())
    rows, res = [], {}
    for c in conds:
        x = s[s.condition == c].score
        rows.append([COND_LABEL[c], len(x), msd(x), f"{x.median():.1f}", S.sus_adjective(x.mean()), S.sus_grade(x.mean())])
        res[c] = {"mean": x.mean(), "sd": x.std(ddof=1), "adjective": S.sus_adjective(x.mean()), "grade": S.sus_grade(x.mean())}
    note = ""
    if len(conds) == 2:
        a, b = (s[s.condition == c].score for c in conds)
        t = stats.ttest_ind(b, a, equal_var=False)
        g, lo, hi = S.hedges_g(b.values, a.values)
        note = f"Welch t({t.df:.1f}) = {t.statistic:.2f}, p {S.fmt_p(t.pvalue)}, g = {g:.2f} [{lo:.2f}, {hi:.2f}] ({COND_LABEL[conds[1]]} vs {COND_LABEL[conds[0]]}). "
        res["comparison"] = {"t": t.statistic, "df": t.df, "p": t.pvalue, "g": g, "g_ci": [lo, hi]}
    R.results["sus"] = res
    R.table("T11", "System Usability Scale scores.", pd.DataFrame(rows, columns=["Condition", "n", "SUS M (SD)", "Mdn", "Adjective", "Grade"]),
            note + "Adjective: the Bangor, Kortum & Miller (2009) adjective whose mean SUS score is nearest the condition mean "
            "(anchors are means, not bands). Grade: band on the Sauro–Lewis (2016) curved grading scale. The two schemes are independent.")


def tlx_analysis(R: Report, tlx: pd.DataFrame, scored: pd.DataFrame) -> None:
    t = tlx[tlx.participant_id.isin(scored.participant_id)].copy()
    if t.empty:
        return
    subs = ["mental", "physical", "temporal", "performance", "effort", "frustration"]
    t["raw_tlx"] = t[subs].mean(axis=1)
    t["condition"] = t.participant_id.map(scored.set_index("participant_id").condition)
    conds = sorted(t.condition.unique())
    rows = []
    for col in [*subs, "raw_tlx"]:
        row = ["Raw TLX (mean)" if col == "raw_tlx" else col.capitalize()]
        for c in conds:
            row.append(msd(t[t.condition == c][col]))
        if len(conds) == 2:
            u = stats.mannwhitneyu(*(t[t.condition == c][col] for c in conds))
            row.append(S.fmt_pv(u.pvalue))
        rows.append(row)
    R.results["tlx"] = {c: t[t.condition == c][[*subs, "raw_tlx"]].mean().to_dict() for c in conds}
    cols = ["Subscale", *[COND_LABEL[c] for c in conds]] + (["Mann–Whitney p"] if len(conds) == 2 else [])
    R.table("T12", "NASA-TLX (raw) workload ratings, 0–100.", pd.DataFrame(rows, columns=cols), "Higher values mean higher workload on every subscale.")


def telemetry_analysis(R: Report, tel: pd.DataFrame, scored: pd.DataFrame) -> None:
    t = tel[tel.participant_id.isin(scored.participant_id)].copy()
    if t.empty:
        return
    feats = [c for c in t.columns if c != "participant_id"]
    rows = [[f, f"{t[f].mean():.1f}", f"{t[f].std(ddof=1):.1f}", f"{t[f].median():.1f}"] for f in feats]
    R.table("T13", "Interaction telemetry in the DL-VizLab condition (per participant).", pd.DataFrame(rows, columns=["Feature", "M", "SD", "Mdn"]))
    t["ngain"] = t.participant_id.map(scored.set_index("participant_id").ngain)
    t = t.dropna(subset=["ngain"])
    corr = [(f, *stats.spearmanr(t[f], t.ngain)) for f in feats if t[f].nunique() > 1]
    adj = S.holm([c[2] for c in corr])
    rows = [[f, f"{rho:.2f}", S.fmt_pv(p), S.fmt_pv(pa)] for (f, rho, p), pa in zip(corr, adj)]
    R.results["telemetry_corr"] = {f: {"rho": rho, "p": p, "p_holm": pa} for (f, rho, p), pa in zip(corr, adj)}
    R.table("T14", "Spearman correlations between engagement and normalised gain (DL-VizLab condition).", pd.DataFrame(rows, columns=["Feature", "ρ", "p", "p (Holm)"]),
            f"n = {len(t)}. Correlational only: engagement was not manipulated.")
    fig, ax = plt.subplots(figsize=(3.4, 2.8))
    ax.scatter(t.steps_total, t.ngain, s=14, facecolor="white", edgecolor="black", lw=0.7)
    b = np.polyfit(t.steps_total, t.ngain, 1)
    xs = np.linspace(t.steps_total.min(), t.steps_total.max(), 10)
    ax.plot(xs, np.polyval(b, xs), color="black", lw=1, ls="--")
    ax.set_xlabel("Execution steps taken")
    ax.set_ylabel(r"Normalised gain $\langle g\rangle$")
    R.figure("F4", "Engagement (execution steps) versus normalised gain in the DL-VizLab condition, with least-squares line.", fig)


def figures_main(R: Report, scored: pd.DataFrame, conds: list[str]) -> None:
    if "emm" in R.results:
        fig, ax = plt.subplots(figsize=(3.4, 2.8))
        for k, c in enumerate(conds):
            # Rounded so the plotted coordinates do not depend on BLAS last-bit differences.
            raw = R.results["emm"][c]
            e = {"mean": round(raw["mean"], 9), "ci": [round(v, 9) for v in raw["ci"]]}
            ax.errorbar(k, e["mean"], yerr=[[e["mean"] - e["ci"][0]], [e["ci"][1] - e["mean"]]], fmt=MARKERS[c], color="black", mfc=GREYS[c], ms=7, capsize=4, lw=1)
        ax.set_xticks(range(len(conds)), [COND_LABEL[c].replace(" ", "\n", 1) for c in conds])
        ax.set_ylabel("Adjusted post-test score (%)")
        ax.set_xlim(-0.5, len(conds) - 0.5)
        R.figure("F2", "Estimated marginal means of post-test score with 95% confidence intervals, adjusted for pre-test score.", fig)

    fig, ax = plt.subplots(figsize=(5.0, 2.9))
    data, pos, cols = [], [], []
    for k, c in enumerate(conds):
        g = scored[scored.condition == c]
        data += [g.pre, g.post]
        pos += [3 * k, 3 * k + 1]
        cols += ["pre", "post"]
    bp = ax.boxplot(data, positions=pos, widths=0.8, patch_artist=True, medianprops=dict(color="black"), flierprops=dict(marker="o", ms=3))
    for patch, kind in zip(bp["boxes"], cols):
        patch.set(facecolor="white" if kind == "pre" else "0.7", hatch="" if kind == "pre" else "///", edgecolor="black", lw=0.8)
    ax.set_xticks([3 * k + 0.5 for k in range(len(conds))], [COND_LABEL[c] for c in conds])
    ax.set_ylabel("Score (% correct)")
    ax.legend([bp["boxes"][0], bp["boxes"][1]], ["Pre-test", "Post-test"], frameon=False, fontsize=8)
    R.figure("F3", "Pre- and post-test scores by condition.", fig)


def power(R: Report, scored: pd.DataFrame, conds: list[str]) -> None:
    k = len(conds)
    n = len(scored)
    rows, res = [], {}
    if "ancova" in R.results:
        eta = R.results["ancova"]["partial_eta_sq"]
        f = math.sqrt(eta / (1 - eta))
        achieved = FTestAnovaPower().power(effect_size=f, nobs=n, alpha=0.05, k_groups=k)
        rows.append(["Achieved power, observed effect", f"f = {f:.3f} (η²ₚ = {S.fmt_r(eta)})", n, S.fmt_r(achieved)])
        res["achieved"] = {"f": f, "power": achieved, "n": n}
    r_pp = float(np.corrcoef(scored.pre, scored.post)[0, 1])
    n_t = TTestIndPower().solve_power(effect_size=0.5, alpha=0.05, power=0.8)
    rows.append(["Required n, two groups, d = 0.5 (t-test)", "d = 0.50", f"{2 * math.ceil(n_t)} ({math.ceil(n_t)} per group)", ".80"])
    d_adj = 0.5 / math.sqrt(1 - r_pp**2)
    n_ta = TTestIndPower().solve_power(effect_size=d_adj, alpha=0.05, power=0.8)
    rows.append([f"Required n, two groups, d = 0.5 with pre-test covariate (r = {r_pp:.2f})", f"d_adj = {d_adj:.2f}", f"{2 * math.ceil(n_ta)} ({math.ceil(n_ta)} per group)", ".80"])
    n_f = FTestAnovaPower().solve_power(effect_size=0.25, alpha=0.05, power=0.8, k_groups=3)
    rows.append(["Required N, three groups, f = 0.25 (ANOVA)", "f = 0.25", f"{math.ceil(n_f)}", ".80"])
    res.update({"n_two_group_d05": 2 * math.ceil(n_t), "n_two_group_d05_ancova": 2 * math.ceil(n_ta), "pre_post_r": r_pp, "n_three_group_f025": math.ceil(n_f)})
    R.results["power"] = res
    R.table("T16", "Power analysis (α = .05).", pd.DataFrame(rows, columns=["Analysis", "Effect size", "N", "Power"]),
            "ANCOVA power approximated by one-way ANOVA power on the covariate-adjusted effect; the adjusted d divides by √(1 − r²) for pre–post correlation r.")


# =============================================================================== main


def run(export_dir: Path, out: Path, png: bool = False) -> dict:
    simulated = (export_dir / "SIMULATED").exists()
    R = Report(out, simulated, png)
    d = load(export_dir)
    scored = score(d["responses_long"], d["participants"])
    conds = [c for c in ("C1", "C2", "C3") if c in set(scored.condition)]
    R.results["design"] = {"conditions": conds, "n_analysed": len(scored)}

    consort(R, d["participants"], scored, conds)
    characteristics(R, d["participants"], scored, conds)
    descriptives(R, scored, conds)
    checks, model = assumptions(scored)
    report_assumptions(R, checks)
    # The primary test is fixed by the checks above; both are reported, labelled accordingly.
    ancova(R, scored, model, conds, primary=checks.parametric_ok)
    nonparametric(R, scored, conds, primary=not checks.parametric_ok)
    within(R, scored, conds)
    gains_by(R, d["responses_long"], scored, conds, "cluster", "T09", "F5", "concept cluster")
    gains_by(R, d["responses_long"], scored, conds, "bloom", "T10", "F6", "Bloom level")
    sus_analysis(R, d["sus"], scored)
    tlx_analysis(R, d["tlx"], scored)
    telemetry_analysis(R, d["telemetry"], scored)
    reliability(R, d["responses_long"], d["sus"], scored)
    power(R, scored, conds)
    figures_main(R, scored, conds)
    gains_by(R, d["responses_long"], scored, conds, "concept", "T17", "", "concept")  # exploratory appendix, last
    R.write()
    return R.results


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--png"]
    if len(args) != 2:
        print(__doc__)
        sys.exit(2)
    res = run(Path(args[0]), Path(args[1]), png="--png" in sys.argv)
    print(f"analysed n = {res['design']['n_analysed']}; primary: {res['assumptions']['primary']}; outputs in {sys.argv[2]}")
