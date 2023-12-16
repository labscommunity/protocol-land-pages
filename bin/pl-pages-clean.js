#!/usr/bin/env node

const plpages = require('../lib/index.js');

function main() {
  plpages.clean();
}

if (require.main === module) {
  main();
}

module.exports = main;
