import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

// Add auth routes for OAuth callbacks, magic links, etc.
auth.addHttpRoutes(http);

export default http;
