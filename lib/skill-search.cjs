'use strict';

const { getAllSkills } = require('./skill-registry.cjs');

function searchSkills(query = {}) {
  const skills = getAllSkills();

  return skills.filter(skill => {
    if (query.type && skill.type !== query.type) return false;

    if (query.protocol && !skill.protocols?.includes(query.protocol)) return false;

    if (query.tag && !skill.tags?.includes(query.tag)) return false;

    if (query.route && !skill.routes?.includes(query.route)) return false;

    if (query.rule && !skill.rules?.includes(query.rule)) return false;

    return true;
  });
}

module.exports = {
  searchSkills
};