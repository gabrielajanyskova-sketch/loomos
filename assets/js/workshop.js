import {
  calcBatch,
  fillFromWater,
  maxLoadWithoutUfi,
  recommendedLoad,
  SUPPLIER_LOAD,
} from "./workshop-calc.mjs";
import {
  CLP_FORMAT,
  FRONT_SIZES,
  frontLabelHtml,
  frontLayout,
  labelHtml,
  overflows,
  sizeLabel,
  smallestFit,
  xHeightMm,
} from "./labels.mjs";

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
  wax_id: Number($("#wax").value) || null,
  loss_percent: Number($("#loss").value),
});

/** Practical know-how collected while setting up production (supplier advice, CLP, claims). */
const KNOWLEDGE = `<div class="knowledge">
<details><summary>Teplota vosku — proč a kolik</summary><ul>
<li><strong>Nature Wax C-3:</strong> zahřát na 65–77 °C (70 °C je ideální), nikdy nad 93 °C. Olej přidat hned, při 65–70 °C. Lít při 55–65 °C.</li>
<li><strong>Golden Wax 464:</strong> výrobce doporučuje 85 °C, aby se rozpustily všechny krystalky tuku — hladší povrch, lepší přilnutí ke sklu a lepší spojení s olejem.</li>
<li>464 jde zahřát i jen na 70 °C (taje při 45–48 °C), ale může se objevit bílý povlak (frosting), mokré skvrny u skla nebo slabší vůně. Nejdřív udělejte 2–3 testovací svíčky; když nebudou hezké, zkuste 75–80 °C.</li>
<li>Nižší teplota šetří citrusové vůně a oleje s nízkým bodem vzplanutí (Kokos a limetka 68 °C, Amalfinské pobřeží 71 °C).</li>
<li>Teploty si upravíte v části <a href="#waxes">Moje vosky</a> → Upravit; postup výroby se podle nich přepočítá.</li>
</ul></details>
<details><summary>Chyby při lití a jak je opravit</summary><ul>
<li><strong>Díra nebo propadlina u knotu:</strong> sójový vosk se při chladnutí smršťuje, střed kolem knotu tuhne poslední a pod povrchem vznikne dutina (u dřevěného knotu častěji). Před prodejem opravit — knot by se při hoření mohl propadnout nebo čadit.</li>
<li><strong>Oprava:</strong> po ztuhnutí udělat špejlí 2–3 hluboké díry asi 1 cm od knotu (skoro ke dnu), dolít trochou stejného vosku jen do roviny a nakonec povrch přejet horkovzdušnou pistolí.</li>
<li><strong>Praskliny na povrchu:</strong> svíčka chladla moc rychle nebo nerovnoměrně (průvan, okno, studená deska, moc horký vosk). Stačí přejet povrch horkovzdušnou pistolí.</li>
<li><strong>Odlepení od skla (wet spots, „mokré skvrny“):</strong> vosk se při chladnutí smrští a místy odtrhne od skla — běžné u sójového vosku, jen vzhled, na hoření ani vůni nemá vliv. Příčiny: studené nebo mastné sklenice, moc horký vosk, rychlé chladnutí, výkyvy teploty. Prevence: sklenice otřít izopropylalkoholem, předehřát na 40–50 °C, lít při 55–60 °C, chladnout pomalu a skladovat při stálé teplotě. Částečná oprava: sklo zvenku krátce prohřát horkovzdušnou pistolí (stále v pohybu, ať sklo nepraskne).</li>
<li><strong>Prevence:</strong> lít chladnější (55–60 °C), sklenice předehřát, chladnout pomalu v pokoji 20–22 °C bez průvanu, volně přikryté krabicí, podložené dřevem, korkem nebo mřížkou — ne na studené desce. Lít pomalu, aby nevznikaly bublinky.</li>
</ul></details>
<details><summary>Vonné oleje — rady dodavatele</summary><ul>
<li>Olej vždy <strong>važte v gramech</strong>, ne podle objemu — dodavatel prodává podle ml, ale každý olej má jinou hustotu.</li>
<li>Doporučená dávka do svíček je 6–8 % z vosku. Kolik u které vůně, je v části <a href="#oleje">Vonné oleje — kolik dát</a>.</li>
<li><strong>Citrusové vůně</strong> (Pomeranč a vanilka, Jantar a citrusy, Amalfinské pobřeží, Kokos a limetka) přidávejte a lijte při co nejnižší teplotě — jinak mohou při hoření vonět „jako palivo“.</li>
<li>Svíčky nechte <strong>zrát aspoň 2 týdny</strong>, teprve pak se vůně naplno rozvine (studená i teplá vůně).</li>
<li>Olej v lahvičce voní jinak než ve svíčce — novou vůni vždy vyzkoušejte v hotové svíčce, než koupíte víc.</li>
<li>Trvanlivost oleje je 6–12 měsíců. Oleje s vanilinem mohou vosk časem zbarvit do žluta až hněda.</li>
<li>Olej nikdy na kůži, nepít, mimo dosah dětí a zvířat; při práci podle bezpečnostního listu (rukavice).</li>
</ul></details>
<details><summary>UFI, etikety a nová šarže oleje</summary><ul>
<li><strong>UFI</strong> je kód, který musí mít výrobek nebezpečný pro zdraví (např. H317 alergie) nebo fyzikálně — a k tomu placené nahlášení složení přes ECHA. Když dáte oleje tak málo, že svíčka nevyjde nebezpečná, UFI ani hlášení nepotřebujete. Ekologická věta H412 hlášení nevyžaduje.</li>
<li>Rozhoduje nejsilnější alergen: ve svíčce ho musí být <strong>pod 1 %</strong> (jinak H317). Alergeny nad 0,1 % se vypisují za „Obsahuje … Může vyvolat alergickou reakci“ (EUH208).</li>
<li>U <strong>každé nové šarže</strong> oleje si stáhněte aktuální bezpečnostní list a deklaraci alergenů (dodavatel je průběžně mění) a pošlete je ke kontrole — může se změnit hranice i text etikety.</li>
<li>U nové vůně potřebujeme: bezpečnostní list k samotnému oleji („Fragrance Oil“), deklaraci alergenů 2023, IFRA certifikát a číslo šarže.</li>
<li>Vůně, kterou chcete prodávat bez UFI, by měla mít u dodavatele „NO UFI up to“ aspoň kolem 8 % — jinak svíčka moc nevoní.</li>
</ul></details>
<details><summary>Co smím psát na web a etiketu</summary><ul>
<li><strong>„Bez ftalátů“ jen u olejů, které ho opravdu splní</strong> (v Dílničce sloupec „Bez ftalátů“). „Phthalate-free“ u dodavatele se týká lahviček; oleje bez ftalátů mají v samostatné kolekci. Diethylftalát (DEP) není zakázaný ani klasifikovaný jako nebezpečný, jen nesmíme tvrdit, že tam není.</li>
<li>„Veganské“ ano, když je veganské vše (olej, sójový vosk, dřevěný knot, barvivo).</li>
<li>„Netestováno na zvířatech“ a „splňuje IFRA“ ano — podklady máme od dodavatele.</li>
<li>„Bez parabenů“ raději ne — ve svíčkách parabeny nikdy nejsou, působilo by to klamavě.</li>
</ul></details>
<details><summary>Vůně do auta (do budoucna)</summary><ul>
<li>Nejjednodušší je tuhý vonný vosk nebo voskový sáček na zavěšení, případně dřevěná či keramická visačka. Tekutým difuzérům se vyhnout (uzávěr proti dětem, hmatová výstraha, UFI).</li>
<li>Platí stejná pravidla jako u svíček: procento oleje tak, aby nebyl H317, CLP etiketa česky s alergeny.</li>
<li>Pokyny: nedávat na palubní desku ani na přímé slunce, nesmí bránit ve výhledu, mimo dosah dětí, nedávat do kontaktu s plasty a potahy.</li>
<li>Nepsat „antibakteriální“ ani „ničí bakterie“ — to by byl biocid s jinými pravidly.</li>
</ul></details>
</div>`;

