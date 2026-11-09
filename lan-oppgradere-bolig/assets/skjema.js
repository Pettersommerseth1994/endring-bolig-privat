/* ──────────────────────────────────────────────────────────────────
   Skjemamotoren. En forenklet utgave av lecaforms i dagens løsning:
   stegene beskrives som data i steg.js, og motoren står for visning,
   synlighet, validering, navigasjon, lagring og oppsummering.

   Tekster kan inneholde {du} {Du} {deg} {din} {Din} {dine} {ditt}
   {jeg} {Jeg}. De blir til dere/deres/vi når søkeren har medlåntaker,
   slik som i dagens løsning.
   ────────────────────────────────────────────────────────────────── */

const FELTTYPER = ['janei', 'radio', 'avkrysning', 'tekstfelt', 'tall', 'belop', 'dato', 'tekstomrade', 'kommune', 'fil'];

let T, D, M;              // hele tilstanden, søknadsdata, metadata
let aktiv = null;         // id til steget som vises, eller 'oppsummering'
let forsokt = false;      // har brukeren trykket Neste på dette steget
let lagreTimer = null;

/* ═══ Oppslag ═════════════════════════════════════════════════════ */

const stegMedId = id => SKJEMA_STEG.find(s => s.id === id);
const hovedrekke = () => SKJEMA_STEG.filter(s => !s.understeg);
const kilde = steg => (steg && steg.utkast ? M.utkast.data : D);

function flertall() {
  return D['laanetakere.medEktefelle'] === true || D['laanetakere.sammenMedNoen'] === true;
}

const PRONOMEN = { du: 'dere', Du: 'Dere', deg: 'dere', din: 'deres', Din: 'Deres', dine: 'deres', ditt: 'deres', jeg: 'vi', Jeg: 'Vi' };
function tx(tekst, x) {
  if (typeof tekst === 'function') tekst = tekst(x ?? D, D);
  if (tekst == null) return '';
  const f = flertall();
  return String(tekst).replace(/\{(du|Du|deg|din|Din|dine|ditt|jeg|Jeg)\}/g, (_, k) => (f ? PRONOMEN[k] : k));
}

const tom = v => v == null || v === '' || (Array.isArray(v) && v.length === 0);
const num = v => { const n = Number(String(v ?? '').replace(/[\s ]/g, '')); return Number.isFinite(n) ? n : 0; };

function stegSynlig(s) {
  if (typeof s === 'string') s = stegMedId(s);
  return !!s && (!s.synlig || !!s.synlig(D));
}
const elSynlig = (el, x) => !el.synlig || !!el.synlig(x, D);

/* Går gjennom elementene, også inni grupper, med synlighet for hvert. */
function gjennomgaa(elementer, x, cb, foreldreSynlig = true, sti = 'e') {
  elementer.forEach((el, i) => {
    const s = `${sti}${i}`;
    const vis = foreldreSynlig && elSynlig(el, x);
    cb(el, vis, s);
    if (el.type === 'gruppe') gjennomgaa(el.elementer, x, cb, vis, `${s}_`);
  });
}

/* ═══ Skjulte felt tømmes, og kommer tilbake om de blir synlige ══════ */

/* Et felt kan stå i flere steg, som garasjen i begge «Velg tiltak».
   Det tømmes bare når det er skjult i alle stegene det står i. */
function rens() {
  for (let runde = 0; runde < 4; runde++) {
    let endret = false;
    const synlige = new Set();
    const alle = new Set();
    for (const s of SKJEMA_STEG) {
      if (s.utkast) continue;
      gjennomgaa(s.elementer, D, (el, vis) => {
        if (el.type === 'beregnet') {
          const v = vis && stegSynlig(s) ? el.verdi(D) : undefined;
          if (v === undefined) { if (el.felt in D) { delete D[el.felt]; endret = true; } }
          else if (D[el.felt] !== v) { D[el.felt] = v; endret = true; }
          return;
        }
        if (!FELTTYPER.includes(el.type) || !el.felt) return;
        alle.add(el.felt);
        if (vis && stegSynlig(s)) synlige.add(el.felt);
      });
    }
    for (const felt of alle) {
      if (!synlige.has(felt) && felt in D) {
        M.backup[felt] = D[felt]; delete D[felt]; endret = true;
      } else if (synlige.has(felt) && !(felt in D) && felt in M.backup) {
        D[felt] = M.backup[felt]; delete M.backup[felt]; endret = true;
      }
    }
    if (!endret) break;
  }
}

/* ═══ Validering ══════════════════════════════════════════════════ */

