import {
  calcBatch,
  fillFromWater,
  maxLoadWithoutUfi,
  SUPPLIER_LOAD,
} from "./workshop-calc.mjs";
import { labelHtml, overflows, sizeLabel } from "./labels.mjs";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const grams = (g) =>
  g >= 1000
    ? `${(g / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} kg`
    : `${Math.round(g).toLocaleString("cs-CZ")} g`;
const num = (n, d = 1) =>
  Number(n).toLocaleString("cs-CZ", { maximumFractionDigits: d });
const DRAFT = "loomos_workshop_draft";

let data = null;
let rows = [];

async function api(path, body) {
  const response = await fetch("/api/admin/" + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw Error("Server e-shopu neodpovídá.");
  }
  if (!response.ok) {
    if (response.status === 401) showLogin();
    throw Error(result.error || "Požadavek se nepodařilo dokončit.");
  }
  return result;
}
function status(msg, error = false) {
  const el = $("#status");
  el.hidden = !msg;
  el.textContent = msg;
  el.className = error ? "notice error" : "notice";
}
const guard =
  (fn) =>
  async (...args) => {
    try {
      await fn(...args);
    } catch (err) {
      status(err.message, true);
    }
  };
function showLogin() {
  $("#login-panel").hidden = false;
  $("#workshop").hidden = true;
  $("#logout").hidden = true;
}
function saveDraft() {
  try {
    localStorage.setItem(DRAFT, JSON.stringify(rows));
  } catch {
    /* optional convenience only */
  }
}
function loadDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

const activeJars = () => data.jars.filter((j) => j.active);
const scentName = (id) => data.scents.find((s) => s.id === id)?.name || id;
const settings = () => ({
  load_percent: Number($("#load").value),
  no_ufi: $("#no-ufi").checked ? 1 : 0,
  loss_percent: Number($("#loss").value),
});

function render() {
  const jars = activeJars();
  $("#workshop").innerHTML = `
  <section class="panel">
    <h2>Plán výroby</h2>
    ${jars.length ? "" : '<p class="notice">Nejdřív si níže v části <strong>Moje sklenice</strong> přidejte sklenice, do kterých lijete.</p>'}
    <div class="workshop-settings">
      <label>Vonný olej (% z vosku)<input id="load" type="number" min="0" max="20" step="0.5" value="${data.settings.load_percent}"></label>
      <label>Rezerva na ztráty (%)<input id="loss" type="number" min="0" max="30" step="1" value="${data.settings.loss_percent}"></label>
      <label class="check wide"><input type="checkbox" id="no-ufi" ${data.settings.no_ufi ? "checked" : ""}>Bez UFI — u každé vůně držet olej pod hranicí, do které dodavatel uvádí „bez UFI“ (s 5% rezervou)</label>
      <label class="wide">Název výroby (nepovinné)<input id="batch-name" maxlength="120" placeholder="např. Vánoční várka"></label>
    </div>
    <p class="muted">Dodavatel doporučuje ${SUPPLIER_LOAD.min}–${SUPPLIER_LOAD.max} % vonného oleje. Rezerva pokryje vosk, který zůstane v konvičce.</p>
    <div class="table-wrap"><table class="plan"><thead><tr><th>Vůně</th><th>Sklenice</th><th>Kusů</th><th></th></tr></thead><tbody id="rows"></tbody></table></div>
    <div class="workshop-actions">
      <button type="button" class="inline-button" id="add-row" ${jars.length ? "" : "disabled"}>＋ Přidat řádek</button>
      <button type="button" class="inline-button" id="add-all" ${jars.length ? "" : "disabled"}>＋ Všechny vůně</button>
      <button type="button" class="inline-button" id="clear">Vyčistit</button>
    </div>
  </section>
  <section class="panel" id="result"></section>
  <section class="panel"><h2>Uložené výroby</h2><div id="batches"></div></section>
  <section class="panel"><h2>Etikety na dno</h2><div id="labels"></div></section>
  <section class="panel"><h2>Moje sklenice</h2><div id="jars"></div></section>
  <section class="panel"><h2>Vonné oleje (údaje dodavatele)</h2><div id="oils"></div></section>`;
  renderRows();
  renderBatches();
  renderJars();
  renderOils();
  renderLabels();
}

