/** Persistent indicator of what the cursor's instruction is doing: text, icon and border pattern, never colour alone. */
import type { ExecState } from '../../core/npm/state';
import { type Flow, visualMapping } from '../registry';

const MODE: Record<Flow, { text: string; icon: string; cls: string }> = {
  forward: { text: 'FORWARD PASS', icon: '▶', cls: 'mode-forward' },
  backward: { text: 'BACKWARD PASS', icon: '◀', cls: 'mode-backward' },
  update: { text: 'PARAMETER UPDATE', icon: '⟳', cls: 'mode-update' },
  none: { text: 'CONTROL', icon: '●', cls: 'mode-none' },
};

export function ModeIndicator({ exec }: { exec: ExecState | null }) {
  const mapping = exec?.current ? visualMapping(exec.current) : null;
  const mode = MODE[mapping?.flow ?? 'none'];
  return (
    <div className={`mode-indicator ${mode.cls}`} role="status" aria-live="polite">
      <span aria-hidden="true" className="mode-icon">
        {mode.icon}
      </span>
      <strong>{mode.text}</strong>
      <span className="mode-label">{mapping?.label ?? 'Ready — press Step to begin'}</span>
    </div>
  );
}
