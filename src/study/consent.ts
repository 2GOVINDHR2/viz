/**
 * The consent document. The bundled draft (config/consent.json) can be
 * replaced by the ethics-approved file at the study machine; Study Mode
 * refuses to start while any [[PLACEHOLDER]] remains.
 */
import draft from './config/consent.json';

export type ConsentDoc = typeof draft;
export const DRAFT_CONSENT: ConsentDoc = draft;

export const placeholders = (doc: unknown): string[] => [
  ...new Set(JSON.stringify(doc).match(/\[\[[A-Z0-9_]+\]\]/g) ?? []),
];

/** Checks that a dropped-in file has every field the screens use. */
export function validateConsent(doc: unknown): string[] {
  const d = doc as Partial<ConsentDoc> | null;
  const errs: string[] = [];
  if (!d || typeof d !== 'object') return ['not a JSON object'];
  if (typeof d.study_title !== 'string') errs.push('study_title missing');
  if (!Array.isArray(d.information_sheet?.sections) || d.information_sheet.sections.length === 0)
    errs.push('information_sheet.sections missing');
  const f = d.consent_form;
  if (!Array.isArray(f?.statements) || f.statements.length === 0)
    errs.push('consent_form.statements missing');
  for (const k of ['agree_label', 'decline_label', 'withdraw_label', 'withdraw_confirmation'] as const)
    if (typeof f?.[k] !== 'string') errs.push(`consent_form.${k} missing`);
  if (typeof d.debrief?.body !== 'string') errs.push('debrief.body missing');
  return errs;
}
