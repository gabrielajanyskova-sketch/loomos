import { build as bundle } from "esbuild";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { metadata, renderHead, publicPath } from "./seo.mjs";
import {
  productCard,
  renderHeader,
  renderFooter,
  renderProductDetail,
  renderRelated,
  renderFAQ,
  safetyTable,
  esc,
} from "../assets/js/ui.mjs";
import { validateCatalog, isCandle, giftFor } from "../assets/js/catalog.mjs";
import { withSafety } from "../assets/js/safety.mjs";
import { brand, faqs } from "../assets/js/site.mjs";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const output = path.join(root, "dist");
const configured = new URL(process.env.SITE_URL || brand.url);
if (
  configured.protocol !== "https:" ||
  configured.username ||
  configured.password ||
  configured.search ||
  configured.hash ||
  configured.pathname !== "/"
)
  throw Error("SITE_URL musí být HTTPS origin bez cesty.");
const siteUrl = configured.origin;
const indexable = process.env.SITE_INDEXABLE === "1";
const live = process.env.SHOP_LIVE === "1";
const gaId = process.env.GA_MEASUREMENT_ID || "";
if (gaId && !/^G-[A-Z0-9]{4,12}$/.test(gaId))
  throw Error("GA_MEASUREMENT_ID musí mít tvar G-XXXXXXXXXX.");
const products = withSafety(
  validateCatalog(
    JSON.parse(
      await fs.readFile(path.join(root, "data/products.json"), "utf8"),
    ),
  ).filter((p) => p.active),
  JSON.parse(await fs.readFile(path.join(root, "data/labels.json"), "utf8")),
);

