import { MetadataRoute } from 'next';
import { getAdminDb } from '@/lib/firebase-admin';

// FIX: Use Firebase Admin SDK (not client SDK) for server-side sitemap generation
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kamilshop.my.id';

  let products: { slug: string }[] = [];
  try {
    const adminDb = getAdminDb();
    const snap = await adminDb
      .collection('products')
      .where('isActive', '==', true)
      .get();
    products = snap.docs.map((d) => ({ slug: (d.data() as { slug: string }).slug }));
  } catch {
    // if Firestore unavailable during build, skip product routes
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/auth/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/auth/register`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${baseUrl}/products/${p.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...productRoutes];
}