function render() {
  const jars = activeJars();
  $("#workshop").innerHTML = `
  <section class="panel">
    <h2>Plán výroby</h2>
    ${jars.length ? "" : '<p class="notice">Nejdřív si níže v části <strong>Moje sklenice</strong> přidejte sklenice, do kterých lijete.</p>'}
    <div class="workshop-settings">
      <label>Vonný olej (% z vosku)<input id="load" type="number" min="0" max="20" step="0.5" value="${data.settings.load_percent}"></label>
      <label>Vosk<select id="wax">${data.waxes
        .filter((w) => w.active)
        .map(
          (w) =>
            `<option value="${w.id}" ${w.id === data.wax_id ? "selected" : ""}>${esc(w.name)}</option>`,
        )
        .join("")}</select></label>
      <label>Rezerva na ztráty (%)<input id="loss" type="number" min="0" max="30" step="1" value="${data.settings.loss_percent}"></label>
      <label class="check wide"><input type="checkbox" id="no-ufi" ${data.settings.no_ufi ? "checked" : ""}>Bez UFI — u každé vůně držet olej pod hranicí, do které dodavatel uvádí „bez UFI“ (s 5% rezervou)</label>
      <label class="wide">Název výroby (nepovinné)<input id="batch-name" maxlength="120" placeholder="např. Vánoční várka"></label>
    </div>
    <p class="muted">Dodavatel doporučuje ${SUPPLIER_LOAD.min}–${SUPPLIER_LOAD.max} % vonného oleje. Rezerva pokryje vosk, který zůstane v konvičce. Kolik oleje dát u které vůně, najdete v části <a href="#oleje">Vonné oleje — kolik dát</a>.</p>
    <div class="table-wrap"><table class="plan"><thead><tr><th>Vůně</th><th>Sklenice</th><th>Kusů</th><th></th></tr></thead><tbody id="rows"></tbody></table></div>
    <div class="workshop-actions">
      <button type="button" class="inline-button" id="add-row" ${jars.length ? "" : "disabled"}>＋ Přidat řádek</button>
      <button type="button" class="inline-button" id="add-all" ${jars.length ? "" : "disabled"}>＋ Všechny vůně</button>
      <button type="button" class="inline-button" id="clear">Vyčistit</button>
    </div>
  </section>
  <section class="panel" id="result"></section>
  <section class="panel" id="procedure"></section>
  <section class="panel"><h2>Uložené výroby</h2><div id="batches"></div></section>
  <section class="panel"><h2>Etikety</h2><div id="labels"></div></section>
  <section class="panel"><h2>Moje sklenice</h2><div id="jars"></div></section>
  <section class="panel"><h2>Testy knotů</h2><div id="wick-tests"></div></section>
  <section class="panel"><h2>Moje vosky</h2><div id="waxes"></div></section>
  <section class="panel" id="oleje"><h2>Vonné oleje — kolik dát</h2><div id="oils"></div></section>
  <section class="panel" id="znalosti"><h2>Znalosti a tipy</h2>${KNOWLEDGE}</section>`;
  renderRows();
  renderBatches();
  renderJars();
  renderOils();
  renderLabels();
  renderWaxes();
  renderWickTests();
}

