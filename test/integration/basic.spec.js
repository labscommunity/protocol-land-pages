import * as helper from '../helper.js';
import * as plPages from '../../lib/index.js';
import path from 'path';

const fixtures = path.join(helper.__dirname, 'fixtures');
const fixtureName = 'basic';

beforeEach(() => {
  plPages.clean();
});

describe('basic usage', () => {
  it('pushes the contents of a directory to a pl-pages branch', (done) => {
    const local = path.join(fixtures, fixtureName, 'local');
    const expected = path.join(fixtures, fixtureName, 'expected');
    const branch = 'pl-pages';

    helper.setupRemote(fixtureName, {branch}).then((url) => {
      const options = {
        repo: url,
        user: {
          name: 'User Name',
          email: 'user@email.com',
        },
      };
      plPages.publish(local, options, (err) => {
        if (err) {
          return done(err);
        }
        helper
          .assertContentsMatch(expected, url, branch)
          .then(() => done())
          .catch(done);
      });
    });
  });

  it('can push to a different branch', (done) => {
    const local = path.join(fixtures, fixtureName, 'local');
    const branch = 'master';

    helper.setupRemote(fixtureName, {branch}).then((url) => {
      const options = {
        repo: url,
        branch: branch,
        user: {
          name: 'User Name',
          email: 'user@email.com',
        },
      };
      plPages.publish(local, options, (err) => {
        if (err) {
          return done(err);
        }
        helper
          .assertContentsMatch(local, url, branch)
          .then(() => done())
          .catch(done);
      });
    });
  });
});
