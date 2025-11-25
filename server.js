
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const CACHE_FILE = 'cache_dump.json';
const MAX_CACHE_SIZE_BYTES = 1024 * 1024 * 1024; // 1GB
const SAVE_INTERVAL_MS = 60000; // Save to disk every 1 minute

// In-memory cache
let cache = new Map();

// --- Persistence Logic ---

function loadCache() {
    if (fs.existsSync(CACHE_FILE)) {
        try {
            const raw = fs.readFileSync(CACHE_FILE, 'utf8');
            const data = JSON.parse(raw);
            cache = new Map(Object.entries(data));
            console.log(`[Server] Loaded ${cache.size} entries from disk.`);
        } catch (e) {
            console.error("[Server] Failed to load cache:", e);
        }
    }
}

function saveCache() {
    try {
        const obj = Object.fromEntries(cache);
        const raw = JSON.stringify(obj);
        fs.writeFileSync(CACHE_FILE, raw);
        console.log(`[Server] Saved cache to disk. Size: ${(raw.length / 1024 / 1024).toFixed(2)} MB`);
    } catch (e) {
        console.error("[Server] Failed to save cache:", e);
    }
}

// Check size and evict if needed (Simple LRU approximation)
function checkSizeLimit() {
    // Estimating size in memory is hard, we approximate by JSON string length
    // This is a heavy operation, so we only check periodically or on large inserts
    // For this simple server, we'll just check the Map size count or do a rough calculation
    
    // Quick heuristic: Average entry size
    const avgEntrySize = 50 * 1024; // Assume 50KB per entry (text + base64 image mixed)
    const estimatedSize = cache.size * avgEntrySize;

    if (estimatedSize > MAX_CACHE_SIZE_BYTES) {
        console.log("[Server] Cache limit exceeded. Evicting old entries...");
        // Delete first 10% of keys (Map preserves insertion order)
        const keysToDelete = Array.from(cache.keys()).slice(0, Math.ceil(cache.size * 0.1));
        for (const k of keysToDelete) cache.delete(k);
    }
}

// Initialize
loadCache();
setInterval(saveCache, SAVE_INTERVAL_MS);

// --- HTTP Server ---

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    // Enable CORS for development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // --- API Endpoints ---
    
    if (url.pathname === '/api/cache') {
        if (req.method === 'GET') {
            const key = url.searchParams.get('key');
            if (cache.has(key)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data: cache.get(key) }));
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Not found' }));
            }
        } 
        else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { key, data } = JSON.parse(body);
                    if (key && data) {
                        // Re-insert to update "recently used" position
                        cache.delete(key); 
                        cache.set(key, data);
                        checkSizeLimit();
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    } else {
                        throw new Error("Invalid payload");
                    }
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
        }
        return;
    }

    // --- Static File Serving ---
    
    let filePath = '.' + url.pathname;
    if (filePath === './') filePath = './index.html';

    const extname = path.extname(filePath);
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // Fallback to index.html for SPA routing (though not really needed for this app)
                fs.readFile('./index.html', (err, indexContent) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Error loading index.html');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(indexContent);
                    }
                });
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n=== 幽冥录 (Nether Chronicles) Server ===`);
    console.log(`Running at http://localhost:${PORT}`);
    console.log(`Shared Cache: ENABLED (Limit: 1GB)`);
    console.log(`=========================================\n`);
});