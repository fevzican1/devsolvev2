@echo off
cd /d "c:\Users\Lenovo\Downloads\devsolvev2-agent-pages-manage-crawl-budget-dd8b\devsolvev2-agent-pages-manage-crawl-budget-dd8b"
git add -A
git commit -m "feat(seo): JSON-LD mainEntityOfPage + BreadcrumbList, deterministic datePublished/dateModified for /k pages, aggressive edge cache for sitemap-*.xml (s-maxage=86400 + CDN-Cache-Control)"
git push
