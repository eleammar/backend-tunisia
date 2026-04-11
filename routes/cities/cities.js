// backend/routes/cities.js - COMPLETE WITH CRUD
const express = require('express');
const router = express.Router();
const pool = require('../../db/connection');

// ═══════════════════════════════════════════════════════════════════════════
// GET ALL CITIES (WITH HERO INFO FOR CARDS)
// ═══════════════════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        c.id, 
        c.name, 
        c.region,
        c.map_center_lat,
        c.map_center_lng,
        h.bg,
        h.description
      FROM cities c
      LEFT JOIN hero_sections h ON c.id = h.city_id
      ORDER BY c.name ASC`
    );

    // ✅ Map to include hero object
    const cities = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      region: row.region,
      mapCenter: [parseFloat(row.map_center_lat), parseFloat(row.map_center_lng)],
      hero: {
        bg: row.bg || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80',
        description: row.description || `Découvrez ${row.name}`
      }
    }));

    res.json({
      success: true,
      data: cities,
      count: cities.length,
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
      'SELECT label, title, description as desc, image FROM city_ctas WHERE city_id = $1',
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
// CREATE NEW CITY (POST)
// ═══════════════════════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      name,
      region,
      mapSrc,
      mapCenter,
      mapZoom,
      hero,
      about,
      culture,
      events,
      experiences,
      food,
      hotels,
      delegations,
      banner,
      cta,
    } = req.body;

    // Validate required fields
    if (!name || !region) {
      return res.status(400).json({
        success: false,
        error: 'Name and region are required',
      });
    }

    await client.query('BEGIN');

    // 1. Insert city
    const cityResult = await client.query(
      `INSERT INTO cities (name, region, map_src, map_center_lat, map_center_lng, map_zoom)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [name, region, mapSrc || '', mapCenter[0], mapCenter[1], mapZoom || 13]
    );

    const cityId = cityResult.rows[0].id;

    // 2. Insert hero section
    if (hero && hero.bg) {
      await client.query(
        `INSERT INTO hero_sections (city_id, bg, description)
         VALUES ($1, $2, $3)`,
        [cityId, hero.bg, hero.desc || '']
      );

      // Insert hero cards
      if (hero.cards && hero.cards.length > 0) {
        for (let i = 0; i < hero.cards.length; i++) {
          await client.query(
            `INSERT INTO hero_cards (city_id, img, name, display_order)
             VALUES ($1, $2, $3, $4)`,
            [cityId, hero.cards[i].img, hero.cards[i].name, i]
          );
        }
      }
    }

    // 3. Insert about section
    if (about && about.headline) {
      await client.query(
        `INSERT INTO city_about (city_id, label, headline, body, img)
         VALUES ($1, $2, $3, $4, $5)`,
        [cityId, about.label || '', about.headline, about.body || '', about.img || '']
      );

      // Insert stats
      if (about.stats && about.stats.length > 0) {
        for (const stat of about.stats) {
          await client.query(
            `INSERT INTO city_stats (city_id, icon, num, label)
             VALUES ($1, $2, $3, $4)`,
            [cityId, stat.icon || '', stat.num || '', stat.label || '']
          );
        }
      }
    }

    // 4. Insert culture items
    if (culture && culture.items && culture.items.length > 0) {
      for (let i = 0; i < culture.items.length; i++) {
        const item = culture.items[i];
        await client.query(
          `INSERT INTO culture_items (city_id, label, title, description, img, rating, display_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [cityId, item.label || '', item.title, item.description || '', item.img || '', item.rating || 0, i]
        );
      }
    }

    // 5. Insert events
    if (events && events.length > 0) {
      for (const event of events) {
        await client.query(
          `INSERT INTO events (city_id, date, name, img)
           VALUES ($1, $2, $3, $4)`,
          [cityId, event.date, event.name, event.img || '']
        );
      }
    }

    // 6. Insert experiences (activities)
    if (experiences && experiences.length > 0) {
      for (const exp of experiences) {
        await client.query(
          `INSERT INTO experiences (city_id, name, type, rating, img)
           VALUES ($1, $2, $3, $4, $5)`,
          [cityId, exp.name, exp.type || '', exp.r || 0, exp.img || '']
        );
      }
    }

    // 7. Insert food items
    if (food && food.length > 0) {
      for (let i = 0; i < food.length; i++) {
        const item = food[i];
        await client.query(
          `INSERT INTO food_items (city_id, img, category, name, description, display_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [cityId, item.img || '', item.cat || '', item.name, item.desc || '', i]
        );
      }
    }

    // 8. Insert hotels
    if (hotels && hotels.length > 0) {
      for (let i = 0; i < hotels.length; i++) {
        const hotel = hotels[i];
        await client.query(
          `INSERT INTO hotels (city_id, name, distance, img, rating, price, display_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [cityId, hotel.n, hotel.dist || 0, hotel.img || '', hotel.r || 0, hotel.price || 0, i]
        );
      }
    }

    // 9. Insert delegations
    if (delegations && delegations.length > 0) {
      for (const deleg of delegations) {
        await client.query(
          `INSERT INTO delegations (city_id, name, population, area, description, img, founded, notable, type, lat, lng)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            cityId,
            deleg.name,
            deleg.pop || 0,
            deleg.area || 0,
            deleg.desc || '',
            deleg.img || '',
            deleg.founded || 0,
            deleg.notable || '',
            deleg.type || '',
            deleg.lat,
            deleg.lng,
          ]
        );
      }
    }

    // 10. Insert banner
    if (banner && banner.title) {
      const bannerResult = await client.query(
        `INSERT INTO city_banners (city_id, type, title, subtitle, cta_label, cta_url, video_url, video_poster)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          cityId,
          banner.type || 'static',
          banner.title,
          banner.subtitle || '',
          banner.ctaLabel || '',
          banner.ctaUrl || '',
          banner.videoUrl || '',
          banner.videoPoster || '',
        ]
      );

      const bannerId = bannerResult.rows[0].id;

      // Insert banner images if carousel
      if (banner.type === 'carousel' && banner.images && banner.images.length > 0) {
        for (let i = 0; i < banner.images.length; i++) {
          await client.query(
            `INSERT INTO banner_images (banner_id, image_url, display_order)
             VALUES ($1, $2, $3)`,
            [bannerId, banner.images[i], i]
          );
        }
      }
    }

    // 11. Insert CTA
    if (cta && cta.title) {
      await client.query(
        `INSERT INTO city_ctas (city_id, label, title, description, image)
         VALUES ($1, $2, $3, $4, $5)`,
        [cityId, cta.label || '', cta.title, cta.description || '', cta.image || '']
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      data: { id: cityId, name, region },
      message: '✓ City created successfully!',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating city:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to create city',
      details: err.message,
    });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE CITY (PUT)
// ═══════════════════════════════════════════════════════════════════════════
router.put('/:id', async (req, res) => {
  const cityId = req.params.id;
  const client = await pool.connect();

  try {
    const {
      name,
      region,
      mapSrc,
      mapCenter,
      mapZoom,
      hero,
      about,
      culture,
      events,
      experiences,
      food,
      hotels,
      delegations,
      banner,
      cta,
    } = req.body;

    // Check city exists
    const cityCheck = await client.query('SELECT id FROM cities WHERE id = $1', [cityId]);
    if (cityCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'City not found',
      });
    }

    await client.query('BEGIN');

    // 1. Update city basic info
    await client.query(
      `UPDATE cities SET name = $1, region = $2, map_src = $3, map_center_lat = $4, 
                         map_center_lng = $5, map_zoom = $6
       WHERE id = $7`,
      [name, region, mapSrc || '', mapCenter[0], mapCenter[1], mapZoom || 13, cityId]
    );

    // 2. Delete and recreate hero section
    await client.query('DELETE FROM hero_cards WHERE city_id = $1', [cityId]);
    await client.query('DELETE FROM hero_sections WHERE city_id = $1', [cityId]);

    if (hero && hero.bg) {
      await client.query(
        `INSERT INTO hero_sections (city_id, bg, description)
         VALUES ($1, $2, $3)`,
        [cityId, hero.bg, hero.desc || '']
      );

      if (hero.cards && hero.cards.length > 0) {
        for (let i = 0; i < hero.cards.length; i++) {
          await client.query(
            `INSERT INTO hero_cards (city_id, img, name, display_order)
             VALUES ($1, $2, $3, $4)`,
            [cityId, hero.cards[i].img, hero.cards[i].name, i]
          );
        }
      }
    }

    // 3. Delete and recreate about section
    await client.query('DELETE FROM city_stats WHERE city_id = $1', [cityId]);
    await client.query('DELETE FROM city_about WHERE city_id = $1', [cityId]);

    if (about && about.headline) {
      await client.query(
        `INSERT INTO city_about (city_id, label, headline, body, img)
         VALUES ($1, $2, $3, $4, $5)`,
        [cityId, about.label || '', about.headline, about.body || '', about.img || '']
      );

      if (about.stats && about.stats.length > 0) {
        for (const stat of about.stats) {
          await client.query(
            `INSERT INTO city_stats (city_id, icon, num, label)
             VALUES ($1, $2, $3, $4)`,
            [cityId, stat.icon || '', stat.num || '', stat.label || '']
          );
        }
      }
    }

    // 4. Delete and recreate other sections
    await client.query('DELETE FROM culture_items WHERE city_id = $1', [cityId]);
    if (culture && culture.items && culture.items.length > 0) {
      for (let i = 0; i < culture.items.length; i++) {
        const item = culture.items[i];
        await client.query(
          `INSERT INTO culture_items (city_id, label, title, description, img, rating, display_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [cityId, item.label || '', item.title, item.description || '', item.img || '', item.rating || 0, i]
        );
      }
    }

    // 5. Delete and recreate events
    await client.query('DELETE FROM events WHERE city_id = $1', [cityId]);
    if (events && events.length > 0) {
      for (const event of events) {
        await client.query(
          `INSERT INTO events (city_id, date, name, img)
           VALUES ($1, $2, $3, $4)`,
          [cityId, event.date, event.name, event.img || '']
        );
      }
    }

    // 6. Delete and recreate experiences
    await client.query('DELETE FROM experiences WHERE city_id = $1', [cityId]);
    if (experiences && experiences.length > 0) {
      for (const exp of experiences) {
        await client.query(
          `INSERT INTO experiences (city_id, name, type, rating, img)
           VALUES ($1, $2, $3, $4, $5)`,
          [cityId, exp.name, exp.type || '', exp.r || 0, exp.img || '']
        );
      }
    }

    // 7. Delete and recreate food items
    await client.query('DELETE FROM food_items WHERE city_id = $1', [cityId]);
    if (food && food.length > 0) {
      for (let i = 0; i < food.length; i++) {
        const item = food[i];
        await client.query(
          `INSERT INTO food_items (city_id, img, category, name, description, display_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [cityId, item.img || '', item.cat || '', item.name, item.desc || '', i]
        );
      }
    }

    // 8. Delete and recreate hotels
    await client.query('DELETE FROM hotels WHERE city_id = $1', [cityId]);
    if (hotels && hotels.length > 0) {
      for (let i = 0; i < hotels.length; i++) {
        const hotel = hotels[i];
        await client.query(
          `INSERT INTO hotels (city_id, name, distance, img, rating, price, display_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [cityId, hotel.n, hotel.dist || 0, hotel.img || '', hotel.r || 0, hotel.price || 0, i]
        );
      }
    }

    // 9. Delete and recreate delegations
    await client.query('DELETE FROM delegations WHERE city_id = $1', [cityId]);
    if (delegations && delegations.length > 0) {
      for (const deleg of delegations) {
        await client.query(
          `INSERT INTO delegations (city_id, name, population, area, description, img, founded, notable, type, lat, lng)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            cityId,
            deleg.name,
            deleg.pop || 0,
            deleg.area || 0,
            deleg.desc || '',
            deleg.img || '',
            deleg.founded || 0,
            deleg.notable || '',
            deleg.type || '',
            deleg.lat,
            deleg.lng,
          ]
        );
      }
    }

    // 10. Delete and recreate banner
    const oldBanner = await client.query(
      'SELECT id FROM city_banners WHERE city_id = $1',
      [cityId]
    );
    if (oldBanner.rows.length > 0) {
      await client.query('DELETE FROM banner_images WHERE banner_id = $1', [oldBanner.rows[0].id]);
    }
    await client.query('DELETE FROM city_banners WHERE city_id = $1', [cityId]);

    if (banner && banner.title) {
      const bannerResult = await client.query(
        `INSERT INTO city_banners (city_id, type, title, subtitle, cta_label, cta_url, video_url, video_poster)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          cityId,
          banner.type || 'static',
          banner.title,
          banner.subtitle || '',
          banner.ctaLabel || '',
          banner.ctaUrl || '',
          banner.videoUrl || '',
          banner.videoPoster || '',
        ]
      );

      const bannerId = bannerResult.rows[0].id;

      if (banner.type === 'carousel' && banner.images && banner.images.length > 0) {
        for (let i = 0; i < banner.images.length; i++) {
          await client.query(
            `INSERT INTO banner_images (banner_id, image_url, display_order)
             VALUES ($1, $2, $3)`,
            [bannerId, banner.images[i], i]
          );
        }
      }
    }

    // 11. Delete and recreate CTA
    await client.query('DELETE FROM city_ctas WHERE city_id = $1', [cityId]);
    if (cta && cta.title) {
      await client.query(
        `INSERT INTO city_ctas (city_id, label, title, description, image)
         VALUES ($1, $2, $3, $4, $5)`,
        [cityId, cta.label || '', cta.title, cta.description || '', cta.image || '']
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      data: { id: cityId, name, region },
      message: '✓ City updated successfully!',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating city:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update city',
      details: err.message,
    });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DELETE CITY (DELETE)
// ═══════════════════════════════════════════════════════════════════════════
router.delete('/:id', async (req, res) => {
  const cityId = req.params.id;
  const client = await pool.connect();

  try {
    // Check city exists
    const cityCheck = await client.query('SELECT id FROM cities WHERE id = $1', [cityId]);
    if (cityCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'City not found',
      });
    }

    await client.query('BEGIN');

    // Delete in order of dependencies
    // Get banner IDs first
    const banners = await client.query(
      'SELECT id FROM city_banners WHERE city_id = $1',
      [cityId]
    );

    // Delete banner images
    for (const banner of banners.rows) {
      await client.query('DELETE FROM banner_images WHERE banner_id = $1', [banner.id]);
    }

    // Delete all related data
    await client.query('DELETE FROM banner_images WHERE banner_id IN (SELECT id FROM city_banners WHERE city_id = $1)', [cityId]);
    await client.query('DELETE FROM city_banners WHERE city_id = $1', [cityId]);
    await client.query('DELETE FROM city_ctas WHERE city_id = $1', [cityId]);
    await client.query('DELETE FROM hero_cards WHERE city_id = $1', [cityId]);
    await client.query('DELETE FROM hero_sections WHERE city_id = $1', [cityId]);
    await client.query('DELETE FROM city_stats WHERE city_id = $1', [cityId]);
    await client.query('DELETE FROM city_about WHERE city_id = $1', [cityId]);
    await client.query('DELETE FROM culture_items WHERE city_id = $1', [cityId]);
    await client.query('DELETE FROM events WHERE city_id = $1', [cityId]);
    await client.query('DELETE FROM experiences WHERE city_id = $1', [cityId]);
    await client.query('DELETE FROM food_items WHERE city_id = $1', [cityId]);
    await client.query('DELETE FROM hotels WHERE city_id = $1', [cityId]);
    await client.query('DELETE FROM delegations WHERE city_id = $1', [cityId]);

    // Finally delete the city
    await client.query('DELETE FROM cities WHERE id = $1', [cityId]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: '✓ City and all related data deleted successfully!',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting city:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to delete city',
      details: err.message,
    });
  } finally {
    client.release();
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






// ═══════════════════════════════════════════════════════════════════════════
// GET ALL CULTURE ITEMS (GLOBAL - NOT FILTERED BY CITY)
// ═══════════════════════════════════════════════════════════════════════════
router.get('/data/culture', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, label, title, description, img, rating FROM culture_items ORDER BY title ASC'
    );
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    console.error('Error fetching culture items:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch culture items',
      details: err.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET ALL EVENTS (GLOBAL - NOT FILTERED BY CITY)
// ═══════════════════════════════════════════════════════════════════════════
router.get('/data/events', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, date, name, img FROM events ORDER BY date DESC'
    );
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch events',
      details: err.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET ALL EXPERIENCES/ACTIVITIES (GLOBAL - NOT FILTERED BY CITY)
// ══════════════════════════════��════════════════════════════════════════════
router.get('/data/activities', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, type, rating as r, img FROM experiences ORDER BY name ASC'
    );
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    console.error('Error fetching activities:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activities',
      details: err.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET ALL FOOD ITEMS (GLOBAL - NOT FILTERED BY CITY)
// ═══════════════════════════════════════════════════════════════════════════
router.get('/data/food', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, img, category as cat, name, description as desc FROM food_items ORDER BY name ASC'
    );
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    console.error('Error fetching food items:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch food items',
      details: err.message,
    });
  }
});

// ═════════════════════��═════════════════════════════════════════════════════
// GET ALL HOTELS (GLOBAL - NOT FILTERED BY CITY)
// ═══════════════════════════════════════════════════════════════════════════
router.get('/data/hotels', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name as n, distance as dist, img, rating as r, price FROM hotels ORDER BY name ASC'
    );
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    console.error('Error fetching hotels:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch hotels',
      details: err.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET ALL DELEGATIONS (GLOBAL - NOT FILTERED BY CITY)
// ═══════════════════════════════════════════════════════════════════════════
router.get('/data/delegations', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, population as pop, area, description as desc, img, 
              founded, notable, type, lat, lng 
       FROM delegations ORDER BY name ASC`
    );
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    console.error('Error fetching delegations:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch delegations',
      details: err.message,
    });
  }
});

module.exports = router;