const FLAME = {
  mala: "malý / slabý",
  dobra: "akorát",
  velka: "moc velký",
  nestabilni: "skáče / čoudí",
};
function renderWickTests() {
  const el = $("#wick-tests");
  const jarName = (id) => data.jars.find((j) => j.id === id)?.name || "—";
  const waxName = (id) => data.waxes.find((w) => w.id === id)?.name || "";
  const tests = data.wick_tests;
  const byJar = new Map();
  for (const t of tests) {
    const best = byJar.get(t.jar_id);
    if (t.rating && (!best || t.rating > best.rating)) byJar.set(t.jar_id, t);
  }
  el.innerHTML = `<p class="muted">Zapalte zkušební svíčku a po 2–3 hodinách zapište výsledek. Ideální knot rozpustí vosk až k okraji sklenice, plamen je klidný (cca 1–2 cm), nečoudí a na knotu se nedělá „houbička“.</p>
  <form id="wick-form" class="jar-form">
    <label>Sklenice<select name="jar_id">${data.jars.map((j) => `<option value="${j.id}">${esc(j.name)}</option>`).join("")}</select></label>
    <label>Knot<input name="wick" required maxlength="80" placeholder="např. dřevěný 13 mm"></label>
    <label>Vůně<select name="product_id"><option value="">—</option>${data.scents.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}</select></label>
    <label>Vosk<select name="wax_id">${data.waxes.map((w) => `<option value="${w.id}" ${w.id === data.wax_id ? "selected" : ""}>${esc(w.name)}</option>`).join("")}</select></label>
    <label>Hořelo hodin<input name="hours" type="number" min="0" max="100" step="0.5" value="3"></label>
    <label>Šíře rozpuštěného vosku (mm)<input name="melt_mm" type="number" min="0" max="300"></label>
    <label>Plamen<select name="flame"><option value="">—</option>${Object.entries(
      FLAME,
    )
      .map(([k, v]) => `<option value="${k}">${v}</option>`)
      .join("")}</select></label>
    <label>Hodnocení<select name="rating"><option value="">—</option>${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${"★".repeat(n)}</option>`).join("")}</select></label>
    <label class="check"><input type="checkbox" name="full_pool">Rozpuštěno až k okraji</label>
    <label class="check"><input type="checkbox" name="soot">Čoudí / černá sklo</label>
    <label class="check"><input type="checkbox" name="mushroom">Houbička na knotu</label>
    <label class="wide">Poznámka<textarea name="note" rows="2" maxlength="500" placeholder="např. tunel po 1. hoření, vůně slabší…"></textarea></label>
    <div class="workshop-actions"><button class="button">Uložit test</button></div>
  </form>
  ${
    byJar.size
      ? `<h3>Nejlépe hodnocené knoty</h3><ul class="order-list">${[...byJar]
          .map(
            ([jarId, t]) =>
              `<li><span>${esc(jarName(jarId))}</span><strong>${esc(t.wick)} ${"★".repeat(t.rating)}</strong><button class="inline-button" data-use-wick="${t.id}">Nastavit u sklenice</button></li>`,
          )
          .join("")}</ul>`
      : ""
  }
  ${
    tests.length
      ? `<div class="table-wrap"><table><thead><tr><th>Datum</th><th>Sklenice / knot</th><th>Vůně, vosk</th><th>Výsledek</th><th></th></tr></thead><tbody>${tests
          .map(
            (t) =>
              `<tr><td>${new Date(t.created * 1000).toLocaleDateString("cs-CZ")}</td><td>${esc(jarName(t.jar_id))}<br><strong>${esc(t.wick)}</strong></td><td>${esc(t.product_id ? scentName(t.product_id) : "—")}<br><small>${esc(waxName(t.wax_id))}</small></td><td>${[
                t.hours != null ? `${num(t.hours)} h` : "",
                t.melt_mm != null ? `vosk ${t.melt_mm} mm` : "",
                t.full_pool ? "až k okraji" : "",
                t.flame ? `plamen ${FLAME[t.flame]}` : "",
                t.soot ? "čoudí" : "",
                t.mushroom ? "houbička" : "",
                t.rating ? "★".repeat(t.rating) : "",
              ]
                .filter(Boolean)
                .join(
                  " · ",
                )}${t.note ? `<br><small>${esc(t.note)}</small>` : ""}</td><td><button class="inline-button danger" data-delete-wick="${t.id}">Smazat</button></td></tr>`,
          )
          .join("")}</tbody></table></div>`
      : '<p class="muted">Zatím žádné testy.</p>'
  }`;
}

const temp = (n) => (n == null ? null : `${n} °C`);
function renderProcedure(r) {
  const el = $("#procedure");
  if (!el) return;
  const wax = data.waxes.find((w) => w.id === settings().wax_id);
  if (!r.totals.candles || !wax) {
    el.innerHTML =
      '<h2>Postup výroby</h2><p class="muted">Vyberte vosk a přidejte do plánu svíčky.</p>';
    return;
  }
  const missing = "doplňte v části Moje vosky";
  const today = new Date();
  const plus = (days) =>
    new Date(today.getTime() + days * 864e5).toLocaleDateString("cs-CZ");
  const citrusTips = r.scents
    .filter((s) => data.oils.find((o) => o.product_id === s.product_id)?.citrus)
    .map(
      (s) =>
        `${scentName(s.product_id)}: citrusová vůně — olej přidejte a lijte při co nejnižší teplotě z rozmezí, aby citrusy nevyprchaly a svíčka při hoření nevoněla „jako palivo“.`,
    );
  const flashWarnings = r.scents
    .filter(
      (s) =>
        wax.add_oil_at != null &&
        s.flashpoint_c != null &&
        wax.add_oil_at >= s.flashpoint_c - 5,
    )
    .map(
      (s) =>
        `${scentName(s.product_id)}: bod vzplanutí oleje je ${s.flashpoint_c} °C — olej přidávejte až pod ${s.flashpoint_c - 5} °C.`,
    );
  const jars = r.jars
    .map((j) => {
      const jar = data.jars.find((x) => x.id === j.id);
      return `${j.candles}× ${esc(j.name)} (${jar?.fill_g ?? "?"} g na kus)`;
    })
    .join(", ");
  el.innerHTML = `<h2>Postup výroby — ${esc(wax.name)}</h2>
    <ol class="steps">
      <li><strong>Příprava.</strong> Sklenice čisté a suché: ${jars}. Na střed dna každé sklenice přilepte knot (${r.jars.reduce((s, j) => s + j.wicks, 0)} knotů) a zajistěte ho držákem. Sklenice předehřejte (např. v troubě na nejnižší stupeň nebo fénem). Připravte váhu, teploměr a konvičku na vosk.</li>
      <li><strong>Rozpuštění vosku.</strong> Navažte vosk podle tabulky níže (celkem ${grams(r.totals.wax)}) a rozpouštějte ve vodní lázni${wax.heat_to ? ` na <strong>${temp(wax.heat_to)}</strong>` : ` (teplota zahřátí: ${missing})`}. Bod tání vosku: ${esc(wax.melt || "—")}. Vosk nepřehřívejte a nenechávejte bez dozoru.</li>
      <li><strong>Přidání vonného oleje.</strong> Nechte vosk zchladnout${wax.add_oil_at ? ` na <strong>${temp(wax.add_oil_at)}</strong>` : ` (teplota přidání oleje: ${missing})`}. Přilijte navážený olej pro danou vůni a pomalu, ale důkladně míchejte aspoň 2 minuty, aby se olej s voskem dobře spojil.</li>
      <li><strong>Lití.</strong> ${wax.pour_from ? `Při teplotě <strong>${wax.pour_from}–${wax.pour_to} °C</strong>` : `Při teplotě lití (${missing})`} lijte pomalu do předehřátých sklenic. Každou sklenici postavte na váhu a nalijte náplň podle tabulky sklenic; nahoře nechte asi 1 cm volného místa.</li>
      <li><strong>Chladnutí.</strong> Svíčky nechte chladnout pomalu při pokojové teplotě, nejlépe na mřížce, mimo průvan a bez zakrytí. Prvních 24 hodin s nimi nehýbejte. Drobné důlky nebo nerovný povrch po ztuhnutí můžete opatrně zarovnat horkovzdušnou pistolí.</li>
      <li><strong>Dokončení.</strong> Po ztuhnutí zkraťte knot (bavlněný asi na 6 mm, dřevěný kratší), nalepte etiketu na dno a označte šarži.</li>
      <li><strong>Zrání.</strong> ${wax.cure_min ? `Nechte svíčky vyzrát ${wax.cure_min}${wax.cure_max ? `–${wax.cure_max}` : ""} dní — při dnešní výrobě jsou hotové <strong>${plus(wax.cure_min)}${wax.cure_max ? ` až ${plus(wax.cure_max)}` : ""}</strong>.` : "Nechte svíčky vyzrát podle doporučení výrobce vosku."} Teprve pak je zapalte nebo prodávejte. Nakonec v Uložených výrobách klikněte „Hotovo → na sklad“.</li>
    </ol>
    <h3>Navážit pro každou vůni</h3>
    <div class="table-wrap"><table><thead><tr><th>Vůně</th><th>Svíček</th><th>Vosk</th><th>Vonný olej</th><th>Bod vzplanutí oleje</th></tr></thead><tbody>${r.scents.map((s) => `<tr><td>${esc(scentName(s.product_id))}</td><td>${s.candles}</td><td>${grams(s.wax)}</td><td><strong>${grams(s.oil)}</strong></td><td>${s.flashpoint_c ? s.flashpoint_c + " °C" : "—"}</td></tr>`).join("")}</tbody></table></div>
    ${flashWarnings.length ? `<ul class="warnings">${flashWarnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}
    ${citrusTips.length ? `<ul class="warnings">${citrusTips.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}
    ${wax.note ? `<p class="muted">Poznámka k vosku: ${esc(wax.note)}</p>` : ""}
    <p class="muted">Doporučení dodavatele vosku: max. olej ${esc(wax.max_load || "—")}. Teploty a doby jsou výchozí hodnoty z jeho stránek, upravit je můžete v části Moje vosky.</p>`;
}

function renderWaxes() {
  const el = $("#waxes");
  el.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Vosk</th><th>Zahřát</th><th>Olej při</th><th>Lít při</th><th>Zrání</th><th></th></tr></thead><tbody>${data.waxes
    .map(
      (w) =>
        `<tr class="${w.active ? "" : "muted"}"><td>${esc(w.name)}<br><small>tání ${esc(w.melt || "—")} · olej ${esc(w.max_load || "—")}</small></td><td>${temp(w.heat_to) || "—"}</td><td>${temp(w.add_oil_at) || "—"}</td><td>${w.pour_from ? `${w.pour_from}–${w.pour_to} °C` : "—"}</td><td>${w.cure_min ? `${w.cure_min}${w.cure_max ? `–${w.cure_max}` : ""} dní` : "—"}</td><td><button class="inline-button" data-edit-wax="${w.id}">Upravit</button></td></tr>`,
    )
    .join("")}</tbody></table></div>
  <form id="wax-form" class="jar-form">
    <h3 id="wax-form-title">Přidat vosk</h3>
    <input type="hidden" name="wax_id">
    <label>Název<input name="name" required maxlength="80"></label>
    <label>Bod tání<input name="melt" maxlength="40" placeholder="např. 45–48 °C"></label>
    <label>Zahřát na (°C)<input name="heat_to" type="number" min="20" max="120"></label>
    <label>Přidat olej při (°C)<input name="add_oil_at" type="number" min="20" max="120"></label>
    <label>Lít od (°C)<input name="pour_from" type="number" min="20" max="120"></label>
    <label>Lít do (°C)<input name="pour_to" type="number" min="20" max="120"></label>
    <label>Max. olej<input name="max_load" maxlength="60" placeholder="např. 7–8 %"></label>
    <label>Zrání od (dní)<input name="cure_min" type="number" min="0" max="90"></label>
    <label>Zrání do (dní)<input name="cure_max" type="number" min="0" max="90"></label>
    <label class="wide">Poznámka<textarea name="note" rows="2" maxlength="500"></textarea></label>
    <label class="check"><input type="checkbox" name="active" checked>Používat</label>
    <div class="workshop-actions"><button class="button">Uložit vosk</button><button type="button" class="inline-button" id="wax-reset">Nový</button></div>
  </form>`;
}

