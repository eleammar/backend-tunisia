// routes/chat/admin.js

const express = require('express');
const router = express.Router();
const axios = require('axios');
const adminSystemPrompt = require('../../util/adminPrompt');

const GITHUB_API_ENDPOINT = 'https://models.inference.ai.azure.com/chat/completions';

// POST /api/chat/admin/message
router.post('/message', async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, error: 'Message cannot be empty' });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return res.status(401).json({ success: false, error: 'GitHub token not configured' });
    }

    const messages = [{ role: 'system', content: adminSystemPrompt }];

    if (Array.isArray(conversationHistory)) {
      messages.push(...conversationHistory);
    }

    messages.push({ role: 'user', content: message });

    const response = await axios.post(
      GITHUB_API_ENDPOINT,
      {
        model: 'meta-llama-3.1-8b-instruct',
        messages,
        temperature: 0.7,
        top_p: 1,
        max_tokens: 2048,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${githubToken}`,
        },
      }
    );

    res.json({
      success: true,
      message: response.data.choices[0].message.content,
    });
  } catch (error) {
    console.error('❌ AdminBot error:', error.response?.data || error.message);

    if (error.response?.status === 401) {
      return res.status(401).json({ success: false, error: 'Authentication failed.' });
    }
    if (error.response?.status === 429) {
      return res.status(429).json({ success: false, error: 'Rate limit exceeded.' });
    }

    res.status(500).json({ success: false, error: 'Failed to get response from AI model' });
  }
});

// GET /api/chat/admin/health
router.get('/health', (req, res) => {
  res.json({ status: '✅ AdminBot is running', timestamp: new Date().toISOString() });
});

module.exports = router;
