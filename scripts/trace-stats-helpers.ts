import { explainedKinds } from '../src/explain';
export { GRANULARITIES, TraceStore, traceStatistics } from '../src/core/npm';
export const explainedKindsCount = (): number => explainedKinds().length;
