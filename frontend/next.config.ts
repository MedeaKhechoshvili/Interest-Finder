import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // hide the development badge so it does not cover the form
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
