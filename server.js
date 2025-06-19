// Backend: Node.js + Express + Supabase

const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { Server } = require('socket.io');
const http = require('http');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.json());

// Supabase Client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// WebSocket Setup
io.on('connection', (socket) => {
  console.log('WebSocket connected');
});

// Caching helper
async function checkCache(key) {
  const { data } = await supabase.from('cache').select('*').eq('key', key).single();
  if (data && new Date(data.expires_at) > new Date()) return data.value;
  return null;
}

async function setCache(key, value) {
  const expires_at = new Date(Date.now() + 3600 * 1000).toISOString();
  await supabase.from('cache').upsert({ key, value, expires_at });
}

// POST /disasters
app.post('/disasters', async (req, res) => {
  const { title, location_name, description, tags, owner_id } = req.body;
  const location = req.body.location || null;
  const audit_trail = [{ action: 'create', user_id: owner_id, timestamp: new Date().toISOString() }];

  const { data, error } = await supabase.from('disasters').insert([
    { title, location_name, location, description, tags, owner_id, created_at: new Date().toISOString(), audit_trail }
  ]).select();

  if (error) return res.status(400).json(error);
  io.emit('disaster_updated', data[0]);
  res.json(data[0]);
});

// GET /disasters
app.get('/disasters', async (req, res) => {
  const tag = req.query.tag;
  const query = tag ? supabase.from('disasters').select('*').contains('tags', [tag]) : supabase.from('disasters').select('*');
  const { data, error } = await query;
  if (error) return res.status(400).json(error);
  res.json(data);
});

// PUT /disasters/:id
app.put('/disasters/:id', async (req, res) => {
  const id = req.params.id;
  const update = req.body;
  update.audit_trail = [{ action: 'update', user_id: update.owner_id, timestamp: new Date().toISOString() }];

  const { data, error } = await supabase.from('disasters').update(update).eq('id', id).select();
  if (error) return res.status(400).json(error);
  io.emit('disaster_updated', data[0]);
  res.json(data[0]);
});

// DELETE /disasters/:id
app.delete('/disasters/:id', async (req, res) => {
  const { error } = await supabase.from('disasters').delete().eq('id', req.params.id);
  if (error) return res.status(400).json(error);
  io.emit('disaster_updated', { id: req.params.id, deleted: true });
  res.json({ status: 'deleted' });
});

// POST /geocode
app.post('/geocode', async (req, res) => {
  const { description } = req.body;
  const cacheKey = `geocode:${description}`;
  const cached = await checkCache(cacheKey);
  if (cached) return res.json(cached);

  const geminiResp = await axios.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
    contents: [{ parts: [{ text: `Extract location from: ${description}` }] }]
  }, { params: { key: process.env.GEMINI_API_KEY } });

  const locationName = geminiResp.data.candidates?.[0]?.content?.parts?.[0]?.text || 'Unknown';

  const mapResp = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json`, {
    params: { address: locationName, key: process.env.GOOGLE_MAPS_API_KEY }
  });

  const latlng = mapResp.data.results[0].geometry.location;
  const result = { location_name: locationName, lat: latlng.lat, lng: latlng.lng };
  await setCache(cacheKey, result);
  res.json(result);
});

// GET /disasters/:id/social-media (mock)
app.get('/disasters/:id/social-media', async (req, res) => {
  const mockData = [
    { post: '#floodrelief Need food in NYC', user: 'citizen1' },
    { post: 'Water supplies low in Manhattan', user: 'citizen2' }
  ];
  io.emit('social_media_updated', mockData);
  res.json(mockData);
});

// GET /disasters/:id/resources?lat=..&lon=..
app.get('/disasters/:id/resources', async (req, res) => {
  const { lat, lon } = req.query;
  const { data, error } = await supabase.rpc('nearby_resources', {
    lat: parseFloat(lat),
    lon: parseFloat(lon),
    radius: 10000
  });
  if (error) return res.status(400).json(error);
  io.emit('resources_updated', data);
  res.json(data);
});

// POST /disasters/:id/verify-image
app.post('/disasters/:id/verify-image', async (req, res) => {
  const { image_url } = req.body;
  const cacheKey = `verify:${image_url}`;
  const cached = await checkCache(cacheKey);
  if (cached) return res.json(cached);

  const geminiResp = await axios.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent', {
    contents: [{ parts: [{ text: `Analyze image at ${image_url} for signs of manipulation or disaster context.` }] }]
  }, { params: { key: process.env.GEMINI_API_KEY } });

  const result = geminiResp.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No result';
  await setCache(cacheKey, { verification: result });
  res.json({ verification: result });
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
