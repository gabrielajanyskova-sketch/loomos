/**
 * Candle production maths shared by the Dílnička page and the server.
 *
 * Fragrance load is a percentage of the wax weight (the usual convention):
 *   wax = fill / (1 + load), oil = wax × load, so wax + oil fills the jar.
 */
export const WAX_DENSITY = 0.86; // g/ml of molten soy wax, used to estimate fill from water weight
export const DEFAULTS = { load_percent: 8, loss_percent: 5, no_ufi: 1 };
/** Stay this far (relative) under the supplier's "no UFI" limit to absorb weighing error. */
export const UFI_MARGIN = 0.95;
export const SUPPLIER_LOAD = { min: 6, max: 8 };

const round = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d;
const cz = (n) => String(n).replace(".", ",");

/** Highest load (% of wax) that keeps the finished candle under the supplier's no-UFI limit. */
export function maxLoadWithoutUfi(noUfiPercent) {
  const c = (noUfiPercent * UFI_MARGIN) / 100;
  return Math.floor((c / (1 - c)) * 1000) / 10;
}

/** Supplier's no-UFI limit, or a stricter limit calculated from the allergen declaration. */
export const oilLimit = (oil) =>
  Math.min(oil.no_ufi_max_percent, oil.clp_max_percent ?? Infinity);

/** How much oil to use (% of wax): the supplier's recommended maximum, unless the no-UFI limit is lower. */
export const recommendedLoad = (oil) =>
  Math.min(SUPPLIER_LOAD.max, maxLoadWithoutUfi(oilLimit(oil)));

/** Fill weight (wax + oil) from the weight of water up to the fill line. */
export const fillFromWater = (waterGrams) => round(waterGrams * WAX_DENSITY);

/**
 * @param {{product_id:string, jar_id:number, count:number}[]} items
 * @param {{id:number,name:string,fill_g:number,wicks:number,wick:string}[]} jars
 * @param {{product_id:string,name?:string,vanillin_percent:number,no_ufi_max_percent:number,flashpoint_c:number}[]} oils
 */
export function calcBatch({
  items,
  jars,
  oils,
  load_percent,
  loss_percent,
  no_ufi = 1,
}) {
  const wanted = Number(load_percent);
  const extra = 1 + Number(loss_percent) / 100;
  const avoidUfi = Number(no_ufi) === 1;
  const jarById = new Map(jars.map((j) => [j.id, j]));
  const oilById = new Map(oils.map((o) => [o.product_id, o]));
  /** Supplier's no-UFI limit, or a stricter limit we calculated from the allergen declaration. */
  const limitOf = oilLimit;
  const loadFor = (productId) => {
    const oil = oilById.get(productId);
    return avoidUfi && oil
      ? Math.min(wanted, maxLoadWithoutUfi(limitOf(oil)))
      : wanted;
  };
  const lines = [];
  const byScent = new Map();
  const byJar = new Map();
  for (const item of items) {
    const jar = jarById.get(item.jar_id);
    const count = Math.max(0, Math.floor(Number(item.count) || 0));
    if (!jar || !count || !item.product_id) continue;
    const fill = jar.fill_g * count;
    const melt = fill * extra;
    const load = loadFor(item.product_id) / 100;
    const wax = melt / (1 + load);
    const oil = melt - wax;
    lines.push({ ...item, count, jar, fill, wax, oil });
    const scent = byScent.get(item.product_id) || {
      product_id: item.product_id,
      name: oilById.get(item.product_id)?.name || item.product_id,
      load_percent: loadFor(item.product_id),
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
  const concentrationOf = (loadPercent) =>
    (loadPercent / (100 + loadPercent)) * 100;
  const warnings = [];
  if (wanted < SUPPLIER_LOAD.min || wanted > SUPPLIER_LOAD.max)
    warnings.push(
      `Dodavatel doporučuje ${SUPPLIER_LOAD.min}–${SUPPLIER_LOAD.max} % vonného oleje; nastaveno ${cz(wanted)} %.`,
    );
  for (const scent of byScent.values()) {
    const oil = oilById.get(scent.product_id);
    if (!oil) continue;
    const concentration = concentrationOf(scent.load_percent);
    if (concentration > limitOf(oil))
      warnings.push(
        `${scent.name}: koncentrace oleje ve svíčce ${cz(round(concentration, 1))} % je nad hranicí ${cz(limitOf(oil))} %${oil.clp_max_percent ? " (výpočet z deklarace alergenů)" : ", do které dodavatel uvádí „bez UFI“"}. Svíčka by potřebovala výstražnou etiketu, kód UFI a nahlášení — zapněte „Bez UFI“ nebo snižte olej.`,
      );
    else if (scent.load_percent < wanted)
      warnings.push(
        scent.load_percent < 1
          ? `${scent.name}: bez UFI lze dát jen ${cz(scent.load_percent)} % oleje — svíčka by skoro nevoněla. Tento olej bez UFI nepoužívejte, zvažte jiný.`
          : `${scent.name}: olej snížen na ${cz(scent.load_percent)} %, aby svíčka zůstala bez výstrahy a bez UFI (hranice ${cz(limitOf(oil))} %).${scent.load_percent < SUPPLIER_LOAD.min ? " Vůně bude slabší než při doporučených 6–8 %." : ""}`,
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
    concentration: round(concentrationOf(s.load_percent), 2),
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
    },
    warnings,
  };
}
