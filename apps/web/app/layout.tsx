import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:5174';

export const metadata: Metadata = {
  title: 'Moleui, macOS maintenance with clear boundaries',
  description: 'Inspect storage, review cleanup candidates, and maintain your Mac with safety-first controls.',
  metadataBase: new URL(siteUrl),
  alternates: { canonical: '/' },
  icons: { icon: '/product/moleui-mark.webp', apple: '/product/moleui-mark.webp' },
  openGraph: { title: 'Moleui for macOS', description: 'Make room. Keep control.', type: 'website' },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return (
    <html lang="en">
      <body>{clerkKey ? <ClerkProvider publishableKey={clerkKey}>{children}</ClerkProvider> : children}</body>
    </html>
  );
}
