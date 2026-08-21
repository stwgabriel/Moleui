import { NextResponse } from 'next/server';

const repo = 'stwgabriel/moleui';

function isArchitecture(value: string): value is 'arm64' | 'x64' {
  return value === 'arm64' || value === 'x64';
}

export async function GET(_request: Request, { params }: { params: { arch: string } }) {
  if (!isArchitecture(params.arch)) return new NextResponse('Unsupported Mac architecture.', { status: 404 });

  const releaseResponse = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Moleui-download' },
    next: { revalidate: 300 },
  });
  if (!releaseResponse.ok) return new NextResponse('The latest Moleui release is temporarily unavailable.', { status: 503 });

  const release = await releaseResponse.json() as { assets?: Array<{ name: string; browser_download_url: string; content_type?: string }> };
  const architecturePattern = params.arch === 'arm64' ? /arm64/i : /(?:x64|amd64)/i;
  const asset = release.assets?.find((candidate) => candidate.name.endsWith('.dmg') && architecturePattern.test(candidate.name));
  if (!asset) return new NextResponse('A compatible DMG was not found in the latest release.', { status: 404 });

  return NextResponse.redirect(asset.browser_download_url, {
    status: 307,
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}
