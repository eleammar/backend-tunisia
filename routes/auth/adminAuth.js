const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'secret_key';

// =======================
// VERIFY ADMIN TOKEN
// =======================
const verifyAdminToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'No token' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.scope !== 'admin') {
      return res.status(403).json({ error: 'Admin token required' });
    }

    req.admin = decoded;
    next();

  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};


// =======================
// ADMIN LOGIN
// =======================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      'SELECT id, full_name, email, role, password, created_at FROM admins WHERE email = $1',
      [email]
    );

    const dbAdmin = result.rows[0];

    if (!dbAdmin) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, dbAdmin.password);

    if (!valid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    await pool.query('UPDATE admins SET last_login = NOW() WHERE id = $1', [dbAdmin.id]);

    const { password: _, ...admin } = dbAdmin;

    const token = jwt.sign(
      { id: admin.id, role: admin.role, scope: 'admin' },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ success: true, admin, token });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// =======================
// GET CURRENT ADMIN
// =======================
router.get('/me', verifyAdminToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, role, last_login, created_at FROM admins WHERE id = $1',
      [req.admin.id]
    );

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// =======================
// SUPER ADMIN CHECK
// =======================
const isSuperAdmin = (req, res, next) => {
  if (req.admin.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin only' });
  }
  next();
};


// =======================
// ADMIN MANAGEMENT (super_admin only)
// =======================

// LIST ALL ADMINS
router.get('/admins', verifyAdminToken, isSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, role, last_login, created_at FROM admins ORDER BY created_at DESC'
    );

    res.json(result.rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE ADMIN
router.post('/admins', verifyAdminToken, isSuperAdmin, async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'fullName, email and password are required' });
    }

    if (!['admin', 'super_admin', 'editor'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const existing = await pool.query('SELECT id FROM admins WHERE email = $1', [email]);

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO admins (full_name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role, last_login, created_at`,
      [fullName, email, hashedPassword, role]
    );

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE ADMIN (role and/or password)
router.put('/admins/:id', verifyAdminToken, isSuperAdmin, async (req, res) => {
  try {
    const { fullName, role, password } = req.body;

    if (role && !['admin', 'super_admin', 'editor'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query('UPDATE admins SET password = $1 WHERE id = $2', [hashedPassword, req.params.id]);
    }

    const result = await pool.query(
      `UPDATE admins
       SET full_name = COALESCE($1, full_name),
           role = COALESCE($2, role)
       WHERE id = $3
       RETURNING id, full_name, email, role, last_login, created_at`,
      [fullName, role, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE ADMIN
router.delete('/admins/:id', verifyAdminToken, isSuperAdmin, async (req, res) => {
  try {
    if (Number(req.params.id) === req.admin.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const result = await pool.query('DELETE FROM admins WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    res.json({ message: 'Admin deleted' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.verifyAdminToken = verifyAdminToken;
