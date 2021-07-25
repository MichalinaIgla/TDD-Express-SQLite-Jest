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
const User = require('./src/user/User');

const addUsers = async (activeUserCount, inactiveUserCount = 0) => {
  for (let i = 0; i < activeUserCount + inactiveUserCount; i++) {
    await User.create({
      username: `user${i + 1}`,
      email: `user${i + 1}@mail.com`,
      inactive: i >= activeUserCount,
    });
  }
};

sequelize.sync({ force: true }).then(async () => {
  await addUsers(25);
});
sequelize.sync({ foce: true });

app.listen(3000, () => console.log('App is running!'));
