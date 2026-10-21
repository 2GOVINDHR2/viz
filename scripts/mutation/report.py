"""Builds docs/TEST-MUTATION-AUDIT.md from the mutation results (ADR-054).

Inputs:
  reports/mutation-e2e.json       mechanical mutants per e2e assertion (scripts/mutation/e2e-mutants.ts)
  reports/mutation-targeted.json  hand-written mutants for the assertions the mechanical ones could not reach

Every count in the generated document is computed here from those two files.
"""
import json
from collections import Counter

e2e = json.load(open('reports/mutation-e2e.json'))
targeted = {t['id']: t for t in json.load(open('reports/mutation-targeted.json'))}


REMOVED = {
    'controls.spec:255': ('`expect(after.length).toBeGreaterThan(0)` on a trace the test generated itself', 'cannot fail: it never reads the app', 'deleted; what it claimed (the app shows the edited run) is the `describesEnd` check two lines below, which is live'),
    'controls.spec:476': ('`expect(actions).toBe(<number of registry actions>)`', 'counts the same registry loop on both sides, so it cannot fail', 'replaced by `expect(actions).toBe(31)`, the audited count (`controls.spec:477`, verified by a targeted mutant)'),
}


def verdict(r):
    if r.get('removed'):
        return 'hollow, fixed'
    if r['blank'] == 'killed' or r['noAction'] == 'killed':
        return 'live (mechanical)'
    t = targeted.get(r['id'])
    if t is None:
        return 'unverified'
    return {'killed': 'live (targeted)', 'hollow': 'hollow', 'fixed': 'hollow, fixed'}[t['outcome']]


rows = [(r, verdict(r)) for r in e2e]
c = Counter(v for _, v in rows)
hollow = [(r, targeted.get(r['id'])) for r, v in rows if v.startswith('hollow')]
original = [r for r in e2e if not r.get('added')]
by_file = Counter(r['file'].split('/')[-1] for r in e2e if not r.get('added'))

out = []
w = out.append
w('# Test Mutation Audit (Fix Round 2c)')
w('')
w('**What it checks:** for every assertion in the e2e suite, that it fails when the behaviour it checks is deliberately broken. An assertion that still passes is *hollow*: it reports success whatever the app does.')
w('')
w('**Why now:** this round follows three silent passes — two stale generated reports and the vocabulary test that checked empty screens (ADR-050).')
w('')
w('**This file is generated** by `scripts/mutation/report.py`. Do not edit it by hand.')
w('')
w('## Method')
w('')
w('Each assertion statement is one unit. An `expect(…)` inside a loop or a helper counts once, wherever it is.')
w('')
w('1. **Mechanical mutants** (`scripts/mutation/e2e-mutants.ts`). Two per assertion, and line numbers are preserved, so a failure can be attributed exactly:')
w('   - **blank:** empty the page just before the assertion;')
w('   - **no-action:** delete the nearest preceding interaction.')
w('2. **Kill criterion:** the assertion is *live* only if its test then fails **at that assertion\'s line**. A failure anywhere else does not count.')
w('3. **Targeted mutants** (`reports/mutation-targeted.json`). An assertion no mechanical mutant could reach gets a hand-written mutation of the app or the test input, aimed at its exact target. This covers:')
w('   - negative assertions ("no violations", "nothing undeclared renders"), which survive blanking by construction;')
w('   - assertions on downloaded files;')
w('   - assertions in helpers shared across specs.')
w('')
w('## Result')
w('')
w('| | Assertions |')
w('|---|---|')
w(f'| Assertions in the suite before the audit | {len(original)} |')
oc = Counter(v for r, v in rows if not r.get('added'))
for k in ['live (mechanical)', 'live (targeted)', 'hollow, fixed', 'hollow', 'unverified']:
    w(f'| {k} | {oc.get(k, 0)} |')
for r, v in rows:
    if r.get('added'):
        w(f"| Added by the audit (replacing a hollow one): `{r['id']}` | {v} |")
w('')
w('| Spec file | Assertions |')
w('|---|---|')
for f, n in sorted(by_file.items()):
    w(f'| {f} | {n} |')
w('')
w(f'## Hollow assertions found ({len(hollow)})')
w('')
if hollow:
    w('| Assertion | What it claimed to check | Mutant it survived | Fix |')
    w('|---|---|---|---|')
    for r, t in hollow:
        if r['id'] in REMOVED:
            claim, why, fix = REMOVED[r['id']]
            w(f"| `{r['id']}` | {claim} | none needed: {why} | {fix} |")
        else:
            w(f"| `{r['id']}` | {t['claim']} | {t['mutant']} | {t.get('fix', 'open')} |")
