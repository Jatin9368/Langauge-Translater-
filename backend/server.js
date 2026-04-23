require('dotenv').config();
// Fix: Use Google DNS for SRV resolution on Windows
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const translateRoutes = require('./routes/translate');
const emotionRoutes = require('./routes/emotion');
const historyRoutes = require('./routes/history');
const styleRoutes = require('./routes/style');
const vibeRoutes = require('./routes/vibe');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bharattranslate', {
    serverSelectionTimeoutMS: 10000,
    family: 4, // Force IPv4 — fixes querySrv ECONNREFUSED on Windows
  })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/translate', translateRoutes);
app.use('/api/emotion', emotionRoutes);
app.use('/api/style', styleRoutes);
app.use('/api/vibe', vibeRoutes);
app.use('/api/history', historyRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Error handler (must be last)
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Samvaadini Bharat backend running on port ${PORT}`);
});
