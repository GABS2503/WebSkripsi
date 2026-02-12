/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com', 
      },
      {
        protocol: 'https',
        hostname: 'peaceful-harmony-324b30d844.strapiapp.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
};

// CHANGE THIS LINE:
export default nextConfig;