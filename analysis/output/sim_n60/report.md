# Analysis report

> ILLUSTRATIVE — simulated data, pipeline validation only.

**Figure 1.** Participant flow (CONSORT-style). ILLUSTRATIVE — simulated data, pipeline validation only. (`figures/F1.pdf`, `figures/F1.svg`)

**Table 1.** Participant characteristics by condition, with tests of baseline equivalence. ILLUSTRATIVE — simulated data, pipeline validation only.

| Characteristic | C1 Control | C2 Baseline | C3 DL-VizLab | Test p |
|---|---|---|---|---|
| n | 21 | 21 | 21 |  |
| Year of study, M (SD) | 2.2 (1.1) | 2.1 (1.1) | 2.4 (1.3) | F: .648 |
| Prior ML course, % | 33 | 29 | 19 | χ²: .569 |
| Programming: none, % | 10 | 0 | 0 | χ²: .192 |
| Programming: < 1 year, % | 19 | 29 | 19 |  |
| Programming: 1–3 years, % | 38 | 57 | 67 |  |
| Programming: > 3 years, % | 33 | 14 | 14 |  |
| Familiarity (1–5), M (SD) | 3.0 (1.5) | 2.9 (1.3) | 2.9 (1.6) | H: .967 |
| Pre-test %, M (SD) | 53.6 (18.0) | 52.9 (17.1) | 51.4 (21.7) | F: .933 |

*Note.* Analysed participants only. One-way ANOVA (F), χ² test of independence, Kruskal–Wallis (H).

**Table 2.** Concept-inventory scores (% correct) before and after the intervention. ILLUSTRATIVE — simulated data, pipeline validation only.

| Condition | n | Pre M (SD) | Pre Mdn | Post M (SD) | Post Mdn | Gain M (SD) | Transfer M (SD) |
|---|---|---|---|---|---|---|---|
| C1 Control | 21 | 53.6 (18.0) | 50.0 | 60.5 (24.2) | 65.0 | 6.9 (19.8) | 68.6 (25.7) |
| C2 Baseline | 21 | 52.9 (17.1) | 50.0 | 63.8 (20.9) | 65.0 | 11.0 (13.4) | 64.8 (21.8) |
| C3 DL-VizLab | 21 | 51.4 (21.7) | 55.0 | 68.6 (19.7) | 70.0 | 17.1 (14.8) | 78.1 (19.9) |

**Table 3.** Assumption checks for the primary analysis. ILLUSTRATIVE — simulated data, pipeline validation only.

| Assumption | Test | Statistic | p | Verdict |
|---|---|---|---|---|
| Normality of ANCOVA residuals | Shapiro–Wilk | W = 0.981 | .430 | met |
| Homogeneity of variance | Levene | F = 2.72 | .074 | met |
| Homogeneity of regression slopes | condition × pre-test | F(2, 57) = 0.48 | .624 | met |

*Note.* Primary analysis selected from these checks before testing: one-way ANCOVA.

**Table 4.** One-way ANCOVA on post-test score with pre-test as covariate (primary analysis). ILLUSTRATIVE — simulated data, pipeline validation only.

| Source | SS | df | MS | F | p | η²ₚ [95% CI] |
|---|---|---|---|---|---|---|
| Pre-test (covariate) | 13328.0 | 1 | 13328.0 | 53.06 | < .001 | .474 |
| Condition | 1014.8 | 2 | 507.4 | 2.02 | .142 | .064 [.000, .188] |
| Residual | 14819.7 | 59 | 251.2 |  |  |  |

*Note.* Type II sums of squares. F(2, 59) = 2.02, p = .142, η²ₚ = .064, 95% CI [.000, .188].

**Table 5.** Estimated marginal means of post-test score (%), adjusted to the mean pre-test score (52.6%). ILLUSTRATIVE — simulated data, pipeline validation only.

