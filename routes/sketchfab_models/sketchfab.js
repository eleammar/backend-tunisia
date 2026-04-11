// routes/models/sketchfab.js

const express = require('express');
const router = express.Router();
const pool = require('../../db/connection');
const axios = require('axios');

const DEFAULT_GITHUB_MODELS_API_ENDPOINT = 'https://models.inference.ai.azure.com/chat/completions';

function getGithubModelsApiEndpoint() {
  const configuredEndpoint = process.env.GITHUB_MODELS_API_ENDPOINT?.trim();

  if (!configuredEndpoint) {
    return DEFAULT_GITHUB_MODELS_API_ENDPOINT;
  }

  if (configuredEndpoint.endsWith('/chat/completions')) {
    return configuredEndpoint;
  }

  return `${configuredEndpoint.replace(/\/+$/, '')}/chat/completions`;
}

// ════════════════════════════════════════════════════════════════
// GENERATE INTERACTIVE DESCRIPTION (SHORT + LONG)
// ════════════════════════════════════════════════════════════════
router.post('/generate-interactive-description/:id', async (req, res) => {
  const modelId = req.params.id;

  try {
    const modelResult = await pool.query(
      `SELECT id, name, city, type FROM sketchfab_models WHERE id = $1`,
      [modelId]
    );

    if (modelResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Model not found',
      });
    }

    const model = modelResult.rows[0];
    const githubToken = process.env.GITHUB_TOKEN;

    if (!githubToken) {
      return res.status(401).json({
        success: false,
        error: 'GitHub token not configured',
      });
    }

    console.log(`🤖 Generating interactive description for: ${model.name}`);

    // 1️⃣ GÉNÉRER LA DESCRIPTION COURTE
    const shortPrompt = `Tu es un expert en histoire et culture tunisienne.

Modèle: ${model.name}
Lieu: ${model.city}, Tunisie
Type: ${model.type}

Génère une description TRÈS COURTE EN FRANÇAIS (1-2 phrases maximum) qui décrit rapidement ce que c'est.
Cette description sera affichée immédiatement dans une popup interactive.

Génère UNIQUEMENT la description, rien d'autre.`;

    const shortResponse = await axios.post(
      getGithubModelsApiEndpoint(),
      {
        model: 'meta-llama-3.1-8b-instruct',
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert en histoire tunisienne. Génère des descriptions courtes et percutantes.'
          },
          {
            role: 'user',
            content: shortPrompt
          }
        ],
        temperature: 0.7,
        top_p: 1,
        max_tokens: 150,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${githubToken}`,
        },
      }
    );

    const shortDescription = shortResponse.data.choices[0].message.content.trim();
    console.log(`✅ Short description: ${shortDescription.substring(0, 60)}...`);

    // 2️⃣ GÉNÉRER LA DESCRIPTION LONGUE (DÉTAILLÉE)
    const longPrompt = `Tu es un expert en histoire et culture tunisienne.

Modèle: ${model.name}
Lieu: ${model.city}, Tunisie
Type: ${model.type}

Génère une description DÉTAILLÉE EN FRANÇAIS (3-4 phrases) qui fournit plus d'informations historiques, culturelles et architecturales.
Sois riche en détails, intéressant et informatif.

Génère UNIQUEMENT la description, rien d'autre.`;

    const longResponse = await axios.post(
      getGithubModelsApiEndpoint(),
      {
        model: 'meta-llama-3.1-8b-instruct',
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert en histoire tunisienne. Génère des descriptions détaillées et enrichies.'
          },
          {
            role: 'user',
            content: longPrompt
          }
        ],
        temperature: 0.7,
        top_p: 1,
        max_tokens: 400,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${githubToken}`,
        },
      }
    );

    const longDescription = longResponse.data.choices[0].message.content.trim();
    console.log(`✅ Long description: ${longDescription.substring(0, 60)}...`);

    // 3️⃣ SAUVEGARDER LES DEUX DESCRIPTIONS
    const updateResult = await pool.query(
      `UPDATE sketchfab_models 
       SET description = $1, description_long = $2, updated_at = now()
       WHERE id = $3
       RETURNING id, name, city, type, embed_src, description, description_long, created_at, updated_at`,
      [shortDescription, longDescription, modelId]
    );

    res.json({
      success: true,
      data: updateResult.rows[0],
      message: '✓ Descriptions générées!',
      shortDesc: shortDescription,
      longDesc: longDescription,
    });

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);

    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        error: 'Authentification échouée.',
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'Limite de requêtes dépassée.',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Impossible de générer les descriptions',
      details: error.message,
    });
  }
});

// ════════════════════════════════════════════════════════════════
// GENERATE INTERACTIVE FOR ALL MODELS
// ════════════════════════════════════════════════════════════════
router.post('/generate-all-interactive-descriptions', async (req, res) => {
  try {
    const githubToken = process.env.GITHUB_TOKEN;

    if (!githubToken) {
      return res.status(401).json({
        success: false,
        error: 'GitHub token not configured',
      });
    }

    const modelsResult = await pool.query(
      `SELECT id, name, city, type FROM sketchfab_models 
       WHERE description IS NULL OR description = ''
       ORDER BY id ASC`
    );

    if (modelsResult.rows.length === 0) {
      return res.json({
        success: true,
        message: 'Tous les modèles ont déjà des descriptions',
        updated: 0,
      });
    }

    console.log(`🤖 Génération de ${modelsResult.rows.length} descriptions interactives...`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const model of modelsResult.rows) {
      try {
        // COURT
        const shortPrompt = `Tu es un expert en histoire tunisienne.
Modèle: ${model.name}, Lieu: ${model.city}, Type: ${model.type}
Génère une description TRÈS COURTE (1-2 phrases). UNIQUEMENT la description.`;

        const shortResponse = await axios.post(
          getGithubModelsApiEndpoint(),
          {
            model: 'meta-llama-3.1-8b-instruct',
            messages: [
              { role: 'system', content: 'Expert en histoire tunisienne. Descriptions courtes.' },
              { role: 'user', content: shortPrompt }
            ],
            temperature: 0.7,
            top_p: 1,
            max_tokens: 150,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${githubToken}`,
            },
          }
        );

        const shortDescription = shortResponse.data.choices[0].message.content.trim();

        // LONG
        const longPrompt = `Tu es un expert en histoire tunisienne.
Modèle: ${model.name}, Lieu: ${model.city}, Type: ${model.type}
Génère une description DÉTAILLÉE (3-4 phrases) avec infos historiques et culturelles. UNIQUEMENT la description.`;

        const longResponse = await axios.post(
          getGithubModelsApiEndpoint(),
          {
            model: 'meta-llama-3.1-8b-instruct',
            messages: [
              { role: 'system', content: 'Expert en histoire tunisienne. Descriptions détaillées.' },
              { role: 'user', content: longPrompt }
            ],
            temperature: 0.7,
            top_p: 1,
            max_tokens: 400,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${githubToken}`,
            },
          }
        );

        const longDescription = longResponse.data.choices[0].message.content.trim();

        // SAUVEGARDER
        await pool.query(
          `UPDATE sketchfab_models SET description = $1, description_long = $2, updated_at = now() WHERE id = $3`,
          [shortDescription, longDescription, model.id]
        );

        results.push({
          id: model.id,
          name: model.name,
          city: model.city,
          success: true,
        });

        successCount++;
        console.log(`✅ [${successCount}/${modelsResult.rows.length}] ${model.name}`);

        await new Promise(resolve => setTimeout(resolve, 1500));

      } catch (error) {
        errorCount++;
        results.push({
          id: model.id,
          name: model.name,
          city: model.city,
          success: false,
          error: error.message,
        });
        console.error(`❌ ${model.name}:`, error.message);
      }
    }

    res.json({
      success: true,
      message: `${successCount} descriptions générées, ${errorCount} erreurs`,
      updated: successCount,
      errors: errorCount,
      results: results,
    });

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    res.status(500).json({
      success: false,
      error: 'Impossible de générer les descriptions',
      details: error.message,
    });
  }
});

// ════════════════════════════════════════════════════════════════
// GENERATE DESCRIPTION BASED ON NAME + CITY (AI will recognize them)
// ════════════════════════════════════════════════════════════════
router.post('/generate-description/:id', async (req, res) => {
  const modelId = req.params.id;

  try {
    // 1️⃣ RÉCUPÉRER LES DONNÉES DE LA TABLE
    const modelResult = await pool.query(
      `SELECT id, name, city, type FROM sketchfab_models WHERE id = $1`,
      [modelId]
    );

    if (modelResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Model not found',
      });
    }

    const model = modelResult.rows[0];
    const githubToken = process.env.GITHUB_TOKEN;

    if (!githubToken) {
      return res.status(401).json({
        success: false,
        error: 'GitHub token not configured',
      });
    }

    console.log(`🤖 Generating description for: ${model.name} (${model.city})`);

    // 2️⃣ L'IA VA RECONNAÎTRE LE LIEU ET L'OBJET
    const prompt = `Tu es un expert en histoire et culture tunisienne.

Je vais te donner le nom d'un modèle 3D, son emplacement et son type. Tu dois générer une description courte et engageante basée sur tes connaissances.

Modèle: ${model.name}
Lieu: ${model.city}, Tunisie
Type: ${model.type}

Génère une description courte EN FRANÇAIS (2-3 phrases maximum) qui:
- Est SPÉCIFIQUE à ce lieu/objet
- Contient des informations historiques ou culturelles
- Est engageante et informative
- Utilise un ton professionnel mais accessible

Génère UNIQUEMENT la description, rien d'autre.`;

    console.log('📍 Contexte:', { name: model.name, city: model.city, type: model.type });

    // 3️⃣ APPELER L'IA
    const aiResponse = await axios.post(
      getGithubModelsApiEndpoint(),
      {
        model: 'meta-llama-3.1-8b-instruct',
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert en histoire et culture tunisienne. Tu génères des descriptions courtes, précises et engageantes pour des modèles 3D.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        top_p: 1,
        max_tokens: 300,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${githubToken}`,
        },
      }
    );

    const description = aiResponse.data.choices[0].message.content.trim();

    console.log(`✅ Description générée: ${description.substring(0, 80)}...`);

    // 4️⃣ SAUVEGARDER DANS LA BD
    const updateResult = await pool.query(
      `UPDATE sketchfab_models 
       SET description = $1, updated_at = now()
       WHERE id = $2
       RETURNING id, name, city, type, embed_src, description, created_at, updated_at`,
      [description, modelId]
    );

    res.json({
      success: true,
      data: updateResult.rows[0],
      message: '✓ Description générée et sauvegardée!',
    });

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);

    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        error: 'Authentification échouée.',
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'Limite de requêtes dépassée.',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Impossible de générer la description',
      details: error.message,
    });
  }
});

// ════════════════════════════════════════════════════════════════
// GENERATE FOR ALL MODELS WITHOUT DESCRIPTION
// ════════════════════════════════════════════════════════════════
router.post('/generate-all-descriptions', async (req, res) => {
  try {
    const githubToken = process.env.GITHUB_TOKEN;

    if (!githubToken) {
      return res.status(401).json({
        success: false,
        error: 'GitHub token not configured',
      });
    }

    // Récupérer tous les modèles sans description
    const modelsResult = await pool.query(
      `SELECT id, name, city, type FROM sketchfab_models 
       WHERE description IS NULL OR description = ''
       ORDER BY id ASC`
    );

    if (modelsResult.rows.length === 0) {
      return res.json({
        success: true,
        message: 'Tous les modèles ont déjà une description',
        updated: 0,
      });
    }

    console.log(`🤖 Génération de ${modelsResult.rows.length} descriptions...`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const model of modelsResult.rows) {
      try {
        const prompt = `Tu es un expert en histoire et culture tunisienne.

Modèle: ${model.name}
Lieu: ${model.city}, Tunisie
Type: ${model.type}

Génère une description courte EN FRANÇAIS (2-3 phrases maximum) qui:
- Est SPÉCIFIQUE à ce lieu/objet
- Contient des informations historiques ou culturelles
- Est engageante et informative

Génère UNIQUEMENT la description.`;

        const aiResponse = await axios.post(
          getGithubModelsApiEndpoint(),
          {
            model: 'meta-llama-3.1-8b-instruct',
            messages: [
              {
                role: 'system',
                content: 'Tu es un expert en histoire tunisienne. Génère des descriptions courtes et précises.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.7,
            top_p: 1,
            max_tokens: 300,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${githubToken}`,
            },
          }
        );

        const description = aiResponse.data.choices[0].message.content.trim();

        // Sauvegarder dans BD
        await pool.query(
          `UPDATE sketchfab_models SET description = $1, updated_at = now() WHERE id = $2`,
          [description, model.id]
        );

        results.push({
          id: model.id,
          name: model.name,
          city: model.city,
          success: true,
          description: description.substring(0, 80) + '...',
        });

        successCount++;
        console.log(`✅ [${successCount}/${modelsResult.rows.length}] ${model.name} - ${model.city}`);

        // Délai pour éviter rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        errorCount++;
        results.push({
          id: model.id,
          name: model.name,
          city: model.city,
          success: false,
          error: error.message,
        });
        console.error(`❌ ${model.name}:`, error.message);
      }
    }

    res.json({
      success: true,
      message: `${successCount} descriptions générées, ${errorCount} erreurs`,
      updated: successCount,
      errors: errorCount,
      results: results,
    });

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    res.status(500).json({
      success: false,
      error: 'Impossible de générer les descriptions',
      details: error.message,
    });
  }
});

