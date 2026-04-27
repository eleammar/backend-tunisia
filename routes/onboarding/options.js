const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');


// ─────────────────────────────────────────────
// GET ALL options + tags
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        o.*,
        COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
      FROM options o
      LEFT JOIN option_tags ot ON ot.option_id = o.id
      LEFT JOIN tags t ON t.id = ot.tag_id
      GROUP BY o.id
      ORDER BY o.id;
    `);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    console.error('Error fetching options:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ─────────────────────────────────────────────
// GET ONE option + tags
// ─────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      SELECT 
        o.*,
        COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
      FROM options o
      LEFT JOIN option_tags ot ON ot.option_id = o.id
      LEFT JOIN tags t ON t.id = ot.tag_id
      WHERE o.id = $1
      GROUP BY o.id;
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Option not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Error fetching option:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ─────────────────────────────────────────────
// CREATE option + tags
// ─────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { id, step_id, title, subtitle, type, icon, tags = [] } = req.body;

  if (!id || !step_id || !title) {
    return res.status(400).json({
      success: false,
      error: 'id, step_id et title sont obligatoires'
    });
  }

  try {
    await pool.query('BEGIN');

    const stepCheck = await pool.query(
      `SELECT id FROM steps WHERE id = $1`,
      [step_id]
    );

    if (stepCheck.rows.length === 0) {
      throw new Error('Step not found');
    }

    const option = await pool.query(
      `INSERT INTO options (id, step_id, title, subtitle, type, icon)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [id, step_id, title, subtitle || null, type || null, icon || null]
    );

    for (let tag of tags) {
      if (!tag) continue;

      const cleanTag = tag.trim().toLowerCase();

      const tagRes = await pool.query(
        `INSERT INTO tags (name)
         VALUES ($1)
         ON CONFLICT (name)
         DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [cleanTag]
      );

      await pool.query(
        `INSERT INTO option_tags (option_id, tag_id)
         VALUES ($1,$2)
         ON CONFLICT DO NOTHING`,
        [id, tagRes.rows[0].id]
      );
    }

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: option.rows[0],
      message: '✓ Option créée avec tags'
    });

  } catch (err) {
    await pool.query('ROLLBACK');

    console.error('Error creating option:', err);

    res.status(500).json({
      success: false,
      error: 'Failed to create option',
      details: err.message
    });
  }
});


// ─────────────────────────────────────────────
// UPDATE option + tags
// ─────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { step_id, title, subtitle, type, icon, tags = [] } = req.body;

  if (!title) {
    return res.status(400).json({
      success: false,
      error: 'title est obligatoire'
    });
  }

  try {
    await pool.query('BEGIN');

    const optionCheck = await pool.query(
      `SELECT id FROM options WHERE id = $1`,
      [id]
    );

    if (optionCheck.rows.length === 0) {
      throw new Error('Option not found');
    }

    if (step_id) {
      const stepCheck = await pool.query(
        `SELECT id FROM steps WHERE id = $1`,
        [step_id]
      );

      if (stepCheck.rows.length === 0) {
        throw new Error('Step not found');
      }
    }

    const updated = await pool.query(
      `UPDATE options
       SET step_id = COALESCE($1, step_id),
           title = $2,
           subtitle = COALESCE($3, subtitle),
           type = COALESCE($4, type),
           icon = COALESCE($5, icon)
       WHERE id = $6
       RETURNING *`,
      [
        step_id || null,
        title,
        subtitle || null,
        type || null,
        icon || null,
        id
      ]
    );

    // supprimer anciens tags
    await pool.query(
      `DELETE FROM option_tags WHERE option_id = $1`,
      [id]
    );

    // reinsert nouveaux tags
    for (let tag of tags) {
      if (!tag) continue;

      const cleanTag = tag.trim().toLowerCase();

      const tagRes = await pool.query(
        `INSERT INTO tags (name)
         VALUES ($1)
         ON CONFLICT (name)
         DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [cleanTag]
      );

      await pool.query(
        `INSERT INTO option_tags (option_id, tag_id)
         VALUES ($1,$2)
         ON CONFLICT DO NOTHING`,
        [id, tagRes.rows[0].id]
      );
    }

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: updated.rows[0],
      message: '✓ Option mise à jour avec tags'
    });

  } catch (err) {
    await pool.query('ROLLBACK');

    console.error('Error updating option:', err);

    res.status(500).json({
      success: false,
      error: 'Failed to update option',
      details: err.message
    });
  }
});


// ─────────────────────────────────────────────
// DELETE option
// ─────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const check = await pool.query(
      `SELECT id FROM options WHERE id = $1`,
      [id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Option not found'
      });
    }

    await pool.query(`DELETE FROM options WHERE id = $1`, [id]);

    res.json({
      success: true,
      message: '✓ Option supprimée'
    });

  } catch (err) {
    console.error('Error deleting option:', err);

    res.status(500).json({
      success: false,
      error: 'Failed to delete option',
      details: err.message
    });
  }
});

module.exports = router;