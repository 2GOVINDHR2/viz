/** Explanation Module (P4 basic form): general formula, substituted formula, plain-language sentence. */
import katex from 'katex';
import { useEffect, useMemo, useState } from 'react';
import type { TraceHeader } from '../core/npm/ir';
import type { ExecState } from '../core/npm/state';
import type { Tensor } from '../core/tensor/tensor';
import { explain } from './index';
import { kindMeaning, learnerGloss, splitMarkers } from './names';
import type { Verbosity } from './registry';

function Tex({ src, label }: { src: string; label: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(src, { throwOnError: false, displayMode: true, output: 'htmlAndMathml' });
    } catch {
      return src;
    }
  }, [src]);
  return (
    <div
      className="tex"
      role="group"
      tabIndex={0}
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export interface ExplanationPanelProps {
  header: TraceHeader;
  exec: ExecState | null;
  operands: Record<string, Tensor>;
  focusIndex: number;
  verbosity: Verbosity;
  onVerbosity(v: Verbosity): void;
  /** Sentences describing what changed since the previous step. */
  changes: string[];
  /** The guided path: the instruction's meaning only, never its kind or number (ADR-062). */
  guided?: boolean;
}

export function ExplanationPanel({
  header,
  exec,
  operands,
  focusIndex,
  verbosity,
  onVerbosity,
  changes,
  guided = false,
}: ExplanationPanelProps) {
  const ins = exec?.current ?? null;
  // Verbosity is the default; each block can still be revealed or hidden in place (Fix Round 2, §2.2-3).
  const detailed = verbosity === 'detailed';
  const [showMaths, setShowMaths] = useState(detailed);
  const [showNumbers, setShowNumbers] = useState(detailed);
  useEffect(() => {
    setShowMaths(detailed);
    setShowNumbers(detailed);
  }, [detailed]);
  const e = useMemo(() => {
    if (!ins) return null;
    return explain(ins, {
      header,
      focus: focusIndex,
      verbosity,
      value: (o) => {
        const v = operands[`${o.ref}.${o.slot}`];
        if (!v) throw new Error(`operand ${o.ref}.${o.slot} not supplied`);
        return v;
      },
    });
  }, [ins, header, operands, focusIndex, verbosity]);

  return (
    <section className="panel explanation" aria-label="Explanation">
      <div className="panel-head">
        <h2>What just happened</h2>
        <div className="seg" role="radiogroup" aria-label="Explanation detail">
          {(['novice', 'detailed'] as const).map((v) => (
            <button
              data-control={`explain:${v}`}
              key={v}
              role="radio"
              aria-checked={verbosity === v}
              className={verbosity === v ? 'on' : ''}
              onClick={() => onVerbosity(v)}
            >
              {v === 'novice' ? 'Simple' : 'Detailed'}
            </button>
          ))}
        </div>
      </div>
      {!ins || !e ? (
        <p className="muted">
          {guided ? (
            <>
              Nothing has been calculated yet. Press “Next” or <kbd>→</kbd> to take the first step.
            </>
          ) : (
            <>
              The training run has not started yet. Press <kbd>→</kbd> or “Step forward” to run the first
              instruction.
            </>
          )}
        </p>
      ) : (
        <>
          {/* What this step is, in words (NPM-SPEC §4.1); the kind follows in expert mode. */}
          <p className="kind">
            <span className="meaning">{guided ? learnerGloss(header, ins) : kindMeaning(ins.kind)}</span>
            {!guided && (
              <>
                {' '}
                <code className="ident">{ins.kind}</code>
              </>
            )}
            {detailed && <span className="symbolic"> {ins.symbolic}</span>}
          </p>
          <p className="sentence">{e.sentence}</p>
          {detailed && e.detail && <p className="detail">{e.detail}</p>}
          <div className="reveal-row">
            <button
              data-control="explain:maths"
              className="link"
              aria-expanded={showMaths}
              onClick={() => setShowMaths(!showMaths)}
            >
              {showMaths ? 'Hide the maths' : 'Show the maths'}
            </button>
            <button
              data-control="explain:numbers"
              className="link"
              aria-expanded={showNumbers}
              onClick={() => setShowNumbers(!showNumbers)}
            >
              {showNumbers ? "Hide this step's numbers" : "Show this step's numbers"}
            </button>
          </div>
          {showMaths && (
            <>
              <h3>In general</h3>
              <Tex src={e.general} label="General formula" />
            </>
          )}
          {showNumbers && (
            <>
              <h3>With this step's numbers</h3>
              <Tex src={e.substituted} label="Formula with this step's numbers" />
            </>
          )}
          {changes.length > 0 && (
            <>
              <h3>What changed since the previous step</h3>
              <ul className="changes">
                {(detailed ? changes : changes.slice(0, 3)).map((c) => (
                  <li key={c}>
                    <MarkedText text={c} guided={guided} />
                  </li>
                ))}
              </ul>
              {!detailed && changes.length > 3 && (
                <p className="small muted">{changes.length - 3} more in the detailed view.</p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

/** Text with identifier markers (names.ts): the identifier is shown in expert mode only, as secondary monospace. */
function MarkedText({ text, guided }: { text: string; guided: boolean }) {
  return (
    <>
      {splitMarkers(text).map((p, k) =>
        'text' in p ? (
          <span key={k}>{p.text}</span>
        ) : guided ? null : (
          <code key={k} className="ident">
            {' '}
            {p.ident}
          </code>
        ),
      )}
    </>
  );
}
