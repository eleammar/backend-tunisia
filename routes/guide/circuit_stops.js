const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');

//
// ✅ GET ALL STOPS
//
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cs.*, p.name, p.image
       FROM circuit_stops cs
       JOIN places p ON p.id = cs.place_id
       ORDER BY cs.circuit_id, cs.stop_order`
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// ✅ GET ONE STOP (IMPORTANT avant /:circuitId)
//
router.get('/one/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM circuit_stops WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stop not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// 🔄 REORDER STOPS (mettre avant /:circuitId)
//
router.put('/reorder/:circuitId', async (req, res) => {
  const client = await pool.connect();

  try {
    const { circuitId } = req.params;
    const { stops } = req.body;

    if (!stops || !Array.isArray(stops)) {
      return res.status(400).json({ error: 'stops array required' });
    }

    await client.query('BEGIN');

   
    for (const stop of stops) {
      await client.query(
        `UPDATE circuit_stops
         SET stop_order = stop_order + 1000
         WHERE id = $1 AND circuit_id = $2`,
        [Number(stop.id), circuitId]
      );
    }

   
    for (const stop of stops) {
      await client.query(
        `UPDATE circuit_stops
         SET stop_order = $1
         WHERE id = $2 AND circuit_id = $3`,
        [Number(stop.stop_order), Number(stop.id), circuitId]
      );
    }

    await client.query('COMMIT');

    res.json({ message: 'Stops reordered successfully' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
//
// 🔍 GET STOPS BY CIRCUIT (mettre APRÈS)
//
router.get('/:circuitId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cs.*, p.name, p.image, p.lat, p.lng
       FROM circuit_stops cs
       JOIN places p ON p.id = cs.place_id
       WHERE cs.circuit_id = $1
       ORDER BY cs.stop_order`,
      [req.params.circuitId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// ➕ ADD STOP
//
router.post('/', async (req, res) => {
  try {
    const { circuit_id, place_id, start_time } = req.body;

    const maxRes = await pool.query(
      'SELECT COALESCE(MAX(stop_order), 0) + 1 AS next_order FROM circuit_stops WHERE circuit_id = $1',
      [circuit_id]
    );
    const stop_order = maxRes.rows[0].next_order;

    const result = await pool.query(
      `INSERT INTO circuit_stops
       (circuit_id, place_id, start_time, stop_order)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [circuit_id, place_id, start_time || null, stop_order]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error('[circuit_stops POST]', err.message);
    res.status(500).json({ error: err.message });
  }
});

//
// ✏️ UPDATE STOP
//
router.put('/:id', async (req, res) => {
  try {
    const { start_time, stop_order } = req.body;

    const result = await pool.query(
      `UPDATE circuit_stops SET
        start_time = $1,
        stop_order = $2
      WHERE id = $3
      RETURNING *`,
      [start_time, stop_order, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stop not found' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//
// ❌ DELETE STOP
//
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM circuit_stops WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stop not found' });
    }

    res.json({
      message: 'Stop deleted',
      stop: result.rows[0]
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;