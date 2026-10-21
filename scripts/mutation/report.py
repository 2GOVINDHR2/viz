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


def verdict(r):
    if r['blank'] == 'killed' or r['noAction'] == 'killed':
        return 'live (mechanical)'
    t = targeted.get(r['id'])
    if t is None:
        return 'unverified'
    return {'killed': 'live (targeted)', 'hollow': 'hollow', 'fixed': 'hollow, fixed'}[t['outcome']]


rows = [(r, verdict(r)) for r in e2e]
c = Counter(v for _, v in rows)
hollow = [(r, targeted[r['id']]) for r, v in rows if v.startswith('hollow')]
by_file = Counter(r['file'].split('/')[-1] for r in e2e)

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
w(f'| Checked | {len(e2e)} |')
for k in ['live (mechanical)', 'live (targeted)', 'hollow, fixed', 'hollow', 'unverified']:
    w(f'| {k} | {c.get(k, 0)} |')
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
        w(f"| `{r['id']}` | {t['claim']} | {t['mutant']} | {t.get('fix', 'open')} |")
else:
    w('None.')
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
