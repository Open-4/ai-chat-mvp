import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages 部署
  output: "standalone",

  // 修复多 lockfile 警告
  turbopack: {
    root: process.cwd(),
  },

  // 图片优化（Cloudflare 不支持 next/image 默认优化器）
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
