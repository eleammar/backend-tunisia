// src/app.js
const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api', routes);

// Route de santé
app.get('/', (req, res) => {
  res.json({ message: 'Backend EduLearn fonctionne ✅' });
});

// ⚠️ IMPORTANT : Exporter l'application Express
module.exports = app;  // ← DOIT être présent