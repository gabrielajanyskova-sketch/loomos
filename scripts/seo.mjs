import { brand, faqs, seller } from "../assets/js/site.mjs";
import { esc } from "../assets/js/ui.mjs";

export const ogImage = {
  path: "/assets/img/og-image.jpg",
  width: 1200,
  height: 630,
  alt: "Ilustrační sójová svíčka LOOMOS v čirém skle s dřevěným knotem",
};
const privatePages = new Set([
  "cart",
  "checkout",
  "admin",
  "notfound",
  "account",
  "reset",
  "order",
  "workshop",
]);
const titles = {
  home: "LOOMOS | Ručně vyráběné sójové svíčky s dřevěným knotem",
  shop: "Sójové svíčky — čtyři vůně, dvě velikosti | LOOMOS",
  wholesale: "Spolupráce a zakázková tvorba | LOOMOS",
  cart: "Váš košík | LOOMOS",
  checkout: "Dokončení objednávky | LOOMOS",
  admin: "Administrace | LOOMOS",
  notfound: "Stránka nenalezena | LOOMOS",
  account: "Můj účet | LOOMOS",
  reset: "Obnovení hesla | LOOMOS",
  order: "Vaše objednávka | LOOMOS",
  workshop: "Dílnička | LOOMOS",
  terms: "Obchodní podmínky | LOOMOS",
  privacy: "Ochrana osobních údajů a cookies | LOOMOS",
};
const descriptions = {
  shop: "Vyberte si ze čtyř vůní ručně vyráběných sójových svíček LOOMOS. Malá i velká varianta, čiré sklo a dřevěný knot. Registrovaní mají 5 % slevu.",
  wholesale:
    "Máte zájem o spolupráci s LOOMOS nebo vlastní nápad? Napište nám a domluvíme se osobně.",
  terms:
    "Obchodní podmínky e-shopu LOOMOS: objednávka, platba převodem s QR kódem, doprava Zásilkovnou, odstoupení od smlouvy a reklamace.",
  privacy:
    "Jak LOOMOS zpracovává osobní údaje zákazníků, jaké používá cookies a jak můžete uplatnit svá práva podle GDPR.",
};
const crumbs = {
  shop: "Svíčky",
  wholesale: "Spolupráce",
  terms: "Obchodní podmínky",
  privacy: "Ochrana osobních údajů",
};
const shorten = (text, max) =>
  text.length <= max
    ? text
    : text.slice(0, text.lastIndexOf(" ", max - 1)).replace(/[,.;:]$/, "") +
      "…";
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
    ? shorten(product.description, 158)
    : descriptions[page] || brand.description;
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
    legalName: seller.name,
    identifier: { "@type": "PropertyValue", name: "IČO", value: seller.ico },
    address: {
      "@type": "PostalAddress",
      streetAddress: seller.street,
      postalCode: seller.zip,
      addressLocality: seller.city,
      addressCountry: "CZ",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: brand.email,
      availableLanguage: ["cs"],
    },
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
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: siteUrl + ogImage.path,
      width: ogImage.width,
      height: ogImage.height,
    },
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
      sku: product.id,
      category: "Vonné svíčky",
      image: [siteUrl + "/assets/img/candle-1536.webp", siteUrl + ogImage.path],
      brand: { "@type": "Brand", name: brand.name },
      manufacturer: { "@id": organization["@id"] },
      material: "Sójový vosk; čiré sklo; dřevěný knot",
      additionalProperty: [
        {
          "@type": "PropertyValue",
          name: "Velikosti",
          value: product.variants?.length
            ? product.variants
                .map((v) => (v.detail ? `${v.name} (${v.detail})` : v.name))
                .join(", ")
            : "Malá, velká",
        },
        { "@type": "PropertyValue", name: "Vonné tóny", value: product.notes },
        ...(product.pyramid
          ? Object.entries({
              "Hlava vůně": product.pyramid.top,
              "Srdce vůně": product.pyramid.heart,
              "Základ vůně": product.pyramid.base,
            })
              .filter(([, value]) => value)
              .map(([name, value]) => ({
                "@type": "PropertyValue",
                name,
                value,
              }))
          : []),
      ],
    });
    webPage.mainEntity = { "@id": canonical + "#product" };
  }
  if (page !== "home" && !privatePages.has(page)) {
    const items = [{ name: "Domů", item: siteUrl + "/" }];
    if (product) items.push({ name: "Svíčky", item: siteUrl + "/obchod" });
    items.push({
      name: product?.name || crumbs[page] || title,
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
  live = false,
  gaId = "",
}) {
  const privatePage = privatePages.has(page);
  const image = new URL(ogImage.path, meta.canonical).href;
  return `<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(meta.title)}</title><meta name="description" content="${esc(meta.description)}">
<meta name="robots" content="${meta.robots}"><meta name="author" content="LOOMOS"><meta name="format-detection" content="telephone=no"><meta name="theme-color" content="#171614"><meta name="color-scheme" content="dark"><meta name="shop-live" content="${live ? "1" : "0"}">${gaId ? `<meta name="ga-id" content="${esc(gaId)}">` : ""}
<link rel="canonical" href="${esc(meta.canonical)}">
<meta property="og:locale" content="cs_CZ"><meta property="og:site_name" content="LOOMOS"><meta property="og:type" content="${page === "product" ? "product" : "website"}"><meta property="og:title" content="${esc(meta.title)}"><meta property="og:description" content="${esc(meta.description)}"><meta property="og:url" content="${esc(meta.canonical)}"><meta property="og:image" content="${image}"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:alt" content="${ogImage.alt}"><meta property="og:image:width" content="${ogImage.width}"><meta property="og:image:height" content="${ogImage.height}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(meta.title)}"><meta name="twitter:description" content="${esc(meta.description)}"><meta name="twitter:image" content="${image}"><meta name="twitter:image:alt" content="${ogImage.alt}">
<link rel="icon" href="/assets/img/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="48x48" href="/assets/img/favicon-48.png"><link rel="apple-touch-icon" sizes="180x180" href="/assets/img/favicon-180.png"><link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/assets/fonts/lora.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/assets/fonts/cormorant-garamond.woff2" as="font" type="font/woff2" crossorigin>
${page === "home" ? '<link rel="preload" as="image" href="/assets/img/candle-1536.webp" imagesrcset="/assets/img/candle-960.webp 960w, /assets/img/candle-1536.webp 1536w" imagesizes="(max-width:700px) 960px, 100vw" fetchpriority="high">' : ""}
<link rel="stylesheet" href="${stylesheet}"><script type="module" src="${script}"></script>
${privatePage ? "" : `<script type="application/ld+json">${meta.json}</script>`}
</head>`;
}
