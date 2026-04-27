const express = require('express');
const router = express.Router();

// 🔥 connecter les sous-routes
router.use('/steps', require('./steps'));
router.use('/options', require('./options'));
router.use('/answers', require('./answers'));

// test
router.get('/', (req, res) => {
  res.send('Onboarding API OK');
});

module.exports = router;