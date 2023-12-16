const plPages = require('./lib/index.js');
const path = require('path');

module.exports = function (pluginConfig, config, callback) {
  plPages.publish(path.join(process.cwd(), config.basePath), config, callback);
};
