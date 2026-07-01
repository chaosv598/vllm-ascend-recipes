import { parse } from 'yaml';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { modelSchema } from '../src/lib/schema';

function findYamlFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      results.push(...findYamlFiles(path));
    } else if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
      results.push(path);
    }
  }
  return results;
}

const modelsDir = new URL('../models/', import.meta.url).pathname;
const files = findYamlFiles(modelsDir);

if (files.length === 0) {
  console.error('No YAML files found in models/');
  process.exit(1);
}

let hasErrors = false;

for (const file of files) {
  try {
    const raw = readFileSync(file, 'utf-8');
    const data = parse(raw);
    modelSchema.parse(data);
    console.log(`  OK  ${file}`);
  } catch (err) {
    hasErrors = true;
    console.error(` FAIL  ${file}`);
    if (err instanceof Error) {
      console.error(`       ${err.message}`);
    }
  }
}

if (hasErrors) {
  console.error('\n YAML validation failed. Fix the errors above.');
  process.exit(1);
} else {
  console.log(`\n All ${files.length} YAML files passed validation.`);
}
