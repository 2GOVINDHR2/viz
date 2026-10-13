import '../autodiff';
import './kinds';

export * from './ir';
export { NpmEmitter, type EmitterState } from './emitter';
export {
  kindSpec,
  opMapping,
  registerInstructionKind,
  registerOpMapping,
  registeredKinds,
  registeredMappings,
  type KindSpec,
  type OpMapping,
} from './kinds';
export { serializeTrace, deserializeTrace, encodeTensor, decodeTensor } from './serialize';
export { TraceStore, instructionBytes, type Segment, type StoreStats } from './store';
export {
  GRANULARITIES,
  StatsAccumulator,
  traceStatistics,
  unitKey,
  type Granularity,
  type TraceStatistics,
} from './stats';
export { TRACE_GRAMMAR, conformsToGrammar, kindSequence } from './grammar';
export { memorySource, storeSource, type TraceSource } from './source';
export { BEFORE_START, clampCursor, stepBackward, stepForward, unitBounds, walk } from './navigator';
export { firstBreak, runToBreakpoint, type BreakHit, type Breakpoint } from './breakpoints';
export { PATHOLOGIES, type Pathology } from './pathologies';
export {
  epochSummaries,
  reconstructState,
  type EpochSummary,
  type ExecState,
  type LayerState,
  type UpdateState,
} from './state';
