const adminBasePath = process.env.ADMIN_BASE_PATH?.trim();

const nextConfig = {
  reactStrictMode: true,
  ...(adminBasePath ? { basePath: adminBasePath } : {}),
  transpilePackages: [
    "@webtui/api-client",
    "@webtui/icons",
    "@webtui/types",
    "@webtui/ui"
  ]
};

export default nextConfig;