function validerFelt(el, x) {
  const v = x[el.felt];
  if (tom(v)) return el.valgfri ? null : (tx(el.feil, x) || 'Du må svare på dette spørsmålet.');
  const s = String(v).replace(/[\s ]/g, '');
  switch (el.type) {
    case 'tall':
      if (/^-/.test(s)) return 'Verdien kan ikke være negativ.';
      if (!/^\d+$/.test(s)) return tx(el.feilTall, x) || 'Verdien må være et tall';
      if (el.min != null && num(s) < el.min) return tx(el.feilMin || el.feil, x);
      if (el.maks != null && num(s) > el.maks) return tx(el.feilMaks, x);
      break;
    case 'belop':
      if (/[.,]/.test(s)) return 'Skriv beløpet i hele kroner, uten desimaler.';
      if (/^-/.test(s)) return 'Verdien kan ikke være negativ.';
      if (!/^\d+$/.test(s)) return 'Verdien må være et tall';
      if (el.min != null && num(s) < el.min) return tx(el.feilMin || el.feil, x);
      break;
    case 'avkrysning':
      if (el.min && v.length < el.min) return tx(el.feilMin || el.feil, x);
      break;
    case 'tekstfelt':
    case 'tekstomrade':
      if (el.maks && String(v).length > el.maks) return tx(el.feilMaks, x);
      break;
    case 'dato': {
      const idag = new Date().toISOString().slice(0, 10);
      if (el.fremtid && v < idag) return tx(el.feilMin, x);
      break;
    }
    case 'kommune':
      if (!LAN_KOMMUNER.some(k => k.nr === v)) return tx(el.feil, x);
      break;
  }
  return el.valider ? el.valider(v, x, D) || null : null;
}

/* Feil i ett steg: [{sti, felt, melding}] */
function feilForSteg(s) {
  const x = kilde(s);
  const feil = [];
  gjennomgaa(s.elementer, x, (el, vis, sti) => {
    if (!vis) return;
    if (FELTTYPER.includes(el.type) && el.felt) {
      const m = validerFelt(el, x);
      if (m) feil.push({ sti, felt: el.felt, melding: m });
    } else if (el.type === 'gruppe' && el.valider) {
      const m = el.valider(x, D);
      if (m) feil.push({ sti, felt: null, melding: tx(m, x), gruppe: true });
    }
  });
  return feil;
}

/* ═══ Lagring ═════════════════════════════════════════════════════ */

function lagre(straks = false) {
  M.sistLagret = new Date().toISOString();
  T.soknad.endret = M.sistLagret;
  const skriv = () => {
    lanSkriv(T);
    const p = document.getElementById('sist-lagret');
    if (p) p.textContent = `Sist lagret ${lanTidSek(new Date(M.sistLagret))}`;
  };
  clearTimeout(lagreTimer);
  if (straks) skriv(); else lagreTimer = setTimeout(skriv, 400);
}

/* ═══ Byggeklosser for HTML ═══════════════════════════════════════ */

const feltId = felt => `f-${String(felt).replace(/[^\w]/g, '-')}`;

function panel(variant, html, ikon = false) {
  const i = ikon ? (variant === 'bla' ? LAN_IKON.info : ikon) : '';
  return `<div class="lan-panel lan-panel--${variant}${i ? ' lan-panel--ikon' : ''}">${i}${i ? `<div>${html}</div>` : html}</div>`;
}

function vedleggskravPanel(labels) {
  if (!labels.length) return '';
  return `<div class="lan-panel lan-panel--gra lan-vedleggskrav">${LAN_IKON.binders}<div>
    <p>Senere i søknaden ber vi deg laste opp:</p>
    <ul class="lan-mb0">${labels.map(l => `<li>${l}</li>`).join('')}</ul></div></div>`;
}

function hjelp(el, x, id) {
  const b = tx(el.beskrivelse, x);
  return b ? `<span class="lan-felt__hjelp" id="${id}-hjelp">${b}</span>` : '';
}

