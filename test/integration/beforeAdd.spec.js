import * as helper from '../helper.js';
import * as plPages from '../../lib/index.js';
import path from 'path';

const fixtures = path.join(helper.__dirname, 'fixtures');
const fixtureName = 'beforeAdd';

beforeEach(() => {
  plPages.clean();
});

describe('the beforeAdd option', () => {
  it('runs a provided async function before adding files', (done) => {
    const local = path.join(fixtures, fixtureName, 'local');
    const expected = path.join(fixtures, fixtureName, 'expected');
    const branch = 'pl-pages';

    helper.setupRemote(fixtureName, {branch}).then((url) => {
      const options = {
        repo: url,
        add: true,
        beforeAdd(git) {
          return Promise.resolve().then(() => {
            return git.rm('hello-outdated-world.txt');
          });
        },
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
});
