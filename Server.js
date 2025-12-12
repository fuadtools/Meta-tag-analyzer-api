const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

app.use(cors());
app.use(express.json());

// Meta tag analyzer endpoint
app.post('/api/analyze', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Validate URL
        try {
            new URL(url);
        } catch {
            return res.status(400).json({ error: 'Invalid URL' });
        }

        // Fetch the webpage with proper headers
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'max-age=0'
            },
            timeout: 10000,
            maxRedirects: 5,
            validateStatus: null // Don't throw on HTTP errors
        });

        if (!response.data) {
            return res.status(404).json({ error: 'No content returned from URL' });
        }

        // Parse HTML with cheerio
        const $ = cheerio.load(response.data);
        
        // Helper function to resolve relative URLs
        const resolveUrl = (relativeUrl) => {
            if (!relativeUrl) return '';
            try {
                return new URL(relativeUrl, url).href;
            } catch {
                return relativeUrl;
            }
        };

        // Extract meta tags
        const metaTags = {
            // Basic SEO
            title: $('title').text() || '',
            description: $('meta[name="description"]').attr('content') || '',
            keywords: $('meta[name="keywords"]').attr('content') || '',
            canonical: resolveUrl($('link[rel="canonical"]').attr('href')) || '',
            robots: $('meta[name="robots"]').attr('content') || '',
            
            // Open Graph
            ogTitle: $('meta[property="og:title"]').attr('content') || '',
            ogDescription: $('meta[property="og:description"]').attr('content') || '',
            ogImage: resolveUrl($('meta[property="og:image"]').attr('content')) || '',
            ogUrl: resolveUrl($('meta[property="og:url"]').attr('content')) || '',
            
            // Twitter Cards
            twitterTitle: $('meta[name="twitter:title"]').attr('content') || 
                         $('meta[property="twitter:title"]').attr('content') || '',
            twitterDescription: $('meta[name="twitter:description"]').attr('content') || 
                               $('meta[property="twitter:description"]').attr('content') || '',
            twitterCard: $('meta[name="twitter:card"]').attr('content') || 
                        $('meta[property="twitter:card"]').attr('content') || '',
            twitterImage: resolveUrl($('meta[name="twitter:image"]').attr('content')) || 
                         resolveUrl($('meta[property="twitter:image"]').attr('content')) || '',
            
            // Technical
            charset: $('meta[charset]').attr('charset') || 
                    $('meta[http-equiv="Content-Type"]').attr('content')?.match(/charset=([^;]+)/)?.[1] || '',
            viewport: $('meta[name="viewport"]').attr('content') || '',
            favicon: resolveUrl($('link[rel="icon"]').attr('href')) || 
                    resolveUrl($('link[rel="shortcut icon"]').attr('href')) ||
                    resolveUrl($('link[rel="apple-touch-icon"]').attr('href')) || '',
            author: $('meta[name="author"]').attr('content') || '',
            language: $('html').attr('lang') || '',
            generator: $('meta[name="generator"]').attr('content') || '',
            
            // Additional useful data
            httpStatus: response.status,
            contentType: response.headers['content-type'],
            finalUrl: response.request?.res?.responseUrl || url
        };

        // Extract all meta tags for comprehensive analysis
        const allMetaTags = [];
        $('meta').each((i, el) => {
            const name = $(el).attr('name') || $(el).attr('property') || $(el).attr('charset');
            const content = $(el).attr('content') || $(el).attr('charset') || '';
            if (name || content) {
                allMetaTags.push({
                    name: name || 'unnamed',
                    content: content,
                    property: $(el).attr('property')
                });
            }
        });

        // Extract all links
        const allLinks = [];
        $('link').each((i, el) => {
            allLinks.push({
                rel: $(el).attr('rel'),
                href: resolveUrl($(el).attr('href')),
                type: $(el).attr('type'),
                sizes: $(el).attr('sizes')
            });
        });

        res.json({
            success: true,
            url: url,
            metaTags: metaTags,
            allMetaTags: allMetaTags,
            allLinks: allLinks,
            analyzedAt: new Date().toISOString(),
            responseInfo: {
                status: response.status,
                contentType: response.headers['content-type'],
                finalUrl: response.request?.res?.responseUrl || url
            }
        });

    } catch (error) {
        console.error('Error analyzing URL:', error.message);
        
        let errorMessage = 'Failed to analyze URL';
        if (error.code === 'ENOTFOUND') {
            errorMessage = 'Domain not found. Please check the URL.';
        } else if (error.code === 'ECONNREFUSED') {
            errorMessage = 'Connection refused. The website may be down.';
        } else if (error.response) {
            errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
        } else if (error.request) {
            errorMessage = 'No response received. The website may be blocking requests.';
        } else {
            errorMessage = error.message;
        }

        res.status(500).json({
            success: false,
            error: errorMessage,
            code: error.code
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Meta Tag Analyzer API running on port ${PORT}`);
});