function feltHtml(el, x) {
  const id = feltId(el.felt);
  const v = x[el.felt];
  const label = tx(el.label, x);
  const beskrivelse = hjelp(el, x, id);
  const aria = `aria-describedby="${el.beskrivelse ? `${id}-hjelp ` : ''}${id}-feil${el.advarsel ? ` ${id}-advarsel` : ''}"`;
  const feil = `<div class="lan-feilmelding" id="${id}-feil" hidden></div>${el.advarsel
    ? `<div class="lan-advarsel" id="${id}-advarsel" role="status" hidden></div>` : ''}`;

  const valgliste = (valg, type, erValgt) => valg.map((o, i) => `
      <label class="lan-valg">
        <input type="${type}" name="${id}" id="${id}-${i}" value="${lanEsc(o.v)}" ${erValgt(o.v) ? 'checked' : ''}>
        <span class="lan-valg__tekst"><span>${tx(o.l, x)}</span>${o.b ? `<span class="lan-valg__beskrivelse">${tx(o.b, x)}</span>` : ''}</span>
      </label>`).join('');

  switch (el.type) {
    case 'janei':
      return `<fieldset class="lan-felt" data-felt="${el.felt}" data-type="janei" ${aria}>
        <legend>${label}</legend>${beskrivelse}
        <div class="lan-valgliste">${valgliste([{ v: 'ja', l: el.ja || 'Ja' }, { v: 'nei', l: el.nei || 'Nei' }], 'radio',
          k => (k === 'ja' ? v === true : v === false))}</div>${feil}</fieldset>`;
    case 'radio':
      return `<fieldset class="lan-felt" data-felt="${el.felt}" data-type="radio" ${aria}>
        <legend>${label}</legend>${beskrivelse}
        <div class="lan-valgliste${el.rad ? ' lan-valgliste--rad' : ''}">${valgliste(el.valg, 'radio', k => v === k)}</div>${feil}</fieldset>`;
    case 'avkrysning':
      return `<fieldset class="lan-felt" data-felt="${el.felt}" data-type="avkrysning" ${aria}>
        <legend>${label}</legend>${beskrivelse}
        <div class="lan-valgliste">${valgliste(el.valg, 'checkbox', k => Array.isArray(v) && v.includes(k))}</div>${feil}</fieldset>`;
    case 'tekstomrade':
      return `<div class="lan-felt" data-felt="${el.felt}" data-type="tekstomrade">
        <label class="lan-felt__label" for="${id}">${label}</label>${beskrivelse}
        <textarea class="lan-textarea" id="${id}" ${aria}>${lanEsc(v ?? '')}</textarea>${feil}</div>`;
    case 'kommune': {
      const navn = (LAN_KOMMUNER.find(k => k.nr === v) || {}).navn || (v ?? '');
      return `<div class="lan-felt" data-felt="${el.felt}" data-type="kommune">
        <label class="lan-felt__label" for="${id}">${label}</label>${beskrivelse}
        <input class="lan-input lan-input--middels" id="${id}" list="${id}-liste" autocomplete="off" value="${lanEsc(navn)}" ${aria}>
        <datalist id="${id}-liste">${LAN_KOMMUNER.map(k => `<option value="${k.navn}"></option>`).join('')}</datalist>${feil}</div>`;
    }
    case 'dato':
      return `<div class="lan-felt" data-felt="${el.felt}" data-type="dato">
        <label class="lan-felt__label" for="${id}">${label}</label>${beskrivelse}
        <input class="lan-input lan-input--middels" type="date" id="${id}" value="${lanEsc(v ?? '')}"
          ${el.fremtid ? `min="${new Date().toISOString().slice(0, 10)}"` : ''} ${aria}>${feil}</div>`;
    case 'fil':
      return filHtml(el, x, id, feil);
    default: {
      const tall = el.type === 'tall' || el.type === 'belop';
      const verdi = el.type === 'belop' && /^\d+$/.test(String(v ?? '').replace(/\s/g, '')) ? lanTall(num(v)) : (v ?? '');
      const input = `<input class="lan-input ${el.type === 'tekstfelt' ? 'lan-input--middels' : 'lan-input--kort'}" id="${id}"
        ${tall ? 'inputmode="numeric"' : ''} ${el.autocomplete ? `autocomplete="${el.autocomplete}"` : ''} value="${lanEsc(verdi)}" ${aria}>`;
      const enhet = el.enhet || (el.type === 'belop' ? 'kroner' : '');
      return `<div class="lan-felt" data-felt="${el.felt}" data-type="${el.type}">
        <label class="lan-felt__label" for="${id}">${label}</label>${beskrivelse}
        ${enhet ? `<div class="lan-enhet">${input}<span class="lan-enhet__tekst">${tx(enhet, x)}</span></div>` : input}${feil}</div>`;
    }
  }
}

function filHtml(el, x, id, feil) {
  const filer = x[el.felt] || [];
  const detaljer = typeof el.detaljer === 'function' ? el.detaljer(x, D) : el.detaljer;
  return `<div class="lan-felt" data-felt="${el.felt}" data-type="fil">
    <h2 class="${el.liten ? 'lan-felt__label' : 'lan-h4 lan-mb0'}" id="${id}-tittel">${tx(el.label, x)}</h2>
    ${el.beskrivelse ? `<p class="lan-felt__hjelp lan-mb0" style="margin-top:var(--space-2)">${tx(el.beskrivelse, x)}</p>` : ''}
    ${detaljer && detaljer.length ? `<ul class="lan-sekundaer" style="margin-top:var(--space-2)">${detaljer.map(d => `<li>${tx(d, x)}</li>`).join('')}</ul>` : ''}
    <div class="lan-opplasting" data-slipp>
      <p class="lan-mb0" style="text-align:center">Dra og slipp filer her<br><span class="lan-sekundaer">eller</span></p>
      <p class="lan-mb0" style="text-align:center;margin-top:var(--space-2)">
        <label class="lan-knapp" for="${id}">${LAN_IKON.opplasting}Velg filer</label>
        <input type="file" id="${id}" multiple accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.doc,.docx,.odf,.xls,.xlsx,.ppt,.bim" aria-describedby="${id}-tittel ${id}-feil">
      </p>
      ${filer.length ? `<p class="lan-fet lan-mb0" style="margin-top:var(--space-4)">Filer (${filer.length})</p>
      <ul class="lan-filer">${filer.map(f => `
        <li class="lan-fil"><span class="lan-fil__navn">${LAN_IKON.fil}<span>${lanEsc(f.navn)} <span class="lan-sekundaer lan-liten">${storrelse(f.storrelse)}</span></span></span>
          <button type="button" class="lan-knapp lan-knapp--subtil" data-slett-fil="${f.id}" aria-label="Slett ${lanEsc(f.navn)}">${LAN_IKON.soppel}</button></li>`).join('')}</ul>` : ''}
    </div>${feil}</div>`;
}

