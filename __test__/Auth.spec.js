const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const bcrypt = require('bcrypt');

beforeAll(async () => {
  await sequelize.sync();
});

beforeEach(async () => {
  await User.destroy({ truncate: true });
});

const addUser = async () => {
  const user = {
    username: 'user1',
    email: 'user1@mail.com',
    password: 'P4ssword',
    inactive: false,
  };
  const hash = await bcrypt.hash(user.password, 10);
  user.password = hash;
  await User.create(user);
};

const postAuthenticatoion = async (credentials) => {
  return await request(app).post('/api/1.0/auth').send(credentials);
};

describe('Authentication', () => {
  it('returns 200 when credentials are correct', async () => {
    await addUser();
    const response = await postAuthenticatoion({
      email: 'user1@mail.',
      password: 'P4ssword',
    });
    expect(response.status).toBe(200);
  });
});
