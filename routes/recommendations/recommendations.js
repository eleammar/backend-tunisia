const express = require('express');
const router = express.Router();
const pool = require('../../src/db/connection');
const axios = require('axios');

// GET /api/recommendations/context/:userId
// Returns all data an AI agent needs to generate personalized recommendations


router.get('/cities', async (req, res) => {

  try {
const allcities = await pool.query(
      `SELECT jsonb_agg(row_to_json(final_data))
FROM (
  SELECT 
    ct.id,
    ct.name,
    ct.hero->'desc'   as description,
    COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', t.id,
                'name', t.name
              )
            )
            FROM public.city_tags citytag
            JOIN public.tags t 
              ON t.id = citytag.tag_id
            WHERE citytag.city_id = ct.id
          ), '[]') as tags,
    COALESCE(experiences.experiences, '[]') AS experiences,
    COALESCE(events.events, '[]') AS events,
    COALESCE(places.places, '[]') AS places,
    COALESCE(all_foods.all_foods, '[]') AS all_foods

  FROM public.cities ct



  LEFT JOIN (
    SELECT 
      expe.city_id,
      jsonb_agg(
        jsonb_build_object(
          'id', expe.id,
          'name', expe.name,
          'type', expe.type,
          'rating', expe.rating,
          'tags', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', t.id,
                'name', t.name
              )
            )
            FROM public.experience_tags exptag
            JOIN public.tags t 
              ON t.id = exptag.tag_id
            WHERE exptag.experience_id = expe.id
          ), '[]')
        )
        ORDER BY expe.id
      ) AS experiences
    FROM public.experiences expe
    GROUP BY expe.city_id
  ) experiences 
  ON experiences.city_id = ct.id

  LEFT JOIN (
    SELECT 
      eve.city_id,
      jsonb_agg(
        jsonb_build_object(
          'id', eve.id,
          'name', eve.name,
          'category', eve.category,
          'date', eve.date,
          'tags', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', t.id,
                'name', t.name
              )
            )
            FROM public.event_tags evtag
            JOIN public.tags t 
              ON t.id = evtag.tag_id
            WHERE evtag.event_id = eve.id
          ), '[]')
        )
        ORDER BY eve.id
      ) AS events
    FROM public.events as eve
    GROUP BY eve.city_id
  ) events 
  ON events.city_id = ct.id

  LEFT JOIN (
    SELECT 
      pla.city_id,
      jsonb_agg(
        jsonb_build_object(
          'id', pla.id,
          'name', pla.name,
          'description', pla.description,
          'address', pla.address,
          'tags', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', t.id,
                'name', t.name
              )
            )
            FROM public.place_tags platag
            JOIN public.tags t 
              ON t.id = platag.tag_id
            WHERE platag.place_id = pla.id
          ), '[]')
        )
        ORDER BY pla.id
      ) AS places
    FROM public.places as pla
    GROUP BY pla.city_id
  ) places 
  ON places.city_id = ct.id

  LEFT JOIN (
    SELECT 
      foo.city,
      jsonb_agg(
        jsonb_build_object(
          'id', foo.id,
          'name', foo.name,
          'description', foo.description,
          'category', foo.category,
          'recipe', foo.recipe,
          'tags', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', t.id,
                'name', t.name
              )
            )
            FROM public.food_tags fdtag
            JOIN public.tags t 
              ON t.id = fdtag.tag_id
            WHERE fdtag.food_id = foo.id
          ), '[]')
        )
        ORDER BY foo.id
      ) AS all_foods
    FROM public.all_foods as foo
    GROUP BY foo.city
  ) all_foods 
  ON all_foods.city = ct.name

  ORDER BY ct.id ASC
) final_data;`
    );
res.json(allcities.rows[0].jsonb_agg);


  } catch (err) {
    console.error("Error fetching cities:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get('/questionReponse', async (req, res) => {

  try {
const questionReponse = await pool.query(
      `SELECT json_agg(row_to_json(final_data))
FROM (
    SELECT 
        us.id,
        us.full_name,
        us.email,
        us.role,
        us.onboarding_completed,

        json_agg(
            json_build_object(
                'step_id', step_data.step_id,
                'title', step_data.title,
                'description', step_data.description,
                'multi', step_data.multi,
                'order_index', step_data.order_index,
                'options', step_data.options
            )
            ORDER BY step_data.order_index
        ) AS steps

    FROM (
        SELECT 
            usan.user_id,
            ste.id AS step_id,
            ste.title,
            ste.description,
            ste.multi,
            ste.order_index,

            json_agg(
                json_build_object(
                    'id', opt.id,
                    'title', opt.title,
                    'subtitle', opt.subtitle,
                    'type', opt.type
                )
                ORDER BY opt.id
            ) AS options

        FROM public.user_answers usan
        JOIN public.steps ste ON ste.id = usan.step_id
        JOIN public.options opt ON opt.id = usan.option_id

        GROUP BY 
            usan.user_id,
            ste.id, ste.title, ste.description, ste.multi, ste.order_index
    ) AS step_data

    JOIN public.users us ON us.id = step_data.user_id

    GROUP BY us.id, us.full_name, us.email, us.role, us.onboarding_completed
    ORDER BY us.id
) final_data;`
    );

res.json(questionReponse.rows[0].json_agg);
  } catch (err) {
    console.error("Error fetching cities:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Generate recommendations using n8n AI (must come BEFORE generic /:userId route)
router.get('/n8n/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user data
    const userRes = await pool.query(
      `SELECT id, full_name, email FROM users WHERE id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userRes.rows[0];

    // Get user's answers to onboarding questions
    const userAnswersRes = await pool.query(
      `SELECT 
        ste.id as step_id,
        ste.title as step_title,
        opt.id as option_id,
        opt.title as option_title,
        opt.subtitle as option_subtitle
       FROM user_answers usan
       JOIN steps ste ON ste.id = usan.step_id
       JOIN options opt ON opt.id = usan.option_id
       WHERE usan.user_id = $1
       ORDER BY ste.order_index`,
      [userId]
    );

    // Format user answers for n8n
    const userAnswers = userAnswersRes.rows.map(row => ({
      step: row.step_title,
      answer: row.option_title,
      subtitle: row.option_subtitle
    }));

    // Send user data to n8n webhook
    const n8nPayload = {
      userId,
      user_name: user.full_name,
      user_email: user.email,
      user_answers: userAnswers
    };

    console.log("Sending to n8n:", n8nPayload);

    const response = await axios.post(
      "http://localhost:5678/webhook-test/330b9488-ac5e-4801-8028-d046f13760ca",
      n8nPayload
    );

    const aiData = response.data;

    const { recommended_cities, recommended_places, recommended_events, recommended_experiences } = aiData;

    const cityIds    = recommended_cities.map(c => c.id);
    const placeIds   = recommended_places.map(p => p.id);
    const eventIds   = recommended_events.map(e => e.id);
    const expIds     = recommended_experiences.map(e => e.id);

    const [citiesRes, placesRes, eventsRes, expsRes] = await Promise.all([
      pool.query(
        `SELECT ct.id, ct.name, ct.map_src, hs.description, hs.bg
         FROM cities ct
         LEFT JOIN hero_sections hs ON hs.city_id = ct.id
         WHERE ct.id = ANY($1::int[])`,
        [cityIds]
      ),
      pool.query(
        `SELECT p.*
         FROM places p WHERE p.id = ANY($1::text[])`,
        [placeIds]
      ),
      pool.query(
        `SELECT e.id, e.city_id, e.name, e.date, e.img, e.category
         FROM events e WHERE e.id = ANY($1::int[])`,
        [eventIds]
      ),
      pool.query(
        `SELECT ex.id, ex.city_id, ex.name, ex.type, ex.rating, ex.img
         FROM experiences ex WHERE ex.id = ANY($1::int[])`,
        [expIds]
      )
    ]);

    const citiesMap = Object.fromEntries(citiesRes.rows.map(r => [r.id, r]));
    const placesMap = Object.fromEntries(placesRes.rows.map(r => [r.id, r]));
    const eventsMap = Object.fromEntries(eventsRes.rows.map(r => [r.id, r]));
    const expsMap   = Object.fromEntries(expsRes.rows.map(r => [r.id, r]));

    const enrichedCities = recommended_cities.map(item => {
      const db = citiesMap[item.id];
      return db ? { ...db, score: item.score, why: item.why, headline: item.headline } : item;
    });

    const enrichedPlaces = recommended_places.map(item => {
      const db = placesMap[item.id];
      return db ? { ...db, score: item.score, why: item.why } : item;
    });

    const enrichedEvents = recommended_events.map(item => {
      const db = eventsMap[item.id];
      return db ? { ...db, score: item.score, why: item.why } : item;
    });

    const enrichedExperiences = recommended_experiences.map(item => {
      const db = expsMap[item.id];
      return db ? { ...db, score: item.score, why: item.why } : item;
    });

    // Save recommendations to database
    await pool.query(
      `INSERT INTO recommendations (user_id, recommended_cities, recommended_places, recommended_events, recommended_experiences)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
       recommended_cities = $2,
       recommended_places = $3,
       recommended_events = $4,
       recommended_experiences = $5,
       updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        JSON.stringify(enrichedCities),
        JSON.stringify(enrichedPlaces),
        JSON.stringify(enrichedEvents),
        JSON.stringify(enrichedExperiences)
      ]
    );

    res.json({
      success: true,
      userId,
      user_name: user.full_name,
      data: {
        recommended_cities: enrichedCities,
        recommended_places: enrichedPlaces,
        recommended_events: enrichedEvents,
        recommended_experiences: enrichedExperiences
      }
    });

  } catch (err) {
    console.error("Error fetching recommendations:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// GET recommendations for a specific user (retrieve from database)
// This must come AFTER /n8n/:userId so more specific routes are matched first
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate that userId is a number
    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid userId. Please provide a numeric user ID." });
    }

    const recRes = await pool.query(
      `SELECT * FROM recommendations WHERE user_id = $1`,
      [parseInt(userId)]
    );

    if (recRes.rows.length === 0) {
      return res.status(404).json({ error: "No recommendations found for this user. Please generate recommendations first by calling /n8n/:userId" });
    }

    const recommendation = recRes.rows[0];

    res.json({
      success: true,
      userId,
      created_at: recommendation.created_at,
      updated_at: recommendation.updated_at,
      data: {
        recommended_cities: recommendation.recommended_cities,
        recommended_places: recommendation.recommended_places,
        recommended_events: recommendation.recommended_events,
        recommended_experiences: recommendation.recommended_experiences
      }
    });

  } catch (err) {
    console.error("Error fetching recommendations:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


router.post('/save', async (req, res) => {
  try {
    const {
      userId,
      recommended_cities,
      recommended_places,
      recommended_events,
      recommended_experiences
    } = req.body;

    const cleanUserId = parseInt(String(userId).replace(/[^0-9]/g, ''));

    if (!cleanUserId || isNaN(cleanUserId)) {
      return res.status(400).json({ error: "userId is required and must be a number" });
    }

    const cities  = recommended_cities    || [];
    const places  = recommended_places    || [];
    const events  = recommended_events    || [];
    const exps    = recommended_experiences || [];

    const cityIds  = cities.map(c => c.id).filter(Boolean);
    const placeIds = places.map(p => p.id).filter(Boolean);
    const eventIds = events.map(e => e.id).filter(Boolean);
    const expIds   = exps.map(e => e.id).filter(Boolean);

    const [citiesRes, placesRes, eventsRes, expsRes] = await Promise.all([
      cityIds.length  ? pool.query(`SELECT ct.id, ct.name, ct.map_src, hs.description, hs.bg FROM cities ct LEFT JOIN hero_sections hs ON hs.city_id = ct.id WHERE ct.id = ANY($1::int[])`, [cityIds])  : { rows: [] },
      placeIds.length ? pool.query(`SELECT p.* FROM places p WHERE p.id = ANY($1::text[])`, [placeIds]) : { rows: [] },
      eventIds.length ? pool.query(`SELECT e.id, e.city_id, e.name, e.date, e.img, e.category FROM events e WHERE e.id = ANY($1::int[])`, [eventIds]) : { rows: [] },
      expIds.length   ? pool.query(`SELECT ex.id, ex.city_id, ex.name, ex.type, ex.rating, ex.img FROM experiences ex WHERE ex.id = ANY($1::int[])`, [expIds]) : { rows: [] }
    ]);

    const citiesMap = Object.fromEntries(citiesRes.rows.map(r => [r.id, r]));
    const placesMap = Object.fromEntries(placesRes.rows.map(r => [r.id, r]));
    const eventsMap = Object.fromEntries(eventsRes.rows.map(r => [r.id, r]));
    const expsMap   = Object.fromEntries(expsRes.rows.map(r => [r.id, r]));

    const enrichedCities      = cities.map(item => { const db = citiesMap[item.id]; return db ? { ...db, score: item.score, why: item.why, headline: item.headline } : item; });
    const enrichedPlaces      = places.map(item => { const db = placesMap[item.id]; return db ? { ...db, score: item.score, why: item.why } : item; });
    const enrichedEvents      = events.map(item => { const db = eventsMap[item.id]; return db ? { ...db, score: item.score, why: item.why } : item; });
    const enrichedExperiences = exps.map(item   => { const db = expsMap[item.id];   return db ? { ...db, score: item.score, why: item.why } : item; });

    await pool.query(
      `INSERT INTO recommendations
        (user_id, recommended_cities, recommended_places, recommended_events, recommended_experiences)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         recommended_cities    = $2,
         recommended_places    = $3,
         recommended_events    = $4,
         recommended_experiences = $5,
         updated_at = CURRENT_TIMESTAMP`,
      [
        cleanUserId,
        JSON.stringify(enrichedCities),
        JSON.stringify(enrichedPlaces),
        JSON.stringify(enrichedEvents),
        JSON.stringify(enrichedExperiences)
      ]
    );

    res.json({ success: true, userId: cleanUserId });

  } catch (err) {
    console.error("Error saving recommendations:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

module.exports = router;
