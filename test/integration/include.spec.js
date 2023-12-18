import * as helper from '../helper.js';
import * as plPages from '../../lib/index.js';
import path from 'path';

const fixtures = path.join(helper.__dirname, 'fixtures');
const fixtureName = 'include';

beforeEach(() => {
  plPages.clean();
});

describe('the src option', () => {
  it('can be used to limit which files are included', (done) => {
    const local = path.join(fixtures, fixtureName, 'local');
    const expected = path.join(fixtures, fixtureName, 'expected');
    const branch = 'pl-pages';

    helper.setupRemote(fixtureName, {branch}).then((url) => {
      const options = {
        repo: url,
        src: '**/*.js',
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
