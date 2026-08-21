import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:5174';
  const paths = ['', '/guides/free-up-mac-storage-safely', '/guides/find-large-files-on-mac', '/guides/uninstall-mac-apps-completely', '/guides/clear-developer-caches-with-context'];
  return paths.map((path, index) => ({ url: `${siteUrl}${path}`, lastModified: new Date(), changeFrequency: 'weekly', priority: index === 0 ? 1 : 0.7 }));
}
