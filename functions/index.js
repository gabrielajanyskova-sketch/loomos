/**
 * dilnicka.loomos.cz shows the production planner at its root; every other host gets the shop.
 * Only "/" runs through this function, other static files are served directly.
 */
export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (!url.hostname.startsWith("dilnicka.")) return next();
  const page = await env.ASSETS.fetch(new URL("/dilnicka/", url));
  const response = new Response(page.body, page);
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "no-store");
  return response;
}
