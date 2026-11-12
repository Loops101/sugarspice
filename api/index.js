// Vercel entry point: the whole site (pages, API, admin) runs through this one function.
// Static files (css, js, images) in /public are served by Vercel's CDN before this is reached.
const { app } = require('../server/app');

module.exports = app;
