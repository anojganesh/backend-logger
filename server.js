const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;
const cors = require('cors');

//Cors
const corsOptions = {
  origin: [
    'http://localhost:3000',       // local frontend
    'https://anojganesh.com',     // production frontend
    'https://www.anojganesh.com', // production frontend
    'https://anojganeshdev.netlify.app/', // dev frontend
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true,             // Allow credentials
  optionsSuccessStatus: 200        // For legacy browser support
};

app.use(cors(corsOptions));  // Apply CORS settings globally

// Configuration
const MY_IP = process.env.MY_IP; // ← My IP address, ENV variable
const SKIP_MY_DUPLICATES = true; // Set to false to track all my visits
const MONGODB_URI = process.env.MONGODB_URI; 

//TESTING - DELETE LATER
//const MY_IP = ''; // ← My IP address, ENV variable
//const MONGODB_URI = '';

// MongoDB connection
mongoose.connect(MONGODB_URI || console.log('MongoDB URI not set'));
console.log('MongoDB connected');

// Visitor schema
const visitorSchema = new mongoose.Schema({
  ip: { type: String, required: true },
  date: { type: Date, default: Date.now },
  country: String,
  city: String,
  lat: Number,
  lon: Number,
  isp: String
}, { timestamps: true });

const Visitor = mongoose.model('Visitor', visitorSchema);

// Tracking middleware
app.use(async (req, res, next) => {
    console.log('request received');
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Special handling for my IP
    if (SKIP_MY_DUPLICATES && ip === MY_IP) {
    const latestVisit = await Visitor.findOne({ ip })
        .sort({ date: -1 }) // Get most recent first
        .limit(1);

    if (latestVisit && latestVisit.ip === ip) {
        console.log(`Skipping repeat visit from your IP (${ip})`);
        return next();
    }
    }

    try {
        const geoResponse = await axios.get(
        `http://ip-api.com/json/${ip}?fields=status,country,city,lat,lon,isp`
        );
        console.log('Geo response:', geoResponse.data);

        if (geoResponse.data.status === 'success') {
            await Visitor.create({
                ip,
                ...geoResponse.data
            });
            console.log(`Logged visit from ${ip}`);
        }
        else{
            console.log(`Failed to log visit from ip: ${ip}`);
        }
    } catch (error) {
        console.error('Tracking error:', error);
    }
    
    next();
});

// API endpoint
app.get('/api/visitors', async (req, res) => {
  try {
    const visitors = await Visitor.find().sort({ date: -1 }).limit(50);
    res.json(visitors);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Your IP filtering: ${SKIP_MY_DUPLICATES ? 'ON' : 'OFF'} for ${MY_IP}`);
});