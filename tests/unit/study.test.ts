/**
 * Study Mode (P8): randomisation, instruments, scoring, telemetry summaries,
 * the export format against docs/DATA-DICTIONARY.md, withdrawal, and the
 * absence of identifying data.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { beforeEach, describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng/rng';
import { placeholders, validateConsent, DRAFT_CONSENT } from '../../src/study/consent';
import { toCsv } from '../../src/export/csv';
import { COLUMNS, exportFiles, exportTables } from '../../src/study/export';
import { newParticipantId } from '../../src/study/ids';
import {
  ALL_ITEMS,
  CORE_ITEMS,
  displayToCanonical,
  itemById,
  makeForm,
  susScore,
  tlxRaw,
  TRANSFER_ITEMS,
} from '../../src/study/instruments';
import { allocate, emptyAllocation, stratumOf, type Allocation } from '../../src/study/randomise';
import { activeParticipant, useStudy } from '../../src/study/store';
import { summarise, track, startRecording, stopRecording } from '../../src/study/telemetry';
import type { Condition, Demographics, TelemetryEvent } from '../../src/study/types';
import { crc32, zip } from '../../src/export/zip';

const root = resolve(import.meta.dirname, '../..');

describe('stratified permuted-block randomisation', () => {
  it('balances the arms within each stratum after every complete block', () => {
    const rng = new Rng(7);
    let st: Allocation = emptyAllocation();
    const seen: Record<string, Condition[]> = { low: [], high: [] };
    for (let k = 0; k < 60; k++) {
      const stratum = k % 3 === 0 ? 'high' : 'low';
      const r = allocate(st, stratum, 'three_condition', rng);
      st = r.state;
      seen[stratum].push(r.condition);
    }
    for (const xs of Object.values(seen))
      for (let b = 0; b + 3 <= xs.length; b += 3)
        expect([...xs.slice(b, b + 3)].sort()).toEqual(['C1', 'C2', 'C3']);
  });

  it('uses only C1 and C3 in the two-condition design and discards a stale three-condition block', () => {
    const rng = new Rng(3);
    const st: Allocation = { low: ['C2', 'C3'], high: [] };
    const out = new Set<string>();
    let s = st;
    for (let k = 0; k < 20; k++) {
      const r = allocate(s, 'low', 'two_condition', rng);
      s = r.state;
      out.add(r.condition);
    }
    expect([...out].sort()).toEqual(['C1', 'C3']);
  });

  it('stratifies on self-rated familiarity (1–2 low, 3–5 high)', () => {
    expect([1, 2, 3, 4, 5].map(stratumOf)).toEqual(['low', 'low', 'high', 'high', 'high']);
  });
});

describe('instruments', () => {
  it('pre-test has the 20 core items; post-test adds the 5 transfer items; orders differ and options are permutations', () => {
    const pre = makeForm('pre', new Rng(1));
    const post = makeForm('post', new Rng(2));
    expect(pre.items).toHaveLength(20);
    expect(new Set(pre.items)).toEqual(new Set(CORE_ITEMS.map((i) => i.id)));
    expect(post.items).toHaveLength(24);
    expect(new Set(post.items)).toEqual(new Set(ALL_ITEMS.map((i) => i.id)));
    expect(post.items.filter((i) => i.startsWith('CI'))).not.toEqual(pre.items);
    for (const id of post.items) expect([...post.options[id]].sort()).toEqual([0, 1, 2, 3]);
    expect(TRANSFER_ITEMS.every((i) => i.transfer)).toBe(true);
  });

  it('SUS scoring reverses the polarity of even items (worked examples, same as analysis/test_analysis.py)', () => {
    expect(susScore(Array(10).fill(3))).toBe(50);
    expect(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBe(100);
    expect(susScore([1, 5, 1, 5, 1, 5, 1, 5, 1, 5])).toBe(0);
    expect(susScore(Array(10).fill(5))).toBe(50);
    expect(susScore([4, 2, 4, 2, 4, 2, 4, 2, 4, 2])).toBe(75);
    expect(() => susScore([3, 3])).toThrow();
  });

  it('raw TLX is the unweighted mean of the six subscales', () => {
    expect(
      tlxRaw({ mental: 60, physical: 0, temporal: 30, performance: 20, effort: 50, frustration: 20 }),
    ).toBe(30);
  });
});

describe('option shuffling (every item is keyed to canonical option 0)', () => {
  const N = 20_000;
  const forms = Array.from({ length: N }, (_, k) => makeForm('post', new Rng(10_000 + k)));

  it(`places the correct option uniformly over the four positions (${N} participants, χ² tests)`, () => {
    // Per item: χ²(3) with Bonferroni over 24 items at family-wise α = .01 → critical 18.11.
    // Pooled over all items: χ²(72) at α = .01 → critical 102.82. (Critical values from scipy.stats.chi2.ppf.)
    let pooled = 0;
    for (const item of ALL_ITEMS) {
      const counts = [0, 0, 0, 0];
      for (const f of forms) counts[f.options[item.id].indexOf(item.answer)]++;
      const chi2 = counts.reduce((s, c) => s + (c - N / 4) ** 2 / (N / 4), 0);
      pooled += chi2;
      expect(chi2, `${item.id}: ${counts.join('/')}`).toBeLessThan(18.11);
    }
    expect(pooled).toBeLessThan(102.82);
  });

  it('gives two participants different option orders for most items', () => {
    const [a, b] = [makeForm('post', new Rng(1)), makeForm('post', new Rng(2))];
    const differ = ALL_ITEMS.filter((i) => a.options[i.id].join() !== b.options[i.id].join()).length;
    expect(differ / ALL_ITEMS.length).toBeGreaterThan(0.6);
    expect(a.items.join()).not.toBe(b.items.join());
  });

  it('scores through the shuffle: always choosing the correct option scores 100 %, always choosing a fixed wrong option scores 0 %', () => {
    const score = (pick: (id: string, displayedOrder: number[]) => number) => {
      let correct = 0;
      for (const f of forms.slice(0, 200))
        for (const id of f.items) {
          const displayed = pick(id, f.options[id]);
          if (displayToCanonical(f, id, displayed) === itemById(id).answer) correct++;
        }
      return correct / (200 * ALL_ITEMS.length);
    };
    // The participant sees option texts in displayed order and clicks the one whose text is the key.
    expect(
      score((id, order) =>
        order.findIndex(
          (c) => itemById(id).options[c].text === itemById(id).options[itemById(id).answer].text,
        ),
      ),
    ).toBe(1);
    // Always the canonical option 1 (a distractor), wherever it is displayed.
    expect(score((_, order) => order.indexOf(1))).toBe(0);
    // A participant who always clicks the first displayed position is right only by chance (about 25 %).
    expect(score(() => 0)).toBeGreaterThan(0.2);
    expect(score(() => 0)).toBeLessThan(0.3);
  });

  it('never administers retired items', () => {
    const ids = new Set(forms.flatMap((f) => f.items));
    expect(ids.has('CI18')).toBe(false);
    expect(ids.has('TR05')).toBe(false);
    expect(ids.size).toBe(24);
  });
});

describe('consent configuration', () => {
  it('finds the placeholders that block the start, and accepts a filled-in copy', () => {
    expect(placeholders(DRAFT_CONSENT)).toContain('[[ETHICS_REFERENCE]]');
    const filled = JSON.parse(JSON.stringify(DRAFT_CONSENT).replace(/\[\[[A-Z0-9_]+\]\]/g, 'X'));
    expect(placeholders(filled)).toEqual([]);
    expect(validateConsent(filled)).toEqual([]);
    expect(validateConsent({ study_title: 'x' }).length).toBeGreaterThan(0);
  });
});

describe('telemetry', () => {
  it('records nothing unless a study session is recording', () => {
    const got: TelemetryEvent[] = [];
    track('step', { granularity: 'layer', direction: 1 });
    startRecording((e) => got.push(e), Date.now());
    track('step', { granularity: 'layer', direction: 1 });
    stopRecording();
    track('step', { granularity: 'layer', direction: 1 });
    expect(got).toHaveLength(1);
  });

  it('summarises events into the data-dictionary features', () => {
    const ev = (t_ms: number, event: string, detail: TelemetryEvent['detail'] = {}): TelemetryEvent => ({
      t_ms,
      event,
      detail,
    });
    const s = summarise([
      ev(0, 'experiment_start', { experiment: 'single-neuron' }),
      ev(1000, 'step', { granularity: 'layer', direction: 1, verbosity: 'novice' }),
      ev(2000, 'step', { granularity: 'layer', direction: -1, verbosity: 'detailed' }),
      ev(3000, 'step', { granularity: 'operation', direction: 1, verbosity: 'detailed' }),
      ev(4000, 'jump', { verbosity: 'novice' }),
      ev(5000, 'breakpoint', { kind: 'vanishing', on: true }),
      ev(5500, 'breakpoint', { kind: 'vanishing', on: false }),
      ev(6000, 'explain_open', { verbosity: 'detailed' }),
      ev(7000, 'view', { view: 'Explanation' }),
      ev(8000, 'param_edit'),
      ev(9000, 'walkthrough_step', { step: 2 }),
      ev(100_000, 'experiment_complete', { experiment: 'single-neuron' }),
    ]);
    expect(s).toMatchObject({
      steps_total: 3,
      steps_layer: 2,
      steps_operation: 1,
      back_steps: 1,
      jumps: 1,
      breakpoints_set: 1,
      explanation_opens: 1,
      view_switches: 1,
      param_edits: 1,
      walkthrough_steps: 1,
      experiments_started: 1,
      experiments_completed: 1,
      idle_gaps: 1,
      active_time_s: 60,
    });
    expect(s.explanation_detailed_share).toBe(0.5);
  });
});

describe('CSV and ZIP', () => {
  it('quotes commas, quotes and newlines and leaves null cells empty', () => {
    expect(toCsv(['a', 'b'], [{ a: 'x, "y"\nz', b: null }])).toBe('a,b\r\n"x, ""y""\nz",\r\n');
  });

  it('writes a ZIP that Python’s zipfile reads back byte for byte', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    const dir = mkdtempSync(resolve(tmpdir(), 'zip-'));
    const files = [
      { name: 'a.csv', text: 'x,y\r\n1,2\r\n' },
      { name: 'b.csv', text: 'é,ü\r\n' },
    ];
    writeFileSync(`${dir}/t.zip`, zip(files));
    const out = execFileSync('python3', [
      '-c',
      'import sys,zipfile,json; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(json.dumps({n: z.read(n).decode() for n in z.namelist()}))',
      `${dir}/t.zip`,
    ]).toString();
    expect(JSON.parse(out)).toEqual({ 'a.csv': files[0].text, 'b.csv': files[1].text });
  });
});

/** Runs one participant through the store, answering with `skill` (probability of a correct answer). */
function runParticipant(opts: {
  familiarity: Demographics['familiarity'];
  skill: number;
  rng: Rng;
  withdrawAt?: string;
  decline?: boolean;
}): string {
  const s = useStudy.getState();
  const id = s.start();
  if (opts.decline) {
    s.consentDecision(false);
    s.close();
    return id;
  }
  s.consentDecision(true);
  s.submitDemographics({
    year_of_study: 2,
    prior_ml_course: 0,
    programming_years: '1to3',
    familiarity: opts.familiarity,
  });
  const answer = (phase: 'pre' | 'post', skill: number) => {
    const p = activeParticipant(useStudy.getState())!;
    for (const item of p.forms[phase]!.items) {
      const it = itemById(item);
      const chosen = opts.rng.next() < skill ? it.answer : (it.answer + 1 + opts.rng.int(3)) % 4;
      useStudy.getState().answer(phase, opts.rng.next() < 0.03 ? null : chosen);
    }
  };
  answer('pre', opts.skill);
  if (opts.withdrawAt === 'intervention') {
    useStudy.getState().withdraw();
    useStudy.getState().close();
    return id;
  }
  const cond = activeParticipant(useStudy.getState())!.condition!;
  if (cond === 'C3')
    for (let k = 0; k < 5; k++)
      useStudy.getState().addEvent({
        t_ms: k * 1000,
        event: 'step',
        detail: { granularity: 'layer', direction: 1, verbosity: 'novice' },
      });
  useStudy.getState().finishIntervention();
  answer('post', Math.min(0.95, opts.skill + (cond === 'C3' ? 0.25 : 0.12)));
  const p = activeParticipant(useStudy.getState())!;
  if (p.stage === 'questionnaires')
    useStudy.getState().submitQuestionnaires(
      Array.from({ length: 10 }, () => 1 + opts.rng.int(5)),
      { mental: 55, physical: 5, temporal: 40, performance: 25, effort: 50, frustration: 20 },
    );
  useStudy
    .getState()
    .submitFeedback({ helped: 'The diagrams, "really".', confusing: 'Backprop, at first', suggestions: '' });
  useStudy.getState().close();
  return id;
}

