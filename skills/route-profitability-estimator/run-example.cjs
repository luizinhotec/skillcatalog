'use strict';

const fs = require('fs');
const path = require('path');
const { run } = require('./index.cjs');

const SKILL_NAME = 'route-profitability-estimator';
const SCHEMA_VERSION = '1.1.0';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function stableStringify(value) {
  return JSON.stringify(value, null, 2);
}

const filePath = process.argv[2];

if (!filePath) {
  console.error(JSON.stringify({
    ok: false,
    skill: SKILL_NAME,
    schemaVersion: SCHEMA_VERSION,
    error: 'MISSING_INPUT_FILE'
  }, null, 2));
  process.exit(1);
}

const resolvedInputPath = path.resolve(process.cwd(), filePath);
const expectedPath = resolvedInputPath.replace(/\.json$/i, '.expected.json');

let payload;

try {
  payload = readJson(resolvedInputPath);
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    skill: SKILL_NAME,
    schemaVersion: SCHEMA_VERSION,
    error: 'INVALID_INPUT_FILE'
  }, null, 2));
  process.exit(1);
}

const actual = run(payload);

if (!fs.existsSync(expectedPath)) {
  process.stdout.write(stableStringify(actual) + '\n');
  process.exit(actual.ok ? 0 : 1);
}

let expected;

try {
  expected = readJson(expectedPath);
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    skill: SKILL_NAME,
    schemaVersion: SCHEMA_VERSION,
    error: 'INVALID_EXPECTED_FILE'
  }, null, 2));
  process.exit(1);
}

const actualText = stableStringify(actual);
const expectedText = stableStringify(expected);

if (actualText !== expectedText) {
  console.error(JSON.stringify({
    ok: false,
    skill: SKILL_NAME,
    schemaVersion: SCHEMA_VERSION,
    error: 'FIXTURE_MISMATCH',
    details: {
      inputFile: resolvedInputPath,
      expectedFile: expectedPath,
      actual,
      expected
    }
  }, null, 2));
  process.exit(1);
}

process.stdout.write(actualText + '\n');
process.exit(0);