/* ---------- labels: one list of what to print, two kinds of labels ---------- */
const LABEL_DRAFT = "loomos-label-rows";
const FRONT_SETTINGS = "loomos-front-labels";
let labelRows = [];
let previewRow = 0;
function loadLabelRows() {
  try {
    const saved = JSON.parse(localStorage.getItem(LABEL_DRAFT) || "[]");
    if (Array.isArray(saved)) labelRows = saved;
  } catch {
    /* optional convenience only */
  }
  const jars = activeJars();
  labelRows = labelRows.filter(
    (r) =>
      data.scents.some((s) => s.id === r.scent) &&
      jars.some((j) => j.id === Number(r.jar)),
  );
  if (!labelRows.length && data.scents.length && jars.length)
    labelRows = [{ scent: data.scents[0].id, jar: jars[0].id, count: 12 }];
}
function saveLabelRows() {
  try {
    localStorage.setItem(LABEL_DRAFT, JSON.stringify(labelRows));
  } catch {
    /* optional convenience only */
  }
}
function frontSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(FRONT_SETTINGS) || "{}");
  } catch {
    /* defaults below */
  }
  return Object.fromEntries(
    Object.entries(FRONT_SIZES).map(([key, size]) => [
      key,
      { ...frontLayout(size), ...(saved[key] || {}) },
    ]),
  );
}
const jarOf = (r) => data.jars.find((j) => j.id === Number(r.jar));
/** Front label size from the jar's shop size; jars without one use their fill weight. */
const frontSize = (jar) =>
  jar?.variant_id === "mala"
    ? "small"
    : jar?.variant_id === "velka"
      ? "big"
      : (jar?.fill_g ?? 0) <= 200
        ? "small"
        : "big";
