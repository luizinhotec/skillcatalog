'use strict';

const fs = require('fs');
const path = require('path');

const catalogPath = path.resolve(__dirname, '../config/skill-catalog.json');

function loadCatalog() {
  const raw = fs.readFileSync(catalogPath, 'utf8');
  return JSON.parse(raw);
}

function getAllSkills() {
  const catalog = loadCatalog();
  return catalog.skills || [];
}

function getSkillById(id) {
  return getAllSkills().find(s => s.id === id) || null;
}

module.exports = {
  loadCatalog,
  getAllSkills,
  getSkillById
};