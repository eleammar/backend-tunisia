const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');

// GET all steps + options + tags (merged)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.id as step_id,
        s.title as step_title,
        s.description,
        s.multi,
        s.order_index,
        o.id as option_id,
        o.title as option_title,
        o.subtitle,
        o.type,
        o.icon,
        t.name as tag
      FROM steps s
      LEFT JOIN options o ON o.step_id = s.id
      LEFT JOIN option_tags ot ON ot.option_id = o.id
      LEFT JOIN tags t ON t.id = ot.tag_id
      ORDER BY s.order_index;
    `);

    const stepsMap = {};
    result.rows.forEach(row => {
      if (!stepsMap[row.step_id]) {
        stepsMap[row.step_id] = {
          id: row.step_id,
          title: row.step_title,
          description: row.description,
          multi: row.multi,
          options: []
        };
      }
      let option = stepsMap[row.step_id].options.find(o => o.id === row.option_id);
      if (!option && row.option_id) {
        option = { id: row.option_id, title: row.option_title, subtitle: row.subtitle, type: row.type, icon: row.icon, tags: [] };
        stepsMap[row.step_id].options.push(option);
      }
      if (row.tag && option && !option.tags.includes(row.tag)) option.tags.push(row.tag);
    });

    res.json({ success: true, data: Object.values(stepsMap) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /answers — save user answers + mark onboarding done
router.post('/answers', async (req, res) => {
  const client = await pool.connect();
  try {
    const { user_id, answers } = req.body;

    if (!user_id || !answers) {
      return res.status(400).json({ error: 'user_id and answers are required' });
    }

    await client.query('BEGIN');

    // delete previous answers for this user (re-onboarding possible)
    await client.query(
      'DELETE FROM user_onboarding_answers WHERE user_id = $1',
      [user_id]
    );

    // insert new answers
    for (const [step_id, option_ids] of Object.entries(answers)) {
      for (const option_id of option_ids) {
        await client.query(
          `INSERT INTO user_onboarding_answers (user_id, step_id, option_id)
           VALUES ($1, $2, $3)`,
          [user_id, step_id, option_id]
        );
      }
    }

    // mark onboarding as completed
    await client.query(
      'UPDATE users SET onboarding_completed = true WHERE id = $1',
      [user_id]
    );

    await client.query('COMMIT');

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
