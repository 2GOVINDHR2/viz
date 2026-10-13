# Data Dictionary — Study Export

Study Mode (P8) exports the files below with one click. All files are UTF-8 CSV with a header row, comma separator, `.` decimal point, and empty cells for missing values. Every row is keyed by `participant_id`, a random code generated on the study machine (format `P-` + 8 base-32 characters). **No file contains names, email addresses, student numbers, IP addresses, free-form identifiers or device fingerprints.** The analysis pipeline (`analysis/analysis.py`) reads exactly these columns; the simulator (`analysis/simulate.py`) writes them.

A file named `SIMULATED` in the export directory marks synthetic data. Its presence forces the pipeline to watermark every table and figure; Study Mode never writes it.

## participants.csv — one row per participant who opened the consent screen

| Column | Type | Values | Meaning |
|---|---|---|---|
| `participant_id` | string | `P-XXXXXXXX` | Anonymous random code |
| `study_id` | string | free | Study identifier from the session configuration |
| `design` | string | `three_condition`, `two_condition` | Design in force for this session |
| `condition` | string | `C1`, `C2`, `C3`, empty | C1 control (static material), C2 baseline (TensorFlow Playground exercise), C3 DL-VizLab; empty if never assigned |
| `assignment` | string | `stratified_random`, `manual_override` | How the condition was assigned |
| `stratum` | string | `low`, `high` | Prior-knowledge stratum used for stratified randomisation (self-rated familiarity ≤ 2 → `low`) |
| `consented` | 0/1 | | Gave explicit opt-in consent |
| `withdrawn` | 0/1 | | Used the withdraw control. All their responses, questionnaires, telemetry, feedback, demographics and durations are deleted; the row keeps only the allocation fields (`condition`, `assignment`, `stratum`) and the flags, for the participant-flow diagram |
| `completed` | 0/1 | | Reached the debrief screen |
| `year_of_study` | integer | 1–6 | Self-reported year of study |
| `prior_ml_course` | 0/1 | | Has taken a machine-learning course before |
| `programming_years` | string | `none`, `lt1`, `1to3`, `gt3` | Programming experience |
| `familiarity` | integer | 1–5 | Self-rated familiarity with neural networks (1 = none, 5 = very familiar) |
| `pre_duration_s` | number | ≥ 0 | Time spent on the pre-test |
| `intervention_duration_s` | number | ≥ 0 | Time-on-task in the intervention stage |
| `post_duration_s` | number | ≥ 0 | Time spent on the post-test |

## responses_long.csv — one row per participant × test item

| Column | Type | Values | Meaning |
|---|---|---|---|
| `participant_id` | string | | |
| `phase` | string | `pre`, `post` | Test administration |
| `item_id` | string | `CI01`–`CI20`, `TR01`–`TR05` | Item (transfer items `TR*` appear only at `post`) |
| `position` | integer | 1–25 | Order in which the item was shown (randomised per participant and phase) |
| `chosen` | integer | 0–3, empty | Canonical index of the chosen option (empty if skipped or timed out) |
| `correct` | 0/1 | | 1 if `chosen` equals the key |
| `latency_ms` | integer | ≥ 0, empty | Time from item display to answer (or to the time limit, for the item on screen when time ran out); empty for items never shown because time ran out |
| `concept` | string | see inventory | Target concept of the item |
| `bloom` | string | `recall`, `understand`, `apply` | Bloom level of the item |
| `transfer` | 0/1 | | 1 for transfer items |

Scores: `pre` and `post` scores are the percentage of the 20 core items (`transfer = 0`) answered correctly; the transfer score is the percentage of the 5 transfer items.

## sus.csv — System Usability Scale (C2 and C3 only)

| Column | Type | Values | Meaning |
|---|---|---|---|
| `participant_id` | string | | |
| `sus01` … `sus10` | integer | 1–5 | Raw responses to the standard ten SUS items (1 = strongly disagree, 5 = strongly agree). Odd items are positively worded, even items negatively worded |

The SUS score is computed in the pipeline, never stored: Σ(odd − 1) + Σ(5 − even), × 2.5, range 0–100.

## tlx.csv — NASA-TLX, raw (C2 and C3 only)

| Column | Type | Values | Meaning |
|---|---|---|---|
| `participant_id` | string | | |
| `mental`, `physical`, `temporal`, `performance`, `effort`, `frustration` | integer | 0–100 in steps of 5 | Raw subscale ratings. `performance` is anchored 0 = perfect, 100 = failure, so higher always means higher workload |

Raw TLX = mean of the six subscales.

## telemetry.csv — per-participant interaction summary (C3; zero rows for others)

Steps taken automatically while *Run* is playing are not counted as steps; the `play` event records starting and stopping instead.

| Column | Type | Meaning |
|---|---|---|
| `participant_id` | string | |
| `steps_total` | integer | Step-forward and step-backward actions |
| `steps_operation`, `steps_layer`, `steps_phase`, `steps_sample`, `steps_batch`, `steps_epoch` | integer | Steps taken at each granularity |
| `back_steps` | integer | Step-backward actions (time travel) |
| `jumps` | integer | Jumps to an arbitrary trace position |
| `view_switches` | integer | Pointer or keyboard focus moving to a different labelled panel (network, training, structure, explanation, inspector, controls, …) |
| `param_edits` | integer | Edits of hyperparameters or architecture |
| `breakpoints_set` | integer | Breakpoints created |
| `explanation_opens` | integer | Moves into the always-visible explanation panel (pointer or keyboard focus arriving from another panel) plus changes of its detail level |
| `explanation_detailed_share` | number 0–1, empty | Share of steps and jumps taken while the explanation was at the detailed level (each navigation shows a new explanation); empty if the participant never navigated |
| `experiments_started`, `experiments_completed` | integer | Curriculum experiments |
| `walkthrough_steps` | integer | Guided-walkthrough steps completed |
| `active_time_s` | number | Time with at least one interaction in each 30 s window |
| `idle_gaps` | integer | Gaps of ≥ 60 s without interaction |

## telemetry_events.csv — raw interaction events (C3)

| Column | Type | Meaning |
|---|---|---|
| `participant_id` | string | |
| `t_ms` | integer | Milliseconds since the start of the intervention stage |
| `event` | string | One of `step`, `jump`, `reset`, `play`, `run_to_breakpoint`, `granularity`, `breakpoint`, `view`, `explain_open`, `param_edit`, `experiment_start`, `experiment_complete`, `self_check`, `walkthrough`, `walkthrough_step` |
| `detail` | string | Event-specific JSON (e.g. `{"granularity":"layer","direction":1}`); never free text typed by the participant |

## feedback.csv — open-ended responses for qualitative coding

| Column | Type | Meaning |
|---|---|---|
| `participant_id` | string | |
| `prompt` | string | `helped`, `confusing`, `suggestions` |
| `text` | string | Participant's free text, exported verbatim. Participants are asked not to include identifying information; the research team screens this file before sharing |
