const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

const http = require('http');
const https = require('https');

function checkStatus(url) {
  return new Promise((resolve) => {
    const isHttps = url.startsWith('https');
    const lib = isHttps ? https : http;
    const options = {
      timeout: 3000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (AppLauncher Status Check)'
      }
    };
    if (isHttps) {
      options.rejectUnauthorized = false; // allow self-signed certs
    }
    const req = lib.get(url, options, (res) => {
      const status = res.statusCode < 500 ? 'up' : 'down';
      console.log(`[Status] ${url}: ${res.statusCode} => ${status}`);
      resolve(status);
    });
    req.on('error', (err) => {
      // if error is self-signed cert, treat as up (used for copyparty)
      if (isHttps && err.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
        console.log(`[Status] ${url}: self-signed cert => up`);
        resolve('up');
      } else {
        console.log(`[Status] ${url}: error => down (${err.message})`);
        resolve('down');
      }
    });
    req.on('timeout', () => {
      req.destroy();
      console.log(`[Status] ${url}: timeout => down`);
      resolve('down');
    });
  });
}

app.get('/', async (req, res) => {
  fs.readFile(path.join(__dirname, 'apps.json'), 'utf8', async (err, data) => {
    if (err) return res.status(500).send('Error loading apps');
    let apps = JSON.parse(data);
    const statusList = await Promise.all(apps.map(app => checkStatus(app.url)));
    apps = apps.map((app, i) => ({ ...app, status: statusList[i] }));
    res.render('index', { apps });
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`App launcher running at http://0.0.0.0:${PORT}`);
});
