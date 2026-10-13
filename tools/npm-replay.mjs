#!/usr/bin/env node
/**
 * Second, independent consumer of the Neural Program Model: replays a trace
 * file as text, step by step, at any granularity. It shares no code with the
 * DL-VizLab application — it needs only the trace and docs/NPM-SPEC.md — which
 * demonstrates that the IR, not the renderer, carries the semantics.
 *
 *   node tools/npm-replay.mjs trace.json [--granularity operation|layer|phase|sample|batch|epoch] [--limit N] [--values]
 */
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const granularity = opt('granularity', 'operation');
const limit = Number(opt('limit', 60));
const showValues = args.includes('--values');
if (!file) {
  console.error('usage: npm-replay.mjs trace.json [--granularity G] [--limit N] [--values]');
  process.exit(2);
}

const trace = JSON.parse(readFileSync(file, 'utf8'));
const { header, instructions } = trace;
const LEVELS = ['epoch', 'batch', 'sample', 'phase', 'layer'];

/** The nesting key that groups instructions into one step at the chosen granularity (spec §5). */
function unitKey(ins) {
  if (granularity === 'operation') return String(ins.id);
  const depth = { epoch: 1, batch: 2, sample: 3, phase: 4, layer: 5 }[granularity];
  if (!depth) throw new Error(`unknown granularity ${granularity}`);
  return LEVELS.slice(0, depth)
    .map((l) => String(ins.path[l]))
    .join('/');
}

const dec = (v) => (typeof v === 'string' ? Number(v === '-0' ? -0 : v) : v);
function fmtTensor(t) {
  const data = t.data.map(dec);
  const shown = data.slice(0, 6).map((v) => (Number.isInteger(v) ? String(v) : v.toPrecision(4)));
  return `[${t.shape.join('×') || 'scalar'}] ${shown.join(', ')}${data.length > 6 ? `, … (${data.length - 6} more)` : ''}`;
}

function describe(ins) {
  const where = LEVELS.filter((l) => ins.path[l] !== null)
    .map((l) => `${l}=${ins.path[l]}`)
    .join(' ');
  const operands = ins.operands.map((o) => `${o.role}←#${o.ref}.${o.slot}`).join(', ');
  const lines = [
    `  #${String(ins.id).padStart(5)} ${ins.kind.padEnd(18)} ${ins.symbolic}`,
    `         ${where}${operands ? `  [${operands}]` : ''}`,
  ];
  if (showValues)
    for (const [slot, t] of Object.entries(ins.results)) lines.push(`         ${slot} = ${fmtTensor(t)}`);
  return lines.join('\n');
}

console.log(
  `NPM trace v${header.version} · ${header.dataset.name} · ${header.model.layers.map((l) => `${l.type}${l.outShape.join('×')}`).join(' → ')}`,
);
console.log(`${instructions.length} instructions, seed ${header.seed}, granularity "${granularity}"\n`);

let steps = 0;
let i = 0;
while (i < instructions.length && steps < limit) {
  const key = unitKey(instructions[i]);
  const group = [];
  while (i < instructions.length && unitKey(instructions[i]) === key) group.push(instructions[i++]);
  steps++;
  const first = group[0];
  const last = group[group.length - 1];
  console.log(
    `step ${steps}: ${group.length} instruction${group.length > 1 ? 's' : ''} (#${first.id}–#${last.id})`,
  );
  if (group.length <= 8 || granularity === 'operation') group.forEach((g) => console.log(describe(g)));
  else {
    console.log(describe(first));
    console.log(`         … ${group.length - 2} more …`);
    console.log(describe(last));
  }
}
if (i < instructions.length)
  console.log(`\n(stopped after ${limit} steps; ${instructions.length - i} instructions remain)`);
