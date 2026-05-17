const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');
const { v4: uuidv4 } = require('uuid');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM circuits ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/city/:cityId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM circuits WHERE city_id = $1 ORDER BY created_at DESC',
      [req.params.cityId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const circuit = await pool.query('SELECT * FROM circuits WHERE id = $1', [req.params.id]);
    if (circuit.rows.length === 0) return res.status(404).json({ error: 'Circuit not found' });

    const stops = await pool.query(
      `SELECT cs.*, p.name, p.lat, p.lng, p.image
       FROM circuit_stops cs
       JOIN places p ON cs.place_id = p.id
       WHERE cs.circuit_id = $1
       ORDER BY cs.stop_order`,
      [req.params.id]
    );

    res.json({ ...circuit.rows[0], stops: stops.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      name,
      mode,
      total_duration,
      total_distance,
      user_id,
      city_id
    } = req.body;

    const result = await pool.query(
      `INSERT INTO circuits
      (id, name, mode, total_duration, total_distance, user_id, city_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *`,
      [
        uuidv4(),
        name,
        mode || 'walking',
        total_duration || null,
        total_distance || null,
        user_id || null,
        city_id || null
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, mode, total_duration, total_distance, user_id, city_id } = req.body;

    const result = await pool.query(
      `UPDATE circuits SET
        name=$1, mode=$2, total_duration=$3, total_distance=$4, user_id=$5, city_id=$6
       WHERE id=$7
       RETURNING *`,
      [name, mode, total_duration, total_distance, user_id, city_id || null, req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Circuit not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM circuit_stops WHERE circuit_id = $1', [req.params.id]);
    const result = await pool.query('DELETE FROM circuits WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Circuit not found' });
    res.json({ message: 'Circuit deleted', circuit: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