| Condition | EMM | SE | 95% CI |
|---|---|---|---|
| C1 Control | 59.73 | 3.46 | [52.81, 66.65] |
| C2 Baseline | 63.62 | 3.46 | [56.70, 70.54] |
| C3 DL-VizLab | 69.50 | 3.46 | [62.58, 76.43] |

**Table 6.** Pairwise comparisons of adjusted post-test means. ILLUSTRATIVE — simulated data, pipeline validation only.

| Contrast | Δ adjusted | SE | t | p (Holm) | Hedges' g [95% CI] |
|---|---|---|---|---|---|
| C2 Baseline − C1 Control | 3.89 | 4.89 | t(59) = 0.80 | .468 | 0.18 [-0.43, 0.78] |
| C3 DL-VizLab − C1 Control | 9.77 | 4.90 | t(59) = 2.00 | .152 | 0.44 [-0.17, 1.06] |
| C3 DL-VizLab − C2 Baseline | 5.88 | 4.89 | t(59) = 1.20 | .468 | 0.27 [-0.34, 0.87] |

*Note.* Hedges' g uses the pooled within-condition SD of the post-test.

**Table 7.** Kruskal–Wallis test on gain scores with Dunn's pairwise tests (sensitivity analysis). ILLUSTRATIVE — simulated data, pipeline validation only.

| Comparison | z | p | p (Holm) | r |
|---|---|---|---|---|
| C2 Baseline vs C1 Control | 1.03 | .303 | .527 | 0.13 |
| C3 DL-VizLab vs C1 Control | 2.15 | .032 | .095 | 0.27 |
| C3 DL-VizLab vs C2 Baseline | 1.12 | .263 | .527 | 0.14 |

*Note.* H(2) = 4.62, p = .099, ε² = .074. Positive z: the first-named condition gained more.

**Table 8.** Within-condition change from pre- to post-test. ILLUSTRATIVE — simulated data, pipeline validation only.

| Condition | Paired t | p | d_z [95% CI] | Wilcoxon W | p | r | ⟨g⟩ M (SD) | Class ⟨g⟩ |
|---|---|---|---|---|---|---|---|---|
| C1 Control | t(20) = 1.59 | .126 | 0.35 [-0.10, 0.78] | 58 | .221 | 0.27 | 0.11 (0.46) | .15 |
| C2 Baseline | t(20) = 3.75 | .001 | 0.82 [0.31, 1.31] | 24 | .004 | 0.63 | 0.29 (0.36) | .23 |
| C3 DL-VizLab | t(20) = 5.31 | < .001 | 1.16 [0.59, 1.71] | 4 | < .001 | 0.82 | 0.36 (0.29) | .35 |

*Note.* ⟨g⟩ = (post − pre)/(100 − pre) per participant (participants at ceiling on the pre-test excluded); class ⟨g⟩ computed from condition means (Hake, 1998).

**Table 9.** Percentage correct before → after, with normalised gain, by concept. ILLUSTRATIVE — simulated data, pipeline validation only.

| Concept | C1 Control | C2 Baseline | C3 DL-VizLab |
|---|---|---|---|
| perceptron | 64 → 74 (0.27) | 57 → 79 (0.50) | 55 → 71 (0.37) |
| activation | 71 → 76 (0.17) | 67 → 73 (0.19) | 73 → 79 (0.24) |
| forward propagation | 43 → 52 (0.17) | 50 → 60 (0.19) | 45 → 67 (0.39) |
| loss | 48 → 57 (0.18) | 36 → 52 (0.26) | 55 → 57 (0.05) |
| gradient | 38 → 57 (0.31) | 55 → 69 (0.32) | 43 → 64 (0.38) |
| chain rule | 51 → 56 (0.10) | 49 → 56 (0.13) | 40 → 67 (0.45) |
| learning rate | 33 → 45 (0.18) | 48 → 52 (0.09) | 33 → 60 (0.39) |
| weight update | 57 → 62 (0.11) | 43 → 62 (0.33) | 43 → 71 (0.50) |
| overfitting | 48 → 48 (0.00) | 52 → 52 (0.00) | 67 → 71 (0.14) |
| convolution | 52 → 38 (-0.30) | 43 → 57 (0.25) | 43 → 57 (0.25) |
| pooling | 95 → 95 (0.00) | 81 → 95 (0.75) | 76 → 95 (0.80) |

