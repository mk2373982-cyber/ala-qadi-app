/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

// 'unsafe-inline' for styles/scripts is required by Next.js (hydration payload and
// inline style attributes). Google origins cover the Cairo/Jakarta fonts and the
// Google Identity / Drive browser flows. Development additionally allows
// 'unsafe-eval' (React refresh) and the HMR websocket.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://accounts.google.com https://apis.google.com https://www.googleapis.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  `connect-src 'self' https://accounts.google.com https://www.googleapis.com https://oauth2.googleapis.com${isDev ? ' ws:' : ''}`,
  'frame-src https://accounts.google.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  distDir: process.env.ALAQADDI_NEXT_DIST_DIR || '.next',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