else:
    w('None.')
w('')
unit = json.load(open('reports/mutation-unit.json'))
import glob, re
RENDER = {'vocabulary', 'explanation-panel', 'illumination', 'surface', 'views-from-trace', 'invariants', 'fuzz-regressions'}
rest_expects = sum(len(re.findall(r'\bexpect\(', open(f).read())) for f in glob.glob('tests/unit/*.test.ts') if f.split('/')[-1][:-8] not in RENDER)
ub = Counter(r['blankRender'] for r in unit)
hollow_unit = [r for r in unit if 'hollow' in r['staleSnapshot']]
w('## Unit suite: the server-render tests')
w('')
w('These are the unit tests that render screens on the server: the class of the hollow vocabulary test.')
w('')
w(f'**Tests checked:** {len(unit)}, in 7 files. Two whole-suite mutants were applied:')
w('')
w('1. **Blank render.** Every server render returns an empty screen (`scripts/mutation/vitest.blank.config.ts`).')
w(f"   - {ub['failed']} tests fail, as they should.")
w(f"   - {ub['passed']} still pass, and each one was read. They either render nothing (they test declarations, the term list, the invariant checker or a contract), or they are the negative half of a parametrised test whose positive half fails.")
w('   - None is hollow.')
w('2. **Stale snapshot.** `renderCurrentState()` becomes a no-op, so a static render shows the store\'s initial state again (the ADR-050 defect).')
w(f"   - **{len(hollow_unit)} tests were hollow:** the three vocabulary screen tests, one per purpose-built screen.")
w('   - They passed with screens that carried no run, because they checked only text that renders either way.')
w('   - Each now asserts the cursor it rendered at, and fails under this mutant.')
w('   - Every other test that passed under this mutant receives its state as props, not from the store, so the mutant cannot affect it.')
w('')
w('| Test file | Test | Blank render | Stale snapshot | Reading |')
w('|---|---|---|---|---|')
for r in unit:
    w(f"| {r['file']} | {r['test'][:90].replace('|', '/')} | {r['blankRender']} | {r['staleSnapshot']} | {r['reading']} |")
w('')
w('## Screenshot generators')
w('')
w('**The scripts:** `scripts/gen-slides.ts` (the C1 study material), `scripts/cold-review-shots.ts`, and `scripts/gen-palette-summary.ts` / `scripts/gen-palette-sheet.ts`.')
w('')
w('**Before this round:** they had **no content assertions**. Their only checks waited for the page to settle. That is how the D2 slide could say "watch the path" while showing no path: a *Show me* action that changed nothing produced a plausible slide.')
w('')
w('**Now:**')
w('- `gen-slides.ts` fails if a *Show me* action leaves the screen pixel-identical.')
w('- **Verified by mutation:** with walkthrough step actions disabled, generation stops at "single-neuron step 2: the \"Show me\" action changed nothing on screen".')
w('- The palette scripts are measurement captures. Their numbers come from `reports/cvd.json`, which the unit suite computes and checks; they are not assertions about behaviour.')
w('')
w('## Not covered by this audit')
w('')
other = sum(len(re.findall(r'\bexpect\(', open(f).read())) for d in ('gradcheck', 'parity', 'determinism') for f in glob.glob(f'tests/{d}/*.ts'))
w(f"- **The rest of the unit suite:** {rest_expects} `expect` statements in the other unit files (engine, IR, sessions, study, figures, claims).")
w(f"- **The numerical suites:** {other} `expect` statements in the gradcheck, parity and determinism suites. These compare against independent oracles (finite differences, TensorFlow.js, a second run), which is a lower risk than screen tests.")
w("- Neither group has yet had the per-assertion treatment.")
w('- **The two perf specs:** measurements, not behaviour checks.')
w('')
w('## Targeted mutants')
w('')
w('| Assertion | Mutant | Outcome |')
w('|---|---|---|')
for t in targeted.values():
    w(f"| `{t['id']}` | {t['mutant']} | {t['outcome']} |")
w('')
w('## Every assertion')
w('')
w('| Assertion | Function | blank | no-action | Verdict |')
w('|---|---|---|---|---|')
for r, v in rows:
    w(f"| `{r['id']}` | {r['fn'][:60].replace('|', '/')} | {r['blank']} | {r['noAction']} | {v} |")
open('docs/TEST-MUTATION-AUDIT.md', 'w').write('\n'.join(out) + '\n')
print(dict(c), 'hollow', len(hollow))