**Figure 5.** Normalised gain by concept and condition. ILLUSTRATIVE — simulated data, pipeline validation only. (`figures/F5.pdf`, `figures/F5.svg`)

**Table 10.** Percentage correct before → after, with normalised gain, by Bloom level. ILLUSTRATIVE — simulated data, pipeline validation only.

| Bloom level | C1 Control | C2 Baseline | C3 DL-VizLab |
|---|---|---|---|
| recall | 75 → 79 (0.14) | 71 → 76 (0.17) | 65 → 79 (0.38) |
| understand | 52 → 59 (0.14) | 50 → 60 (0.21) | 51 → 72 (0.44) |
| apply | 44 → 52 (0.16) | 46 → 61 (0.28) | 44 → 58 (0.24) |

**Figure 6.** Normalised gain by Bloom level and condition. ILLUSTRATIVE — simulated data, pipeline validation only. (`figures/F6.pdf`, `figures/F6.svg`)

**Table 11.** System Usability Scale scores. ILLUSTRATIVE — simulated data, pipeline validation only.

| Condition | n | SUS M (SD) | Mdn | Adjective | Grade |
|---|---|---|---|---|---|
| C2 Baseline | 21 | 61.5 (18.4) | 60.0 | OK | D |
| C3 DL-VizLab | 21 | 70.5 (20.1) | 75.0 | OK | C |

*Note.* Welch t(39.7) = 1.50, p = .141, g = 0.45 [-0.16, 1.07] (C3 DL-VizLab vs C2 Baseline). Adjective anchors after Bangor, Kortum & Miller (2009); grades on the Sauro–Lewis curved scale.

**Table 12.** NASA-TLX (raw) workload ratings, 0–100. ILLUSTRATIVE — simulated data, pipeline validation only.

| Subscale | C2 Baseline | C3 DL-VizLab | Mann–Whitney p |
|---|---|---|---|
| Mental | 52.9 (23.4) | 62.6 (19.6) | .194 |
| Physical | 15.7 (16.3) | 19.8 (15.8) | .379 |
| Temporal | 39.0 (19.9) | 45.0 (22.5) | .306 |
| Performance | 33.8 (22.0) | 37.4 (16.9) | .667 |
| Effort | 47.9 (20.8) | 54.3 (18.0) | .448 |
| Frustration | 31.0 (22.3) | 37.9 (17.6) | .433 |
| Raw TLX (mean) | 36.7 (17.7) | 42.8 (15.5) | .308 |

*Note.* Higher values mean higher workload on every subscale.

**Table 13.** Interaction telemetry in the DL-VizLab condition (per participant). ILLUSTRATIVE — simulated data, pipeline validation only.

| Feature | M | SD | Mdn |
|---|---|---|---|
| steps_total | 136.8 | 69.9 | 126.0 |
| steps_operation | 52.7 | 24.9 | 50.0 |
| steps_layer | 41.3 | 21.8 | 37.0 |
| steps_phase | 17.8 | 9.1 | 16.0 |
| steps_sample | 13.2 | 9.8 | 11.0 |
| steps_batch | 7.0 | 4.4 | 6.0 |
| steps_epoch | 4.7 | 3.8 | 3.0 |
| back_steps | 10.8 | 6.4 | 9.0 |
| jumps | 3.4 | 2.3 | 3.0 |
| view_switches | 21.9 | 12.9 | 18.0 |
| param_edits | 5.4 | 3.6 | 4.0 |
| breakpoints_set | 1.5 | 1.2 | 1.0 |
| explanation_opens | 26.6 | 16.1 | 23.0 |
| explanation_detailed_share | 0.5 | 0.2 | 0.5 |
| experiments_started | 4.6 | 2.2 | 4.0 |
| experiments_completed | 4.2 | 2.1 | 4.0 |
| walkthrough_steps | 16.0 | 7.7 | 15.0 |
| active_time_s | 1046.0 | 339.5 | 1066.4 |
| idle_gaps | 2.5 | 1.9 | 2.0 |

