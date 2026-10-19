/** Participant screens: consent, demographics, the two tests, questionnaires, feedback and the end screens. */
import { useEffect, useState } from 'react';
import { displayToCanonical, FEEDBACK_ITEMS, itemById, SUS_ITEMS, TLX_ITEMS } from '../instruments';
import { consentDoc, useStudy } from '../store';
import type { Demographics, FeedbackPrompt, Participant, TlxScale } from '../types';
import { StageShell, useRemaining } from './common';

export function Consent({ p }: { p: Participant }) {
  const s = useStudy();
  const doc = consentDoc(s);
  const [ticked, setTicked] = useState<boolean[]>(doc.consent_form.statements.map(() => false));
  return (
    <StageShell p={p}>
      <section className="panel prose">
        <h2>{doc.information_sheet.title}</h2>
        {doc.information_sheet.sections.map((x) => (
          <div key={x.heading}>
            <h3>{x.heading}</h3>
            <p>{x.body}</p>
          </div>
        ))}
      </section>
      <section className="panel prose">
        <h2>{doc.consent_form.title}</h2>
        <p className="small muted">Tick each statement you agree with.</p>
        {doc.consent_form.statements.map((t, k) => (
          <label key={k} className="check">
            <input
              type="checkbox"
              checked={ticked[k]}
              onChange={() => setTicked(ticked.map((v, j) => (j === k ? !v : v)))}
            />{' '}
            {t}
          </label>
        ))}
        <div className="row-buttons">
          <button
            className="primary"
            disabled={!ticked.every(Boolean)}
            onClick={() => s.consentDecision(true)}
          >
            {doc.consent_form.agree_label}
          </button>
          <button onClick={() => s.consentDecision(false)}>{doc.consent_form.decline_label}</button>
        </div>
      </section>
    </StageShell>
  );
}

export function DemographicsForm({ p }: { p: Participant }) {
  const s = useStudy();
  const [d, setD] = useState<Partial<Demographics>>({});
  const ok = d.year_of_study && d.prior_ml_course !== undefined && d.programming_years && d.familiarity;
  const radios = <K extends keyof Demographics>(k: K, opts: [Demographics[K], string][], legend: string) => (
    <fieldset>
      <legend>{legend}</legend>
      {opts.map(([v, label]) => (
        <label key={String(v)} className="check inline">
          <input type="radio" name={k} checked={d[k] === v} onChange={() => setD({ ...d, [k]: v })} /> {label}
        </label>
      ))}
    </fieldset>
  );
  return (
    <StageShell p={p}>
      <section className="panel prose">
        <h2>About you</h2>
        <p className="small muted">
          These questions describe the group of participants. They do not identify you.
        </p>
        {radios(
          'year_of_study',
          [1, 2, 3, 4, 5, 6].map((y) => [y, y === 6 ? '6 or later' : String(y)]),
          'Year of study',
        )}
        {radios(
          'prior_ml_course',
          [
            [1, 'Yes'],
            [0, 'No'],
          ],
          'Have you taken a course on machine learning before?',
        )}
        {radios(
          'programming_years',
          [
            ['none', 'None'],
            ['lt1', 'Less than 1 year'],
            ['1to3', '1–3 years'],
            ['gt3', 'More than 3 years'],
          ],
          'Programming experience',
        )}
        {radios(
          'familiarity',
          [
            [1, '1 — none'],
            [2, '2'],
            [3, '3'],
            [4, '4'],
            [5, '5 — very familiar'],
          ],
          'How familiar are you with how neural networks are trained?',
        )}
        <button className="primary" disabled={!ok} onClick={() => s.submitDemographics(d as Demographics)}>
          Continue
        </button>
      </section>
    </StageShell>
  );
}

export function Test({ p, phase }: { p: Participant; phase: 'pre' | 'post' }) {
  const s = useStudy();
  const remaining = useRemaining(p, s.config.limits[phase]);
  const form = p.forms[phase]!;
  const k = p.responses[phase].length;
  const id = form.items[k];
  const [chosen, setChosen] = useState<number | null>(null);
  useEffect(() => {
    setChosen(null);
    s.showItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    if (remaining === 0) s.timeUp(phase);
  }, [remaining, phase, s]);
  if (!id) return null;
  const item = itemById(id);
  return (
    <StageShell p={p} remaining={remaining}>
      <section className="panel prose test" aria-labelledby="q-stem">
        <p className="small muted">
          Question {k + 1} of {form.items.length}. Choose the best answer. You cannot go back.
        </p>
        <fieldset>
          <legend id="q-stem">{item.stem}</legend>
          {form.options[id]
            .map((_, j) => displayToCanonical(form, id, j))
            .map((canonical, j) => (
              <label key={j} className="check option">
                <input
                  type="radio"
                  name={`q-${id}`}
                  checked={chosen === canonical}
                  onChange={() => setChosen(canonical)}
                />{' '}
                <span className="opt-letter">{'ABCD'[j]}.</span> {item.options[canonical].text}
              </label>
            ))}
        </fieldset>
        <div className="row-buttons">
          <button className="primary" disabled={chosen === null} onClick={() => s.answer(phase, chosen)}>
            Next
          </button>
          <button onClick={() => s.answer(phase, null)}>Skip this question</button>
        </div>
      </section>
    </StageShell>
  );
}

