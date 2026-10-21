# Accessibility (WCAG 2.1 AA)

**Status in one sentence:** DL-VizLab is designed to WCAG 2.1 AA and verified with axe-core across 47 screens with zero violations, plus a manual criterion review; it has **not yet been validated with screen-reader users**, so conformance is not claimed.

Audit of DL-VizLab and Study Mode against WCAG 2.1 levels A and AA, carried out in P9. Two layers of evidence:

1. **Automated:** `tests/e2e/a11y.spec.ts` runs axe-core (rules tagged wcag2a, wcag2aa, wcag21a, wcag21aa) on 47 screens. These are every experiment mid-run, the figure-export panel, every Study Mode screen (researcher, consent, demographics, test item, intervention, questionnaires, feedback, debrief), every novice screen in both themes (Fix Round 2), and the parameter editor and bound inspector (Fix Round 2b). The test fails on any violation; results are in `reports/a11y.json` and summarised in `docs/VALIDATION-REPORT.md`.
2. **Manual:** the criterion-by-criterion review below. Automated tools find roughly a third of the problems, so the manual review is the main evidence for keyboard operation, meaning and reflow.

## Found and fixed in the audit

| Problem | Criterion | Fix |
|---|---|---|
| The network diagram was `role="img"` but contained focusable neurons and weights (children of an image are hidden from assistive technology) | 4.1.2 | `role="group"`, labelled by the diagram's title and description |
| Formula containers carried `aria-label` on a plain `div` | 4.1.2 | `role="group"` |
| Wide formulas scrolled horizontally but could not be reached by keyboard | 2.1.1 | formula boxes are focusable |
| Convolution feature-map cells could only be picked with a mouse | 2.1.1 | maps are focusable buttons; arrow keys move the selected cell and the label announces it |
| Kernel cell text chose black or white by a magnitude threshold, failing contrast on mid-tone cells | 1.4.3 | text colour chosen by WCAG luminance, as for neurons |
| Backward (magenta) and update (green) mode colours were indistinguishable for deuteranopes (ΔE 0.3) | 1.4.1 (redundancy), 1.4.11 | update colour changed to amber (#946200 light, #e3b23c dark); all pairs now ≥ 9 ΔE under protanopia and deuteranopia (`tests/unit/cvd.test.ts`) |
| No way to skip the header and curriculum strip | 2.4.1 | "Skip to the training views" link |
| A NASA-TLX slider left at its starting value could not be recorded without moving it away and back | 2.1.1, 3.3.2 | releasing the pointer or pressing a key on the slider records the current value |
| Deep networks drew overlapping headings and labels | 1.4.10, 1.3.1 | the diagram grows with depth and scrolls (ADR-031) |

## Criterion review

| Criterion | How it is met | Evidence |
|---|---|---|
| 1.1.1 Non-text content | Every SVG view has a title and description or an `aria-label` naming what it shows; neurons and weights have labels with their values; canvases (input image, feature maps) are `aria-hidden` and described by the labelled SVG over them; decorative icons are `aria-hidden`. | axe (image-alt, svg-img-alt); `tests/unit/views-from-trace.test.ts` |
| 1.3.1 Info and relationships | Landmarks (banner, navigation, main, regions per panel), headings, fieldsets with legends for every radio group, `<label for>` on every input, data tables with header cells. | axe |
| 1.3.2 Meaningful sequence | DOM order follows the visual order (controls → views → explanation). | manual |
| 1.3.3 Sensory characteristics | Instructions never rely on colour or position alone ("the dashed line", "the 50 % contour", named buttons). | manual review of walkthrough texts |
| 1.3.4 Orientation / 1.3.5 Input purpose | No orientation lock; Study Mode collects no personal data, so autocomplete purposes do not apply. | — |
| 1.4.1 Use of colour | Weight sign: colour **and** dash pattern; mode: colour **and** text label, icon and border pattern; chart series: colour **and** dash pattern and legend; class in the boundary plot: shape (○/■); correctness feedback: ✓/✗ and text. | manual; exported greyscale figures contain no hue (`tests/unit/figures.test.ts`) |
| 1.4.3 Contrast (minimum) | Text tokens ≥ 4.5:1 in light and dark themes; text on value-coloured neurons and kernel cells chosen by luminance over the whole value range. | `tests/unit/contrast.test.ts`; axe color-contrast |
| 1.4.4 Resize text | Layout in rem/px with wrapping; usable at 200 % zoom with horizontal scrolling of the wide network diagram only. | manual (Chromium, 200 %) |
| 1.4.5 Images of text | None; formulas are KaTeX text with MathML. | — |
| 1.4.10 Reflow | Designed for 1280×720 and up (projectors); phone layouts are a non-goal of the brief. Below 1180 px the explanation column moves under the views, and below 760 px everything stacks in one column. | **partial** — see limitations |
| 1.4.11 Non-text contrast | Focus ring 3 px #f0b400 plus offset; neuron borders and chart axes ≥ 3:1. Categorical series slot 3 (#1baf7a) is 2.74:1 against white, so every chart has a table view and series also differ by dash. | validator output in VALIDATION-REPORT |
| 1.4.12 Text spacing / 1.4.13 Content on hover | No fixed-height text boxes; tooltips duplicate information available in tables and the inspector, and do not obscure content. | manual |
| 2.1.1 Keyboard | Everything operable by keyboard: ←/→ step, Space run/pause, Home reset, 1–6 granularity; neurons and (up to 64) weights are focusable buttons; charts move the cursor by click **or** via the position slider; feature maps by arrow keys. | `tests/e2e/app.spec.ts` (keyboard focus test); manual |
| 2.1.2 No keyboard trap | Focus moves freely; the export PDF window is a normal browser window. | manual |
| 2.1.4 Character key shortcuts | Single-key shortcuts act only when focus is not in a text field, select or slider. | `App.tsx` guard |
| 2.2.1 Timing adjustable | Study Mode time limits are part of the research protocol (essential exception); they are set by the researcher and shown as a visible countdown. Auto-run speed is adjustable and pausable. | — |
| 2.2.2 Pause, stop, hide | Auto-run has Pause; the sliding-window animation stops when a cell is chosen and is off under `prefers-reduced-motion`. | manual |
| 2.3.1 Three flashes | No flashing content. | — |
| 2.4.1 Bypass blocks | Skip link to the views; landmarks. | manual |
| 2.4.2 Page titled | "DL-VizLab". | — |
| 2.4.3 Focus order | Follows reading order. | manual |
| 2.4.4 Link purpose | Links have descriptive text ("Open this task in TensorFlow Playground ↗"). | axe |
| 2.4.6 Headings and labels / 2.4.7 Focus visible | Descriptive headings; visible focus ring on every focusable element including SVG neurons and weights. | manual |
| 2.5.1–2.5.4 Pointer | No path gestures; actions fire on click (up event); visible labels match accessible names; no motion actuation. | manual |
| 3.1.1 Language of page | `lang="en"`. | axe |
| 3.2.1 / 3.2.2 On focus / on input | Focus never changes context; editing a parameter regenerates the run only after a pause and says so ("Each change restarts the run"). | manual |
| 3.3.1 / 3.3.2 Error identification, labels | Study forms label every field and disable *Continue* until required answers are given; rejected consent files state the reason. | manual |
| 4.1.1 Parsing / 4.1.2 Name, role, value | Custom segmented controls are `role="radiogroup"`/`radio` with `aria-checked`; toggles use `aria-pressed`; sliders expose `aria-valuetext` where the number alone is unclear. | axe |
| 4.1.3 Status messages | Text-equivalent state summary, walkthrough and self-check feedback are `aria-live`/`role="status"`. | manual |

## Limitations

- **Screen-reader experience** has been checked through the accessibility tree (Playwright snapshots) but not with NVDA, JAWS or VoiceOver users; a session with screen-reader users is recommended before the study.
- **Reflow (1.4.10)** below 1280 px is supported only by stacking; phone widths are out of scope (brief, non-goals).
- The network diagram exposes up to 64 weights as individual buttons; larger layers are reached through the neuron inspector instead, to keep tab order usable.
