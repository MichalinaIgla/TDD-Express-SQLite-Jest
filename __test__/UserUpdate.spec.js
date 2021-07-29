const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const en = require('../src/locales/en/translation.json');
const pl = require('../src/locales/pl/translation.json');

beforeAll(async () => {
  await sequelize.sync();
});

beforeEach(async () => {
  await User.destroy({ truncate: true });
});

describe('User update', () => {
  it('returns forbidden when request sent without basic authorization', async () => {
    const response = await request(app).put('/api/1.0/users/5').send();
    expect(response.status).toBe(403);
  });

  it.each`
    language | message
    ${'pl'}  | ${pl.unauthenticated_user_update}
    ${'en'}  | ${en.unauthenticated_user_update}
  `(
    'returns error body with $message for unauthroized request when language is $language',
    async ({ language, message }) => {
      const nowInMillis = new Date().getTime();
      const response = await request(app)
        .put('/api/1.0/users/5')
        .set('Accept-Language', language)
        .send();
      expect(response.body.path).toBe('/api/1.0/users/5');
      expect(response.body.timestamp).toBeGreaterThan(nowInMillis);
      expect(response.body.message).toBe(message);
    }
  );
});
