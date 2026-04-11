// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const chatRoutes = require("./routes/chat/tunex");
const media = require('./routes/media');
const citiesRouter = require('./routes/cities/cities');
const foodRouter = require('./routes/foods/foods');
const sketchfabRouter = require('./routes/sketchfab_models/sketchfab'); // ✅ AJOUTER

const eventsRouter = require('./routes/events/events');

const app = express();
app.use(express.json());


// CORS configuration
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: CORS_ORIGIN }));



// Routes de media
app.use('/api', media);
// Routes de villes
app.use('/api/cities', citiesRouter);
// Routes de chat
app.use("/api/chat", chatRoutes);
// Routes de nourriture
app.use('/api/food', foodRouter);
// Routes d'événements
app.use('/api/events', eventsRouter);
// Routes de modèles 3D Sketchfab
app.use('/api/models', sketchfabRouter);



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
    Model: Llama 3.1-8B   
    
    ` 
));