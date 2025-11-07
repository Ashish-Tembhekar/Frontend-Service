import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true, // Required for static export
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  async headers() {
    return [
      {
        // Apply this header to all routes in your application
        source: '/:path*', 
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            // Set the policy to allow popups to maintain a reference (window.opener)
            value: 'same-origin-allow-popups', 
          },
        ],
      },
    ];
  },
};

export default nextConfig;
