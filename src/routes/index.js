// src/routes/index.js
const express = require('express');
const router = express.Router();

// Vérifie si le sous-fichier existe
const authRoutes = require('./auth'); 

// Vérifie qu’il s’agit bien d’un router
if (typeof authRoutes === 'function') {
  router.use('/auth', authRoutes);
} else {
  console.error('⚠️ authRoutes n’est pas une fonction. Vérifie ./auth.js');
}

router.get('/', (req, res) => {
  res.send('API EduLearn fonctionne 🚀');
});

module.exports = router;
