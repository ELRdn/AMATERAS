import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createApi } from "./server/api";
function apiPlugin(): Plugin {
  const handler = createApi();
  const install = (server: { middlewares: { use: Function } }) => {
    server.middlewares.use(async (req: any, res: any, next: () => void) => {
      if (!req.url?.startsWith("/api/")) return next();
      try {
        const result = await handler(
          new Request("http://localhost" + req.url, { method: req.method }),
        );
        res.statusCode = result.status;
        result.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(Buffer.from(await result.arrayBuffer()));
      } catch {
        res.statusCode = 500;
        res.end('{"error":"Local API error"}');
      }
    });
  };
  return {
    name: "amateras-api",
    configureServer: install,
    configurePreviewServer: install,
  };
}
export default defineConfig({
  plugins: [react(), apiPlugin()],
  server: { port: 5186, strictPort: true },
  build: { chunkSizeWarningLimit: 1600 },
});
