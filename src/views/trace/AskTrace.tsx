/**
 * Ask the trace (Fix Round 5, 3.2; ADR-074): the five diagnostic questions of src/views/trace/diagnose.ts, each
 * answered from the trace alone, with the instructions that justify the answer one click away.
 */
import { useState } from 'react';
import type { Instruction, TraceHeader } from '../../core/npm/ir';
import { num } from '../../explain/format';
import { layerTitle, paramTitle } from '../../explain/names';
import {
  deadRelus,
  firstVanishing,
  largestLossExample,
  lossStoppedDecreasing,
  readersOfMostChanged,
} from './diagnose';

type Question = 'vanishing' | 'readers' | 'largest-loss' | 'dead-relu' | 'plateau';

const QUESTIONS: { id: Question; label: string; epoch?: boolean }[] = [
  { id: 'vanishing', label: 'Where does a weight gradient first fall below 10⁻⁴?' },
  { id: 'readers', label: 'Which instructions read the weight that changed most in an epoch?', epoch: true },
  {
    id: 'largest-loss',
    label: 'Which example had the largest loss in an epoch, and its forward pass?',
    epoch: true,
  },
  { id: 'dead-relu', label: 'Where did a ReLU neuron go inactive and never recover?' },
  { id: 'plateau', label: 'After which instruction did the loss stop decreasing?' },
];

interface Answer {
  text: string;
  /** Instructions to jump to, with a short label each. */
  links: { id: number; label: string }[];
  /** How many instructions the answer names in all (the links may be the first of them). */
  total?: number;
}

const MAX_LINKS = 12;

function answer(q: Question, all: Instruction[], header: TraceHeader, epoch: number): Answer {
  const at = (id: number): string => `#${(id + 1).toLocaleString('en')}`;
  switch (q) {
    case 'vanishing': {
      const r = firstVanishing(all, 1e-4);
      return r
        ? {
            text: `At ${at(r.ins.id)} (epoch ${(r.ins.path.epoch ?? 0) + 1}): the batch gradient of the ${paramTitle(header, r.param)} has no element larger than ${num(r.magnitude)}.`,
            links: [{ id: r.ins.id, label: at(r.ins.id) }],
          }
        : { text: 'No weight gradient in this run falls below 10⁻⁴.', links: [] };
    }
    case 'readers': {
      const r = readersOfMostChanged(all, epoch);
      if (!r) return { text: `Epoch ${epoch + 1} is not in this run.`, links: [] };
      return {
        text: `In epoch ${epoch + 1}, element ${r.element + 1} of the ${paramTitle(header, r.param)} changed most: ${num(r.before)} → ${num(r.after)}. ${r.readers.length.toLocaleString('en')} instructions read that tensor in the epoch.`,
        links: r.readers.slice(0, MAX_LINKS).map((id) => ({ id, label: at(id) })),
        total: r.readers.length,
      };
    }
    case 'largest-loss': {
      const r = largestLossExample(all, epoch);
      if (!r) return { text: `Epoch ${epoch + 1} is not in this run.`, links: [] };
      return {
        text: `In epoch ${epoch + 1}, training example ${r.datasetIndex + 1} had the largest loss, ${num(r.loss)}, at ${at(r.lossAt)}. Its forward pass is ${r.forward.length} instructions.`,
        links: r.forward.slice(0, MAX_LINKS).map((id) => ({ id, label: at(id) })),
        total: r.forward.length,
      };
    }
    case 'dead-relu': {
      const d = deadRelus(all);
      if (!d.length)
        return {
          text: header.model.layers.some((l) => l.activation === 'relu')
            ? 'No ReLU neuron in this run stays inactive for the rest of training.'
            : 'This run has no ReLU neurons.',
          links: [],
        };
      return {
        text: `${d.length} ReLU ${d.length === 1 ? 'neuron goes' : 'neurons go'} inactive and never recover: ${d
          .slice(0, 4)
          .map(
            (x) =>
              `neuron ${x.unit + 1} of ${layerTitle(header, x.layer)} from ${at(x.inactiveFrom)}${x.lastActive === null ? ' (never active)' : `, last active at ${at(x.lastActive)}`}`,
          )
          .join('; ')}${d.length > 4 ? '; …' : ''}.`,
        links: d.slice(0, MAX_LINKS).map((x) => ({ id: x.inactiveFrom, label: at(x.inactiveFrom) })),
        total: d.length,
      };
    }
    case 'plateau': {
      const r = lossStoppedDecreasing(all);
      return r
        ? {
            text: `After ${at(r.at)}, the end of epoch ${r.epoch + 1} (loss ${num(r.loss)}), the loss never goes lower in the ${r.later} later ${r.later === 1 ? 'epoch' : 'epochs'}.`,
            links: [{ id: r.at, label: at(r.at) }],
          }
        : {
            text: 'The loss is still at its lowest at the last epoch: it never stopped decreasing.',
            links: [],
          };
    }
  }
}

export function AskTrace({
  header,
  all,
  onJump,
}: {
  header: TraceHeader;
  /** Null while the trace is still being read: the questions are shown, and can be asked once it is. */
  all: Instruction[] | null;
  onJump(id: number): void;
}) {
  const [q, setQ] = useState<Question>('vanishing');
  const [epoch, setEpoch] = useState(0);
  const [result, setResult] = useState<Answer | null>(null);
  const spec = QUESTIONS.find((x) => x.id === q)!;
  const epochs = header.epochStarts.length - 1;
  return (
    <div className="trace-ask" role="group" aria-label="Ask the trace">
      <label>
        Ask the trace{' '}
        <select
          data-control="trace:ask"
          value={q}
          onChange={(e) => {
            setQ(e.target.value as Question);
            setResult(null);
          }}
        >
          {QUESTIONS.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
      </label>
      {spec.epoch && (
        <label>
          Epoch{' '}
          <select
            data-control="trace:ask-epoch"
            value={epoch}
            onChange={(e) => setEpoch(Number(e.target.value))}
          >
            {Array.from({ length: epochs }, (_, e) => (
              <option key={e} value={e}>
                {e + 1}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        data-control="trace:ask-run"
        disabled={!all}
        onClick={() => all && setResult(answer(q, all, header, epoch))}
      >
        Answer
      </button>
      {result && (
        <div className="trace-answer" role="status" data-answer={q}>
          <p className="small">{result.text}</p>
          {result.links.length > 0 && (
            <p className="small">
              Go to:{' '}
              {result.links.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="link"
                  data-control="trace:ask-jump"
                  onClick={() => onJump(l.id)}
                >
                  {l.label}
                </button>
              ))}
              {result.total !== undefined &&
                result.total > result.links.length &&
                ` (the first ${result.links.length} of ${result.total.toLocaleString('en')})`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
