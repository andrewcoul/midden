import { createFileRoute } from "@tanstack/react-router";

// Every /api/* request goes to the Hono app in src/server. It is loaded lazily so the
// Cloudflare-only imports stay out of the client bundle.
async function handle({ request }: { request: Request }) {
  const { api } = await import("@/server");
  return api.fetch(request);
}

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: { GET: handle, HEAD: handle, POST: handle, PUT: handle, PATCH: handle, DELETE: handle },
  },
});
