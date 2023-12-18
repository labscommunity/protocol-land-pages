import * as index from '../../lib/index.js';
import path from 'path';
import {assert} from '../helper.js';

describe('index', () => {
  describe('getCacheDir()', () => {
    it('works for git@github.com:<username>/<project>.git', () => {
      const dir = index.getCacheDir(
        'git@github.com:example-user/example-project.git'
      );

      const expected = path.join(
        '.cache',
        'pl-pages',
        'git@github.com!example-user!example-project.git'
      );
      assert(dir.endsWith(expected), `unexpected cache dir: ${dir}`);
    });

    it('works for https://github.com/<username>/<project>.git', () => {
      const dir = index.getCacheDir(
        'https://github.com/example-user/example-project.git'
      );

      const expected = path.join(
        '.cache',
        'pl-pages',
        'https!github.com!example-user!example-project.git'
      );
      assert(dir.endsWith(expected), `unexpected cache dir: ${dir}`);
    });

    it('works for https://<username>:<password>@github.com/<username>/<project>.git', () => {
      const dir = index.getCacheDir(
        'https://user:pass@github.com/example-user/example-project.git'
      );

      const expected = path.join(
        '.cache',
        'pl-pages',
        'https!user!pass@github.com!example-user!example-project.git'
      );
      assert(dir.endsWith(expected), `unexpected cache dir: ${dir}`);
    });
  });
});
