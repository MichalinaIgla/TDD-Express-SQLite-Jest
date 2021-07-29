const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const SMTPServer = require('smtp-server').SMTPServer;
const en = require('../src/locales/en/translation.json');
const pl = require('../src/locales/pl/translation.json');

let lastMail, server;
let simulateSmtpFailure = false;

beforeAll(async () => {
  server = new SMTPServer({
    authOptional: true,
    onData(stream, session, callback) {
      let mailBody;
      stream.on('data', (data) => {
        mailBody += data.toString();
      });
      stream.on('end', () => {
        if (simulateSmtpFailure) {
          const err = new Error('Invalid mailbox');
          err.responseCode = 553;
          return callback(err);
        }
        lastMail = mailBody;
        callback();
      });
    },
  });

  await server.listen(8587, 'localhost');

  await sequelize.sync();
});

beforeEach(async () => {
  simulateSmtpFailure = false;
  await User.destroy({ truncate: true });
});

afterAll(async () => {
  await server.close();
});

const ValidUser = {
  username: 'user1',
  email: 'user1@mail.com',
  password: 'P4ssword',
};

const postUser = (user = ValidUser, options = {}) => {
  const agent = request(app).post('/api/1.0/users');
  if (options.language) {
    agent.set('Accept-Language', options.language);
  }
  return agent.send(user);
};

describe('User Registration', () => {
  it('returns 200 OK when signup request is valid', async () => {
    const response = await postUser();
    expect(response.status).toBe(200);
  });

  it('returns success message when signup request is valid', async () => {
    const response = await postUser();
    expect(response.body.message).toBe(en.user_create_success);
  });

  it('saves the user to database', async () => {
    await postUser();
    const userList = await User.findAll();
    expect(userList.length).toBe(1);
  });

  it('saves the username and email to database', async () => {
    await postUser();
    const userList = await User.findAll();
    const savedUser = userList[0];
    expect(savedUser.username).toBe('user1');
    expect(savedUser.email).toBe('user1@mail.com');
  });

  it('hashes the password in database', async () => {
    await postUser();
    const userList = await User.findAll();
    const savedUser = userList[0];
    expect(savedUser.password).not.toBe('P4ssword');
  });

  it('returns 400 when user is null', async () => {
    const response = await request(app).post('/api/1.0/users').send({
      username: null,
      email: 'user1@mail.com',
      password: 'P4ssword',
    });
    expect(response.status).toBe(400);
  });

  it('returns validationErrors field in response body when validation error occurs', async () => {
    const response = await request(app).post('/api/1.0/users').send({
      username: null,
      email: 'user1@mail.com',
      password: 'P4ssword',
    });
    const body = response.body;
    expect(body.validationErrors).not.toBeUndefined();
  });

  it('returns errors for both when username and email is Null', async () => {
    const response = await request(app).post('/api/1.0/users').send({
      username: null,
      email: null,
      password: 'P4ssword',
    });
    const body = response.body;

    expect(Object.keys(body.validationErrors)).toEqual(['username', 'email']);
  });

  // const username_null = 'Username cannot be null';
  // const username_size = 'Must have min 4 and max 32 characters';
  // const email_null = 'E-mail cannot be null';
  // const email_invalid = 'E-mail is not valid';
  // const password_null = 'Password cannot be null';
  // const password_size = 'Password must be at least 6 characters long';
  // const password_pattern =
  //   'Password must have at least 1 uppercase, 1 lowercase letter and 1 number';
  // const email_inuse = 'E-mail in use';

  it.each`
    field         | value              | expectedMessage
    ${'username'} | ${null}            | ${en.username_null}
    ${'username'} | ${'usr'}           | ${en.username_size}
    ${'username'} | ${'a'.repeat(33)}  | ${en.username_size}
    ${'email'}    | ${null}            | ${en.email_null}
    ${'email'}    | ${'mail.com'}      | ${en.email_invalid}
    ${'email'}    | ${'user.mail.com'} | ${en.email_invalid}
    ${'email'}    | ${'user@mail'}     | ${en.email_invalid}
    ${'password'} | ${null}            | ${en.password_null}
    ${'password'} | ${'P4ssw'}         | ${en.password_size}
    ${'password'} | ${'alllowercase'}  | ${en.password_pattern}
    ${'password'} | ${'ALLUPPERCASE'}  | ${en.password_pattern}
    ${'password'} | ${'1234567890'}    | ${en.password_pattern}
    ${'password'} | ${'lowerandUPPER'} | ${en.password_pattern}
    ${'password'} | ${'lower4nd5667'}  | ${en.password_pattern}
    ${'password'} | ${'UPPER44444'}    | ${en.password_pattern}
  `(
    'returns $expectedMessage when $field is $value',
    async ({ field, expectedMessage, value }) => {
      const user = {
        username: 'user1',
        email: 'user1@mail.com',
        password: 'P4ssword',
      };
      user[field] = value;
      const response = await postUser(user);
      const body = response.body;
      expect(body.validationErrors[field]).toBe(expectedMessage);
    }
  );
  it(`returns ${en.email_inuse} when same email is already in use`, async () => {
    await User.create({ ...ValidUser });
    const response = await postUser();
    expect(response.body.validationErrors.email).toBe(en.email_inuse);
  });

  it('returns errors for both username is null and email is in use', async () => {
    await User.create({ ...ValidUser });
    const response = await postUser({
      username: null,
      email: ValidUser.email,
      password: 'P4ssword',
    });

    const body = response.body;
    expect(Object.keys(body.validationErrors)).toEqual(['username', 'email']);
  });

  it('creates user in inactive mode', async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.inactive).toBe(true);
  });

  it('creates user in inactive mode even the request body contains inactive as false', async () => {
    const newUser = { ...ValidUser, inactive: false };
    await postUser(newUser);
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.inactive).toBe(true);
  });

  it('creates an activationToken for user', async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.activationToken).toBeTruthy();
  });

  it('sends an Account activation email with activation token', async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(lastMail).toContain('user1@mail.com');
    expect(lastMail).toContain(savedUser.activationToken);
  });

  it('returns 502 Bad Gateway when sending email fails', async () => {
    simulateSmtpFailure = true;
    const response = await postUser();
    expect(response.status).toBe(502);
  });

  it('returns Email failure message when sending email fails', async () => {
    simulateSmtpFailure = true;
    const response = await postUser();
    expect(response.body.message).toBe(en.email_failure);
  });

  it('does not save user to database if activation email fails', async () => {
    simulateSmtpFailure = true;
    await postUser();
    const users = await User.findAll();
    expect(users.length).toBe(0);
  });

  it('return Validation Failure message in error response body when validation fails', async () => {
    const response = await postUser({
      username: null,
      email: ValidUser.email,
      password: 'P4ssword',
    });
    expect(response.body.message).toBe(en.validation_failure);
  });
});

