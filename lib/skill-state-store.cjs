'use strict';

const fs = require('fs');
const path = require('path');

const statePath = path.resolve(__dirname, '../state/skill-state.json');

function readState() {
  const raw = fs.readFileSync(statePath, 'utf8');
  return JSON.parse(raw);
}

function writeState(state) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

module.exports = {
  readState,
  writeState
};
