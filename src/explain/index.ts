import './builtins';

export {
  explain,
  explainedKinds,
  hasExplainer,
  registerExplainer,
  type ExplainContext,
  type Explanation,
  type Explainer,
  type Verbosity,
} from './registry';
export { num, tex } from './format';
export { describeChanges } from './diff';