// ════════════════════════════════════════════════════════════════
// GET ALL MODELS
// ════════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, city, type, embed_src, description, description_long, created_at, updated_at 
       FROM sketchfab_models 
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    console.error('Erreur:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch models',
      details: err.message,
    });
  }
});

// ════════════════════════════════════════════════════════════════
// GET SINGLE MODEL
// ════════════════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  const modelId = req.params.id;

  try {
    const result = await pool.query(
      `SELECT id, name, city, type, embed_src, description, description_long, created_at, updated_at 
       FROM sketchfab_models 
       WHERE id = $1`,
      [modelId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Model not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error('Erreur:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch model',
      details: err.message,
    });
  }
});

// ════════════════════════════════════════════════════════════════
// CREATE MODEL
// ════════════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const { name, city, type, embed_src } = req.body;

    if (!name || !city || !type || !embed_src) {
      return res.status(400).json({
        success: false,
        error: 'name, city, type, et embed_src sont requis',
      });
    }

    const existCheck = await pool.query(
      'SELECT id FROM sketchfab_models WHERE embed_src = $1',
      [embed_src]
    );

    if (existCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Ce modèle existe déjà',
      });
    }

    const result = await pool.query(
      `INSERT INTO sketchfab_models (name, city, type, embed_src, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       RETURNING id, name, city, type, embed_src, description, description_long, created_at, updated_at`,
      [name, city, type, embed_src]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: '✓ Modèle créé!',
    });
  } catch (err) {
    console.error('Erreur:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to create model',
      details: err.message,
    });
  }
});

