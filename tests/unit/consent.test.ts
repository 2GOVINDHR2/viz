import { describe, expect, it } from 'vitest';
import consent from '../../src/study/config/consent.json';

describe('consent configuration', () => {
  it('states voluntariness, no effect on grades, withdrawal and no PII', () => {
    const text = JSON.stringify(consent).toLowerCase();
    expect(text).toContain('voluntary');
    expect(text).toContain('marks');
    expect(text).toContain('withdraw');
    expect(text).toMatch(/do not record your name/);
  });

  it('marks the unfilled placeholders explicitly so Study Mode can refuse to start', () => {
    const placeholders = JSON.stringify(consent).match(/\[\[[A-Z_]+\]\]/g) ?? [];
    expect(placeholders.length).toBeGreaterThan(0);
  });

  it('requires explicit opt-in with a separate decline option', () => {
    expect(consent.consent_form.statements.length).toBeGreaterThanOrEqual(5);
    expect(consent.consent_form.agree_label).not.toBe(consent.consent_form.decline_label);
  });
});
