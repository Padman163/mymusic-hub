// @ts-check

/**
 * @param {string | undefined} netlifyDev
 * @param {string | undefined} origin
 * @returns {Record<string, import("vite").ProxyOptions> | undefined}
 */
export function createLocalIdentityProxy(netlifyDev, origin) {
  if (netlifyDev !== "true" || !origin) return undefined;

  const identityUrl = new URL(origin);
  if (
    identityUrl.protocol !== "https:" ||
    identityUrl.username ||
    identityUrl.password ||
    identityUrl.pathname !== "/" ||
    identityUrl.search ||
    identityUrl.hash
  ) {
    throw new Error(
      "LOCAL_NETLIFY_IDENTITY_ORIGIN muss eine HTTPS-Site-Adresse ohne Pfad oder Zugangsdaten sein.",
    );
  }
  return {
    "^/\\.netlify/identity(?:/|\\?|$)": {
      target: identityUrl.origin,
      changeOrigin: true,
      configure(proxy) {
        proxy.on("proxyReq", (proxyReq, req) => {
          proxyReq.removeHeader("cookie");
          proxyReq.removeHeader("referer");
          if (req.headers.origin) {
            proxyReq.setHeader("origin", identityUrl.origin);
          }
        });
      },
    },
  };
}
