// Importing ./ops registers every built-in gradient rule as a side effect.
import './ops';

export { BCE_EPSILON } from './ops';
export { getOp, registerOp, registeredOps, type OpAttrs, type OpRule } from './registry';
export { Tape, Var, backward, type BackwardStep, type EntryMeta, type TapeEntry } from './tape';
