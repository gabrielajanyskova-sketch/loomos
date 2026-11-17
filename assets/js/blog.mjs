/**
 * Blog articles. Each one has its own page in blog/<slug>.html; this list feeds the blog
 * overview, the page titles and descriptions, structured data and the sitemap.
 * Newest first.
 */
export const posts = [
  {
    slug: "pece-o-svicku-s-drevenym-knotem",
    title: "Jak pečovat o svíčku s dřevěným knotem",
    heading: "Jak pečovat o svíčku s <em>dřevěným knotem.</em>",
    description:
      "Péče o sójovou svíčku s dřevěným knotem: první zapálení, zkracování knotu, nejčastější chyby a jak opravit tunel, utopený knot nebo začouzené sklo.",
    excerpt:
      "První zapálení, zkracování knotu a nejčastější chyby. A co dělat, když se udělá tunel, knot se utopí nebo začne čoudit.",
    published: "2026-11-17",
    minutes: 6,
    image: "/assets/img/svicka-pomeranc-vanilka",
    imageAlt: "Sójová svíčka LOOMOS v čirém skle s dřevěným knotem",
  },
];

export const postDate = (iso) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Prague",
  });
