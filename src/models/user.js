// src/models/User.js
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

class User {
  // Créer un utilisateur
  static async create({ email, username, password, role }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO users (email, username, password, role, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, email, username, role, created_at;
    `;
    const values = [email, username, hashedPassword, role];
    const res = await pool.query(query, values);
    return res.rows[0];
  }

  // Trouver par email
  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const res = await pool.query(query, [email]);
    return res.rows[0];
  }

  // Comparer mot de passe
  static async comparePassword(candidatePassword, hashedPassword) {
    return await bcrypt.compare(candidatePassword, hashedPassword);
  }
}

module.exports = User;  // ⚠️ OBLIGATOIRE