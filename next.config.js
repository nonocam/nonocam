/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
}

if(process.env.APP_ENV === 'github-pages') {
  nextConfig.basePath = '/nonocam';
}

module.exports = nextConfig
