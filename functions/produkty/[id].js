/**
 * Products added in admin have no prebuilt page: serve the product template with their id.
 * Prebuilt product pages are served unchanged.
 */
export async function onRequest({ request, params, next, env }) {
  const response = await next();
  if (response.status !== 404) return response;
  const id = String(params.id || "").replace(/\.html$/, "");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return response;
  const template = await env.ASSETS.fetch(
    new URL("/produkty/_sablona", request.url),
  );
  if (!template.ok) return response;
  const html = (await template.text()).replaceAll("__PRODUCT_ID__", id);
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, follow",
    },
  });
}
