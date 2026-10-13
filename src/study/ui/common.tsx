/** Shared pieces of the participant screens: stage header with timer and the always-visible withdraw control. */
import { useEffect, useState, type ReactNode } from 'react';
import { consentDoc, useStudy } from '../store';
import type { Participant, Stage } from '../types';
import { hasQuestionnaires } from '../types';

export function stagesFor(p: Participant): Stage[] {
  return [
    'consent',
    'demographics',
    'pre',
    'intervention',
    'post',
    ...(hasQuestionnaires(p.condition) ? (['questionnaires'] as Stage[]) : []),
    'feedback',
    'debrief',
  ];
}

const STAGE_NAME: Partial<Record<Stage, string>> = {
  consent: 'Information and consent',
  demographics: 'About you',
  pre: 'Questions (part 1)',
  intervention: 'Learning',
  post: 'Questions (part 2)',
  questionnaires: 'Your experience',
  feedback: 'Your comments',
  debrief: 'Thank you',
};

/** Seconds left in a timed stage, updated every second; null when untimed. */
export function useRemaining(p: Participant, limit: number | null): number | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (limit === null) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [limit]);
  return limit === null ? null : Math.max(0, limit - (now - p.stageStartedAt) / 1000);
}

export const clock = (s: number): string =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function StageShell({
  p,
  remaining,
  children,
  wide,
}: {
  p: Participant;
  remaining?: number | null;
  children: ReactNode;
  wide?: boolean;
}) {
  const s = useStudy();
  const doc = consentDoc(s);
  const stages = stagesFor(p);
  const k = stages.indexOf(p.stage);
  const canWithdraw = p.consented === 1 && p.stage !== 'debrief';
  return (
    <div className={`study${wide ? ' wide' : ''}`}>
      <header className="study-bar">
        <div>
          <strong>{doc.study_title}</strong>
          {k >= 0 && (
            <span className="muted small">
              {' '}
              · Part {k + 1} of {stages.length}: {STAGE_NAME[p.stage]}
            </span>
          )}
        </div>
        <div className="study-bar-right">
          {remaining !== undefined && remaining !== null && (
            <span
              className={`timer${remaining < 60 ? ' low' : ''}`}
              role="timer"
              aria-label={`Time left ${clock(remaining)}`}
            >
              ⏱ {clock(remaining)}
            </span>
          )}
          {canWithdraw && (
            <button
              className="withdraw"
              onClick={() => {
                if (window.confirm(doc.consent_form.withdraw_confirmation)) s.withdraw();
              }}
            >
              {doc.consent_form.withdraw_label}
            </button>
          )}
        </div>
      </header>
      <main className="study-main">{children}</main>
    </div>
  );
}