async function write(file, content) {
  const dest = path.join(output, file);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, content);
}
function slot(html, id, content) {
  const expression = new RegExp(`(<div\\s+id="${id}"[^>]*>)[\\s\\S]*?(</div>)`);
  if (!expression.test(html)) throw Error(`Chybí místo pro ${id}`);
  return html.replace(expression, (_, open, close) => open + content + close);
}
function cleanLinks(html) {
  return html.replace(/(href="[^"?#]*)\.html(?=["?#])/g, "$1");
}

await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });
const js = await bundle({
  absWorkingDir: root,
  entryPoints: [
    "assets/js/store.js",
    "assets/js/admin.js",
    "assets/js/workshop.js",
  ],
  outdir: "dist/assets/js",
  entryNames: "[name]-[hash]",
  bundle: true,
  minify: true,
  format: "esm",
  target: ["es2020"],
  metafile: true,
  legalComments: "none",
});
const css = await bundle({
  absWorkingDir: root,
  entryPoints: ["assets/css/store.css"],
  outdir: "dist/assets/css",
  entryNames: "[name]-[hash]",
  minify: true,
  bundle: true,
  external: ["/assets/*"],
  metafile: true,
});
const entry = (result, name) =>
  "/" +
  Object.keys(result.metafile.outputs)
    .find((file) => result.metafile.outputs[file].entryPoint === name)
    .replace(/^dist\//, "");
const scripts = {
  public: entry(js, "assets/js/store.js"),
  admin: entry(js, "assets/js/admin.js"),
  workshop: entry(js, "assets/js/workshop.js"),
};
const stylesheet = entry(css, "assets/css/store.css");
for (const dir of ["img", "fonts"])
  for (const name of await fs.readdir(path.join(root, "assets", dir))) {
    if (
      !(
        /\.(webp|woff2|ico)$/.test(name) ||
        (name.startsWith("favicon-") && name.endsWith(".png")) ||
        name.endsWith("-LICENSE.txt") ||
        name === "og-image.jpg" ||
        name === "icons.svg" ||
        /^carrier-[a-z-]+\.svg$/.test(name)
      )
    )
      continue;
    await write(
      `assets/${dir}/${name}`,
      await fs.readFile(path.join(root, "assets", dir, name)),
    );
  }
for (const name of await fs.readdir(path.join(root, "assets/img/pikto")))
  if (name.endsWith(".png"))
    await write(
      `assets/img/pikto/${name}`,
      await fs.readFile(path.join(root, "assets/img/pikto", name)),
    );
await write("data/products.json", JSON.stringify(products));
const pages = [
  ["index.html", "home"],
  ["obchod.html", "shop"],
  ["velkoobchod.html", "wholesale"],
  ["lapace-slunce.html", "suncatchers"],
  ["darek-pro-ni.html", "gifts-her"],
  ["darek-pro-nej.html", "gifts-him"],
  ["poptavka.html", "inquiry"],
  ["kosik.html", "cart"],
  ["pokladna.html", "checkout"],
  ["admin/index.html", "admin"],
  ["dilnicka/index.html", "workshop"],
  ["ucet.html", "account"],
  ["obnova-hesla.html", "reset"],
  ["objednavka.html", "order"],
  ["obchodni-podminky.html", "terms"],
  ["ochrana-osobnich-udaju.html", "privacy"],
  ["slozeni-a-bezpecnost.html", "safety"],
  ["odstoupeni.html", "withdrawal"],
  ...products.map((p) => [`produkty/${p.id}.html`, "product", p]),
  // Template for products added in admin (served by functions/produkty/[id].js).
  ["produkty/_sablona.html", "product-template"],
];
const sitemap = [];
for (const [file, page, product] of pages) {
  // A product without its own page file is built from produkty/_sablona.html.
  let html = await fs
    .readFile(path.join(root, file), "utf8")
    .catch(async (error) => {
      if (page !== "product" || error.code !== "ENOENT") throw error;
      return (
        await fs.readFile(path.join(root, "produkty/_sablona.html"), "utf8")
      )
        .replace("__PRODUCT_ID__", product.id)
        .replace(
          "<title>Sójová svíčka — LOOMOS</title>",
          `<title>${esc(product.name)} — LOOMOS</title>`,
        );
    });
  if (product?.category === "lapace-slunce")
    html = html.replace(
      '<a href="/obchod.html">Svíčky</a>',
      '<a href="/lapace-slunce.html">Lapače slunce</a>',
    );
  html = html.replace(/<head>[\s\S]*?<\/head>/, () =>
    renderHead({
      meta: metadata({ page, product, siteUrl, indexable, file, products }),
      page,
      script:
        page === "admin"
          ? scripts.admin
          : page === "workshop"
            ? scripts.workshop
            : scripts.public,
      stylesheet,
      live,
      gaId: ["admin", "workshop"].includes(page) ? "" : gaId,
    }),
  );
  if (!["admin", "workshop"].includes(page)) {
    html = slot(html, "site-header", renderHeader(page, { live }));
    html = slot(html, "site-footer", renderFooter());
    if (page === "home") {
      html = slot(
        html,
        "home-products",
        products.filter(isCandle).map(productCard).join(""),
      );
      html = html.replace(
        /(<section[^>]*id="otazky"[^>]*>)[\s\S]*?(<\/section>)/,
        (_, open, close) => open + renderFAQ(faqs) + close,
      );
    }
    if (page === "shop") {
      html = slot(
        html,
        "shop-products",
        products.filter(isCandle).map(productCard).join(""),
      );
      html = html.replace(/(<p id="product-count"[^>]*>).*?(<\/p>)/, "$1$2");
    }
    if (page === "gifts-her" || page === "gifts-him")
      html = slot(
        html,
        "gift-products",
        products
          .filter(
            (p) =>
              isCandle(p) &&
              giftFor(p, page === "gifts-her" ? "pro-ni" : "pro-nej"),
          )
          .map(productCard)
          .join(""),
      );
    if (page === "suncatchers") {
      const list = products.filter((p) => !isCandle(p));
      if (list.length)
        html = slot(
          html,
          "suncatcher-products",
          list.map(productCard).join(""),
        );
    }
    if (page === "safety")
      html = slot(html, "safety-table", safetyTable(products.filter(isCandle)));
    if (product) {
      html = slot(html, "product-detail", renderProductDetail(product));
      html = slot(html, "product-related", renderRelated(product, products));
      html = html.replace(
        '<span id="product-breadcrumb"></span>',
        `<span id="product-breadcrumb">${esc(product.name)}</span>`,
      );
    }
  }
  await write(file, cleanLinks(html));
  if (
    [
      "home",
      "shop",
      "wholesale",
      "suncatchers",
      "gifts-her",
      "gifts-him",
      "inquiry",
      "product",
      "terms",
      "privacy",
      "safety",
    ].includes(page)
  )
    sitemap.push(new URL(publicPath(file), siteUrl).href);
}
const notFoundMeta = metadata({
  page: "notfound",
  siteUrl,
  indexable: false,
  file: "404.html",
  products,
});
await write(
  "404.html",
  `<!doctype html><html lang="cs">${renderHead({ meta: notFoundMeta, page: "notfound", script: scripts.public, stylesheet, live, gaId })}<body data-page="notfound"><div id="site-header">${renderHeader("notfound", { live })}</div><main id="main" class="container page-main empty-state"><h1>Tahle stránka tu není.</h1><p>Zkuste moji aktuální nabídku svíček.</p><a class="button" href="/obchod">Zpět ke svíčkám →</a></main><div id="site-footer">${renderFooter()}</div><div id="toast" role="status"></div></body></html>`,
);
await write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap.map((url) => `<url><loc>${esc(url)}</loc></url>`).join("")}</urlset>\n`,
);
await write(
  "robots.txt",
  `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /dilnicka\nDisallow: /api/\nDisallow: /kosik\nDisallow: /pokladna\nDisallow: /ucet\nDisallow: /obnova-hesla\nDisallow: /objednavka\n${indexable ? `Sitemap: ${siteUrl}/sitemap.xml\n` : "# Indexace není zapnutá; stránky mají noindex.\n"}`,
);
await write(
  "llms.txt",
  `# LOOMOS\n\n> ${brand.description}\n\n## Stav e-shopu\nE-shop je ve fázi přípravy. Fotografie jsou ilustrační. Platby a skutečné objednávky nejsou spuštěné.\n\n## Ověřené informace\n- Ruční výroba, sójový vosk, čiré sklo, dřevěný knot.\n- Vonné oleje dovážené z Velké Británie s certifikátem IFRA.\n- Malá svíčka: sklenice 20 cl, cca 180 g vosku, hoří orientačně ±50 h. Velká svíčka: sklenice 30 cl, cca 220 g vosku, hoří orientačně ±60 h. Dřevěný knot.\n\n## Stránky\n- [Úvod a časté otázky](${siteUrl}/)\n- [Nabídka svíček](${siteUrl}/obchod)\n- [Lapače slunce — duhové nálepky na okno](${siteUrl}/lapace-slunce)\n- [Dárek pro ni — vonné svíčky pro ženy](${siteUrl}/darek-pro-ni)\n- [Dárek pro něj — pánské vonné svíčky](${siteUrl}/darek-pro-nej)\n- [Lapač slunce na přání — váš motiv podle fotky, od 299 Kč](${siteUrl}/poptavka)\n- [Spolupráce a zakázková tvorba](${siteUrl}/velkoobchod)\n\n## Vůně\n${products
    .filter(isCandle)
    .map(
      (p) =>
        `- [${p.name}](${siteUrl}/produkty/${p.id}): ${p.character?.length ? p.character.join(", ") + " — " : ""}${p.notes}${p.variants?.length ? ` (velikosti: ${p.variants.map((v) => v.name.toLowerCase()).join(", ")})` : ""}`,
    )
    .join(
      "\n",
    )}\n\n## Časté otázky\n${faqs.map((f) => `### ${f.question}\n${f.answer}`).join("\n\n")}\n\n## Kontakt\n${brand.email}\n`,
);
await write(
  "site.webmanifest",
  JSON.stringify({
    name: "LOOMOS",
    short_name: "LOOMOS",
    lang: "cs",
    start_url: "/",
    display: "browser",
    background_color: "#171614",
    theme_color: "#171614",
    icons: [192, 512].map((size) => ({
      src: `/assets/img/favicon-${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
    })),
  }),
);
const ga = gaId
  ? {
      script: " https://www.googletagmanager.com",
      connect:
        " https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
      img: " https://*.google-analytics.com https://*.googletagmanager.com",
    }
  : { script: "", connect: "", img: "" };
const packetaOrigin = "https://widget.packeta.com";
// library.js first calls a healthcheck (XHR) and falls back to the backup or error-page host.
const packetaHosts = [
  packetaOrigin,
  "https://backup.widget.packeta.com",
  "https://error-page-service-widget-errors.prod.packeta-com.codenow.com",
].join(" ");
const balikovnaOrigin = "https://b2c.cpost.cz";
const policy = ({ packeta = false } = {}) =>
  `default-src 'self'; script-src 'self'${ga.script}${packeta ? " " + packetaOrigin : ""}; style-src 'self'${packeta ? " 'unsafe-inline' " + packetaOrigin : ""}; font-src 'self'${packeta ? " " + packetaOrigin : ""}; img-src 'self' data:${ga.img}${packeta ? " " + packetaOrigin : ""}; connect-src 'self'${ga.connect}${packeta ? " " + packetaOrigin : ""}; object-src 'none'; frame-src ${packeta ? `${packetaHosts} ${balikovnaOrigin}` : "'none'"}; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`;
const csp = policy();
const expires = new Date(Date.now() + 365 * 864e5).toISOString();
await write(
  ".well-known/security.txt",
  `Contact: mailto:${brand.email}\nExpires: ${expires}\nPreferred-Languages: cs, en\nCanonical: ${siteUrl}/.well-known/security.txt\n`,
);
await write(
  "_headers",
  `/*\n  Content-Security-Policy: ${csp}\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Resource-Policy: same-origin\n  Strict-Transport-Security: max-age=31536000\n${indexable ? "" : "  X-Robots-Tag: noindex, follow\n"}\n/assets/*\n  Cache-Control: public, max-age=86400, stale-while-revalidate=604800\n\n/assets/js/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/assets/css/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/admin/*\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: no-store\n\n/dilnicka/*\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: no-store\n\n/pokladna*\n  ! Content-Security-Policy\n  Content-Security-Policy: ${policy({ packeta: true })}\n  ! Permissions-Policy\n  Permissions-Policy: camera=(), microphone=(), geolocation=(self "${balikovnaOrigin}" "${packetaOrigin}"), payment=(), usb=()\n`,
);
await write(
  "_redirects",
  "/index.html / 301\n/produkty/amber-tobacco /obchod 301\n/produkty/sandalwood-leather /obchod 301\n/produkty/fig-wild-berry /obchod 301\n/produkty/goji-cerveny-pomeranc /obchod 301\n/produkty/svatecni-duch /obchod 301\n",
);
console.log(
  `Built ${pages.length} pages in dist; canonical ${siteUrl}; indexing ${indexable ? "enabled" : "disabled (prelaunch)"}.`,
);
