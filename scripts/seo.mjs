import { brand, faqs } from "../assets/js/site.mjs";
import { esc } from "../assets/js/ui.mjs";

const privatePages = new Set(["cart", "checkout", "admin", "notfound"]);
const titles = {
  home: "LOOMOS | Ručně vyráběné sójové svíčky s dřevěným knotem",
  shop: "Sójové svíčky — šest vůní, dvě velikosti | LOOMOS",
  wholesale: "Spolupráce a zakázková tvorba | LOOMOS",
  cart: "Váš košík | LOOMOS",
  checkout: "Dokončení objednávky | LOOMOS",
  admin: "Administrace | LOOMOS",
  notfound: "Stránka nenalezena | LOOMOS",
};
export const publicPath = (file) =>
  file === "index.html" ? "/" : file.replace(/\.html$/, "");
export function metadata({
  page,
  product,
  siteUrl,
  indexable,
  file,
  products,
}) {
  const path = publicPath(file);
  const canonical = new URL(path, siteUrl).href;
  const title = product
    ? `${product.name} — sójová svíčka | LOOMOS`
    : titles[page];
  const description = product
    ? product.description
    : page === "shop"
      ? "Vyberte si ze šesti vůní ručně vyráběných sójových svíček LOOMOS. Malá i velká varianta, čiré sklo a dřevěný knot. E-shop připravujeme."
      : page === "wholesale"
        ? "Máte zájem o spolupráci s LOOMOS nebo vlastní nápad? Napište nám a domluvíme se osobně."
        : brand.description;
  const robots =
    indexable && !privatePages.has(page)
      ? "index,follow,max-image-preview:large"
      : "noindex,follow";
  const organization = {
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: brand.name,
    url: siteUrl + "/",
    logo: {
      "@type": "ImageObject",
      url: siteUrl + "/assets/img/favicon-512.png",
    },
    email: brand.email,
    description: brand.description,
  };
  const website = {
    "@type": "WebSite",
    "@id": siteUrl + "/#website",
    url: siteUrl + "/",
    name: brand.name,
    inLanguage: brand.language,
    publisher: { "@id": organization["@id"] },
  };
  const webPage = {
    "@type":
      page === "shop"
        ? "CollectionPage"
        : page === "home"
          ? "WebPage"
          : product
            ? "ItemPage"
            : "WebPage",
    "@id": canonical + "#webpage",
    url: canonical,
    name: title,
    description,
    inLanguage: brand.language,
    isPartOf: { "@id": website["@id"] },
    about: { "@id": organization["@id"] },
  };
  const graph = [organization, website, webPage];
  if (page === "home")
    graph.push({
      "@type": "FAQPage",
      "@id": canonical + "#otazky",
      inLanguage: brand.language,
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  if (page === "shop")
    graph.push({
      "@type": "ItemList",
      "@id": canonical + "#nabidka",
      numberOfItems: products.length,
      itemListElement: products.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: p.name,
        url: siteUrl + "/produkty/" + p.id,
      })),
    });
  if (product) {
    // Prices are provisional and checkout is a preview: do not publish Offer or availability claims.
    graph.push({
      "@type": "Product",
      "@id": canonical + "#product",
      name: product.name,
      description: product.description,
      url: canonical,
      image: siteUrl + "/assets/img/candle-1536.webp",
      brand: { "@type": "Brand", name: brand.name },
      material: "Sójový vosk; čiré sklo; dřevěný knot",
      additionalProperty: [
        { "@type": "PropertyValue", name: "Velikosti", value: "Malá, velká" },
        { "@type": "PropertyValue", name: "Vonné tóny", value: product.notes },
      ],
    });
    webPage.mainEntity = { "@id": canonical + "#product" };
  }
  if (page !== "home" && !privatePages.has(page)) {
    const items = [{ name: "Domů", item: siteUrl + "/" }];
    if (product) items.push({ name: "Svíčky", item: siteUrl + "/obchod" });
    items.push({
      name: product?.name || (page === "shop" ? "Svíčky" : "Spolupráce"),
      item: canonical,
    });
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: items.map((x, i) => ({
        "@type": "ListItem",
        position: i + 1,
        ...x,
      })),
    });
  }
  const json = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": graph,
  })
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
  return { title, description, canonical, robots, json };
}
export function renderHead({
  meta,
  page,
  script,
  stylesheet,
  runtime = "static",
}) {
  const privatePage = privatePages.has(page);
  return `<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(meta.title)}</title><meta name="description" content="${esc(meta.description)}">
<meta name="robots" content="${meta.robots}"><meta name="theme-color" content="#171614"><meta name="color-scheme" content="dark"><meta name="loomos-runtime" content="${runtime}">
<link rel="canonical" href="${esc(meta.canonical)}">
<meta property="og:locale" content="cs_CZ"><meta property="og:site_name" content="LOOMOS"><meta property="og:type" content="${page === "product" ? "product" : "website"}"><meta property="og:title" content="${esc(meta.title)}"><meta property="og:description" content="${esc(meta.description)}"><meta property="og:url" content="${esc(meta.canonical)}"><meta property="og:image" content="${new URL("/assets/img/candle-1536.webp", meta.canonical).href}"><meta property="og:image:alt" content="Ilustrační sójová svíčka LOOMOS v čirém skle s dřevěným knotem"><meta property="og:image:width" content="1536"><meta property="og:image:height" content="1024">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(meta.title)}"><meta name="twitter:description" content="${esc(meta.description)}"><meta name="twitter:image" content="${new URL("/assets/img/candle-1536.webp", meta.canonical).href}">
<link rel="icon" href="/assets/img/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="48x48" href="/assets/img/favicon-48.png"><link rel="apple-touch-icon" sizes="180x180" href="/assets/img/favicon-180.png"><link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/assets/fonts/lora.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/assets/fonts/cormorant-garamond.woff2" as="font" type="font/woff2" crossorigin>
${page === "home" ? '<link rel="preload" as="image" href="/assets/img/candle-1536.webp" imagesrcset="/assets/img/candle-960.webp 960w, /assets/img/candle-1536.webp 1536w" imagesizes="(max-width:700px) 960px, 100vw" fetchpriority="high">' : ""}
<link rel="stylesheet" href="${stylesheet}"><script type="module" src="${script}"></script>
${privatePage ? "" : `<script type="application/ld+json">${meta.json}</script>`}
</head>`;
}
