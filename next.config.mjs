if (process.env.NODE_ENV === 'development') {
  try {
    const { initOpenNextCloudflareForDev } = await import('@opennextjs/cloudflare')
    await initOpenNextCloudflareForDev()
  } catch {}
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.supabase.co https://*.stripe.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.resend.com; frame-src https://js.stripe.com https://hooks.stripe.com; media-src 'self' blob: https://*.supabase.co; object-src 'none'; base-uri 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;