const storrelse = b => (b >= 1048576 ? `${(b / 1048576).toFixed(2)} MB` : `${(b / 1024).toFixed(2)} KB`);

function elementHtml(el, x, sti) {
  if (FELTTYPER.includes(el.type)) return feltHtml(el, x);
  switch (el.type) {
    case 'ingress': return `<p class="lan-ingress">${tx(el.tekst, x)}</p>`;
    case 'tekst': return typeof el.html === 'function' ? el.html(x, D) : tx(el.html, x);
    case 'panel': return panel(el.variant || 'gra', typeof el.html === 'function' ? el.html(x, D) : tx(el.html, x), el.ikon);
    case 'lesmer': return lanLesMer(tx(el.tittel, x), typeof el.html === 'function' ? el.html(x, D) : tx(el.html, x));
    case 'vedleggskrav': return vedleggskravPanel(el.krav.map(id => VEDLEGGSKRAV.find(k => k.felt === id))
      .filter(k => k && k.synlig(x, D)).map(k => tx(k.label, x)));
    case 'egen': return `<div data-egen="${el.id}">${el.render(x, D, M)}</div>`;
    case 'gruppe': return `${el.tittel ? tx(el.tittel, x) : ''}${el.elementer.map((c, i) => wrap(c, x, `${sti}_${i}`)).join('')}
      <div class="lan-feilmelding" id="${sti}-feil" hidden></div>`;
    default: return '';
  }
}

/* Skjulte elementer bygges først når de blir synlige. */
function wrap(el, x, sti) {
  if (el.type === 'beregnet') return '';
  const endret = el.endret ? ` data-endret="${el.endret}"` : '';
  return elSynlig(el, x)
    ? `<div data-el="${sti}"${endret}>${elementHtml(el, x, sti)}</div>`
    : `<div data-el="${sti}"${endret} data-lat="1" hidden></div>`;
}

/* Advarsler under et felt, som vises mens man skriver. De stopper ikke
   Neste, de sier bare fra om at svaret ikke kvalifiserer til lånet. */
function visAdvarsler() {
  const s = stegMedId(aktiv);
  const x = kilde(s);
  gjennomgaa(s.elementer, x, (el, vis) => {
    if (!vis || !el.advarsel) return;
    const boks = document.getElementById(`${feltId(el.felt)}-advarsel`);
    if (!boks) return;
    const m = tom(x[el.felt]) ? null : el.advarsel(x[el.felt], x, D);
    boks.hidden = !m;
    boks.innerHTML = m ? `${LAN_IKON.feil}<span>${tx(m, x)}</span>` : '';
  });
}

/* ═══ Visning av ett steg ═════════════════════════════════════════ */

function forsteSynligeSteg() { return hovedrekke().find(stegSynlig); }

function renderSteg() {
  const s = stegMedId(aktiv);
  const x = kilde(s);
  const rot = document.getElementById('skjema');
  const erForste = forsteSynligeSteg() === s;
  const nesteTekst = s.nesteTekst ? s.nesteTekst(x, D, M) : 'Neste';

  rot.innerHTML = `
    <div id="steg-${s.id}">
      <h1 class="lan-h1">${tx(s.tittel, x)}</h1>
      <div id="steg-innhold">${s.elementer.map((el, i) => wrap(el, x, `e${i}`)).join('')}</div>
      <div id="feilliste"></div>
      <div class="lan-knapperad">
        <div class="lan-hovedknapper${erForste || s.blindvei ? ' lan-hovedknapper--en' : ''}">
          ${erForste ? '' : '<button type="button" class="lan-knapp" data-nav="forrige">Forrige</button>'}
          ${s.blindvei ? '' : `<button type="button" class="lan-knapp lan-knapp--prominent" data-nav="neste">${nesteTekst}</button>`}
        </div>
        ${M.harVaertPaaOppsummering && !s.utkast ? `<button type="button" class="lan-knapp lan-knapp--subtil" data-nav="oppsummering">Til oppsummeringen ${LAN_IKON.pilHoyre}</button>` : ''}
      </div>
    </div>
    ${fortsettSenere()}`;
  lanInitLesMer(rot);
  visAdvarsler();
  if (s.etterRender) s.etterRender(rot, x, api);
  if (M.visFeilVedAnkomst === s.id) {
    delete M.visFeilVedAnkomst;
    forsokt = true;
    visFeil(false);
  }
}

function fortsettSenere() {
  return `
    <div class="lan-fortsett-senere">
      <button type="button" class="lan-knapp lan-knapp--subtil" data-nav="senere">${LAN_IKON.hus}Fortsett senere</button>
    </div>
    <p class="lan-sist-lagret" id="sist-lagret">${M.sistLagret ? `Sist lagret ${lanTidSek(new Date(M.sistLagret))}` : ''}</p>`;
}

