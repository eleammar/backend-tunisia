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

router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.onboarding_completed,
              COUNT(DISTINCT ua.step_id) AS answer_count,
              CASE WHEN r.user_id IS NOT NULL THEN true ELSE false END AS has_recommendation,
              r.updated_at AS recommendation_updated_at
       FROM public.users u
       LEFT JOIN public.user_answers ua ON ua.user_id = u.id
       LEFT JOIN public.recommendations r ON r.user_id = u.id
       GROUP BY u.id, u.full_name, u.email, u.onboarding_completed, r.user_id, r.updated_at
       ORDER BY has_recommendation DESC, u.id ASC
`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const monthly = await pool.query(
      `SELECT
         TO_CHAR(updated_at, 'YYYY-MM') AS month,
         TO_CHAR(updated_at, 'Mon')     AS month_label,
         COUNT(*)::int                  AS total
       FROM public.recommendations
       GROUP BY TO_CHAR(updated_at, 'YYYY-MM'), TO_CHAR(updated_at, 'Mon')
       ORDER BY month ASC`
    );

    const totals = await pool.query(
      `SELECT
         COUNT(*)::int                                             AS total_reco,
         COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '30 days')::int AS last_30d,
         COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '7 days')::int  AS last_7d,
         MAX(updated_at)                                           AS last_generated
       FROM public.recommendations`
    );

    res.json({
      monthly: monthly.rows,
      totals:  totals.rows[0],
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/questionReponse', async (req, res) => {
  let userId = req.query.user_id;

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
        left JOIN public.steps ste ON ste.id = usan.step_id
       left JOIN public.options opt ON opt.id = usan.option_id

        GROUP BY 
            usan.user_id,
            ste.id, ste.title, ste.description, ste.multi, ste.order_index
    ) AS step_data

     JOIN public.users us ON us.id = step_data.user_id

	 where us.id=$1

    GROUP BY us.id, us.full_name, us.email, us.role, us.onboarding_completed
    ORDER BY us.id
) final_data;`,
 [userId]
    );
if(questionReponse.rows.length === 0 || questionReponse.rows[0].json_agg === null){
  return res.status(404).json({ error: "No data found for the given user ID" });
}
res.json(questionReponse.rows[0].json_agg);
  } catch (err) {
    console.error("Error fetching cities:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get('/n8n/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
   
    const recRes = await pool.query(
      `SELECT * FROM recommendations WHERE user_id = $1`,
      [parseInt(userId)]
    );

    if (recRes.rows.length > 0) {
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
    });    }
    else{

    const response = await axios.get(
      "http://localhost:5678/webhook/330b9488-ac5e-4801-8028-d046f13760ca?user_id=" + userId
      
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
      data: {
        recommended_cities: enrichedCities,
        recommended_places: enrichedPlaces,
        recommended_events: enrichedEvents,
        recommended_experiences: enrichedExperiences
      }
    });

    }
    
  } catch (err) {
    console.error("Error fetching recommendations:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});



module.exports = router;