const labelValues = (r, batch = "") => {
  const texts = data.labels[r.scent] || {};
  return {
    name: scentName(r.scent).replace(/ \(zatím není v e-shopu\)$/, ""),
    grams: jarOf(r)?.fill_g ?? "",
    contains: texts.contains,
    extra: texts.extra,
    pictogram: texts.pictogram,
    phone: data.label.phone,
    icons: data.label.icons !== false,
    batch,
  };
};
const frontValues = (r) => {
  const jar = jarOf(r);
  const scent = data.scents.find((s) => s.id === r.scent);
  const size = frontSize(jar);
  const variant = scent?.variants.find((v) => v.id === jar?.variant_id);
  return {
    size,
    name: labelValues(r).name,
    notes: scent?.notes,
    grams: jar?.fill_g,
    hours: variant?.burn_hours,
  };
};
const labelCount = () =>
  labelRows.reduce((sum, r) => sum + Math.max(0, Number(r.count) || 0), 0);
function renderLabelPreview() {
  const r = labelRows[previewRow] || labelRows[0];
  const preview = $("#label-preview");
  if (!r || !preview) return;
  preview.innerHTML =
    labelHtml(labelValues(r, $("#label-print").elements.batch.value.trim())) +
    frontLabelHtml(frontValues(r));
  const circle = $(".label-circle", preview);
  sizeLabel(circle, data.label);
  const fits = !overflows(circle);
  const x = xHeightMm(data.label.font);
  const clpOk = x >= CLP_FORMAT.minXHeightMm;
  const minimum = smallestFit(circle, data.label);
  sizeLabel(circle, data.label);
  $("#label-fit").innerHTML =
    `Náhled: <strong>${esc(labelValues(r).name)}</strong> · ${esc(jarOf(r)?.name)} — přední etiketa ${FRONT_SIZES[frontSize(jarOf(r))].name.toLowerCase()} ${FRONT_SIZES[frontSize(jarOf(r))].width} × ${FRONT_SIZES[frontSize(jarOf(r))].height} mm.<br>${
      fits
        ? `Text na dno se vejde (průměr ${num(data.label.diameter)} mm, písmo ${num(data.label.font)} pt).`
        : "Text na dno se nevejde — zvětšete průměr nebo zmenšete písmo."
    }<br>${minimum ? `Nejmenší kolečko pro tuto vůni: <strong>${minimum} mm</strong>.` : "Ani 140 mm nestačí — text je pro dno příliš dlouhý."}<br>CLP (od 2028): výška malých písmen ${num(x, 2)} mm ${clpOk ? "✓" : "✗ — potřeba aspoň 1,2 mm (písmo 6,6 pt)"}, řádkování 120 % ✓`;
  $("#label-fit").className = "label-fit" + (fits && clpOk ? "" : " bad");
  const missing = [
    ...new Set(
      labelRows
        .filter((x) => !data.labels[x.scent]?.contains)
        .map((x) => labelValues(x).name),
    ),
  ];
  $("#label-missing").hidden = !missing.length;
  $("#label-missing").textContent =
    `Na etiketu na dno chybí látky „Obsahuje“ u: ${missing.join(", ")} — doplňte je níže.`;
}
function renderLabelRows() {
  const jars = activeJars();
  const l = data.label;
  const perPage = l.columns * l.rows;
  const total = labelCount();
  const front = frontSettings();
  const bySize = { small: 0, big: 0 };
  for (const r of labelRows)
    bySize[frontSize(jarOf(r))] += Math.max(0, Number(r.count) || 0);
  const sheets = (n, per) => Math.ceil(n / per);
  $("#label-rows").innerHTML = labelRows
    .map(
      (
        r,
        i,
      ) => `<tr data-label-row="${i}" class="${i === previewRow ? "active" : ""}">
      <td><select data-label-field="scent" aria-label="Vůně">${data.scents.map((s) => `<option value="${esc(s.id)}" ${s.id === r.scent ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></td>
      <td><select data-label-field="jar" aria-label="Sklenice">${jars.map((j) => `<option value="${j.id}" ${j.id === Number(r.jar) ? "selected" : ""}>${esc(j.name)} · ${j.fill_g} g</option>`).join("")}</select></td>
      <td><input data-label-field="count" type="number" min="0" max="500" value="${esc(r.count)}" aria-label="Počet etiket"></td>
      <td><button type="button" class="inline-button" data-label-preview="${i}">Náhled</button> <button type="button" class="inline-button danger" data-label-remove="${i}" aria-label="Odebrat řádek">✕</button></td></tr>`,
    )
    .join("");
  $("#label-total").innerHTML = total
    ? `Celkem <strong>${total}</strong> etiket. Na dno: ${sheets(total + Math.max(0, startPosition() - 1), perPage)} ${sheetWord(sheets(total + Math.max(0, startPosition() - 1), perPage))} (${perPage} na arch). Přední: ${[
        bySize.small
          ? `${bySize.small} malých na ${sheets(bySize.small, front.small.columns * front.small.rows)} ${sheetWord(sheets(bySize.small, front.small.columns * front.small.rows))} (${front.small.columns * front.small.rows} na arch)`
          : "",
        bySize.big
          ? `${bySize.big} velkých na ${sheets(bySize.big, front.big.columns * front.big.rows)} ${sheetWord(sheets(bySize.big, front.big.columns * front.big.rows))} (${front.big.columns * front.big.rows} na arch)`
          : "",
      ]
        .filter(Boolean)
        .join(", ")}.`
    : "Zadejte, kolik etiket od které vůně chcete.";
  renderLabelPreview();
}
const sheetWord = (n) =>
  n === 1 ? "arch" : n >= 2 && n <= 4 ? "archy" : "archů";
const startPosition = () =>
  Math.max(1, Number($("#label-print")?.elements.start.value) || 1);
function renderLabels() {
  const l = data.label;
  const jars = activeJars();
  if (!jars.length || !data.scents.length) {
    $("#labels").innerHTML =
      '<p class="muted">Nejdřív přidejte sklenici v části „Moje sklenice“.</p>';
    return;
  }
  loadLabelRows();
  const front = frontSettings();
  const frontFields = (key) => {
    const f = front[key];
    const size = FRONT_SIZES[key];
    return `<fieldset class="variant-fields"><legend>${size.name} ${size.width} × ${size.height} mm</legend><label>Etiket v řadě<input name="${key}_columns" type="number" min="1" max="10" value="${f.columns}"></label><label>Řad na stránce<input name="${key}_rows" type="number" min="1" max="15" value="${f.rows}"></label><label>Okraj nahoře (mm)<input name="${key}_margin_top" type="number" min="0" max="80" step="0.5" value="${f.margin_top}"></label><label>Okraj vlevo (mm)<input name="${key}_margin_left" type="number" min="0" max="80" step="0.5" value="${f.margin_left}"></label><label>Mezera (mm)<input name="${key}_gap" type="number" min="0" max="30" step="0.5" value="${f.gap}"></label></fieldset>`;
  };
  $("#labels").innerHTML = `
    <p class="muted">Zadejte, kolik etiket od které vůně chcete — různé vůně se vytisknou za sebou na stejné archy. Z jednoho seznamu vytisknete kulaté etikety na dno i přední etikety. Velikost přední etikety se řídí sklenicí (malá 5 × 6 cm, velká 6 × 7 cm).</p>
    <form id="label-print" class="label-print">
      <div class="table-wrap"><table class="label-rows-table"><thead><tr><th>Vůně</th><th>Sklenice</th><th>Počet</th><th></th></tr></thead><tbody id="label-rows"></tbody></table></div>
      <div class="workshop-actions">
        <button type="button" class="inline-button" data-label-add>＋ Přidat vůni</button>
        <button type="button" class="inline-button" data-label-from-batch>Podle výroby nahoře</button>
        <button type="button" class="inline-button" data-label-clear>Vyčistit</button>
      </div>
      <p id="label-total" class="muted" role="status"></p>
      <div class="jar-form">
        <label>Šarže / datum (nepovinné, na dno)<input name="batch" maxlength="40" placeholder="např. 2026-11"></label>
        <label>Začít od pozice na archu<input name="start" type="number" min="1" max="200" value="1"><small>když tisknete na načatý arch</small></label>
        <label class="check wide"><input type="checkbox" name="cut" checked>Vodítka pro stříhání u předních etiket (tenké čáry přes celý arch na hranách etiket)</label>
        <label class="check wide"><input type="checkbox" name="guides">Tisknout obrysy etiket (zkušební tisk na obyčejný papír)</label>
      </div>
      <div class="workshop-actions">
        <button class="button" data-print="round">Tisknout etikety na dno</button>
        <button class="button" data-print="front">Tisknout přední etikety</button>
      </div>
    </form>
    <p id="label-missing" class="notice" hidden></p>
    <div class="label-preview"><div id="label-preview"></div><p id="label-fit" class="label-fit" role="status"></p></div>
    <details><summary>Texty na etiketu na dno (alergeny a varování u každé vůně)</summary>
    ${data.scents
      .map((s) => {
        const t = data.labels[s.id] || {};
        return `<form class="jar-form label-texts" data-label-scent="${esc(s.id)}"><h3>${esc(s.name)}</h3><label class="wide">Obsahuje — alergeny (věta EUH208, oddělené čárkou)<textarea name="contains" rows="2" maxlength="1000" placeholder="např. Linalool, Limonene, Citral">${esc(t.contains)}</textarea></label><label class="wide">Varování a pokyny z dokumentu (H a P věty)<textarea name="extra" rows="4" maxlength="1500">${esc(t.extra)}</textarea></label><label class="check wide"><input type="checkbox" name="pictogram" ${t.pictogram ? "checked" : ""}>Tisknout výstražný symbol (vykřičník GHS07)</label>${t.source ? `<p class="muted wide">Zdroj: ${esc(t.source)}</p>` : ""}<div class="workshop-actions"><button class="inline-button">Uložit texty</button></div></form>`;
      })
      .join("")}
    </details>
    <details><summary>Nastavení tisku etiket na dno</summary>
      <form id="label-settings" class="jar-form">
        <label>Telefon na etiketu<input name="phone" type="tel" maxlength="30" value="${esc(l.phone)}" placeholder="+420 …"></label>
        <label>Průměr etikety (mm)<input name="diameter" type="number" min="20" max="120" step="1" value="${l.diameter}"></label>
        <label>Velikost písma (pt)<input name="font" type="number" min="4" max="12" step="0.1" value="${l.font}"></label>
        <label>Kroužků v řadě<input name="columns" type="number" min="1" max="10" value="${l.columns}"></label>
        <label>Řad na stránce<input name="rows" type="number" min="1" max="15" value="${l.rows}"></label>
        <label>Okraj nahoře (mm)<input name="margin_top" type="number" min="0" max="60" step="0.5" value="${l.margin_top}"></label>
        <label>Okraj vlevo (mm)<input name="margin_left" type="number" min="0" max="60" step="0.5" value="${l.margin_left}"></label>
        <label>Mezera mezi kroužky (mm)<input name="gap" type="number" min="0" max="30" step="0.5" value="${l.gap}"></label>
        <label class="check wide"><input type="checkbox" name="clp" ${l.clp !== false ? "checked" : ""}>Hlídat pravidla CLP pro vzhled etiket (od 2028: písmo aspoň 6,6 pt, řádkování 120 %)</label>
        <label class="check wide"><input type="checkbox" name="icons" ${l.icons !== false ? "checked" : ""}>Tisknout bezpečnostní piktogramy (ČSN EN 15494)</label>
        <div class="workshop-actions"><button class="inline-button">Uložit nastavení</button></div>
      </form>
      <p class="muted">Rozměry archu najdete na obalu samolepicích kroužků. Při tisku zvolte měřítko 100 % (ne „přizpůsobit stránce“).</p>
    </details>
    <details><summary>Nastavení tisku předních etiket</summary>
      <form id="front-settings" class="jar-form">
        ${frontFields("small")}${frontFields("big")}
        <div class="workshop-actions"><button class="inline-button">Uložit nastavení</button><button type="button" class="inline-button" data-front-reset>Výchozí rozložení</button></div>
      </form>
      <p class="muted">Výchozí rozložení je největší, které se vejde na A4 (velké 3 × 4 = 12, malé 4 × 4 = 16), vycentrované. Pokud máte předřezané archy, opište rozměry z jejich obalu. Tiskněte v měřítku 100 %.</p>
    </details>`;
  renderLabelRows();
}
/** Puts label HTML into A4 pages and opens the print dialog. */
function printSheets(pages) {
  let sheet = document.getElementById("label-sheet");
  if (!sheet) {
    sheet = document.createElement("div");
    sheet.id = "label-sheet";
    document.body.append(sheet);
  }
  sheet.innerHTML = pages
    .map(
      (p) =>
        `<div class="label-page">${p.items.map((html) => html || '<div class="label-empty"></div>').join("")}</div>`,
    )
    .join("");
  sheet.querySelectorAll(".label-page").forEach((pageEl, n) => {
    const { layout, width, height, round } = pages[n];
    const labels = [...pageEl.children];
    if (!round && $("#label-print").elements.cut.checked)
      cutLines(pageEl, layout, width, height, labels.length);
    labels.forEach((el, i) => {
      if (round) sizeLabel(el, data.label);
      el.style.left = `${layout.margin_left + (i % layout.columns) * (width + layout.gap)}mm`;
      el.style.top = `${layout.margin_top + Math.floor(i / layout.columns) * (height + layout.gap)}mm`;
    });
  });
  document.body.classList.add("print-labels");
  document.body.classList.toggle(
    "print-guides",
    $("#label-print").elements.guides.checked,
  );
  window.print();
  document.body.classList.remove("print-labels", "print-guides");
}
/**
 * Thin cutting guides across the whole A4 sheet on every label edge, so the sheet can be cut
 * with scissors or a trimmer. Lines sit exactly on the edges, so nothing is left on the label.
 */
function cutLines(pageEl, layout, width, height, count) {
  const columns = Math.min(layout.columns, count);
  const rows = Math.ceil(count / layout.columns);
  const edges = (start, size, n) => [
    ...new Set(
      Array.from({ length: n }, (_, i) => {
        const from = start + i * (size + layout.gap);
        return [from, from + size].map((x) => Math.round(x * 100) / 100);
      }).flat(),
    ),
  ];
  for (const [axis, positions] of [
    ["v", edges(layout.margin_left, width, columns)],
    ["h", edges(layout.margin_top, height, rows)],
  ])
    for (const at of positions) {
      const line = document.createElement("span");
      line.className = `cut-line cut-${axis}`;
      line.style[axis === "v" ? "left" : "top"] = `${at}mm`;
      pageEl.append(line);
    }
}
/** Splits a list of labels into pages; the first page can start at a later position. */
function paginate(list, perPage, start = 1) {
  const items = [...Array(Math.min(start - 1, perPage - 1)).fill(""), ...list];
  return Array.from({ length: Math.ceil(items.length / perPage) }, (_, i) =>
    items.slice(i * perPage, (i + 1) * perPage),
  );
}
function printLabels(kind) {
  if (!labelCount()) {
    alert("Zadejte počet etiket.");
    return;
  }
  const batch = $("#label-print").elements.batch.value.trim();
  const start = startPosition();
  const repeat = (r, html) =>
    Array(Math.max(0, Math.min(500, Number(r.count) || 0))).fill(html);
  if (kind === "round") {
    const l = data.label;
    const list = labelRows.flatMap((r) =>
      repeat(r, labelHtml(labelValues(r, batch))),
    );
    return printSheets(
      paginate(list, l.columns * l.rows, start).map((items) => ({
        items,
        layout: l,
        width: l.diameter,
        height: l.diameter,
        round: true,
      })),
    );
  }
  const front = frontSettings();
  const pages = [];
  let first = true;
  for (const key of ["small", "big"]) {
    const list = labelRows
      .filter((r) => frontSize(jarOf(r)) === key)
      .flatMap((r) => repeat(r, frontLabelHtml(frontValues(r))));
    if (!list.length) continue;
    const layout = front[key];
    const size = FRONT_SIZES[key];
    for (const items of paginate(
      list,
      layout.columns * layout.rows,
      first ? start : 1,
    ))
      pages.push({ items, layout, width: size.width, height: size.height });
    first = false;
  }
  printSheets(pages);
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
  renderProcedure(r);
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
    `<p class="muted">„Kolik dát“ = doporučených 8 % z vosku, nebo méně, když by svíčka jinak potřebovala UFI. Olej vždy navažte na váze (v gramech), ne podle objemu.</p><div class="table-wrap"><table><thead><tr><th>Vůně</th><th>Kolik dát</th><th>Bez ftalátů</th><th>Bod vzplanutí</th><th>Vanilin</th><th>Difuzéry max.</th><th>Bez UFI do</th><th>Olej od dodavatele</th></tr></thead><tbody>${data.oils
      .map((o) => {
        const load = recommendedLoad(o);
        const max = maxLoadWithoutUfi(
          Math.min(o.no_ufi_max_percent, o.clp_max_percent ?? Infinity),
        );
        return `<tr><td><strong>${esc(o.name)}</strong></td><td><strong>${num(load)} % z vosku</strong><br><small>${num(load * 10)} g oleje na 1 kg vosku${max > load ? ` · bez UFI až ${num(max)} %` : " · víc ne"}</small></td><td>${o.phthalate_free ? "ano" : "ne"}</td><td>${o.flashpoint_c} °C</td><td>${o.vanillin_percent ? num(o.vanillin_percent, 2) + " %" : "ne"}</td><td>${o.diffuser_max_percent ? o.diffuser_max_percent + " %" : "nevhodný"}</td><td>${num(o.no_ufi_max_percent, 2)} % ve svíčce${o.clp_max_percent ? `<br><small>přísněji ${num(o.clp_max_percent, 2)} % podle alergenů</small>` : ""}${o.clp_note ? `<br><small class="muted">${esc(o.clp_note)}</small>` : ""}</td><td><small>${esc(o.supplier_name)}</small></td></tr>`;
      })
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

document.addEventListener("click", (e) => {
  const t = e.target.closest(
    "[data-label-add], [data-label-from-batch], [data-label-clear], [data-label-preview], [data-label-remove], [data-front-reset]",
  );
  if (!t) return;
  const jars = activeJars();
  if (t.matches("[data-label-add]")) {
    const last = labelRows.at(-1);
    labelRows.push({
      scent: last?.scent || data.scents[0].id,
      jar: last?.jar || jars[0].id,
      count: last?.count || 12,
    });
    previewRow = labelRows.length - 1;
  } else if (t.matches("[data-label-from-batch]")) {
    const fromBatch = rows
      .filter((r) => Number(r.count) > 0)
      .map((r) => ({
        scent: r.product_id,
        jar: Number(r.jar_id),
        count: Number(r.count),
      }));
    if (!fromBatch.length) {
      status("Nahoře ve výrobě zatím nic není.", true);
      return;
    }
    labelRows = fromBatch;
    previewRow = 0;
    status(`Etikety převzaty z výroby: ${fromBatch.length} řádků.`);
  } else if (t.matches("[data-label-clear]")) {
    labelRows = [];
    previewRow = 0;
  } else if (t.matches("[data-label-preview]")) {
    previewRow = Number(t.dataset.labelPreview);
  } else if (t.matches("[data-label-remove]")) {
    labelRows.splice(Number(t.dataset.labelRemove), 1);
    previewRow = Math.min(previewRow, Math.max(0, labelRows.length - 1));
  } else if (t.matches("[data-front-reset]")) {
    try {
      localStorage.removeItem(FRONT_SETTINGS);
    } catch {
      /* nothing stored */
    }
    return renderLabels();
  }
  saveLabelRows();
  renderLabelRows();
});
document.addEventListener("input", (e) => {
  const tr = e.target.closest("[data-row]");
  if (tr) {
    rows[Number(tr.dataset.row)][e.target.dataset.field] = e.target.value;
    saveDraft();
    renderResult();
  }
  if (["load", "loss", "no-ufi", "wax"].includes(e.target.id)) renderResult();
  const labelRow = e.target.closest("[data-label-row]");
  if (labelRow && e.target.dataset.labelField) {
    previewRow = Number(labelRow.dataset.labelRow);
    labelRows[previewRow][e.target.dataset.labelField] =
      e.target.dataset.labelField === "jar"
        ? Number(e.target.value)
        : e.target.dataset.labelField === "count"
          ? Number(e.target.value)
          : e.target.value;
    saveLabelRows();
    renderLabelRows();
  } else if (e.target.closest("#label-print")) renderLabelRows();
  if (e.target.name === "water_g") {
    const water = Number(e.target.value);
    if (water > 0) e.target.form.elements.fill_g.value = fillFromWater(water);
  }
});
document.addEventListener("change", (e) => {
  if (["load", "loss", "no-ufi", "wax"].includes(e.target.id)) {
    data.wax_id = settings().wax_id;
    guard(() => api("workshop/settings", settings()))();
  }
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
      if (b.result.wax?.id) $("#wax").value = b.result.wax.id;
      $("#loss").value = b.loss_percent;
      $("#batch-name").value = b.name;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (t.dataset.done) {
      if (!confirm("Označit výrobu jako hotovou a přičíst svíčky na sklad?"))
        return;
      const batch = data.batches.find((b) => b.id === Number(t.dataset.done));
      const hidden = [
        ...new Set(
          (batch?.items || [])
            .map((i) => data.scents.find((x) => x.id === i.product_id))
            .filter((x) => x && !x.active)
            .map((x) => x.name.replace(" (zatím není v e-shopu)", "")),
        ),
      ];
      const r = await api("workshop/batch-done", {
        id: Number(t.dataset.done),
      });
      status(
        (r.stocked.length
          ? `Hotovo. Na sklad přibylo ${r.stocked.reduce((s, x) => s + x.count, 0)} svíček.`
          : "Hotovo. Sklenice nemají nastavenou velikost v e-shopu, sklad se nezměnil.") +
          (hidden.length
            ? ` Pozor: ${hidden.join(", ")} zatím není v e-shopu vidět — sklad je připravený, ale vůni je potřeba v e-shopu zapnout.`
            : ""),
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
    } else if (t.dataset.editWax) {
      const w = data.waxes.find((w) => w.id === Number(t.dataset.editWax));
      const f = $("#wax-form");
      f.elements.wax_id.value = w.id;
      for (const k of [
        "name",
        "melt",
        "heat_to",
        "add_oil_at",
        "pour_from",
        "pour_to",
        "max_load",
        "cure_min",
        "cure_max",
        "note",
      ])
        f.elements[k].value = w[k] ?? "";
      f.elements.active.checked = Boolean(w.active);
      $("#wax-form-title").textContent = "Upravit vosk";
      f.scrollIntoView({ behavior: "smooth" });
      return;
    } else if (t.dataset.useWick) {
      const test = data.wick_tests.find(
        (x) => x.id === Number(t.dataset.useWick),
      );
      const jar = data.jars.find((j) => j.id === test.jar_id);
      if (
        !jar ||
        !confirm(`Nastavit u sklenice „${jar.name}“ knot „${test.wick}“?`)
      )
        return;
      await api("workshop/jar", {
        ...jar,
        wick: test.wick,
        active: Boolean(jar.active),
      });
      status("Knot je nastavený u sklenice.");
      await load();
      return;
    } else if (t.dataset.deleteWick) {
      if (!confirm("Smazat tento test?")) return;
      await api("workshop/wick-test-delete", {
        id: Number(t.dataset.deleteWick),
      });
      await load();
      return;
    } else if (t.id === "wax-reset") {
      $("#wax-form").reset();
      $("#wax-form").elements.wax_id.value = "";
      $("#wax-form-title").textContent = "Přidat vosk";
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
      return printLabels(e.submitter?.dataset.print || "round");
    }
    if (e.target.matches("#front-settings")) {
      e.preventDefault();
      const f = e.target.elements;
      const value = Object.fromEntries(
        Object.keys(FRONT_SIZES).map((key) => [
          key,
          Object.fromEntries(
            ["columns", "rows", "margin_top", "margin_left", "gap"].map((k) => [
              k,
              Number(f[`${key}_${k}`].value) || 0,
            ]),
          ),
        ]),
      );
      for (const v of Object.values(value)) {
        v.columns = Math.max(1, v.columns);
        v.rows = Math.max(1, v.rows);
      }
      try {
        localStorage.setItem(FRONT_SETTINGS, JSON.stringify(value));
      } catch {
        /* the defaults stay in use */
      }
      status("Nastavení předních etiket je uložené.");
      return renderLabelRows();
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
    if (e.target.matches("#wax-form")) {
      e.preventDefault();
      const f = e.target;
      const values = Object.fromEntries(new FormData(f));
      await api("workshop/wax", {
        ...values,
        id: values.wax_id ? Number(values.wax_id) : null,
        active: f.elements.active.checked,
      });
      status("Vosk je uložený.");
      return load();
    }
    if (e.target.matches("#wick-form")) {
      e.preventDefault();
      const f = e.target;
      const values = Object.fromEntries(new FormData(f));
      await api("workshop/wick-test", {
        ...values,
        jar_id: Number(values.jar_id) || null,
        wax_id: Number(values.wax_id) || null,
        full_pool: f.elements.full_pool.checked,
        soot: f.elements.soot.checked,
        mushroom: f.elements.mushroom.checked,
      });
      status("Test knotu je uložený.");
      return load();
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
