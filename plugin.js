import path from 'path';
import {publish} from './lib/index.js';

export default function (pluginConfig, config, callback) {
  publish(path.join(process.cwd(), config.basePath), config, callback);
}
