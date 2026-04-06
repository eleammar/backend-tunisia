// routes/media.js
const express = require('express');
const router = express.Router();
const pool = require('../db/connection');

// Create media record after upload
router.post('/media', async (req, res) => {
  const { url, filename, mime_type, size_bytes, alt_text } = req.body;
  try {
    const q = `INSERT INTO media (url, filename, mime_type, size_bytes, alt_text, created_at) VALUES ($1,$2,$3,$4,$5, now()) RETURNING *;`;
    const { rows } = await pool.query(q, [url, filename || null, mime_type || null, size_bytes || null, alt_text || null]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
});

// Presign placeholder (you can replace with AWS SDK presign logic)
router.post('/admin/media/presign', async (req, res) => {
  // If you use S3, implement AWS.S3.getSignedUrlPromise('putObject', params) and return url/fields
  // For now, return a placeholder instructing the admin to upload elsewhere
  res.json({ message: 'Presign not implemented. Implement with AWS SDK or your storage provider.' });
});

module.exports = router;