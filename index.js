// npx http-server -c-1 -p 8080 -P http://localhost:3000
// "no-unused-vars": [
//   "warn",
//   {
//     "vars": "all",
//     "args": "after-used",
//     "ignoreRestSiblings": false
//   }
// ]
const app = require('./src/app');
const sequelize = require('./src/config/database');

sequelize.sync();

app.listen(3000, () => console.log('App is running!'));
