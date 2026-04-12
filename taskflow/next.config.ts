import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    styledComponents: true,
  },
  images: {
    disableStaticImages: true,
  },
};

export default nextConfig;
