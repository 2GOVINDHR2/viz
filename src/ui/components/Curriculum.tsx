/** Curriculum strip: every experiment in order, with completion and prerequisite locks. */
import { isComplete, isUnlocked } from '../../experiments/progress';
import { EXPERIMENTS, experimentById } from '../../experiments/registry';
import { useLab } from '../store';

export function Curriculum() {
  const { experimentId, progress, load, generating } = useLab();
  return (
    <nav className="curriculum" aria-label="Curriculum">
      {(['core', 'diagnostic'] as const).map((track) => (
        <ol
          key={track}
          className={`track ${track}`}
          aria-label={track === 'core' ? 'Core experiments' : 'Diagnostic experiments'}
        >
          {EXPERIMENTS.filter((e) => e.track === track).map((e) => {
            const unlocked = isUnlocked(e.id, progress);
            const done = isComplete(e.id, progress);
            const current = e.id === experimentId;
            const why =
              e.status === 'planned'
                ? 'coming in a later version'
                : unlocked
                  ? done
                    ? 'completed'
                    : 'available'
                  : `complete “${experimentById(e.prerequisite as string).title}” first`;
            return (
              <li key={e.id}>
                <button
                  className={`exp-chip${current ? ' current' : ''}${done ? ' done' : ''}`}
                  disabled={!unlocked || generating}
                  aria-current={current ? 'step' : undefined}
                  title={why}
                  aria-label={`${e.number}. ${e.title} — ${why}`}
                  onClick={() => void load(e.id)}
                >
                  <span className="exp-num">{e.number}</span>
                  <span className="exp-title">{e.title}</span>
                  <span className="exp-state" aria-hidden="true">
                    {done ? '✓' : unlocked ? '' : e.status === 'planned' ? '…' : '🔒'}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      ))}
    </nav>
  );
}
