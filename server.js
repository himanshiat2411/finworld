// Tiny static server: node server.js  ->  http://localhost:5173
const http = require('http'), fs = require('fs'), path = require('path');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.csv': 'text/csv', '.json': 'application/json' };
const port = process.env.PORT || 5173;
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(__dirname, path.normalize(p).replace(/^(\.\.[\/\\])+/, ''));
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': (types[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8' }); res.end(data);
  });
}).listen(port, () => console.log('Finworld prototype running at http://localhost:' + port));
