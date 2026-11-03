/**
 * Candle production maths shared by the Dílnička page and the server.
 *
 * Fragrance load is a percentage of the wax weight (the usual convention):
 *   wax = fill / (1 + load), oil = wax × load, so wax + oil fills the jar.
 */
export const WAX_DENSITY = 0.86; // g/ml of molten soy wax, used to estimate fill from water weight
export const DEFAULTS = { load_percent: 8, loss_percent: 5 };
export const SUPPLIER_LOAD = { min: 6, max: 8 };

const round = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d;
const cz = (n) => String(n).replace(".", ",");

/** Fill weight (wax + oil) from the weight of water up to the fill line. */
export const fillFromWater = (waterGrams) => round(waterGrams * WAX_DENSITY);

/**
 * @param {{product_id:string, jar_id:number, count:number}[]} items
 * @param {{id:number,name:string,fill_g:number,wicks:number,wick:string}[]} jars
 * @param {{product_id:string,name?:string,vanillin_percent:number,no_ufi_max_percent:number,flashpoint_c:number}[]} oils
 */
export function calcBatch({ items, jars, oils, load_percent, loss_percent }) {
  const load = Number(load_percent) / 100;
  const extra = 1 + Number(loss_percent) / 100;
  const jarById = new Map(jars.map((j) => [j.id, j]));
  const oilById = new Map(oils.map((o) => [o.product_id, o]));
  const lines = [];
  const byScent = new Map();
  const byJar = new Map();
  for (const item of items) {
    const jar = jarById.get(item.jar_id);
    const count = Math.max(0, Math.floor(Number(item.count) || 0));
    if (!jar || !count || !item.product_id) continue;
    const fill = jar.fill_g * count;
    const melt = fill * extra;
    const wax = melt / (1 + load);
    const oil = melt - wax;
    lines.push({ ...item, count, jar, fill, wax, oil });
    const scent = byScent.get(item.product_id) || {
      product_id: item.product_id,
      name: oilById.get(item.product_id)?.name || item.product_id,
      candles: 0,
      wax: 0,
      oil: 0,
    };
    scent.candles += count;
    scent.wax += wax;
    scent.oil += oil;
    byScent.set(item.product_id, scent);
    const j = byJar.get(jar.id) || { jar, candles: 0, wicks: 0 };
    j.candles += count;
    j.wicks += count * (jar.wicks || 1);
    byJar.set(jar.id, j);
  }
  const concentration = (load / (1 + load)) * 100;
  const warnings = [];
  if (load_percent < SUPPLIER_LOAD.min || load_percent > SUPPLIER_LOAD.max)
    warnings.push(
      `Dodavatel doporučuje ${SUPPLIER_LOAD.min}–${SUPPLIER_LOAD.max} % vonného oleje; nastaveno ${load_percent} %.`,
    );
  for (const scent of byScent.values()) {
    const oil = oilById.get(scent.product_id);
    if (!oil) continue;
    if (concentration > oil.no_ufi_max_percent)
      warnings.push(
        `${scent.name}: koncentrace oleje ve svíčce ${cz(round(concentration, 1))} % je nad hranicí ${cz(oil.no_ufi_max_percent)} %, do které dodavatel uvádí „bez UFI“. Ověřte označení etikety (CLP/UFI) podle bezpečnostního listu.`,
      );
    if (oil.vanillin_percent > 0)
      warnings.push(
        `${scent.name}: obsahuje vanilin (${cz(oil.vanillin_percent)} %) — vosk může časem zežloutnout nebo zhnědnout.`,
      );
  }
  const scents = [...byScent.values()].map((s) => ({
    ...s,
    wax: round(s.wax),
    oil: round(s.oil),
    flashpoint_c: oilById.get(s.product_id)?.flashpoint_c ?? null,
  }));
  return {
    lines: lines.map((l) => ({
      product_id: l.product_id,
      jar_id: l.jar.id,
      jar: l.jar.name,
      count: l.count,
      wax: round(l.wax),
      oil: round(l.oil),
    })),
    scents,
    jars: [...byJar.values()].map((j) => ({
      id: j.jar.id,
      name: j.jar.name,
      wick: j.jar.wick,
      candles: j.candles,
      wicks: j.wicks,
    })),
    totals: {
      candles: scents.reduce((s, x) => s + x.candles, 0),
      wax: round(scents.reduce((s, x) => s + x.wax, 0)),
      oil: round(scents.reduce((s, x) => s + x.oil, 0)),
      concentration: round(concentration, 2),
    },
    warnings,
  };
}
