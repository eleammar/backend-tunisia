const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const JWT_SECRET = 'secret_key';

// ⚠️ DOIT être le même que dans Angular
const GOOGLE_CLIENT_ID = '560697263093-rk5it9n29g7rjpdvbk0atd0aje2jo6be.apps.googleusercontent.com';

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);


// =======================
// VERIFY TOKEN
// =======================
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'No token' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded;
    next();

  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};


// =======================
// ADMIN CHECK
// =======================
const isAdmin = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows[0]?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    next();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// =======================
// SIGNUP
// =======================
router.post('/signup', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    const existing = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role, onboarding_completed, created_at`,
      [fullName, email, hashedPassword, 'user']
    );

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET
    );

    res.json({ success: true, user, token });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// =======================
// LOGIN
// =======================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      'SELECT id, full_name, email, role, onboarding_completed, created_at, password FROM users WHERE email = $1',
      [email]
    );

    const dbUser = result.rows[0];

    if (!dbUser) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, dbUser.password);

    if (!valid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const { password: _, ...user } = dbUser;

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET
    );

    res.json({ success: true, user, token });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// =======================
// ✅ GOOGLE LOGIN (FIX)
// =======================
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'No Google token' });
    }

    // 🔐 VERIFY TOKEN WITH GOOGLE
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    const email = payload.email;
    const fullName = payload.name;

    // =======================
    // CHECK USER IN DB
    // =======================
    let result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    let user;

    // =======================
    // CREATE USER IF NOT EXISTS
    // =======================
    if (result.rows.length === 0) {
      const newUser = await pool.query(
        `INSERT INTO users (full_name, email, password, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, full_name, email, role, onboarding_completed, created_at`,
        [fullName, email, null, 'user']
      );

      user = newUser.rows[0];

    } else {
      const existing = await pool.query(
        'SELECT id, full_name, email, role, onboarding_completed, created_at FROM users WHERE email = $1',
        [email]
      );
      user = existing.rows[0];
    }

    // =======================
    // GENERATE JWT
    // =======================
    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET
    );

    res.json({ success: true, user, token });

  } catch (err) {
    console.error('Google auth error:', err);
    res.status(401).json({ error: 'Google authentication failed' });
  }
});


// =======================
// QR SESSION — stockage en mémoire (code court 6 cars, TTL 2 min)
// =======================
const qrSessions = new Map(); // code -> { jwt, expiresAt }

const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// PC connecté → génère un code court lié à son JWT
router.post('/qr-session', verifyToken, async (req, res) => {
  // Nettoyer les codes expirés
  const now = Date.now();
  for (const [k, v] of qrSessions) {
    if (v.expiresAt < now) qrSessions.delete(k);
  }

  const code = generateCode();
  const userJwt = req.headers.authorization.split(' ')[1];

  qrSessions.set(code, { jwt: userJwt, expiresAt: now + 2 * 60 * 1000 });

  console.log('[QR] created code', code, 'for token', userJwt.slice(0, 20) + '...');

  res.json({ code });
});

// Mobile → échange le code contre le JWT
router.get('/qr-session/:code', async (req, res) => {
  const key = req.params.code.toUpperCase();
  const session = qrSessions.get(key);

  console.log('[QR] exchange request for code', key, '| known codes =', [...qrSessions.keys()], '| found =', !!session);

  if (!session) {
    return res.status(404).json({ error: 'Code invalide ou expiré' });
  }

  if (session.expiresAt < Date.now()) {
    qrSessions.delete(req.params.code.toUpperCase());
    return res.status(410).json({ error: 'Code expiré' });
  }

  qrSessions.delete(req.params.code.toUpperCase()); // usage unique
  res.json({ token: session.jwt });
});

// =======================
// GET CURRENT USER
// =======================
router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// =======================
// ADMIN ROUTES
// =======================

// GET ALL USERS
router.get('/users', verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, role, created_at FROM users ORDER BY created_at DESC'
    );

    res.json(result.rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET USER BY ID
router.get('/users/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, role, created_at FROM users WHERE id = $1',
      [req.params.id]
    );

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE USER
router.put('/users/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { fullName, role } = req.body;

    const result = await pool.query(
      `UPDATE users
       SET full_name = $1, role = $2
       WHERE id = $3
       RETURNING id, full_name, email, role`,
      [fullName, role, req.params.id]
    );

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE USER
router.delete('/users/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM users WHERE id = $1',
      [req.params.id]
    );

    res.json({ message: 'User deleted' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.verifyToken = verifyToken;