/* Etter hver endring: synlighet, levende paneler og feil. */
function oppdater() {
  rens();
  if (aktiv === 'oppsummering') return;
  const s = stegMedId(aktiv);
  const x = kilde(s);
  gjennomgaa(s.elementer, x, (el, vis, sti) => {
    const node = document.querySelector(`[data-el="${sti}"]`);
    if (!node) return;
    const synlig = elSynlig(el, x);
    node.hidden = !synlig;
    if (!synlig) return;
    if (node.dataset.lat || el.live || el.type === 'vedleggskrav' || el.type === 'egen') {
      delete node.dataset.lat;
      node.innerHTML = elementHtml(el, x, sti);
      lanInitLesMer(node);
    }
  });
  visAdvarsler();
  if (forsokt) visFeil(false);
}

function visFeil(flyttFokus) {
  const s = stegMedId(aktiv);
  const feil = feilForSteg(s);
  document.querySelectorAll('#steg-innhold .lan-felt--feil').forEach(n => n.classList.remove('lan-felt--feil'));
  document.querySelectorAll('#steg-innhold .lan-feilmelding').forEach(n => { n.hidden = true; n.textContent = ''; });

  feil.forEach(f => {
    const boks = f.gruppe ? document.getElementById(`${f.sti}-feil`) : document.getElementById(`${feltId(f.felt)}-feil`);
    if (boks) { boks.hidden = false; boks.innerHTML = `${LAN_IKON.feil}<span>${f.melding}</span>`; }
    const felt = !f.gruppe && document.querySelector(`#steg-innhold [data-felt="${f.felt}"]`);
    if (felt) felt.classList.add('lan-felt--feil');
  });

  const liste = document.getElementById('feilliste');
  if (!feil.length) { liste.innerHTML = ''; return; }
  liste.innerHTML = `
    <div class="lan-feilliste" aria-live="assertive">
      <h2 class="lan-h3" tabindex="-1" id="feilliste-tittel">For å gå videre må du rette opp i følgende feil:</h2>
      <ul aria-labelledby="feilliste-tittel">${feil.map(f => `<li><a href="#" data-til-felt="${f.felt || ''}" data-til-sti="${f.sti}">${f.melding}</a></li>`).join('')}</ul>
    </div>`;
  if (flyttFokus) {
    const h = document.getElementById('feilliste-tittel');
    h.scrollIntoView({ behavior: 'smooth', block: 'center' });
    h.focus({ preventScroll: true });
  }
}

/* ═══ Navigasjon ══════════════════════════════════════════════════ */

function nesteIRekke(id) {
  const rekke = hovedrekke();
  const i = rekke.findIndex(s => s.id === id);
  for (let j = i + 1; j < rekke.length; j++) if (stegSynlig(rekke[j])) return rekke[j].id;
  return 'oppsummering';
}

function forrigeIRekke(id) {
  const rekke = hovedrekke();
  const i = rekke.findIndex(s => s.id === id);
  for (let j = (i < 0 ? rekke.length : i) - 1; j >= 0; j--) if (stegSynlig(rekke[j]) && !rekke[j].blindvei) return rekke[j].id;
  return null;
}

function gaaTil(id, { erstatt = false } = {}) {
  aktiv = id;
  forsokt = false;
  M.sisteSteg = id;
  if (id === 'oppsummering') M.harVaertPaaOppsummering = true;
  lagre(true);
  const url = id === 'oppsummering' ? '?visning=oppsummering' : `?steg=${id}`;
  if (erstatt) history.replaceState(null, '', url); else history.pushState(null, '', url);
  render();
  window.scrollTo(0, 0);
  lanFokuserH1();
}

function neste() {
  const s = stegMedId(aktiv);
  const x = kilde(s);
  forsokt = true;
  if (feilForSteg(s).length) { visFeil(true); return; }
  const tvunget = s.vedNeste ? s.vedNeste(x, D, M, api) : null;
  rens();
  if (!s.utkast && !s.skipHistorikk) M.historikk.push(s.id);
  if (tvunget && tvunget.utkast) { startUtkast(tvunget.utkast); return; }
  gaaTil(tvunget || (s.neste && s.neste(x, D, M)) || nesteIRekke(s.id));
}

function forrige() {
  const s = aktiv === 'oppsummering' ? null : stegMedId(aktiv);
  if (s && s.utkast) {
    const fra = M.utkast.fra;
    M.utkast = null;
    gaaTil(fra);
    return;
  }
  let til = null;
  while (M.historikk.length && !til) {
    const kandidat = M.historikk.pop();
    if (kandidat !== aktiv && stegSynlig(kandidat)) til = kandidat;
  }
  if (!til) til = aktiv === 'oppsummering' ? forrigeIRekke('__slutt') : forrigeIRekke(aktiv);
  if (til) gaaTil(til);
}

