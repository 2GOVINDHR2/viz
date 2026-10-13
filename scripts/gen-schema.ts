import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '../src/core/npm';
import { buildTraceSchema } from '../src/core/npm/schema';

const out = resolve(import.meta.dirname, '../src/core/npm/schema.json');
writeFileSync(out, JSON.stringify(buildTraceSchema(), null, 2) + '\n');
console.log(`wrote ${out}`);
