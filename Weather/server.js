const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || process.env.APP_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'ForecastBustAI NWP Analytics Platform',
    timestamp: new Date().toISOString(),
    env: process.env.APP_ENV || 'development'
  });
});

// Proxy for IMD Subdivision Rainfall Forecast API
app.get('/api/imd/rainfall', async (req, res) => {
  try {
    const imdKey = process.env.IMD_API_KEY;
    const imdUrl = `${process.env.IMD_BASE_URL || 'https://api.imd.gov.in'}/api/v1/subdivision_rainfall_forecast`;
    
    const response = await axios.get(imdUrl, {
      headers: imdKey && imdKey !== 'your_imd_api_key_here' ? { 'Authorization': `Bearer ${imdKey}` } : {},
      timeout: 8000
    });
    res.json(response.data);
  } catch (error) {
    res.status(502).json({
      error: 'IMD API unreachable or key not configured',
      details: error.message,
      usingFallback: true
    });
  }
});

// Proxy for IMD State & District Rainfall Forecast API
app.get('/api/imd/state_district_rainfall_forecast', async (req, res) => {
  try {
    const imdKey = process.env.IMD_API_KEY;
    const imdUrl = `${process.env.IMD_BASE_URL || 'https://api.imd.gov.in'}/api/v1/state_district_rainfall_forecast`;
    const { state, district } = req.query;

    const params = {};
    if (state) params.state = state;
    if (district) params.district = district;

    const response = await axios.get(imdUrl, {
      params,
      headers: imdKey && imdKey !== 'your_imd_api_key_here' ? { 'Authorization': `Bearer ${imdKey}` } : {},
      timeout: 8000
    });
    res.json(response.data);
  } catch (error) {
    res.status(502).json({
      error: 'IMD State & District Rainfall Forecast API unreachable or key not configured',
      details: error.message,
      usingFallback: true
    });
  }
});

// Proxy for IMD Observed District Rainfall & Departure API (districtrainfall)
app.get('/api/imd/districtrainfall', async (req, res) => {
  try {
    const imdKey = process.env.IMD_API_KEY;
    const imdUrl = `${process.env.IMD_BASE_URL || 'https://api.imd.gov.in'}/api/v1/districtrainfall`;
    const { state, district, date } = req.query;

    const params = {};
    if (state) params.state = state;
    if (district) params.district = district;
    if (date) params.date = date;

    const response = await axios.get(imdUrl, {
      params,
      headers: imdKey && imdKey !== 'your_imd_api_key_here' ? { 'Authorization': `Bearer ${imdKey}` } : {},
      timeout: 8000
    });
    res.json(response.data);
  } catch (error) {
    res.status(502).json({
      error: 'IMD districtrainfall API unreachable or key not configured',
      details: error.message,
      usingFallback: true
    });
  }
});

// Proxy for IMD Automatic Weather Station (AWS) Telemetry API (aws_data)
app.get('/api/imd/aws_data', async (req, res) => {
  try {
    const imdKey = process.env.IMD_API_KEY;
    const imdUrl = `${process.env.IMD_BASE_URL || 'https://api.imd.gov.in'}/api/v1/aws_data`;
    const { state, district, station_id } = req.query;

    const params = {};
    if (state) params.state = state;
    if (district) params.district = district;
    if (station_id) params.station_id = station_id;

    const response = await axios.get(imdUrl, {
      params,
      headers: imdKey && imdKey !== 'your_imd_api_key_here' ? { 'Authorization': `Bearer ${imdKey}` } : {},
      timeout: 8000
    });
    res.json(response.data);
  } catch (error) {
    res.status(502).json({
      error: 'IMD aws_data API unreachable or key not configured',
      details: error.message,
      usingFallback: true
    });
  }
});

const BUST_ENGINE_URL = (process.env.BUST_ENGINE_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');

// Proxy for FastAPI Error-Prone Intelligence
app.use('/api/error-prone', async (req, res) => {
  try {
    const targetUrl = `${BUST_ENGINE_URL}/api/error-prone${req.url}`;
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: { 'Accept': 'application/json' },
      timeout: 15000
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      res.status(502).json({ error: 'Bust Engine backend unavailable', details: err.message });
    }
  }
});

// Proxy for FastAPI Bust Probability Engine
app.use('/api/bust-probability', async (req, res) => {
  try {
    const targetUrl = `${BUST_ENGINE_URL}/api/bust-probability${req.url}`;
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: { 'Accept': 'application/json' },
      timeout: 15000
    });
    res.status(response.status).json(response.data);
  } catch (err) {
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      res.status(502).json({ error: 'Bust Engine backend unavailable', details: err.message });
    }
  }
});

// Proxy for FastAPI Data Status
app.get('/api/data-status', async (req, res) => {
  try {
    const targetUrl = `${BUST_ENGINE_URL}/api/data-status`;
    const response = await axios.get(targetUrl, { timeout: 10000 });
    res.json(response.data);
  } catch (err) {
    res.status(502).json({ error: 'Data status unavailable', details: err.message });
  }
});

// Proxy for Open-Meteo Ensemble & Medium Range Forecasts
app.get('/api/open-meteo', async (req, res) => {
  try {
    const { latitude = 22.5, longitude = 78.5, daily = 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max' } = req.query;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=${daily}&timezone=Asia%2FKolkata&forecast_days=10`;
    
    const response = await axios.get(url, { timeout: 8000 });
    res.json(response.data);
  } catch (error) {
    res.status(502).json({ error: 'Open-Meteo API error', details: error.message });
  }
});

// Proxy for Geocoding (OpenStreetMap Nominatim default, Mappls optional)
app.get('/api/mappls/geocode', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ error: 'Address parameter is required' });
    }
    const restKey = process.env.MAPPLS_REST_KEY;
    if (restKey && restKey !== 'your_mappls_rest_api_key_here') {
      const url = `https://atlas.mappls.com/api/places/geocode?address=${encodeURIComponent(address)}`;
      const response = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${restKey}` },
        timeout: 8000
      });
      return res.json(response.data);
    }
    // OpenStreetMap Nominatim (Free, keyless)
    const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=in&limit=1`;
    const response = await axios.get(osmUrl, {
      headers: { 'User-Agent': 'ForecastBustAI-SIH2026/1.0' },
      timeout: 8000
    });
    res.json(response.data);
  } catch (error) {
    res.status(502).json({ error: 'Geocoding service error', details: error.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n============================================================`);
  console.log(`🚀 ForecastBustAI Server running at: http://localhost:${PORT}`);
  console.log(`   - Hub:               http://localhost:${PORT}/index.html`);
  console.log(`   - Fingerprinting:    http://localhost:${PORT}/fingerprint.html`);
  console.log(`   - Rainfall Forecast: http://localhost:${PORT}/rainfall.html`);
  console.log(`   - Bust Engine:       http://localhost:${PORT}/bust.html`);
  console.log(`   - Error-Prone Area:  http://localhost:${PORT}/error_prone.html`);
  console.log(`   - Bust API (Python): http://localhost:8001/docs`);
  console.log(`============================================================\n`);
});