/* Åpner et understeg for ett element i en liste (medlåntaker, barn). */
function startUtkast({ liste, indeks = null, fra, steg }) {
  const eksisterende = indeks != null ? (D[liste] || [])[indeks] : null;
  M.utkast = { liste, indeks, fra, ny: indeks == null, data: eksisterende ? { ...eksisterende } : {} };
  gaaTil(steg);
}

function lagreUtkast(ekstra = {}) {
  const u = M.utkast;
  const liste = D[u.liste] = D[u.liste] || [];
  const rad = { ...u.data, ...ekstra };
  if (u.indeks == null) liste.push(rad); else liste[u.indeks] = rad;
  M.utkast = null;
}

const api = { gaaTil, startUtkast, lagreUtkast, oppdater, lagre, stegSynlig, tx, num };

/* ═══ Oppsummering ════════════════════════════════════════════════ */

function formater(el, v, x) {
  if (tom(v)) return '<span class="lan-sekundaer">Ikke fylt ut</span>';
  switch (el.type) {
    case 'janei': return v ? 'Ja' : 'Nei';
    case 'radio': { const o = el.valg.find(o => o.v === v); return o ? tx(o.l, x) : lanEsc(v); }
    case 'avkrysning': {
      const l = v.map(k => { const o = el.valg.find(o => o.v === k); return o ? tx(o.l, x) : lanEsc(k); });
      return l.length === 1 ? l[0] : `<ul>${l.map(t => `<li>${t}</li>`).join('')}</ul>`;
    }
    case 'belop': return lanKr(num(v));
    case 'tall': return `${lanEsc(v)}${el.enhet ? ` ${tx(el.enhet, x)}` : ''}`;
    case 'dato': return lanDatoFraIso(v);
    case 'kommune': { const k = LAN_KOMMUNER.find(k => k.nr === v); return k ? `${k.navn} - ${k.nr}` : `Fant ikke kommunenavn - ${lanEsc(v)}`; }
    case 'fil': return v.length === 1 ? lanEsc(v[0].navn) : `<ul>${v.map(f => `<li>${lanEsc(f.navn)}</li>`).join('')}</ul>`;
    default: return lanEsc(v).replace(/\n/g, '<br>');
  }
}

function raderForSteg(s) {
  const rader = [];
  const feil = feilForSteg(s);
  gjennomgaa(s.elementer, D, (el, vis) => {
    if (!vis || el.oppsummering === false) return;
    if (FELTTYPER.includes(el.type) && el.felt) {
      const f = feil.find(f => f.felt === el.felt);
      rader.push({ label: tx(el.oppsLabel || el.label), verdi: formater(el, D[el.felt], D), feil: f && f.melding });
    } else if (el.type === 'beregnet' && el.label) {
      rader.push({ label: tx(el.label), verdi: el.enhet === 'kroner' ? lanKr(D[el.felt]) : lanEsc(D[el.felt]) });
    } else if (el.oppsummering) {
      rader.push(...el.oppsummering(D));
    }
  });
  return rader;
}

function alleFeil() {
  return hovedrekke().filter(stegSynlig).flatMap(s => feilForSteg(s).map(f => ({ ...f, steg: s.id })));
}

function renderOppsummering() {
  const rot = document.getElementById('skjema');
  const seksjoner = hovedrekke().filter(s => stegSynlig(s) && !s.blindvei).map(s => ({ s, rader: raderForSteg(s) })).filter(x => x.rader.length);
  const feil = alleFeil();

  rot.innerHTML = `
    <h1 class="lan-h1">Oppsummering</h1>
    <div class="lan-oppsummering">
      ${seksjoner.map(({ s, rader }) => `
        <section>
          <header class="lan-oppsummering__steg-topp">
            <h2 class="lan-h2 lan-mb0">${tx(s.tittel)}</h2>
            <button type="button" class="lan-knapp lan-knapp--lenke" data-gaa-til="${s.id}">${LAN_IKON.blyant}Endre<span class="lan-sr"> svar på ${tx(s.tittel)}</span></button>
          </header>
          <dl>${rader.map(r => `
            <div class="lan-oppsummering__rad"${r.feil ? ' style="border-left:6px solid var(--lan-feil-kant);padding-left:1rem"' : ''}>
              <dt>${r.label}</dt>
              <dd>${r.verdi}${r.feil ? `<p class="lan-mb0" style="color:var(--lan-feil);margin-top:var(--space-2)"><span class="lan-sr">Feilmelding: </span>${r.feil}</p>` : ''}</dd>
            </div>`).join('')}</dl>
        </section>`).join('')}
    </div>
    <div style="margin-top:var(--space-7)">
      ${feil.length ? `
        <div class="lan-feilliste">
          <h2 class="lan-h3" tabindex="-1" id="feilliste-tittel">For å gå videre må du rette opp i følgende feil:</h2>
          <ul>${feil.map(f => `<li><a href="#" data-feil-steg="${f.steg}">${f.melding}</a></li>`).join('')}</ul>
        </div>` : '<h2 class="lan-h2">Alt er klart til å sendes inn.</h2>'}
      <div class="lan-hovedknapper">
        <button type="button" class="lan-knapp" data-nav="forrige">Forrige</button>
        <button type="button" class="lan-knapp lan-knapp--prominent" data-nav="sendinn">Send inn ${LAN_IKON.send}</button>
      </div>
    </div>
    ${fortsettSenere()}`;
}

