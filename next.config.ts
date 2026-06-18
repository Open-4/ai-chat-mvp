import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages: @opennextjs/cloudflare 处理输出格式，不设 output

  // 修复多 lockfile 警告
  turbopack: {
    root: process.cwd(),
  },

  // Cloudflare 不支持 next/image 默认优化器
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
