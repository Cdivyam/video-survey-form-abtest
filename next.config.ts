import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/uploads/:path*.mp4",
        headers: [
          { key: "Content-Type", value: "video/mp4" },
          { key: "Accept-Ranges", value: "bytes" },
        ],
      },
      {
        source: "/uploads/:path*.webm",
        headers: [
          { key: "Content-Type", value: "video/webm" },
          { key: "Accept-Ranges", value: "bytes" },
        ],
      },
      {
        source: "/uploads/:path*.mov",
        headers: [
          { key: "Content-Type", value: "video/quicktime" },
          { key: "Accept-Ranges", value: "bytes" },
        ],
      },
    ];
  },
};

export default nextConfig;
