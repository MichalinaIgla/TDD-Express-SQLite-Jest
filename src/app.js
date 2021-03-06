const express = require('express');
const UserRouter = require('./user/UserRouter');
const AuthenticationRouter = require('./auth/AuthenticationRouter');
const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');
const ErrorHandler = require('./error/ErrorHandler');
i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init(
    {
      fallbackLng: 'en',
      lng: 'en',
      ns: ['translation'],
      defaultNS: 'translation',
      backend: {
        loadPath: './src/locales/{{lng}}/{{ns}}.json',
      },
      detection: {
        lookupHeader: 'accept-language',
      },
    },
    (err) => {
      if (err) return console.error(err);
      // console.log(t('welcome i18n'));
    }
  );

const app = express();
app.use(middleware.handle(i18next));

app.use(express.json());

app.use(UserRouter);
app.use(AuthenticationRouter);

app.use(ErrorHandler);

module.exports = app;
