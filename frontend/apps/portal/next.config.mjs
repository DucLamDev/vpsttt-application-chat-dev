const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  reactStrictMode: true,
  transpilePackages: [
    "@webtui/api-client",
    "@webtui/icons",
    "@webtui/types"
  ]
};

export default nextConfig;
