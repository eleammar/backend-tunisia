const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');

// GET all steps
router.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM steps ORDER BY order_index');
  res.json({ success: true, data: result.rows });
});

// CREATE
router.post('/', async (req, res) => {
  const { id, title, description, multi, order_index } = req.body;

  const result = await pool.query(
    `INSERT INTO steps (id, title, description, multi, order_index)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [id, title, description, multi, order_index]
  );

  res.json({ success: true, data: result.rows[0] });
});

// UPDATE
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, multi, order_index } = req.body;

  const result = await pool.query(
    `UPDATE steps
     SET title=$1, description=$2, multi=$3, order_index=$4
     WHERE id=$5 RETURNING *`,
    [title, description, multi, order_index, id]
  );

  res.json({ success: true, data: result.rows[0] });
});

// DELETE
router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM steps WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;