import { ConvexClient } from "convex/browser";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  console.error("VITE_CONVEX_URL is not defined in environment variables");
}

export const convex = new ConvexClient(convexUrl || "");
