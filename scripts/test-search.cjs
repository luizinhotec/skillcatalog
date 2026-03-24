'use strict';

const { searchSkills } = require('../lib/skill-search.cjs');

console.log('--- Buscar por protocolo hermetica ---');
console.log(searchSkills({ protocol: 'hermetica' }));

console.log('--- Buscar guards ---');
console.log(searchSkills({ type: 'guard' }));