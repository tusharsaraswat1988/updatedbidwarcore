import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createServer } from 'http';

const GATEWAY_PORT = process.env.GATEWAY_PORT || 3000;
const API_PORT = process.env.API_PORT || 8085;
const WEB_PORT = process.env.FRONTEND_PORT || 5173;
const OWNER_PORT = process.env.OWNER_APP_PORT || 5174;
const SCORING_PORT = process.env.SCORING_APP_PORT || 5175;
const MOBILE_PORT = process.env.MOBILE_APP_PORT || 5176;
const FAN_PORT = process.env.FAN_PLATFORM_PORT || 5177;

const app = express();

// Ensure clean trailing slash on sub-app roots so Vite base paths match without redirect loops
app.get(['/fan', '/owner-app', '/scoring-app', '/mobile'], (req, res, next) => {
    if (req.path.endsWith('/')) {
        return next();
    }
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(302, `${req.path}/${qs}`);
});

// Proxy configuration with pathFilter (does not strip mount prefix from req.url)
const createProxy = (target, pathFilter) => createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true,
    pathFilter,
    onError: (err, req, res) => {
        console.error(`Proxy Error to ${target}:`, err);
        res.status(502).send('Gateway Proxy Error');
    }
});

app.use(createProxy(`http://127.0.0.1:${API_PORT}`, (p) => p.startsWith('/api')));
app.use(createProxy(`http://127.0.0.1:${OWNER_PORT}`, (p) => p.startsWith('/owner-app')));
app.use(createProxy(`http://127.0.0.1:${SCORING_PORT}`, (p) => p.startsWith('/scoring-app')));
app.use(createProxy(`http://127.0.0.1:${MOBILE_PORT}`, (p) => p.startsWith('/mobile')));
app.use(createProxy(`http://127.0.0.1:${FAN_PORT}`, (p) => p.startsWith('/fan')));
app.use(createProxy(`http://127.0.0.1:${WEB_PORT}`));

const server = createServer(app);
server.listen(GATEWAY_PORT, () => {
    console.log(`Gateway listening on port ${GATEWAY_PORT}`);
});