const labelValues = () => {
  const f = $("#label-print");
  const jar = data.jars.find((j) => j.id === Number(f.elements.jar.value));
  const scent = f.elements.scent.value;
  const texts = data.labels[scent] || {};
  return {
    name: scentName(scent),
    grams: jar?.fill_g ?? "",
    contains: texts.contains,
    extra: texts.extra,
    pictogram: texts.pictogram,
    phone: data.label.phone,
    batch: f.elements.batch.value.trim(),
  };
};
function renderLabelPreview() {
  const preview = $("#label-preview");
  preview.innerHTML = labelHtml(labelValues());
  const circle = $(".label-circle", preview);
  sizeLabel(circle, data.label);
  const fits = !overflows(circle);
  $("#label-fit").textContent = fits
    ? `Text se vejde (průměr ${num(data.label.diameter)} mm, písmo ${num(data.label.font)} pt).`
    : "Text se nevejde — zvětšete průměr nebo zmenšete písmo.";
  $("#label-fit").className = "label-fit" + (fits ? "" : " bad");
  const texts = data.labels[$("#label-print").elements.scent.value];
  $("#label-missing").hidden = Boolean(texts?.contains);
}
function renderLabels() {
  const l = data.label;
  const jars = activeJars();
  $("#labels").innerHTML = `
    <p class="muted">Kulatá bezpečnostní etiketa na dno sklenice. Látky z dokumentů dodavatele (záložka „KE STAŽENÍ“, v angličtině „Substances“ nebo „Mixtures“) zapište u každé vůně níže.</p>
    <form id="label-print" class="jar-form">
      <label>Vůně<select name="scent">${data.scents.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</select></label>
      <label>Sklenice (hmotnost)<select name="jar">${jars.map((j) => `<option value="${j.id}">${esc(j.name)} · ${j.fill_g} g</option>`).join("")}</select></label>
      <label>Počet etiket<input name="count" type="number" min="1" max="500" value="${l.columns * l.rows}"></label>
      <label>Šarže / datum (nepovinné)<input name="batch" maxlength="40" placeholder="např. 2026-11"></label>
      <label class="check wide"><input type="checkbox" name="guides">Tisknout obrysy kroužků (zkušební tisk na obyčejný papír)</label>
      <div class="workshop-actions"><button class="button">Vytisknout etikety</button></div>
    </form>
    <p id="label-missing" class="notice" hidden>U této vůně ještě nejsou zapsané látky „Obsahuje“ — doplňte je níže.</p>
    <div class="label-preview"><div id="label-preview"></div><p id="label-fit" class="label-fit" role="status"></p></div>
    <details><summary>Texty podle vůní</summary>${data.scents
      .map((s) => {
        const t = data.labels[s.id] || {};
        return `<form class="jar-form label-texts" data-label-scent="${esc(s.id)}"><h3>${esc(s.name)}</h3><label class="wide">Obsahuje — alergeny (věta EUH208, oddělené čárkou)<textarea name="contains" rows="2" maxlength="1000" placeholder="např. Linalool, Limonene, Citral">${esc(t.contains)}</textarea></label><label class="wide">Varování a pokyny z dokumentu (H a P věty)<textarea name="extra" rows="4" maxlength="1500">${esc(t.extra)}</textarea></label><label class="check wide"><input type="checkbox" name="pictogram" ${t.pictogram ? "checked" : ""}>Tisknout výstražný symbol (vykřičník GHS07)</label>${t.source ? `<p class="muted wide">Zdroj: ${esc(t.source)}</p>` : ""}<div class="workshop-actions"><button class="inline-button">Uložit texty</button></div></form>`;
      })
      .join("")}</details>
    <details><summary>Nastavení tisku a údaje na etiketě</summary>
      <form id="label-settings" class="jar-form">
        <label>Telefon na etiketu<input name="phone" type="tel" maxlength="30" value="${esc(l.phone)}" placeholder="+420 …"></label>
        <label>Průměr etikety (mm)<input name="diameter" type="number" min="20" max="120" step="1" value="${l.diameter}"></label>
        <label>Velikost písma (pt)<input name="font" type="number" min="4" max="12" step="0.1" value="${l.font}"></label>
        <label>Kroužků v řadě<input name="columns" type="number" min="1" max="10" value="${l.columns}"></label>
        <label>Řad na stránce<input name="rows" type="number" min="1" max="15" value="${l.rows}"></label>
        <label>Okraj nahoře (mm)<input name="margin_top" type="number" min="0" max="60" step="0.5" value="${l.margin_top}"></label>
        <label>Okraj vlevo (mm)<input name="margin_left" type="number" min="0" max="60" step="0.5" value="${l.margin_left}"></label>
        <label>Mezera mezi kroužky (mm)<input name="gap" type="number" min="0" max="30" step="0.5" value="${l.gap}"></label>
        <div class="workshop-actions"><button class="inline-button">Uložit nastavení</button></div>
      </form>
      <p class="muted">Rozměry archu najdete na obalu samolepicích kroužků. Při tisku zvolte měřítko 100 % (ne „přizpůsobit stránce“).</p>
    </details>`;
  if (jars.length) renderLabelPreview();
}
function printLabels() {
  const f = $("#label-print");
  const l = data.label;
  const count = Math.max(1, Math.min(500, Number(f.elements.count.value) || 1));
  const perPage = l.columns * l.rows;
  let sheet = document.getElementById("label-sheet");
  if (!sheet) {
    sheet = document.createElement("div");
    sheet.id = "label-sheet";
    document.body.append(sheet);
  }
  const html = labelHtml(labelValues());
  sheet.innerHTML = Array.from(
    { length: Math.ceil(count / perPage) },
    (_, page) =>
      `<div class="label-page">${Array.from(
        { length: Math.min(perPage, count - page * perPage) },
        () => html,
      ).join("")}</div>`,
  ).join("");
  sheet.querySelectorAll(".label-page").forEach((pageEl) =>
    pageEl.querySelectorAll(".label-circle").forEach((circle, i) => {
      sizeLabel(circle, l);
      circle.style.left = `${l.margin_left + (i % l.columns) * (l.diameter + l.gap)}mm`;
      circle.style.top = `${l.margin_top + Math.floor(i / l.columns) * (l.diameter + l.gap)}mm`;
    }),
  );
  document.body.classList.add("print-labels");
  document.body.classList.toggle("print-guides", f.elements.guides.checked);
  window.print();
  document.body.classList.remove("print-labels", "print-guides");
}

