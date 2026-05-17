// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const chatRoutes = require("./routes/chat/tunex");
const adminChatRoutes = require("./routes/chat/admin");
const media = require('./routes/media');
const citiesRouter = require('./routes/cities/cities');
const foodRouter = require('./routes/foods/foods');
const sketchfabRouter = require('./routes/sketchfab_models/sketchfab');
const eventsRouter = require('./routes/events/events');
const guideRoutes = require('./routes/guide/guide');
const path = require('path');
const app = express();
app.use(express.json());


// CORS configuration
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: CORS_ORIGIN }));



// Routes de media
app.use('/api', media);
// Routes de villes
app.use('/api/cities', citiesRouter);
// Routes de chat (site public)
app.use("/api/chat", chatRoutes);
// Routes de chat admin dashboard
app.use("/api/chat/admin", adminChatRoutes);
// Routes de nourriture
app.use('/api/food', foodRouter);
// Routes d'événements
app.use('/api/events', eventsRouter);
// Routes de modèles 3D Sketchfab
app.use('/api/models', sketchfabRouter);
// Routes d'expériences
app.use('/api/experiences', require('./routes/experiences/experiences'));
// Routes de culture
app.use('/api/culture', require('./routes/culture/culture'));
// Routes de délégations
app.use('/api/delegations', require('./routes/delegations/delegations'));
//route hotels
app.use('/api/hotels', require('./routes/hotels/hotels'));
// Routes de téléchargement
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
// Routes de guide touristique
app.use('/api/guide', guideRoutes);
// Routes d'authentification
app.use('/api/auth', require('./routes/auth/auth'));
// Routes d'onboarding
app.use('/api/onboarding', require('./routes/onboarding/onboardingRoutes.js'));
// Routes de tags
app.use('/api/tags', require('./routes/tags/tags'));
app.use('/api/tags/assign', require('./routes/tags/assign'));
// Routes de recommandations IA
app.use('/api/recommendations', require('./routes/recommendations/recommendations'));
// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`
    
    API listening on ${port}
    Chat API: http://localhost:${port}/api/chat
    Cities API: http://localhost:${port}/api/cities
    Foods API: http://localhost:${port}/api/food
    Events API: http://localhost:${port}/api/events
    Sketchfab Models API: http://localhost:${port}/api/models
    Experiences API: http://localhost:${port}/api/experiences
    Culture API: http://localhost:${port}/api/culture
    Delegations API: http://localhost:${port}/api/delegations
    guide touristique API: http://localhost:${port}/api/guide
    Auth API: http://localhost:${port}/api/auth
    Onboarding API: http://localhost:${port}/api/onboarding
    Tags API: http://localhost:${port}/api/tags
    Tag Assignment API: http://localhost:${port}/api/tags/assign
    hotels API: http://localhost:${port}/api/hotels
    Uploads API: http://localhost:${port}/uploads
    Recommendations API: http://localhost:${port}/api/recommendations/cities
    Question/Response API: http://localhost:${port}/api/recommendations/questionReponse
    Webhook Test: http://localhost:${port}/api/recommendations/n8n
    recommendations API: http://localhost:${port}/api/recommendations/cities
    recommendations question/reponse API: http://localhost:${port}/api/recommendations/questionReponse
    recommendations save API: http://localhost:${port}/api/recommendations/save
    
     
    Model: Llama 3.1-8B   
    
    ` 
));