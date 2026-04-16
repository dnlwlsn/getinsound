/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  typescript: {
    // This ignores the Supabase Deno/URL import errors
    ignoreBuildErrors: true,
  },
  eslint: {
    // This ensures linting doesn't stop the build
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;