// ════════════════════════════════════════════════════════════════
// UPDATE MODEL
// ════════════════════════════════════════════════════════════════
router.put('/:id', async (req, res) => {
  const modelId = req.params.id;

  try {
    const { name, city, type, embed_src } = req.body;

    const modelCheck = await pool.query(
      'SELECT id FROM sketchfab_models WHERE id = $1',
      [modelId]
    );

    if (modelCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Model not found',
      });
    }

    const result = await pool.query(
      `UPDATE sketchfab_models 
       SET name = COALESCE($1, name),
           city = COALESCE($2, city),
           type = COALESCE($3, type),
           embed_src = COALESCE($4, embed_src),
           updated_at = now()
       WHERE id = $5
       RETURNING id, name, city, type, embed_src, description, description_long, created_at, updated_at`,
      [name || null, city || null, type || null, embed_src || null, modelId]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: '✓ Modèle mis à jour!',
    });
  } catch (err) {
    console.error('Erreur:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update model',
      details: err.message,
    });
  }
});

// ════════════════════════════════════════════════════════════════
// DELETE MODEL
// ════════════════════════════════════════════════════════════════
router.delete('/:id', async (req, res) => {
  const modelId = req.params.id;

  try {
    const modelCheck = await pool.query(
      'SELECT id FROM sketchfab_models WHERE id = $1',
      [modelId]
    );

    if (modelCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Model not found',
      });
    }

    await pool.query('DELETE FROM sketchfab_models WHERE id = $1', [modelId]);

    res.json({
      success: true,
      message: '✓ Modèle supprimé!',
    });
  } catch (err) {
    console.error('Erreur:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to delete model',
      details: err.message,
    });
  }
});

module.exports = router;