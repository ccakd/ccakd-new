import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";
import { mkdirSync, writeFileSync } from "node:fs";

/**
 * Custom Keystatic integration that skips the auto-injected API route.
 * We provide our own at src/pages/api/keystatic/[...params].ts with GitHub OAuth secrets.
 * The page route (UI) is still auto-injected.
 */
function keystatic() {
  return {
    name: "keystatic",
    hooks: {
      "astro:config:setup": ({ injectRoute, updateConfig, config }) => {
        updateConfig({
          server: config.server.host ? {} : { host: "127.0.0.1" },
          vite: {
            plugins: [
              {
                name: "keystatic",
                resolveId(id) {
                  if (id === "virtual:keystatic-config") {
                    return this.resolve("./keystatic.config", "./a");
                  }
                  return null;
                },
              },
            ],
            optimizeDeps: {
              entries: ["keystatic.config.*", ".astro/keystatic-imports.js"],
            },
          },
        });
        const dotAstroDir = new URL("./.astro/", config.root);
        mkdirSync(dotAstroDir, { recursive: true });
        writeFileSync(
          new URL("keystatic-imports.js", dotAstroDir),
          `import "@keystatic/astro/ui";\nimport "@keystatic/astro/api";\nimport "@keystatic/core/ui";\n`
        );
        // Inject the page route — API route is handled by src/pages/api/keystatic/[...params].ts
        injectRoute({
          entrypoint:
            "@keystatic/astro/internal/keystatic-astro-page.astro",
          pattern: "/keystatic/[...params]",
          prerender: false,
        });
      },
    },
  };
}

export default defineConfig({
  site: "https://ccakd.ca",
  // Astro 5 removed 'hybrid' mode. Use 'static' (default prerender) with
  // per-page `export const prerender = false` for SSR routes (Keystatic admin).
  output: "static",
  adapter: cloudflare(),
  integrations: [react(), tailwind(), keystatic(), sitemap()],
  i18n: {
    defaultLocale: "en",
    locales: ["en", "zh", "zh-tw"],
    routing: "manual",
  },
  vite: {
    plugins: [
      {
        // Fix: @astrojs/cloudflare aliases react-dom/server → react-dom/server.browser,
        // but React 19's browser build uses MessageChannel at module init, which fails
        // in Cloudflare Workers. Redirect to the edge build instead.
        name: "react-dom-server-edge-fix",
        enforce: "pre",
        resolveId(source) {
          if (source === "react-dom/server.browser") {
            return this.resolve("react-dom/server.edge");
          }
        },
      },
    ],
  },
});
