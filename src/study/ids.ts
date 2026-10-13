/**
 * Anonymous participant codes and study seeds from the platform's
 * cryptographic generator. Nothing about the participant or the machine goes
 * into a code.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 symbols, no I/O/0/1

function randomU32(): number {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0];
}

export function newParticipantId(): string {
  const b = new Uint8Array(8);
  globalThis.crypto.getRandomValues(b);
  return 'P-' + Array.from(b, (x) => ALPHABET[x & 31]).join('');
}

export const newSeed = (): number => randomU32() | 0;
