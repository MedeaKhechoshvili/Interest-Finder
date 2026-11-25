import type { NextConfig } from "next";

let outputDirectory = ".next";
if (process.env.NEXT_DIST_DIR) {
  outputDirectory = process.env.NEXT_DIST_DIR;
}

const nextConfig: NextConfig = {
  // integration checks use a separate build directory from normal development
  distDir: outputDirectory,
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
