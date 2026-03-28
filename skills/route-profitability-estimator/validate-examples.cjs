'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const examplesDir = path.resolve(__dirname, 'examples');
const runnerPath = path.resolve(__dirname, 'run-example.cjs');

function listExampleFiles() {
  return fs.readdirSync(examplesDir)
    .filter((name) => name.endsWith('.json') && !name.endsWith('.expected.json'))
    .sort();
}

for (const fileName of listExampleFiles()) {
  const fixturePath = path.join(examplesDir, fileName);
  const result = spawnSync(process.execPath, [runnerPath, fixturePath], {
    encoding: 'utf8'
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
