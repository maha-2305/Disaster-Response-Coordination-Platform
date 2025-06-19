# 🌐 Disaster Response Coordination Platform (Backend)

This is a backend application built with Node.js and Express to coordinate disaster response operations using geospatial queries, Google Gemini, and Supabase.

## 🚀 Features
- ✅ Create, update, delete disaster records
- 📍 Extract locations from descriptions using Gemini API and geocode them using Google Maps
- 📡 Real-time WebSocket updates for disasters, social media alerts, and resources
- 🧠 Image verification using Google Gemini Vision API
- 📊 Supabase geospatial queries for nearby shelters/resources
- 🗃️ Supabase caching to reduce API calls

## 📦 Tech Stack
- Node.js, Express.js
- Supabase (PostgreSQL)
- Socket.IO
- Google Gemini API
- Google Maps API (Geocoding)

## 🔧 Setup Instructions

1. Clone this repository:
   ```bash
   git clone <your-repo-url>
   cd disaster-response-platform
   
2. Install dependencies:
   npm install

3. Create a .env file based on .env.example and fill in your credentials

5. Start the server:
   npm start