describe('Study Mode session flow and export', () => {
  beforeEach(() => {
    useStudy.getState().clearAll();
    useStudy.getState().setConfig({ design: 'three_condition', override: null });
  });

  it('walks every stage in order; questionnaires only for C2 and C3', () => {
    const rng = new Rng(11);
    const stages: Record<string, string[]> = {};
    for (const c of ['C1', 'C2', 'C3'] as Condition[]) {
      useStudy.getState().setConfig({ override: c });
      const id = runParticipant({ familiarity: 2, skill: 0.5, rng });
      const p = useStudy.getState().participants.find((x) => x.participant_id === id)!;
      stages[c] = [
        p.stage,
        String(p.completed),
        p.assignment!,
        String(p.sus !== null),
        String(p.tlx !== null),
      ];
      expect(p.condition).toBe(c);
      expect(p.responses.pre).toHaveLength(20);
      expect(p.responses.post).toHaveLength(24);
      expect(p.responses.post.map((r) => r.position)).toEqual(Array.from({ length: 24 }, (_, k) => k + 1));
    }
    expect(stages.C1).toEqual(['debrief', '1', 'manual_override', 'false', 'false']);
    expect(stages.C2).toEqual(['debrief', '1', 'manual_override', 'true', 'true']);
    expect(stages.C3).toEqual(['debrief', '1', 'manual_override', 'true', 'true']);
    // The override applies to one participant only.
    expect(useStudy.getState().config.override).toBeNull();
  });

  it('time-out records the unanswered items as unanswered, with no latency for unseen ones, and moves on', () => {
    const s = useStudy.getState();
    s.start();
    s.consentDecision(true);
    s.submitDemographics({ year_of_study: 1, prior_ml_course: 0, programming_years: 'none', familiarity: 1 });
    useStudy.getState().answer('pre', 0);
    useStudy.getState().timeUp('pre');
    const p = activeParticipant(useStudy.getState())!;
    expect(p.stage).toBe('intervention');
    expect(p.responses.pre).toHaveLength(20);
    expect(p.responses.pre[1].chosen).toBeNull();
    expect(p.responses.pre[1].latency_ms).not.toBeNull();
    expect(p.responses.pre[2].latency_ms).toBeNull();
  });

  it('withdrawal deletes everything but the flow row; declining records only that the session was opened', () => {
    const rng = new Rng(5);
    const w = runParticipant({ familiarity: 4, skill: 0.6, rng, withdrawAt: 'intervention' });
    const d = runParticipant({ familiarity: 4, skill: 0.6, rng, decline: true });
    const t = exportTables(useStudy.getState().participants);
    const rw = t.participants.find((r) => r.participant_id === w)!;
    expect(rw).toMatchObject({ withdrawn: 1, consented: 1, completed: 0 });
    expect(rw.familiarity).toBeUndefined();
    expect(rw.pre_duration_s).toBeNull();
    expect(t.participants.find((r) => r.participant_id === d)).toMatchObject({
      consented: 0,
      condition: null,
    });
    for (const k of ['responses_long', 'sus', 'tlx', 'telemetry', 'telemetry_events', 'feedback'] as const)
      expect(t[k].some((r) => r.participant_id === w || r.participant_id === d)).toBe(false);
  });

  it('exports exactly the columns docs/DATA-DICTIONARY.md documents, in that order', () => {
    const md = readFileSync(resolve(root, 'docs/DATA-DICTIONARY.md'), 'utf8');
    for (const [name, cols] of Object.entries(COLUMNS)) {
      const sec = md.split(`## ${name}.csv`)[1].split('\n## ')[0];
      const documented = [...sec.matchAll(/^\| ((?:`[^`]+`(?:, | … )?)+) \|/gm)].flatMap((m) => {
        const names = [...m[1].matchAll(/`([^`]+)`/g)].map((x) => x[1]);
        if (!m[1].includes('…')) return names;
        const [a, b] = names.map((x) => Number(x.slice(-2)));
        return Array.from(
          { length: b - a + 1 },
          (_, k) => `${names[0].slice(0, -2)}${String(a + k).padStart(2, '0')}`,
        );
      });
      const expanded = documented;
      expect(expanded, name).toEqual([...cols]);
    }
  });

  it('contains no identifying fields: anonymous codes only, no free-text outside feedback', () => {
    expect(newParticipantId()).toMatch(/^P-[A-HJ-NP-Z2-9]{8}$/);
    const banned = /(^|_)(name|email|mail|ip|address|user_?agent|student|device|browser|birth)(_|$)/i;
    for (const cols of Object.values(COLUMNS)) for (const c of cols) expect(c, c).not.toMatch(banned);
    const src = [
      'store.ts',
      'export.ts',
      'telemetry.ts',
      'instrument.ts',
      'ui/Intervention.tsx',
      'ui/Screens.tsx',
      'ui/Researcher.tsx',
    ]
      .map((f) => readFileSync(resolve(root, 'src/study', f), 'utf8'))
      .join('\n');
    expect(src).not.toMatch(
      /navigator\.(userAgent|platform|language)|fetch\(|XMLHttpRequest|sendBeacon|WebSocket|document\.cookie/,
    );
  });

  it('produces an export that the analysis pipeline reads and analyses end to end', () => {
    const rng = new Rng(2027);
    for (let k = 0; k < 36; k++)
      runParticipant({
        familiarity: (1 + (k % 5)) as Demographics['familiarity'],
        skill: 0.3 + 0.1 * (k % 4),
        rng,
      });
    runParticipant({ familiarity: 3, skill: 0.5, rng, withdrawAt: 'intervention' });
    runParticipant({ familiarity: 3, skill: 0.5, rng, decline: true });
    const dir = mkdtempSync(resolve(tmpdir(), 'export-'));
    for (const f of exportFiles(useStudy.getState().participants)) writeFileSync(`${dir}/${f.name}`, f.text);
    const counts = useStudy
      .getState()
      .participants.reduce<Record<string, number>>(
        (m, p) => ((m[p.condition ?? '-'] = (m[p.condition ?? '-'] ?? 0) + 1), m),
        {},
      );
    expect(counts.C1).toBeGreaterThanOrEqual(12);
    const out = `${dir}/out`;
    execFileSync('python3', [resolve(root, 'analysis/analysis.py'), dir, out], { stdio: 'pipe' });
    const results = JSON.parse(readFileSync(`${out}/results.json`, 'utf8'));
    expect(results.consort ?? results.flow ?? results).toBeTruthy();
    const report = readFileSync(`${out}/report.md`, 'utf8');
    expect(report).not.toMatch(/ILLUSTRATIVE/); // a real export is never watermarked
    expect(report).toMatch(/SUS/);
  }, 120_000);
});
