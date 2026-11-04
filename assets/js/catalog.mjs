/** Product categories: candles (default) and window sun catchers. */
export const SUNCATCHER = "lapace-slunce";
export const isCandle = (p) => (p.category || "svicky") === "svicky";
/** Gift audiences: "pro-ni" (for her), "pro-nej" (for him); both = unisex. */
export const GIFTS = { "pro-ni": "Pro ni", "pro-nej": "Pro něj" };
export const giftFor = (p, who) => Boolean(p.gift?.includes(who));

/** Scent families for the shop filter, recognised from the notes and the scent pyramid. */
export const SCENT_FAMILIES = [
  ["vanilka", "Vanilka", ["vanilk"]],
  ["pizmo", "Pižmo", ["pižm"]],
  ["paculi", "Pačuli", ["pačuli"]],
  ["ambra", "Ambra", ["ambr"]],
  ["drevo", "Dřevo", ["santal", "cedr", "vetiver", "dřev"]],
  [
    "citrusy",
    "Citrusy",
    [
      "pomeranč",
      "citron",
      "bergamot",
      "limet",
      "mandarin",
      "grapefruit",
      "tangerin",
      "citrus",
    ],
  ],
  [
    "kvetiny",
    "Květiny",
    [
      "jasmín",
      "růž",
      "lili",
      "fialk",
      "frézi",
      "květ",
      "neroli",
      "ylang",
      "levandul",
    ],
  ],
  ["svezi", "Svěží a zelené", ["okurk", "mát", "čaj", "ozon", "zelen"]],
  ["more", "Moře", ["moř"]],
  ["koreni", "Koření a zázvor", ["zázvor", "skořic", "hřebíč"]],
  ["sladke", "Sladké", ["čokolád", "cukr", "kokos", "broskev", "jahod"]],
];
export const scentFamilies = (p) => {
  const text = [p.notes, p.pyramid?.top, p.pyramid?.heart, p.pyramid?.base]
    .join(" ")
    .toLowerCase();
  return SCENT_FAMILIES.filter(([, , words]) =>
    words.some((w) => text.includes(w)),
  ).map(([id]) => id);
};

/** Validate the same public catalog in the static build and the browser. */
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const validPrice = (price) =>
  price === null ||
  (Number.isSafeInteger(price) && price > 0 && price <= 100000);
export function validateCatalog(value) {
  if (!Array.isArray(value) || value.length > 1000)
    throw new TypeError("Neplatná nabídka.");
  const seen = new Set();
  return value.map((p) => {
    if (
      !p ||
      typeof p.id !== "string" ||
      !ID.test(p.id) ||
      seen.has(p.id) ||
      typeof p.name !== "string" ||
      p.name.length > 120 ||
      !validPrice(p.price) ||
      typeof p.active !== "boolean"
    )
      throw new TypeError("Neplatný produkt.");
    seen.add(p.id);
    for (const key of ["subtitle", "notes", "description"])
      if (typeof p[key] !== "string")
        throw new TypeError("Neplatný popis produktu.");
    if (
      p.badge !== undefined &&
      (typeof p.badge !== "string" || !p.badge || p.badge.length > 40)
    )
      throw new TypeError("Neplatný štítek produktu.");
    if (
      p.gift !== undefined &&
      (!Array.isArray(p.gift) || p.gift.some((g) => !(g in GIFTS)))
    )
      throw new TypeError("Neplatné určení dárku.");
    if (
      p.character !== undefined &&
      (!Array.isArray(p.character) ||
        p.character.length > 4 ||
        p.character.some((t) => typeof t !== "string" || !t || t.length > 20))
    )
      throw new TypeError("Neplatný charakter vůně.");
    if (
      p.pyramid !== undefined &&
      (!p.pyramid ||
        typeof p.pyramid.top !== "string" ||
        typeof p.pyramid.heart !== "string" ||
        (p.pyramid.base !== undefined && typeof p.pyramid.base !== "string"))
    )
      throw new TypeError("Neplatné vonné tóny.");
    if (
      p.variants !== undefined &&
      (!Array.isArray(p.variants) ||
        p.variants.length > 2 ||
        new Set(p.variants.map((v) => v?.id)).size !== p.variants.length ||
        p.variants.some(
          (v) =>
            !v ||
            !["mala", "velka"].includes(v.id) ||
            typeof v.name !== "string" ||
            (v.detail !== undefined && typeof v.detail !== "string") ||
            (v.burn_hours !== undefined &&
              !(
                Number.isInteger(v.burn_hours) &&
                v.burn_hours > 0 &&
                v.burn_hours <= 500
              )) ||
            !Number.isSafeInteger(v.price) ||
            !validPrice(v.price),
        ))
    )
      throw new TypeError("Neplatná velikost.");
    return p;
  });
}
export function readCart(raw) {
  const parsed = JSON.parse(raw || "[]");
  if (!Array.isArray(parsed)) return [];
  const result = new Map();
  for (const item of parsed.slice(0, 100)) {
    if (
      !item ||
      typeof item.id !== "string" ||
      !ID.test(item.id) ||
      !Number.isInteger(item.qty) ||
      item.qty < 1 ||
      item.qty > 20 ||
      (item.variant !== undefined &&
        !["", "mala", "velka"].includes(item.variant))
    )
      continue;
    const variant = item.variant || "mala";
    const key = `${item.id}::${variant}`;
    const previous = result.get(key);
    result.set(key, {
      id: item.id,
      variant,
      qty: Math.min(20, (previous?.qty || 0) + item.qty),
    });
  }
  return [...result.values()];
}
