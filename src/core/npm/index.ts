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