export function Questionnaires({ p }: { p: Participant }) {
  const s = useStudy();
  const [sus, setSus] = useState<(number | null)[]>(SUS_ITEMS.map(() => null));
  const [tlx, setTlx] = useState<Partial<Record<TlxScale, number>>>({});
  const ok = sus.every((x) => x !== null) && TLX_ITEMS.every((t) => tlx[t.scale] !== undefined);
  return (
    <StageShell p={p}>
      <section className="panel prose">
        <h2>Using the learning material</h2>
        <p className="small muted">
          “The system” means the learning material you just used. 1 = strongly disagree, 5 = strongly agree.
        </p>
        <table className="likert">
          <thead>
            <tr>
              <th />
              {[1, 2, 3, 4, 5].map((v) => (
                <th key={v}>{v}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SUS_ITEMS.map((q, k) => (
              <tr key={k}>
                <th scope="row" id={`sus-${k}`}>
                  {k + 1}. {q}
                </th>
                {[1, 2, 3, 4, 5].map((v) => (
                  <td key={v}>
                    <input
                      type="radio"
                      name={`sus-${k}`}
                      aria-label={`${v}`}
                      aria-describedby={`sus-${k}`}
                      checked={sus[k] === v}
                      onChange={() => setSus(sus.map((x, j) => (j === k ? v : x)))}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="panel prose">
        <h2>Workload</h2>
        <p className="small muted">
          Move each slider to the point that matches your experience of the learning task (0–100).
        </p>
        {TLX_ITEMS.map((t) => (
          <div key={t.scale} className="tlx">
            <label htmlFor={`tlx-${t.scale}`}>
              <strong>{t.title}.</strong> {t.question}
            </label>
            <div className="tlx-scale">
              <span className="small">{t.low}</span>
              <input
                id={`tlx-${t.scale}`}
                type="range"
                min={0}
                max={100}
                step={5}
                value={tlx[t.scale] ?? 50}
                className={tlx[t.scale] === undefined ? 'untouched' : ''}
                aria-valuetext={tlx[t.scale] === undefined ? 'not rated yet' : String(tlx[t.scale])}
                onChange={(e) => setTlx({ ...tlx, [t.scale]: Number(e.target.value) })}
                // Releasing the pointer or pressing a key on the slider counts as a rating, even at the starting value.
                onPointerUp={(e) => setTlx({ ...tlx, [t.scale]: Number(e.currentTarget.value) })}
                onKeyUp={(e) => setTlx({ ...tlx, [t.scale]: Number(e.currentTarget.value) })}
              />
              <span className="small">{t.high}</span>
              <output className="small">{tlx[t.scale] ?? '—'}</output>
            </div>
          </div>
        ))}
        <button
          className="primary"
          disabled={!ok}
          onClick={() => s.submitQuestionnaires(sus as number[], tlx as Record<TlxScale, number>)}
        >
          Continue
        </button>
      </section>
    </StageShell>
  );
}

export function Feedback({ p }: { p: Participant }) {
  const s = useStudy();
  const [f, setF] = useState<Record<FeedbackPrompt, string>>({ helped: '', confusing: '', suggestions: '' });
  return (
    <StageShell p={p}>
      <section className="panel prose">
        <h2>Your comments</h2>
        <p className="small muted">
          Optional. Please do not include your name or anything that could identify you.
        </p>
        {FEEDBACK_ITEMS.map((x) => (
          <div key={x.prompt} className="fb">
            <label htmlFor={`fb-${x.prompt}`}>{x.text}</label>
            <textarea
              id={`fb-${x.prompt}`}
              rows={3}
              maxLength={2000}
              value={f[x.prompt]}
              onChange={(e) => setF({ ...f, [x.prompt]: e.target.value })}
            />
          </div>
        ))}
        <button className="primary" onClick={() => s.submitFeedback(f)}>
          Finish
        </button>
      </section>
    </StageShell>
  );
}

export function End({ p }: { p: Participant }) {
  const s = useStudy();
  const doc = consentDoc(s);
  const text =
    p.stage === 'debrief'
      ? doc.debrief.body
      : p.stage === 'declined'
        ? 'Thank you for considering the study. Nothing has been recorded apart from the fact that this session was opened.'
        : 'You have withdrawn from the study. Your answers from this session have been deleted.';
  return (
    <StageShell p={p}>
      <section className="panel prose">
        <h2>{p.stage === 'debrief' ? doc.debrief.title : 'Thank you'}</h2>
        <p>{text}</p>
        {p.stage === 'debrief' && (
          <p>
            Your participant code: <strong className="code">{p.participant_id}</strong>
          </p>
        )}
        <p className="small muted">Please tell the researcher that you have finished.</p>
        <button onClick={() => s.close()}>Researcher: end this session</button>
      </section>
    </StageShell>
  );
}
