/**
 * One learner parameter (Fix Round 3, ADR-055). A numeric parameter is a text field for an exact value:
 * Enter or leaving the field applies it.
 *
 * - A valid value is used exactly as typed, never clamped.
 * - A rejected value stays in the field with a message naming the valid range, and the run is left as it was.
 * - Where the experiment drags a value (a starting weight), the slider and the field show the same state.
 * - Presets, where declared, are suggestions in a list attached to the field.
 *
 * A choice parameter (activation, loss) is a select.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { isNumeric, paramLabel, paramPresets, parseNumber, type Validation } from '../../experiments/params';
import { hasSlider } from '../../experiments/controls';
import type { EditableParam } from '../../experiments/types';

const LOSS_NAME: Record<string, string> = {
  bce: 'cross-entropy',
  mse: 'squared error',
  cce: 'categorical cross-entropy',
};

export function ParamField({
  param,
  control,
  value,
  disabled,
  validate,
  onApply,
  label = paramLabel(param),
}: {
  param: EditableParam;
  /** The `data-control` id of the field (invariant A); the slider is `<control>:slider`. */
  control: string;
  value: number | string;
  disabled?: boolean;
  validate(raw: string): Validation;
  onApply(v: number | string): void;
  label?: string;
}) {
  const id = useId();
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    setText(String(value));
    setError(null);
  }, [value]);
  const commit = (raw = text): void => {
    if (raw.trim() === String(value)) {
      setError(null);
      return;
    }
    const r = validate(raw);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setError(null);
    onApply(r.value);
  };

  if (!isNumeric(param)) {
    const opts = paramPresets(param);
    return (
      <div className="param-field">
        <label htmlFor={id}>{label}</label>
        <select
          id={id}
          data-control={control}
          value={String(value)}
          disabled={disabled}
          onChange={(e) => commit(e.target.value)}
        >
          {opts.map((o) => (
            <option key={String(o)} value={String(o)}>
              {param.kind === 'loss' ? (LOSS_NAME[String(o)] ?? String(o)) : String(o)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const presets = paramPresets(param);
  const slider = !hasSlider(param)
    ? null
    : param.kind === 'initialValue'
      ? { min: param.min, max: param.max, step: param.step }
      : param.kind === 'probe'
        ? { min: param.min!, max: param.max!, step: (param.max! - param.min!) / 100 }
        : null;
  const errId = `${id}-error`;
  return (
    <div className="param-field">
      <label htmlFor={id}>{label}</label>
      <span className="param-inputs">
        {slider && (
          <input
            type="range"
            aria-label={`${label} (drag)`}
            data-control={`${control}:slider`}
            min={slider.min}
            max={slider.max}
            step={slider.step}
            // While a drag is pending, the slider follows the field's text, not the last applied value.
            value={parseNumber(text) ?? Number(value)}
            disabled={disabled}
            onChange={(e) => {
              // A drag regenerates the run once the learner pauses, not at every intermediate value.
              const v = e.target.value;
              setText(v);
              window.clearTimeout(timer.current);
              timer.current = window.setTimeout(() => commit(v), 350);
            }}
          />
        )}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          className="param-number"
          data-control={control}
          value={text}
          disabled={disabled}
          list={presets.length ? `${id}-presets` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setText(String(value));
              setError(null);
            }
          }}
        />
        {presets.length > 0 && (
          <datalist id={`${id}-presets`}>
            {presets.map((o) => (
              <option key={String(o)} value={String(o)} />
            ))}
          </datalist>
        )}
      </span>
      {error && (
        <p className="param-error" id={errId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