async function sendInn() {
  if (alleFeil().length) {
    const h = document.getElementById('feilliste-tittel');
    h.scrollIntoView({ behavior: 'smooth', block: 'center' });
    h.focus({ preventScroll: true });
    return;
  }
  const ferdig = lanSpinner('Vennligst vent, behandler søknaden.');
  await new Promise(r => setTimeout(r, 1200));
  T.soknad.status = 'innsendt';
  T.soknad.sendt = new Date().toISOString();
  lanSkriv(T);
  ferdig();
  location.href = 'bekreftelse.html';
}

/* ═══ Hendelser ═══════════════════════════════════════════════════ */

function lesVerdi(felt) {
  const type = felt.dataset.type;
  if (type === 'janei') { const r = felt.querySelector('input:checked'); return r ? r.value === 'ja' : undefined; }
  if (type === 'radio') { const r = felt.querySelector('input:checked'); return r ? r.value : undefined; }
  if (type === 'avkrysning') return [...felt.querySelectorAll('input:checked')].map(i => i.value);
  const input = felt.querySelector('input, textarea');
  if (type === 'kommune') {
    const k = LAN_KOMMUNER.find(k => k.navn.toLowerCase() === input.value.trim().toLowerCase());
    return k ? k.nr : input.value.trim() || undefined;
  }
  const v = type === 'tekstomrade' ? input.value : input.value.trim();
  return v === '' ? undefined : v;
}

function vedEndring(e) {
  const felt = e.target.closest('[data-felt]');
  if (!felt || felt.dataset.type === 'fil') return;
  const x = kilde(stegMedId(aktiv));
  const v = lesVerdi(felt);
  if (v === undefined) delete x[felt.dataset.felt]; else x[felt.dataset.felt] = v;
  lagre();
  oppdater();
}

async function leggTilFiler(felt, filer) {
  const x = kilde(stegMedId(aktiv));
  const liste = x[felt] = x[felt] || [];
  const godkjent = /\.(pdf|jpe?g|png|gif|bmp|tiff?|docx?|odf|xlsx?|ppt|bim)$/i;
  for (const f of filer) {
    let melding = null;
    if (f.size > 50 * 1048576) melding = 'Den valgte filen må være mindre enn 50 MB.';
    else if (f.size <= 2) melding = 'Den valgte filen kan ikke være tom.';
    else if (!godkjent.test(f.name)) melding = 'Den valgte filen må være PDF, JPG, BMP, PNG, TIF, DOC, ODF, XLS, PPT eller BIM.';
    if (melding) { await lanBekreft({ tittel: 'Filen ble ikke lastet opp', tekst: melding, bekreft: 'Lukk' }); continue; }
    liste.push({ id: Math.random().toString(36).slice(2, 10), navn: f.name, storrelse: f.size });
  }
  lagre();
  renderFilfelt(felt);
}

function renderFilfelt(felt) {
  const s = stegMedId(aktiv);
  const x = kilde(s);
  gjennomgaa(s.elementer, x, (el, vis, sti) => {
    if (el.felt !== felt) return;
    const node = document.querySelector(`[data-el="${sti}"]`);
    if (node) node.innerHTML = elementHtml(el, x, sti);
  });
  oppdater();
}

