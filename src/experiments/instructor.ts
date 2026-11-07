/**
 * The instructor view (Fix Round 6, C; ADR-083): every experiment opened for a demonstration, without completing
 * anything. It is a separate switch beside the learner's progress, never written into it, so the comprehension gate
 * is unchanged for learners and turning the view off restores exactly the locks the learner had.
 *
 * It is kept in localStorage under its own key (guarded: storage can be unavailable), and can be turned on by a link
 * carrying `?instructor=open`, for a prepared demonstration.
 */
const KEY = 'dl-vizlab.instructor-open.v1';

export function loadInstructorOpen(search: string = globalThis.location?.search ?? ''): boolean {
  try {
    if (new URLSearchParams(search).get('instructor') === 'open') return true;
    return globalThis.localStorage?.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function saveInstructorOpen(on: boolean): void {
  try {
    if (on) globalThis.localStorage?.setItem(KEY, '1');
    else globalThis.localStorage?.removeItem(KEY);
  } catch {
    // Storage unavailable: the view lasts for this session only.
  }
}

/** Whether a chip can be opened: the learner's own lock, or the instructor view for any available experiment. */
export function openable(unlockedByProgress: boolean, available: boolean, instructorOpen: boolean): boolean {
  return unlockedByProgress || (instructorOpen && available);
}
