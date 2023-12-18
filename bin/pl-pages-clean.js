#!/usr/bin/env node

import {clean} from '../lib/index.js';
import {pathToFileURL} from 'url';

export default function main() {
  clean();
}

if (
  import.meta.url
    .replace('pl-pages/bin', '.bin')
    .includes(pathToFileURL(process.argv[1]).href)
) {
  main();
}
