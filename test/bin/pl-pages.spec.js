import * as plpages from '../../lib/index.js';
import beforeAdd from './fixtures/beforeAdd.js';
import cli from '../../bin/pl-pages.js';
import sinon from 'sinon';
import {assert} from '../helper.js';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);

describe('pl-pages', () => {
  describe('main', () => {
    beforeEach(() => {
      sinon
        .stub(plpages, 'publish')
        .callsFake((basePath, config, callback) => callback());
    });

    afterEach(() => {
      plpages.publish.restore();
    });

    const scenarios = [
      {
        args: ['--dist', 'lib'],
        dist: 'lib',
        config: plpages.defaults,
      },
      {
        args: ['--dist', 'lib', '-n'],
        dist: 'lib',
        config: {push: false},
      },
      {
        args: ['--dist', 'lib', '-f'],
        dist: 'lib',
        config: {history: false},
      },
      {
        args: ['--dist', 'lib', '-x'],
        dist: 'lib',
        config: {silent: true},
      },
      {
        args: ['--dist', 'lib', '--dotfiles'],
        dist: 'lib',
        config: {dotfiles: true},
      },
      {
        args: ['--dist', 'lib', '--dest', 'target'],
        dist: 'lib',
        config: {dest: 'target'},
      },
      {
        args: ['--dist', 'lib', '-a', 'target'],
        dist: 'lib',
        config: {add: true},
      },
      {
        args: ['--dist', 'lib', '--git', 'path/to/git'],
        dist: 'lib',
        config: {git: 'path/to/git'},
      },
      {
        args: ['--dist', 'lib', '--user', 'Full Name <email@example.com>'],
        dist: 'lib',
        config: {user: {name: 'Full Name', email: 'email@example.com'}},
      },
      {
        args: ['--dist', 'lib', '--user', 'email@example.com'],
        dist: 'lib',
        config: {user: {name: null, email: 'email@example.com'}},
      },
      {
        args: ['--dist', 'lib', '-u', 'Full Name <email@example.com>'],
        dist: 'lib',
        config: {user: {name: 'Full Name', email: 'email@example.com'}},
      },
      {
        args: [
          '--dist',
          'lib',
          '--before-add',
          require.resolve('./fixtures/beforeAdd'),
        ],
        dist: 'lib',
        config: {beforeAdd},
      },
      {
        args: ['--dist', 'lib', '-u', 'junk email'],
        dist: 'lib',
        error:
          'Could not parse name and email from user option "junk email" (format should be "Your Name <email@example.com>")',
      },
    ];

    scenarios.forEach(({args, dist, config, error}) => {
      let title = args.join(' ');
      if (error) {
        title += ' (user error)';
      }
      it(title, async () => {
        try {
          await cli(['node', 'pl-pages'].concat(args));
        } catch (err) {
          if (!error) {
            throw err;
          }
          assert.equal(err.message, error);
          return;
        }

        if (error) {
          throw new Error(`Expected error "${error}" but got success`);
        }

        sinon.assert.calledWithMatch(plpages.publish, dist, config);
      });
    });
  });
});