function renderRows() {
  const jars = activeJars();
  $("#rows").innerHTML = rows
    .map(
      (r, i) => `<tr data-row="${i}">
      <td><select data-field="product_id" aria-label="Vůně">${data.scents.map((s) => `<option value="${esc(s.id)}" ${s.id === r.product_id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></td>
      <td><select data-field="jar_id" aria-label="Sklenice">${jars.map((j) => `<option value="${j.id}" ${j.id === Number(r.jar_id) ? "selected" : ""}>${esc(j.name)} · ${j.fill_g} g</option>`).join("")}</select></td>
      <td><input data-field="count" type="number" min="1" max="10000" value="${r.count}" aria-label="Počet kusů"></td>
      <td><button type="button" class="inline-button danger" data-remove="${i}" aria-label="Odebrat řádek">✕</button></td></tr>`,
    )
    .join("");
  renderResult();
}

function renderResult() {
  const el = $("#result");
  const r = calcBatch({
    items: rows.map((x) => ({ ...x, jar_id: Number(x.jar_id) })),
    jars: data.jars,
    oils: data.oils,
    ...settings(),
  });
  if (!r.totals.candles) {
    el.innerHTML =
      '<h2>Výpočet</h2><p class="muted">Přidejte řádek s vůní, sklenicí a počtem kusů.</p>';
    return;
  }
  el.innerHTML = `<h2>Výpočet</h2>
    <div class="stats"><div class="stat">Svíček<strong>${r.totals.candles}</strong></div><div class="stat">Sójový vosk celkem<strong>${grams(r.totals.wax)}</strong></div><div class="stat">Vonný olej celkem<strong>${grams(r.totals.oil)}</strong></div></div>
    <p class="muted">Množství už obsahuje rezervu ${settings().loss_percent} %. Olej je v % z hmotnosti vosku; „ve svíčce“ je podíl oleje v hotové svíčce.</p>
    <h3>Podle vůně</h3>
    <div class="table-wrap"><table><thead><tr><th>Vůně</th><th>Svíček</th><th>Olej %</th><th>Vosk</th><th>Vonný olej</th><th>Bod vzplanutí</th></tr></thead><tbody>${r.scents.map((s) => `<tr><td>${esc(scentName(s.product_id))}</td><td>${s.candles}</td><td>${num(s.load_percent)} %<br><small class="muted">ve svíčce ${num(s.concentration, 2)} %</small></td><td>${grams(s.wax)}</td><td><strong>${grams(s.oil)}</strong> <small class="muted">≈ ${Math.round(s.oil)} ml</small></td><td>${s.flashpoint_c ? s.flashpoint_c + " °C" : "—"}</td></tr>`).join("")}</tbody></table></div>
    <h3>Sklenice a knoty</h3>
    <div class="table-wrap"><table><thead><tr><th>Sklenice</th><th>Kusů</th><th>Knotů</th></tr></thead><tbody>${r.jars.map((j) => `<tr><td>${esc(j.name)}</td><td>${j.candles}</td><td>${j.wicks}${j.wick ? ` × ${esc(j.wick)}` : ""}</td></tr>`).join("")}</tbody></table></div>
    <h3>Rozpis</h3>
    <div class="table-wrap"><table><thead><tr><th>Vůně</th><th>Sklenice</th><th>Kusů</th><th>Vosk</th><th>Olej</th></tr></thead><tbody>${r.lines.map((l) => `<tr><td>${esc(scentName(l.product_id))}</td><td>${esc(l.jar)}</td><td>${l.count}</td><td>${grams(l.wax)}</td><td>${grams(l.oil)}</td></tr>`).join("")}</tbody></table></div>
    ${r.warnings.length ? `<h3>Pozor</h3><ul class="warnings">${r.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}
    <p class="muted">Olej v ml je orientační (hustota ≈ 1 g/ml); přesně važte na gramy.</p>
    <div class="workshop-actions"><button type="button" class="button" id="save-batch">Uložit výrobu</button><button type="button" class="inline-button" id="print">Vytisknout</button></div>`;
}

function renderBatches() {
  const el = $("#batches");
  if (!data.batches.length) {
    el.innerHTML = '<p class="muted">Zatím žádné uložené výroby.</p>';
    return;
  }
  el.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Výroba</th><th>Svíček</th><th>Vosk</th><th>Olej</th><th>Stav</th><th></th></tr></thead><tbody>${data.batches
    .map(
      (b) =>
        `<tr><td>${esc(b.name || "Výroba " + b.id)}<br><small>${new Date(b.created * 1000).toLocaleDateString("cs-CZ")} · olej ${num(b.load_percent)} %${b.no_ufi ? " · bez UFI" : ""}</small></td><td>${b.result.totals.candles}</td><td>${grams(b.result.totals.wax)}</td><td>${grams(b.result.totals.oil)}</td><td>${b.status === "hotovo" ? '<span class="status-label">Hotovo</span>' : "Plánováno"}</td><td><button class="inline-button" data-load="${b.id}">Načíst</button> ${b.status === "hotovo" ? "" : `<button class="inline-button" data-done="${b.id}">Hotovo → na sklad</button>`} <button class="inline-button danger" data-delete="${b.id}">Smazat</button></td></tr>`,
    )
    .join("")}</tbody></table></div>
    <p class="muted">„Hotovo → na sklad“ přičte svíčky do skladu e-shopu u sklenic, které mají nastavenou velikost (malá / velká).</p>`;
}

function renderJars() {
  const el = $("#jars");
  el.innerHTML = `${
    data.jars.length
      ? `<div class="table-wrap"><table><thead><tr><th>Sklenice</th><th>Náplň</th><th>Knoty</th><th>V e-shopu</th><th></th></tr></thead><tbody>${data.jars
          .map(
            (j) =>
              `<tr class="${j.active ? "" : "muted"}"><td>${esc(j.name)}${j.note ? `<br><small>${esc(j.note)}</small>` : ""}${j.active ? "" : " <small>(skrytá)</small>"}</td><td>${j.fill_g} g${j.water_g ? `<br><small>voda ${j.water_g} g</small>` : ""}</td><td>${j.wicks}${j.wick ? ` × ${esc(j.wick)}` : ""}</td><td>${{ mala: "Malá", velka: "Velká" }[j.variant_id] || "—"}</td><td><button class="inline-button" data-edit-jar="${j.id}">Upravit</button></td></tr>`,
          )
          .join("")}</tbody></table></div>`
      : ""
  }
  <form id="jar-form" class="jar-form">
    <h3 id="jar-form-title">Přidat sklenici</h3>
    <input type="hidden" name="jar_id">
    <label>Název<input name="name" required maxlength="80" placeholder="např. Čirá sklenice 200 ml"></label>
    <label>Voda po rysku (g)<input name="water_g" type="number" min="1" max="20000" placeholder="zvažte vodu"></label>
    <label>Náplň vosk + olej (g)<input name="fill_g" type="number" min="1" max="10000" required></label>
    <label>Počet knotů<input name="wicks" type="number" min="1" max="5" value="1" required></label>
    <label>Typ knotu<input name="wick" maxlength="80" placeholder="např. dřevěný knot 13 mm"></label>
    <label>Velikost v e-shopu<select name="variant_id"><option value="">— nepropojovat —</option><option value="mala">Malá</option><option value="velka">Velká</option></select></label>
    <label class="wide">Poznámka<input name="note" maxlength="200"></label>
    <label class="check"><input type="checkbox" name="active" checked>Používat v plánu</label>
    <div class="workshop-actions"><button class="button">Uložit sklenici</button><button type="button" class="inline-button" id="jar-reset">Nová</button></div>
  </form>
  <p class="muted">Tip: prázdnou sklenici postavte na váhu, vynulujte ji a nalijte vodu po místo, kam chcete lít vosk. Gramy vody zadejte — náplň se dopočítá (× 0,86, vosk je lehčí než voda).</p>`;
}

function renderOils() {
  $("#oils").innerHTML =
    `<div class="table-wrap"><table><thead><tr><th>Vůně</th><th>Olej od dodavatele</th><th>Bod vzplanutí</th><th>Vanilin</th><th>Difuzéry max.</th><th>Bez UFI do</th><th>Max. olej bez UFI</th></tr></thead><tbody>${data.oils
      .map(
        (o) =>
          `<tr><td>${esc(o.name)}</td><td><small>${esc(o.supplier_name)}</small></td><td>${o.flashpoint_c} °C</td><td>${o.vanillin_percent ? num(o.vanillin_percent, 2) + " %" : "ne"}</td><td>${o.diffuser_max_percent ? o.diffuser_max_percent + " %" : "nevhodný"}</td><td>${num(o.no_ufi_max_percent, 2)} % ve svíčce</td><td>${num(maxLoadWithoutUfi(o.no_ufi_max_percent))} % z vosku</td></tr>`,
      )
      .join("")}</tbody></table></div>`;
}

async function load() {
  data = await api("workshop");
  if (!rows.length) rows = loadDraft();
  rows = rows.filter((r) => data.scents.some((s) => s.id === r.product_id));
  $("#login-panel").hidden = true;
  $("#workshop").hidden = false;
  $("#logout").hidden = false;
  render();
}

document.addEventListener("input", (e) => {
  const tr = e.target.closest("[data-row]");
  if (tr) {
    rows[Number(tr.dataset.row)][e.target.dataset.field] = e.target.value;
    saveDraft();
    renderResult();
  }
  if (["load", "loss", "no-ufi"].includes(e.target.id)) renderResult();
  if (e.target.closest("#label-print")) renderLabelPreview();
  if (e.target.name === "water_g") {
    const water = Number(e.target.value);
    if (water > 0) e.target.form.elements.fill_g.value = fillFromWater(water);
  }
});
document.addEventListener("change", (e) => {
  if (["load", "loss", "no-ufi"].includes(e.target.id))
    guard(() => api("workshop/settings", settings()))();
});
document.addEventListener(
  "click",
  guard(async (e) => {
    const t = e.target;
    const jars = activeJars();
    if (t.id === "add-row") {
      const last = rows.at(-1);
      rows.push({
        product_id: last?.product_id || data.scents[0].id,
        jar_id: last?.jar_id || jars[0].id,
        count: last?.count || 6,
      });
    } else if (t.id === "add-all") {
      const last = rows.at(-1);
      for (const s of data.scents)
        rows.push({
          product_id: s.id,
          jar_id: last?.jar_id || jars[0].id,
          count: last?.count || 6,
        });
    } else if (t.id === "clear") rows = [];
    else if (t.dataset.remove) rows.splice(Number(t.dataset.remove), 1);
    else if (t.id === "print") return window.print();
    else if (t.id === "save-batch") {
      await api("workshop/batch", {
        name: $("#batch-name").value,
        items: rows.map((r) => ({
          ...r,
          jar_id: Number(r.jar_id),
          count: Number(r.count),
        })),
        ...settings(),
      });
      status("Výroba je uložená.");
      await load();
      return;
    } else if (t.dataset.load) {
      const b = data.batches.find((b) => b.id === Number(t.dataset.load));
      rows = b.items.map((i) => ({ ...i }));
      $("#load").value = b.load_percent;
      $("#no-ufi").checked = Boolean(b.no_ufi);
      $("#loss").value = b.loss_percent;
      $("#batch-name").value = b.name;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (t.dataset.done) {
      if (!confirm("Označit výrobu jako hotovou a přičíst svíčky na sklad?"))
        return;
      const r = await api("workshop/batch-done", {
        id: Number(t.dataset.done),
      });
      status(
        r.stocked.length
          ? `Hotovo. Na sklad přibylo ${r.stocked.reduce((s, x) => s + x.count, 0)} svíček.`
          : "Hotovo. Sklenice nemají nastavenou velikost v e-shopu, sklad se nezměnil.",
      );
      await load();
      return;
    } else if (t.dataset.delete) {
      if (!confirm("Smazat uloženou výrobu?")) return;
      await api("workshop/batch-delete", { id: Number(t.dataset.delete) });
      await load();
      return;
    } else if (t.dataset.editJar) {
      const j = data.jars.find((j) => j.id === Number(t.dataset.editJar));
      const f = $("#jar-form");
      f.elements.jar_id.value = j.id;
      for (const k of [
        "name",
        "water_g",
        "fill_g",
        "wicks",
        "wick",
        "variant_id",
        "note",
      ])
        f.elements[k].value = j[k] ?? "";
      f.elements.active.checked = Boolean(j.active);
      $("#jar-form-title").textContent = "Upravit sklenici";
      f.scrollIntoView({ behavior: "smooth" });
      return;
    } else if (t.id === "jar-reset") {
      $("#jar-form").reset();
      $("#jar-form").elements.jar_id.value = "";
      $("#jar-form-title").textContent = "Přidat sklenici";
      return;
    } else return;
    saveDraft();
    renderRows();
  }),
);
document.addEventListener(
  "submit",
  guard(async (e) => {
    if (e.target.matches("#label-print")) {
      e.preventDefault();
      return printLabels();
    }
    if (e.target.matches("[data-label-scent]")) {
      e.preventDefault();
      const id = e.target.dataset.labelScent;
      const body = {
        product_id: id,
        contains: e.target.elements.contains.value.replace(/[.\s]+$/, ""),
        extra: e.target.elements.extra.value,
        pictogram: e.target.elements.pictogram.checked,
      };
      await api("workshop/label", body);
      data.labels[id] = { ...body, source: "upraveno ručně" };
      status("Texty etikety jsou uložené.");
      return renderLabelPreview();
    }
    if (e.target.matches("#label-settings")) {
      e.preventDefault();
      const values = Object.fromEntries(new FormData(e.target));
      await api("workshop/label-settings", values);
      status("Nastavení etiket je uložené.");
      return load();
    }
    if (!e.target.matches("#jar-form")) return;
    e.preventDefault();
    const f = e.target;
    await api("workshop/jar", {
      id: f.elements.jar_id.value ? Number(f.elements.jar_id.value) : null,
      name: f.elements.name.value,
      water_g: f.elements.water_g.value
        ? Number(f.elements.water_g.value)
        : null,
      fill_g: Number(f.elements.fill_g.value),
      wicks: Number(f.elements.wicks.value),
      wick: f.elements.wick.value,
      variant_id: f.elements.variant_id.value,
      note: f.elements.note.value,
      active: f.elements.active.checked,
    });
    status("Sklenice je uložená.");
    await load();
  }),
);
$("#login-form").addEventListener(
  "submit",
  guard(async (e) => {
    e.preventDefault();
    await api("login", { password: e.target.elements.password.value });
    e.target.reset();
    status("");
    await load();
  }),
);
$("#logout").addEventListener(
  "click",
  guard(async () => {
    await api("logout", {});
    showLogin();
    status("Jste odhlášeni.");
  }),
);
guard(async () => {
  const s = await api("session");
  if (s.authenticated) return load();
  showLogin();
  if (!s.configured)
    status(
      "Nejdřív v Cloudflare nastavte ADMIN_PASSWORD (stejné heslo jako do administrace).",
      true,
    );
})();
