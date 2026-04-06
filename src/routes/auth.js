// src/routes/auth.js
const express = require('express');
const User = require('../models/user');
const router = express.Router();

// 🆕 Inscription
router.post('/signup', async (req, res) => {
  const { email, username, password, role } = req.body;

  // Validation basique
  if (!email || !username || !password || !role) {
    return res.status(400).json({ message: 'Tous les champs sont requis.' });
  }
  if (!['student', 'teacher'].includes(role)) {
    return res.status(400).json({ message: 'Rôle invalide. Utilisez "student" ou "teacher".' });
  }

  try {
    // Vérifier si email existe déjà
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
    }

    // Créer l'utilisateur
    const newUser = await User.create({ email, username, password, role });
    
    // ⚠️ Pour la sécurité : ne jamais renvoyer le mot de passe (même hashé)
    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json({
      message: 'Utilisateur créé avec succès.',
      user: userWithoutPassword
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// 🔑 Connexion
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email et mot de passe requis.' });
  }

  try {
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }

    const isMatch = await User.comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
    }

    // ✅ Succès → renvoyer user (sans mot de passe) + rôle
    const { password: _, ...userWithoutPassword } = user;

    res.status(200).json({
      message: 'Connexion réussie.',
      user: userWithoutPassword
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;