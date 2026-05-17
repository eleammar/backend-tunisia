const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');


// ─────────────────────────────────────────────
// ✅ POST — SAVE USER ANSWERS (SAFE + TRANSACTION)
// ─────────────────────────────────────────────
router.post('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const { user_id, answers } = req.body;

    console.log('BODY:', req.body);

    if (!user_id) {
      return res.status(400).json({ error: 'user_id missing' });
    }

    if (!answers) {
      return res.status(400).json({ error: 'answers missing' });
    }

    await client.query('BEGIN');

    // 🔥 delete old answers (important si user refait onboarding)
    await client.query(
      `DELETE FROM user_answers WHERE user_id = $1`,
      [user_id]
    );

    // 🔹 normalize format
    let formattedAnswers = [];

    if (Array.isArray(answers)) {
      formattedAnswers = answers;
    } else {
      for (const stepId in answers) {
        const options = answers[stepId];

        for (const optionId of options) {
          formattedAnswers.push({
            step_id: stepId,
            option_id: optionId
          });
        }
      }
    }

    // 🔹 insert
    for (let ans of formattedAnswers) {
      await client.query(
        `INSERT INTO user_answers (user_id, step_id, option_id)
         VALUES ($1,$2,$3)`,
        [user_id, ans.step_id, ans.option_id]
      );
    }

    // 🔹 update onboarding
    await client.query(
      `UPDATE users SET onboarding_completed = true WHERE id = $1`,
      [user_id]
    );

    await client.query('COMMIT');

    res.json({ success: true });

  } catch (err) {
    await client.query('ROLLBACK');

    console.error('❌ ERROR:', err);

    res.status(500).json({
      success: false,
      error: err.message
    });

  } finally {
    client.release();
  }
});


// ─────────────────────────────────────────────
// ✅ GET — ALL USERS ANSWERS (ADMIN)
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        ua.user_id,
        u.full_name,
        ua.step_id,
        s.title AS step_title,
        ua.option_id,
        o.title AS option_title
      FROM user_answers ua
      JOIN users u ON u.id = ua.user_id
      JOIN steps s ON s.id = ua.step_id
      JOIN options o ON o.id = ua.option_id
      ORDER BY ua.user_id, ua.step_id;
    `);

    // 🔥 group by user
    const usersMap = {};

    result.rows.forEach(row => {
      if (!usersMap[row.user_id]) {
        usersMap[row.user_id] = {
          user_id: row.user_id,
          name: row.full_name,
          steps: {}
        };
      }

      if (!usersMap[row.user_id].steps[row.step_id]) {
        usersMap[row.user_id].steps[row.step_id] = {
          step_title: row.step_title,
          options: []
        };
      }

      usersMap[row.user_id].steps[row.step_id].options.push({
        id: row.option_id,
        title: row.option_title
      });
    });

    res.json({
      success: true,
      data: Object.values(usersMap)
    });

  } catch (err) {
    console.error('❌ ERROR:', err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


// ─────────────────────────────────────────────
// ✅ GET — ONE USER ANSWERS
// ─────────────────────────────────────────────
router.get('/:user_id', async (req, res) => {
  const { user_id } = req.params;

  try {
    const result = await pool.query(`
      SELECT 
        ua.step_id,
        s.title AS step_title,
        ua.option_id,
        o.title AS option_title
      FROM user_answers ua
      JOIN steps s ON s.id = ua.step_id
      JOIN options o ON o.id = ua.option_id
      WHERE ua.user_id = $1
    `, [user_id]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    console.error('❌ ERROR:', err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


// ─────────────────────────────────────────────
// ✅ GET — STATS (ADMIN DASHBOARD)
// ─────────────────────────────────────────────
router.get('/stats/global', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        o.id,
        o.title,
        COUNT(*) AS total
      FROM user_answers ua
      JOIN options o ON o.id = ua.option_id
      GROUP BY o.id, o.title
      ORDER BY total DESC;
    `);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    console.error('❌ ERROR:', err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;