/** Explanation Module (P4 basic form): general formula, substituted formula, plain-language sentence. */
import katex from 'katex';
import { useMemo } from 'react';
import type { TraceHeader } from '../core/npm/ir';
import type { ExecState } from '../core/npm/state';
import type { Tensor } from '../core/tensor/tensor';
import { explain } from './index';
import type { Verbosity } from './registry';

function Tex({ src, label }: { src: string; label: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(src, { throwOnError: false, displayMode: true, output: 'htmlAndMathml' });
    } catch {
      return src;
    }
  }, [src]);
  return <div className="tex" aria-label={label} dangerouslySetInnerHTML={{ __html: html }} />;
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
}

export function ExplanationPanel({
  header,
  exec,
  operands,
  focusIndex,
  verbosity,
  onVerbosity,
  changes,
}: ExplanationPanelProps) {
  const ins = exec?.current ?? null;
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
          Nothing has executed yet. Press <kbd>→</kbd> or “Step forward” to run the first instruction.
        </p>
      ) : (
        <>
          <p className="kind">
            <code>{ins.kind}</code> <span className="symbolic">{ins.symbolic}</span>
          </p>
          <p className="sentence">{e.sentence}</p>
          {verbosity === 'detailed' && e.detail && <p className="detail">{e.detail}</p>}
          <h3>In general</h3>
          <Tex src={e.general} label="General formula" />
          <h3>With this step's numbers</h3>
          <Tex src={e.substituted} label="Formula with this step's numbers" />
          {changes.length > 0 && (
            <>
              <h3>What changed since the previous step</h3>
              <ul className="changes">
                {(verbosity === 'detailed' ? changes : changes.slice(0, 3)).map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
