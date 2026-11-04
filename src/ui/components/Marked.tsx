/**
 * Text with expert-only identifier markers (`[[MATMUL]]`, ADR-062). The guided path shows the words only; expert
 * mode adds each identifier as secondary monospace after the words it names.
 */
import { splitMarkers } from '../../explain/names';
import { useLab } from '../store';

export function Marked({ text }: { text: string }) {
  const expert = useLab((s) => s.mode) === 'expert';
  return (
    <>
      {splitMarkers(text).map((p, k) =>
        'text' in p ? (
          <span key={k}>{p.text}</span>
        ) : expert ? (
          <code key={k} className="ident">
            {' '}
            {p.ident}
          </code>
        ) : null,
      )}
    </>
  );
}

/** An identifier shown only in expert mode, secondary to the words beside it. */
export function Ident({ children }: { children: string }) {
  const expert = useLab((s) => s.mode) === 'expert';
  return expert ? <code className="ident">{children}</code> : null;
}
