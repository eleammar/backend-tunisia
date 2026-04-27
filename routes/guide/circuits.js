// routes/circuits.js
const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');
const axios = require('axios');
//
// 🔍 GET ALL CIRCUITS
//
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM circuits ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// 🔍 GET ONE CIRCUIT + STOPS
//
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const circuit = await pool.query(
      'SELECT * FROM circuits WHERE id = $1',
      [id]
    );

    if (circuit.rows.length === 0) {
      return res.status(404).json({ error: 'Circuit not found' });
    }

    const stops = await pool.query(
      `SELECT cs.*, p.name, p.lat, p.lng, p.image
       FROM circuit_stops cs
       JOIN places p ON cs.place_id = p.id
       WHERE cs.circuit_id = $1
       ORDER BY cs.stop_order`,
      [id]
    );

    res.json({
      ...circuit.rows[0],
      stops: stops.rows
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// ➕ CREATE CIRCUIT
//
router.post('/', async (req, res) => {
  try {
    const {
      id,
      name,
      mode,
      total_duration,
      total_distance,
      user_id
    } = req.body;

    const result = await pool.query(
      `INSERT INTO circuits 
       (id, name, mode, total_duration, total_distance, user_id)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [id, name, mode, total_duration, total_distance, user_id]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// ✏️ UPDATE CIRCUIT
//
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      mode,
      total_duration,
      total_distance,
      user_id
    } = req.body;

    const result = await pool.query(
      `UPDATE circuits SET
        name = $1,
        mode = $2,
        total_duration = $3,
        total_distance = $4,
        user_id = $5
      WHERE id = $6
      RETURNING *`,
      [name, mode, total_duration, total_distance, user_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Circuit not found' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// ❌ DELETE CIRCUIT
//
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // ⚠️ delete stops first (FK constraint)
    await pool.query(
      'DELETE FROM circuit_stops WHERE circuit_id = $1',
      [id]
    );

    const result = await pool.query(
      'DELETE FROM circuits WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Circuit not found' });
    }

    res.json({
      message: 'Circuit deleted',
      circuit: result.rows[0]
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;