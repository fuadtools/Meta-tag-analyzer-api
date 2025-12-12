// At the very top
require('dotenv').config();  // Loads .env automatically

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

// Use environment variable PORT or fallback to 3000
const PORT = process.env.PORT || 3000;

// Your meta analyzer endpoint
app.post('/api/analyze', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const response = await axios.get(url, { timeout: 10000 });
        const $ = cheerio.load(response.data);

        const metaTags = {
            title: $('title').text() || '',
            description: $('meta[name="description"]').attr('content') || '',
            keywords: $('meta[name="keywords"]').attr('content') || '',
        };

        res.json({ success: true, url, metaTags });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/', (req, res) => {
    res.send('Meta Tag Analyzer API is running 🚀');
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