describe('Internationalization', () => {
  // const username_null = 'Nazwa użytkownika nie może być pusta';
  // const username_size = 'Musi mieć min 4 i max 32 znaki';
  // const email_null = 'E-mail nie może być pusty';
  // const email_invalid = 'E-mail nie jest prawidłowy';
  // const password_null = 'Hałso nie może być puste';
  // const password_size = 'Hasło musi miec przynajmniej 6 characters long';
  // const password_pattern =
  //   'Hasło must have at least 1 uppercase, 1 lowercase letter and 1 number';
  // const email_inuse = 'Email w użyciu';
  // const user_create_success = 'Uzytkownik został stworzony poprawnie';
  // const email_failure = 'Wystąpił błąd Email';
  // const validation_failure = 'Nie udane';

  it.each`
    field         | value              | expectedMessage
    ${'username'} | ${null}            | ${pl.username_null}
    ${'username'} | ${'usr'}           | ${pl.username_size}
    ${'username'} | ${'a'.repeat(33)}  | ${pl.username_size}
    ${'email'}    | ${null}            | ${pl.email_null}
    ${'email'}    | ${'mail.com'}      | ${pl.email_invalid}
    ${'email'}    | ${'user.mail.com'} | ${pl.email_invalid}
    ${'email'}    | ${'user@mail'}     | ${pl.email_invalid}
    ${'password'} | ${null}            | ${pl.password_null}
    ${'password'} | ${'P4ssw'}         | ${pl.password_size}
    ${'password'} | ${'alllowercase'}  | ${pl.password_pattern}
    ${'password'} | ${'ALLUPPERCASE'}  | ${pl.password_pattern}
    ${'password'} | ${'1234567890'}    | ${pl.password_pattern}
    ${'password'} | ${'lowerandUPPER'} | ${pl.password_pattern}
    ${'password'} | ${'lower4nd5667'}  | ${pl.password_pattern}
    ${'password'} | ${'UPPER44444'}    | ${pl.password_pattern}
  `(
    'returns $expectedMessage when $field is $value when language is set to Polish',
    async ({ field, expectedMessage, value }) => {
      const user = {
        username: 'user1',
        email: 'user1@mail.com',
        password: 'P4ssword',
      };
      user[field] = value;
      const response = await postUser(user, { language: 'pl' });
      const body = response.body;
      expect(body.validationErrors[field]).toBe(expectedMessage);
    }
  );

  it(`returns ${pl.email_inuse} when same email is already in use when language is set to Polish`, async () => {
    await User.create({ ...ValidUser }, { language: 'pl' });
    const response = await postUser({ ...ValidUser }, { language: 'pl' });
    expect(response.body.validationErrors.email).toBe(pl.email_inuse);
  });

  it(`returns success message of ${pl.user_create_success} when signup request is valid and is Polish`, async () => {
    const response = await postUser({ ...ValidUser }, { language: 'pl' });
    expect(response.body.message).toBe(pl.user_create_success);
  });

  it(`returns ${pl.email_failure} failure message when sending email fails and language is Polish`, async () => {
    simulateSmtpFailure = true;
    const response = await postUser({ ...ValidUser }, { language: 'pl' });
    expect(response.body.message).toBe(pl.email_failure);
  });
  it(`return ${pl.validation_failure} message in error response body when validation fails`, async () => {
    const response = await postUser(
      {
        username: null,
        email: ValidUser.email,
        password: 'P4ssword',
      },
      { language: 'pl' }
    );
    expect(response.body.message).toBe(pl.validation_failure);
  });
});

