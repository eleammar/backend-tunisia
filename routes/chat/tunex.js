// routes/chat/tunex.js

const express = require("express");
const router = express.Router();
const axios = require("axios");
const { verifyToken } = require("../auth/auth");
const tunisiaSystemPrompt = require("../../util/tunisiaPrompt");

const DEFAULT_API_ENDPOINT = "https://models.inference.ai.azure.com/chat/completions";

function getApiEndpoint() {
  const configured = process.env.GITHUB_MODELS_API_ENDPOINT?.trim();
  if (!configured) return DEFAULT_API_ENDPOINT;
  if (configured.endsWith("/chat/completions")) return configured;
  return `${configured.replace(/\/+$/, "")}/chat/completions`;
}

function buildMessages(message, conversationHistory, systemContext) {
  // Combine le system prompt de base avec le contexte de page envoyé par le frontend
  const fullSystem = systemContext
    ? `${tunisiaSystemPrompt}\n\n--- CONTEXTE PAGE ACTUELLE ---\n${systemContext}`
    : tunisiaSystemPrompt;

  const messages = [{ role: "system", content: fullSystem }];

  if (Array.isArray(conversationHistory)) {
    messages.push(...conversationHistory);
  }

  messages.push({ role: "user", content: message });
  return messages;
}

// ─── POST /api/chat/message  (réponse complète, non-streaming) ─────────────
router.post("/message", verifyToken, async (req, res) => {
  try {
    const { message, conversationHistory, systemContext } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ success: false, error: "Message cannot be empty" });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return res.status(401).json({ success: false, error: "GitHub token not configured" });
    }

    const messages = buildMessages(message, conversationHistory, systemContext);

    const response = await axios.post(
      getApiEndpoint(),
      {
        model: "meta-llama-3.1-8b-instruct",
        messages,
        temperature: 0.8,
        top_p: 1,
        max_tokens: 1024,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${githubToken}`,
        },
      }
    );

    const assistantMessage = response.data.choices[0].message.content;

    res.json({ success: true, message: assistantMessage, model: "meta-llama-3.1-8b-instruct" });

  } catch (error) {
    console.error("❌ Chat error:", error.response?.data || error.message);

    if (error.response?.status === 401) {
      return res.status(401).json({ success: false, error: "Authentication failed. Check GITHUB_TOKEN." });
    }
    if (error.response?.status === 429) {
      return res.status(429).json({ success: false, error: "Rate limit exceeded. Try again later." });
    }

    res.status(500).json({
      success: false,
      error: "Failed to get response from AI model",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// ─── POST /api/chat/stream  (SSE streaming token par token) ────────────────
router.post("/stream", verifyToken, async (req, res) => {
  const { message, conversationHistory, systemContext } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ success: false, error: "Message cannot be empty" });
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return res.status(401).json({ success: false, error: "GitHub token not configured" });
  }

  // Headers SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const messages = buildMessages(message, conversationHistory, systemContext);

    const response = await axios.post(
      getApiEndpoint(),
      {
        model: "meta-llama-3.1-8b-instruct",
        messages,
        temperature: 0.8,
        top_p: 1,
        max_tokens: 1024,
        stream: true,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${githubToken}`,
        },
        responseType: "stream",
      }
    );

    let buffer = "";

    response.data.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop(); // garde la dernière ligne incomplète

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;

        const jsonStr = trimmed.startsWith("data: ") ? trimmed.slice(6) : trimmed;
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            send("token", { token: delta });
          }
        } catch {
          // ignore parse errors for incomplete chunks
        }
      }
    });

    response.data.on("end", () => {
      send("done", { success: true });
      res.end();
    });

    response.data.on("error", (err) => {
      console.error("Stream error:", err.message);
      send("error", { error: "Stream interrupted" });
      res.end();
    });

  } catch (error) {
    console.error("❌ Stream setup error:", error.response?.data || error.message);

    // Si les headers sont déjà envoyés, utiliser SSE pour signaler l'erreur
    if (res.headersSent) {
      send("error", { error: "Failed to connect to AI model" });
      res.end();
    } else {
      res.status(500).json({ success: false, error: "Failed to start stream" });
    }
  }
});

// ─── GET /api/chat/health ──────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.json({
    status: "✅ TunEx is running",
    model: "meta-llama-3.1-8b-instruct",
    streaming: true,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
