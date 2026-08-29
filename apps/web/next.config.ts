import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";
const basePath = isGitHubPages ? "/trend-pulse" : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath,
  transpilePackages: ["@trend-pulse/contracts"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
