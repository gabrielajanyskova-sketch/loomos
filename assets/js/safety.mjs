/** Public composition and warning texts per scent (same as the bottom label, from data/labels.json). */
export const withSafety = (products, labels) => {
  const byId = new Map(labels.map((l) => [l.product_id, l]));
  return products.map((p) => {
    const l = byId.get(p.id);
    return l
      ? {
          ...p,
          safety: {
            contains: l.contains,
            extra: l.extra,
            pictogram: Boolean(l.pictogram),
          },
        }
      : p;
  });
};
