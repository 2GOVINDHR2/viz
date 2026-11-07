/** Curriculum strip: every experiment in order, with completion and prerequisite locks. */
import { openable } from '../../experiments/instructor';
import { isComplete, isUnlocked } from '../../experiments/progress';
import { EXPERIMENTS, experimentById } from '../../experiments/registry';
import { useLab } from '../store';

export function Curriculum() {
  const { experimentId, progress, load, generating, instructorOpen, setInstructorOpen } = useLab();
  return (
    <nav className="curriculum" aria-label="Curriculum">
      {instructorOpen && (
        <p className="instructor-banner" role="status">
          <strong>Instructor view:</strong> every experiment is open for demonstration. Nothing has been
          marked complete, and your own progress is unchanged.{' '}
          <button type="button" data-control="instructor:close" onClick={() => setInstructorOpen(false)}>
            Return to my own progress
          </button>
        </p>
      )}
      {(['core', 'diagnostic'] as const).map((track) => (
        <ol
          key={track}
          className={`track ${track}`}
          aria-label={track === 'core' ? 'Core experiments' : 'Diagnostic experiments'}
        >
          {EXPERIMENTS.filter((e) => e.track === track).map((e) => {
            const own = isUnlocked(e.id, progress);
            const unlocked = openable(own, e.status === 'available', instructorOpen);
            const done = isComplete(e.id, progress);
            const current = e.id === experimentId;
            const why =
              e.status === 'planned'
                ? 'coming in a later version'
                : own
                  ? done
                    ? 'completed'
                    : 'available'
                  : unlocked
                    ? 'opened by the instructor view'
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
                    {done ? '✓' : own ? '' : unlocked ? '◇' : e.status === 'planned' ? '…' : '🔒'}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      ))}
      {!instructorOpen && (
        <details className="instructor">
          <summary data-control="instructor:open-details">For instructors</summary>
          <p className="small">
            Demonstrating a later experiment? This opens every experiment without answering the questions. It
            does not mark anything complete, and it does not change a learner’s progress: “Return to my own
            progress” puts the locks back exactly as they were. A link ending in <code>?instructor=open</code>{' '}
            opens it too.
          </p>
          <button type="button" data-control="instructor:open" onClick={() => setInstructorOpen(true)}>
            Open every experiment for a demonstration
          </button>
        </details>
      )}
    </nav>
  );
}
