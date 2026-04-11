// routes/chat/tunex.js

const express = require("express");
const router = express.Router();
const axios = require("axios");
const tunisiaSystemPrompt = require("../../util/tunisiaPrompt");

const DEFAULT_GITHUB_MODELS_API_ENDPOINT = "https://models.inference.ai.azure.com/chat/completions";

function getGithubModelsApiEndpoint() {
  const configuredEndpoint = process.env.GITHUB_MODELS_API_ENDPOINT?.trim();

  if (!configuredEndpoint) {
    return DEFAULT_GITHUB_MODELS_API_ENDPOINT;
  }

  if (configuredEndpoint.endsWith("/chat/completions")) {
    return configuredEndpoint;
  }

  return `${configuredEndpoint.replace(/\/+$/, "")}/chat/completions`;
}
// POST /api/chat/message
router.post("/message", async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;

    // Validation
    if (!message || message.trim() === "") {
      return res.status(400).json({ 
        success: false,
        error: "Message cannot be empty" 
      });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return res.status(401).json({ 
        success: false,
        error: "GitHub token not configured" 
      });
    }

    // Construire les messages
    const messages = [
      {
        role: "system",
        content: tunisiaSystemPrompt,
      },
    ];

    // Ajouter l'historique
    if (conversationHistory && Array.isArray(conversationHistory)) {
      messages.push(...conversationHistory);
    }

    // Ajouter le message utilisateur
    messages.push({
      role: "user",
      content: message,
    });

    console.log("📤 Envoi à GitHub Models API...");

    // Appeler GitHub Models API
    const response = await axios.post(
      getGithubModelsApiEndpoint(),
      {
        model: "meta-llama-3.1-8b-instruct",
        messages: messages,
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

    console.log("✅ Réponse reçue");

    const assistantMessage = response.data.choices[0].message.content;

    res.json({
      success: true,
      message: assistantMessage,
      model: "meta-llama-3.1-8b-instruct",
    });

  } catch (error) {
    console.error("❌ Erreur API:", error.response?.data || error.message);

    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed. Check GITHUB_TOKEN.",
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        error: "Rate limit exceeded. Try again later.",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to get response from AI model",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/chat/health
router.get("/health", (req, res) => {
  res.json({
    status: "✅ TunEx is running",
    model: "meta-llama-3.1-8b-instruct",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;