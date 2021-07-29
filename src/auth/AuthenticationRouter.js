const express = require('express');
const router = express.Router();

router.post('/api/1.0/auth', (req, res) => {
  res.send(200);
});

module.exports = router;
