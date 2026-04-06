// backend/routes/cities.js
const express = require('express');
const router = express.Router();
const pool = require('../../db/connection');

// ═══════════════════════════════════════════════════════════════════════════
// GET ALL CITIES (Basic Info)
// ═══════════════════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, region FROM cities ORDER BY name ASC'
    );
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    console.error('Error fetching cities:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cities',
      details: err.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET SINGLE CITY WITH ALL RELATED DATA
// ═══════════════════════════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  const cityId = req.params.id;

  try {
    // 1. Get city basic info
    const cityResult = await pool.query(
      `SELECT id, name, region, map_src, map_center_lat, map_center_lng, map_zoom 
       FROM cities WHERE id = $1`,
      [cityId]
    );

    if (cityResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'City not found',
      });
    }

    const city = cityResult.rows[0];

    // 2. Get hero section
    const heroResult = await pool.query(
      'SELECT bg, description FROM hero_sections WHERE city_id = $1',
      [cityId]
    );

    // 3. Get hero cards
    const heroCardsResult = await pool.query(
      'SELECT id, img, name FROM hero_cards WHERE city_id = $1 ORDER BY display_order ASC',
      [cityId]
    );

    // 4. Get about section
    const aboutResult = await pool.query(
      'SELECT label, headline, body, img FROM city_about WHERE city_id = $1',
      [cityId]
    );

    // 5. Get stats
    const statsResult = await pool.query(
      'SELECT icon, num, label FROM city_stats WHERE city_id = $1',
      [cityId]
    );

    // 6. Get culture items
    const cultureItemsResult = await pool.query(
      `SELECT id, label, title, description, img, rating 
       FROM culture_items WHERE city_id = $1 ORDER BY display_order ASC`,
      [cityId]
    );

    // 7. Get events
    const eventsResult = await pool.query(
      'SELECT id, date, name, img FROM events WHERE city_id = $1 ORDER BY date ASC',
      [cityId]
    );

    // 8. Get experiences/activities
    const experiencesResult = await pool.query(
      'SELECT id, name, type, rating as r, img FROM experiences WHERE city_id = $1 ORDER BY name ASC',
      [cityId]
    );

    // 9. Get food items
    const foodResult = await pool.query(
      `SELECT id, img, category as cat, name, description as desc 
       FROM food_items WHERE city_id = $1 ORDER BY display_order ASC`,
      [cityId]
    );

    // 10. Get hotels
    const hotelsResult = await pool.query(
      `SELECT id, name as n, distance as dist, img, rating as r, price 
       FROM hotels WHERE city_id = $1 ORDER BY display_order ASC`,
      [cityId]
    );

    // 11. Get delegations with map markers
    const delegationsResult = await pool.query(
      `SELECT id, name, population as pop, area, description as desc, img, 
              founded, notable, type, lat, lng 
       FROM delegations WHERE city_id = $1 ORDER BY name ASC`,
      [cityId]
    );

    // 12. Get banner
    const bannerResult = await pool.query(
      `SELECT id, type, title, subtitle, cta_label, cta_url, video_url, video_poster 
       FROM city_banners WHERE city_id = $1`,
      [cityId]
    );

    // Get banner images if carousel type
    let bannerImages = [];
    if (bannerResult.rows.length > 0 && bannerResult.rows[0].type === 'carousel') {
      const imagesResult = await pool.query(
        'SELECT image_url FROM banner_images WHERE banner_id = $1 ORDER BY display_order ASC',
        [bannerResult.rows[0].id]
      );
      bannerImages = imagesResult.rows.map(row => row.image_url);
    }

    // 13. Get CTA
    const ctaResult = await pool.query(
      'SELECT label, title,  description as desc, image FROM city_ctas WHERE city_id = $1',
      [cityId]
    );

    // ─────────────────────────────────────────────────────────────────────────
    // BUILD RESPONSE OBJECT
    // ─────────────────────────────────────────────────────────────────────────
    const responseCity = {
      id: city.id,
      name: city.name,
      region: city.region,
      mapSrc: city.map_src,
      mapCenter:
        city.map_center_lat && city.map_center_lng
          ? [parseFloat(city.map_center_lat), parseFloat(city.map_center_lng)]
          : [36.819, 10.1658],
      mapZoom: city.map_zoom || 13,

      // Hero section
      hero: {
        bg: heroResult.rows[0]?.bg || '',
        desc: heroResult.rows[0]?.description || '',
        cards: heroCardsResult.rows || [],
      },

      // About section
      about:
        aboutResult.rows.length > 0
          ? {
              label: aboutResult.rows[0].label,
              headline: aboutResult.rows[0].headline,
              body: aboutResult.rows[0].body,
              img: aboutResult.rows[0].img,
              stats: statsResult.rows || [],
            }
          : undefined,

      // Culture section
      culture: {
        title: `La culture de ${city.name}`,
        country: `Tunisie · ${city.region}`,
        items: cultureItemsResult.rows || [],
      },

      // Events
      events: eventsResult.rows || [],

      // Experiences/Activities
      experiences: experiencesResult.rows || [],

      // Food
      food: foodResult.rows || [],

      // Hotels
      hotels: hotelsResult.rows || [],

      // Delegations
      delegations: delegationsResult.rows || [],

      // CTA
      cta: ctaResult.rows[0] || { label: '', title: '', description: '', image: '' },

      // Banner
      banner:
        bannerResult.rows.length > 0
          ? {
              type: bannerResult.rows[0].type,
              title: bannerResult.rows[0].title,
              subtitle: bannerResult.rows[0].subtitle,
              ctaLabel: bannerResult.rows[0].cta_label,
              ctaUrl: bannerResult.rows[0].cta_url,
              videoUrl: bannerResult.rows[0].video_url,
              videoPoster: bannerResult.rows[0].video_poster,
              images: bannerImages,
            }
          : undefined,
    };

    res.json({
      success: true,
      data: responseCity,
    });
  } catch (err) {
    console.error('Error fetching city details:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch city details',
      details: err.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET CITY BY NAME (Alternative)
// ═══════════════════════════════════════════════════════════════════════════
router.get('/by-name/:name', async (req, res) => {
  const cityName = req.params.name;

  try {
    const result = await pool.query(
      'SELECT id FROM cities WHERE LOWER(name) = LOWER($1)',
      [cityName]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'City not found',
      });
    }

    // Redirect to the ID-based endpoint
    res.redirect(`/api/cities/${result.rows[0].id}`);
  } catch (err) {
    console.error('Error fetching city by name:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch city',
      details: err.message,
    });
  }
});

module.exports = router;