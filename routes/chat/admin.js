// routes/chat/admin.js

const express = require('express');
const router = express.Router();
const axios = require('axios');
const adminSystemPrompt = require('../../util/adminPrompt');

const GITHUB_API_ENDPOINT = 'https://models.inference.ai.azure.com/chat/completions';

function buildMessages(message, conversationHistory) {
  const messages = [{ role: 'system', content: adminSystemPrompt }];
  if (Array.isArray(conversationHistory)) {
    messages.push(...conversationHistory);
  }
  messages.push({ role: 'user', content: message });
  return messages;
}

// POST /api/chat/admin/message
router.post('/message', async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ success: false, error: 'Message cannot be empty' });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return res.status(401).json({ success: false, error: 'GitHub token not configured' });
    }

    const messages = buildMessages(message, conversationHistory);

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
      model: 'meta-llama-3.1-8b-instruct',
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

// POST /api/chat/admin/stream
router.post('/stream', async (req, res) => {
  const { message, conversationHistory } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ success: false, error: 'Message cannot be empty' });
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return res.status(401).json({ success: false, error: 'GitHub token not configured' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const messages = buildMessages(message, conversationHistory);

    const response = await axios.post(
      GITHUB_API_ENDPOINT,
      {
        model: 'meta-llama-3.1-8b-instruct',
        messages,
        temperature: 0.7,
        top_p: 1,
        max_tokens: 2048,
        stream: true,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${githubToken}`,
        },
        responseType: 'stream',
      }
    );

    let buffer = '';

    response.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;

        const jsonStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) send('token', { token: delta });
        } catch {
          // ignore incomplete chunks
        }
      }
    });

    response.data.on('end', () => {
      send('done', { success: true });
      res.end();
    });

    response.data.on('error', (err) => {
      console.error('AdminBot stream error:', err.message);
      send('error', { error: 'Stream interrupted' });
      res.end();
    });

  } catch (error) {
    console.error('❌ AdminBot stream setup error:', error.response?.data || error.message);

    if (res.headersSent) {
      send('error', { error: 'Failed to connect to AI model' });
      res.end();
    } else {
      res.status(500).json({ success: false, error: 'Failed to start stream' });
    }
  }
});

// GET /api/chat/admin/health
router.get('/health', (req, res) => {
  res.json({
    status: '✅ AdminBot is running',
    model: 'meta-llama-3.1-8b-instruct',
    streaming: true,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