describe('Account activation', () => {
  it('activates the account when correct token is sent', async () => {
    await postUser();
    let users = await User.findAll();
    const token = users[0].activationToken;

    await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();
    users = await User.findAll();
    expect(users[0].inactive).toBe(false);
  });

  it('removes the token from user table after successful activation', async () => {
    await postUser();
    let users = await User.findAll();
    const token = users[0].activationToken;

    await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();
    users = await User.findAll();
    expect(users[0].activationToken).toBeFalsy();
  });

  it('does not activate the account when token is wrong', async () => {
    await postUser();
    const token = 'this-token-does-not-exist';
    await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();
    const users = await User.findAll();
    expect(users[0].inactive).toBe(true);
  });

  it('returns bad request when token is wrong', async () => {
    await postUser();
    const token = 'this-token-does-not-exist';
    const response = await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();
    expect(response.status).toBe(400);
  });

  it.each`
    language | tokenStatus  | message
    ${'pl'}  | ${'wrong'}   | ${pl.account_activation_failure}
    ${'en'}  | ${'wrong'}   | ${en.account_activation_failure}
    ${'pl'}  | ${'correct'} | ${pl.account_activation_success}
    ${'en'}  | ${'correct'} | ${en.account_activation_success}
  `(
    'returns $message when token is $tokenStatus and language is $language',
    async ({ language, tokenStatus, message }) => {
      await postUser();
      let token = 'this-token-does-not-exist';
      if (tokenStatus === 'correct') {
        let users = await User.findAll();
        token = users[0].activationToken;
      }
      const response = await request(app)
        .post('/api/1.0/users/token/' + token)
        .set('Accept-Language', language)
        .send();
      expect(response.body.message).toBe(message);
    }
  );
});

describe('Error Model', () => {
  it('returns path, timestamp, message and validationErrors in response when validation failure', async () => {
    const response = await postUser({ ...ValidUser, username: null });
    const body = response.body;
    expect(Object.keys(body)).toStrictEqual([
      'path',
      'timestamp',
      'message',
      'validationErrors',
    ]);
  });

  it('returns path, timestamp, message in response when request fails other than validation error', async () => {
    const token = 'this-token-does-not-exist';
    const response = await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();
    const body = response.body;
    expect(Object.keys(body)).toStrictEqual(['path', 'timestamp', 'message']);
  });

  it('returns path in error body', async () => {
    const token = 'this-token-does-not-exist';
    const response = await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();
    const body = response.body;
    expect(body.path).toEqual('/api/1.0/users/token/' + token);
  });

  it('returns timestamp in miliseconds within 5 s value in error body', async () => {
    const nowInMillis = new Date().getTime();
    const fiveSecondsLater = nowInMillis + 5 * 1000;
    const token = 'this-token-does-not-exist';
    const response = await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();
    const body = response.body;
    expect(body.timestamp).toBeGreaterThan(nowInMillis);
    expect(body.timestamp).toBeLessThan(fiveSecondsLater);
  });
});
