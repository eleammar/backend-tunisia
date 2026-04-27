const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');

// SAVE answers
router.post('/', async (req, res) => {
  const { user_id, answers } = req.body;

  try {
    for (let ans of answers) {
      await pool.query(
        `INSERT INTO user_answers (user_id, step_id, option_id)
         VALUES ($1,$2,$3)`,
        [user_id, ans.step_id, ans.option_id]
      );
    }

    await pool.query(
      'UPDATE users SET onboarding_completed = true WHERE id = $1',
      [user_id]
    );

    res.json({ success: true, message: 'Answers saved' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;