/**
 * The trace grammar of docs/NPM-SPEC.md §3, compiled to a regular expression
 * over one-character codes per instruction kind. Every well-formed trace's
 * kind sequence matches it; tests check this for every planned architecture.
 */
import type { Instruction } from './ir';
import { kindSpec } from './kinds';

const CODE: Record<string, string> = {
  INIT_PARAM: 'I',
  EPOCH_BEGIN: 'E',
  EPOCH_END: 'e',
  BATCH_BEGIN: 'B',
  BATCH_END: 'b',
  EVAL_BEGIN: 'V',
  EVAL_END: 'v',
  LOAD_INPUT: 'X',
  FORWARD_LAYER_END: 'F',
  BACKWARD_LAYER_END: 'R',
  COMPUTE_LOSS: 'C',
  LOSS_REDUCE: 'L',
  GRAD_INIT: 'G',
  GRAD_ACCUMULATE: 'A',
  OPTIMIZER_STATE: 'O',
  COMPUTE_UPDATE: 'U',
  APPLY_UPDATE: 'P',
};

/** Forward/backward computational kinds (built-in or extension) map to 'f' and 'g' by phase. */
function code(kind: string): string {
  if (CODE[kind]) return CODE[kind];
  const phase = kindSpec(kind).phase;
  if (phase === 'forward') return 'f';
  if (phase === 'backward') return 'g';
  throw new Error(`kind ${kind} has no grammar category`);
}

//   trace    ::= INIT_PARAM+ epoch*
//   epoch    ::= EPOCH_BEGIN batch+ EVAL_BEGIN EVAL_END EPOCH_END
//   batch    ::= BATCH_BEGIN sample+ LOSS_REDUCE update+ BATCH_END
//   sample   ::= LOAD_INPUT fwdLayer+ COMPUTE_LOSS GRAD_INIT bwdLayer*
//   fwdLayer ::= fwdOp+ FORWARD_LAYER_END
//   bwdLayer ::= bwdOp+ BACKWARD_LAYER_END
//   update   ::= GRAD_ACCUMULATE OPTIMIZER_STATE? COMPUTE_UPDATE APPLY_UPDATE
const SAMPLE = 'X(?:f+F)+CG(?:g+R)*';
const UPDATE = 'AO?UP';
const BATCH = `B(?:${SAMPLE})+L(?:${UPDATE})+b`;
const EPOCH = `E(?:${BATCH})+Vve`;
export const TRACE_GRAMMAR = new RegExp(`^I+(?:${EPOCH})*$`);

export function kindSequence(instructions: readonly Instruction[]): string {
  return instructions.map((i) => code(i.kind)).join('');
}

export function conformsToGrammar(instructions: readonly Instruction[]): boolean {
  return TRACE_GRAMMAR.test(kindSequence(instructions));
}