**Table 14.** Spearman correlations between engagement and normalised gain (DL-VizLab condition). ILLUSTRATIVE — simulated data, pipeline validation only.

| Feature | ρ | p | p (Holm) |
|---|---|---|---|
| steps_total | 0.44 | .044 | .664 |
| steps_operation | 0.39 | .077 | .996 |
| steps_layer | 0.48 | .026 | .449 |
| steps_phase | 0.26 | .247 | 1.000 |
| steps_sample | 0.41 | .068 | .957 |
| steps_batch | 0.18 | .434 | 1.000 |
| steps_epoch | 0.28 | .222 | 1.000 |
| back_steps | 0.29 | .201 | 1.000 |
| jumps | 0.28 | .225 | 1.000 |
| view_switches | 0.56 | .008 | .159 |
| param_edits | 0.15 | .524 | 1.000 |
| breakpoints_set | -0.20 | .388 | 1.000 |
| explanation_opens | 0.13 | .579 | 1.000 |
| explanation_detailed_share | -0.24 | .290 | 1.000 |
| experiments_started | 0.23 | .318 | 1.000 |
| experiments_completed | 0.47 | .032 | .511 |
| walkthrough_steps | 0.50 | .022 | .404 |
| active_time_s | 0.32 | .157 | 1.000 |
| idle_gaps | -0.07 | .749 | 1.000 |

*Note.* n = 21. Correlational only: engagement was not manipulated.

**Figure 4.** Engagement (execution steps) versus normalised gain in the DL-VizLab condition, with least-squares line. ILLUSTRATIVE — simulated data, pipeline validation only. (`figures/F4.pdf`, `figures/F4.svg`)

**Table 15.** Internal consistency (Cronbach's α with Feldt 95% CI). ILLUSTRATIVE — simulated data, pipeline validation only.

| Instrument | n | Items | α [95% CI] |
|---|---|---|---|
| Concept inventory (pre-test) | 63 | 20 | .70 [.58, .80] |
| Concept inventory (post-test) | 63 | 20 | .80 [.73, .87] |
| System Usability Scale | 42 | 10 | .92 [.88, .95] |

*Note.* Inventory items scored 0/1 (α equals KR-20); SUS items after polarity recoding.

**Table 16.** Power analysis (α = .05). ILLUSTRATIVE — simulated data, pipeline validation only.

| Analysis | Effect size | N | Power |
|---|---|---|---|
| Achieved power, observed effect | f = 0.262 (η²ₚ = .064) | 63 | .425 |
| Required n, two groups, d = 0.5 (t-test) | d = 0.50 | 128 (64 per group) | .80 |
| Required n, two groups, d = 0.5 with pre-test covariate (r = 0.67) | d_adj = 0.67 | 72 (36 per group) | .80 |
| Required N, three groups, f = 0.25 (ANOVA) | f = 0.25 | 158 | .80 |

*Note.* ANCOVA power approximated by one-way ANOVA power on the covariate-adjusted effect; the adjusted d divides by √(1 − r²) for pre–post correlation r.

**Figure 2.** Estimated marginal means of post-test score with 95% confidence intervals, adjusted for pre-test score. ILLUSTRATIVE — simulated data, pipeline validation only. (`figures/F2.pdf`, `figures/F2.svg`)

**Figure 3.** Pre- and post-test scores by condition. ILLUSTRATIVE — simulated data, pipeline validation only. (`figures/F3.pdf`, `figures/F3.svg`)
