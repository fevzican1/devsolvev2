const siteUrl = process.env.SITE_URL || process.env.URL || 'https://devsolvev2.com';

/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl,
  generateRobotsTxt: false,
  generateIndexSitemap: false,
  // Avoid sitemap.xml — Google auto-discovers it and can treat it as a second root sitemap.
  sitemapBaseFileName: 'sitemap-main-pages',
  sitemapSize: 50000,
  outDir: 'out',
  autoLastmod: true,
  exclude: [
    '/api/*',
    '/cmd-center',
    '/cmd-center/*',
    '/k/*',
    '/404',
    '/manifest.webmanifest',
  ],
  transform: async (_config, path) => ({
    loc: path,
    changefreq: 'weekly',
    priority: path === '/' ? 1.0 : 0.7,
    lastmod: new Date().toISOString(),
  }),
};

export default config;