function kobleHendelser() {
  const rot = document.getElementById('skjema');
  rot.addEventListener('input', vedEndring);
  rot.addEventListener('change', e => {
    if (e.target.type === 'file') {
      const felt = e.target.closest('[data-felt]').dataset.felt;
      leggTilFiler(felt, [...e.target.files]);
      return;
    }
    vedEndring(e);
  });
  rot.addEventListener('focusout', e => {
    const felt = e.target.closest('[data-type="belop"]');
    if (felt && /^\d+$/.test(e.target.value.replace(/\s/g, ''))) e.target.value = lanTall(num(e.target.value));
  });
  rot.addEventListener('dragover', e => { if (e.target.closest('[data-slipp]')) e.preventDefault(); });
  rot.addEventListener('drop', e => {
    const sone = e.target.closest('[data-slipp]');
    if (!sone) return;
    e.preventDefault();
    leggTilFiler(sone.closest('[data-felt]').dataset.felt, [...e.dataTransfer.files]);
  });

  rot.addEventListener('click', async e => {
    const k = e.target.closest('button, a');
    if (!k) return;

    if (k.dataset.nav) {
      e.preventDefault();
      const nav = k.dataset.nav;
      if (nav === 'neste') neste();
      else if (nav === 'forrige') forrige();
      else if (nav === 'oppsummering') gaaTil('oppsummering');
      else if (nav === 'sendinn') sendInn();
      else if (nav === 'senere') {
        const ok = await lanBekreft({
          tittel: 'Vil du lagre og fortsette senere?',
          tekst: ['Din søknad blir midlertidig lagret.', 'Hvis du ikke sender inn søknaden innen 90 dager, vil den automatisk bli slettet.'],
          bekreft: 'Fortsett senere', avbryt: 'Avbryt'
        });
        if (ok) { lagre(true); location.href = 'index.html'; }
      }
      return;
    }
    if (k.dataset.gaaTil) { e.preventDefault(); gaaTil(k.dataset.gaaTil); return; }
    if (k.dataset.feilSteg) { e.preventDefault(); M.visFeilVedAnkomst = k.dataset.feilSteg; gaaTil(k.dataset.feilSteg); return; }
    if (k.dataset.tilSti) {
      e.preventDefault();
      const node = document.querySelector(`[data-el="${k.dataset.tilSti}"]`);
      const input = node && node.querySelector('input, textarea, select');
      if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (input) input.focus({ preventScroll: true });
      return;
    }
    if (k.dataset.slettFil) {
      const felt = k.closest('[data-felt]').dataset.felt;
      const x = kilde(stegMedId(aktiv));
      const fil = (x[felt] || []).find(f => f.id === k.dataset.slettFil);
      const ok = await lanBekreft({ tittel: `Er du sikker på at du vil slette "${lanEsc(fil.navn)}"?`, tekst: '', bekreft: 'Ja, slett filen', avbryt: 'Nei, avbryt', destruktiv: true });
      if (ok) {
        x[felt] = x[felt].filter(f => f.id !== fil.id);
        if (!x[felt].length) delete x[felt];
        lagre();
        renderFilfelt(felt);
      }
      return;
    }
    if (k.dataset.handling) {
      const s = stegMedId(aktiv);
      let el = null;
      gjennomgaa(s.elementer, kilde(s), c => { if (c.type === 'egen' && c.klikk && k.closest(`[data-egen="${c.id}"]`)) el = c; });
      if (el) { e.preventDefault(); await el.klikk(k.dataset.handling, k.dataset, api); }
    }
  });
}

/* ═══ Oppstart ════════════════════════════════════════════════════ */

function render() {
  if (aktiv === 'oppsummering') renderOppsummering(); else renderSteg();
  document.title = `${aktiv === 'oppsummering' ? 'Oppsummering' : tx(stegMedId(aktiv).tittel, kilde(stegMedId(aktiv))).replace(/&shy;|­/g, '')} | ${LAN_SKJEMANAVN}`;
}

/* Skrivebeskyttet oppsummering av en innsendt søknad («Se søknaden»). */
function innsendtStart() {
  T = lanTilstand();
  if (!T.soknad) { location.href = 'index.html'; return; }
  D = T.soknad.data;
  M = T.soknad.meta;
  lanMonter();
  const seksjoner = hovedrekke().filter(s => stegSynlig(s) && !s.blindvei).map(s => ({ s, rader: raderForSteg(s) })).filter(x => x.rader.length);
  document.getElementById('skjema').innerHTML = `
    <h1 class="lan-h1">${LAN_SKJEMANAVN}</h1>
    <div class="lan-oppsummering">${seksjoner.map(({ s, rader }) => `
      <section>
        <header class="lan-oppsummering__steg-topp"><h2 class="lan-h2 lan-mb0">${tx(s.tittel)}</h2></header>
        <dl>${rader.map(r => `<div class="lan-oppsummering__rad"><dt>${r.label}</dt><dd>${r.verdi}</dd></div>`).join('')}</dl>
      </section>`).join('')}</div>
    <p class="lan-mt"><a class="lan-knapp" href="min-soknad.html">Tilbake til søknaden</a></p>`;
}

function lesUrl() {
  const p = new URLSearchParams(location.search);
  if (p.get('visning') === 'oppsummering') return 'oppsummering';
  const id = p.get('steg');
  const s = id && stegMedId(id);
  if (!s) return M.sisteSteg || forsteSynligeSteg().id;
  if (s.utkast && !M.utkast) return s.utkastFra || forsteSynligeSteg().id;
  return id;
}

function skjemaStart() {
  T = lanTilstand();
  if (!T.soknad || T.soknad.status === 'innsendt') {
    location.href = T.soknad ? 'min-soknad.html' : 'informasjon.html';
    return;
  }
  D = T.soknad.data;
  M = T.soknad.meta;
  M.backup = M.backup || {};
  M.historikk = M.historikk || [];
  lanMonter();
  kobleHendelser();
  rens();
  aktiv = lesUrl();
  history.replaceState(null, '', aktiv === 'oppsummering' ? '?visning=oppsummering' : `?steg=${aktiv}`);
  render();
  window.addEventListener('popstate', () => { aktiv = lesUrl(); forsokt = false; render(); window.scrollTo(0, 0); });
}

/* Oppretter en ny søknad. Kalles fra «Start søknaden». */
function nySoknad() {
  const naa = new Date().toISOString();
  lanOppdater({ soknad: { status: 'pabegynt', opprettet: naa, endret: naa, data: {}, meta: { historikk: [], backup: {} } } });
}
