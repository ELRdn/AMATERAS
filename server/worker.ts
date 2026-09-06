import { createApi } from "./api";
interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}
let api: ReturnType<typeof createApi> | undefined;
export default {
  async fetch(request: Request, env: Env) {
    if (new URL(request.url).pathname.startsWith("/api/")) {
      const storage = globalThis.caches as CacheStorage & { default: Cache };
      api ??= createApi({ cache: storage.default });
      return api(request);
    }
    const response = await env.ASSETS.fetch(request);
    const result = new Response(response.body, response);
    result.headers.set("X-Content-Type-Options", "nosniff");
    result.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    result.headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    result.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tiles.openfreemap.org https://cyberjapandata.gsi.go.jp; connect-src 'self' https://tiles.openfreemap.org https://cyberjapandata.gsi.go.jp; font-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    );
    return result;
  },
};
