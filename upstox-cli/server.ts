import express from 'express';
import { fetchDashboard } from './upstox_dashboard.js';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

let cachedDashboardData: any = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 60000; // 1 minute cache

// Serve static files
app.use(express.static('public'));

// API endpoint to get dashboard data
app.get('/api/dashboard', async (req, res) => {
  try {
    const now = Date.now();
    
    // Return cached data if it's fresh
    if (cachedDashboardData && (now - lastFetchTime) < CACHE_DURATION) {
      return res.json(cachedDashboardData);
    }

    // Fetch fresh data
    console.log('📊 Fetching fresh dashboard data...');
    const data = await fetchDashboard();
    cachedDashboardData = data;
    lastFetchTime = now;
    
    res.json(data);
  } catch (error: any) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get latest saved dashboard file
app.get('/api/dashboard/latest', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const filename = `dashboard_${today}.json`;
    
    if (existsSync(filename)) {
      const data = JSON.parse(readFileSync(filename, 'utf-8'));
      res.json(data);
    } else {
      res.status(404).json({ error: 'No dashboard data found for today' });
    }
  } catch (error: any) {
    console.error('Error reading dashboard file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Dashboard server running at http://localhost:${PORT}`);
  console.log(`📊 Open your browser to view the dashboard\n`);
});
