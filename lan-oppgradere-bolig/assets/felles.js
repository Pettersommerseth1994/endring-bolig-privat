/* ──────────────────────────────────────────────────────────────────
   Felles for alle sidene i flyten: testpersoner, lagring, formatering,
   ikoner, header, footer og dialoger. Ingen backend. Alt som i dagens
   løsning hentes fra Folkeregisteret, KRR, Skatteetaten, Kartverket og
   renteoppslaget, er oppdiktede testdata her.
   ────────────────────────────────────────────────────────────────── */

const LAN_TJENESTE = 'Lån og tilskudd fra Husbanken';
const LAN_SKJEMANAVN = 'Søknad om lån til å bygge klimavennlig bolig';

/* ═══ Testpersoner ════════════════════════════════════════════════
   Byttes i stripa øverst. Alle navn og tall er oppdiktet.
   ─────────────────────────────────────────────────────────────────── */

const LAN_EIENDOM = {
  adresse: { gateadresse: 'Eksempelveien', gatenummer: 12, gatebokstav: 'B', matrikkelnummer: '0000-12/345' },
  boligtype: 'PRIMARBOLIG', eierskapsprosent: 50, eierskapsdetalj: ''
};

const LAN_TESTPERSONER = {
  gift: {
    navn: 'Gift, med barn og eiendom',
    person: {
      fornavn: 'Kari', etternavn: 'Nordmann', epost: 'kari.nordmann@example.no', mobil: '40000000',
      sivilstand: 'GIFT', fnr: '00000000000', harBarnUnder18: true,
      barn: [{ kjoenn: 'KVINNE', alder: 7 }, { kjoenn: 'MANN', alder: 4 }],
      ektefelle: { fornavn: 'Ola', etternavn: 'Nordmann', fnr: '00000000001', harMobil: true, harEpost: true, sivilstand: 'GIFT' }
    },
    inntekter: [
      { arbeidsgiver: 'Eksempel Bygg AS', stillingsprosent: ['100'], inntekttype: 'Lønn', inntekt: '612000' },
      { arbeidsgiver: 'NAV', stillingsprosent: [], inntekttype: 'Barnetrygd', inntekt: '36960' }
    ],
    eiendommer: [LAN_EIENDOM]
  },
  enslig: {
    navn: 'Enslig, uten barn og eiendom',
    person: {
      fornavn: 'Kari', etternavn: 'Nordmann', epost: 'kari.nordmann@example.no', mobil: '40000000',
      sivilstand: 'UGIFT', fnr: '00000000000', harBarnUnder18: false, barn: [], ektefelle: null
    },
    inntekter: [{ arbeidsgiver: 'Eksempel Bygg AS', stillingsprosent: ['100'], inntekttype: 'Lønn', inntekt: '548000' }],
    eiendommer: []
  },
  partnerUtenMobil: {
    navn: 'Registrert partner uten mobil i KRR',
    person: {
      fornavn: 'Kari', etternavn: 'Nordmann', epost: 'kari.nordmann@example.no', mobil: '40000000',
      sivilstand: 'REGISTRERTPARTNER', fnr: '00000000000', harBarnUnder18: false, barn: [],
      ektefelle: { fornavn: 'Eva', etternavn: 'Nordmann', fnr: '00000000002', harMobil: false, harEpost: true, sivilstand: 'REGISTRERTPARTNER' }
    },
    inntekter: [{ arbeidsgiver: 'Eksempel Bygg AS', stillingsprosent: ['80'], inntekttype: 'Lønn', inntekt: '495000' }],
    eiendommer: [LAN_EIENDOM]
  },
  utenKontaktinfo: {
    navn: 'Mangler mobil i KRR (blindvei)',
    person: {
      fornavn: 'Kari', etternavn: 'Nordmann', epost: 'kari.nordmann@example.no', mobil: null,
      sivilstand: 'UGIFT', fnr: '00000000000', harBarnUnder18: false, barn: [], ektefelle: null
    },
    inntekter: [],
    eiendommer: []
  }
};

const LAN_KOMMUNER = [
  ['0301', 'Oslo'], ['1103', 'Stavanger'], ['1108', 'Sandnes'], ['1507', 'Ålesund'], ['1804', 'Bodø'],
  ['3201', 'Bærum'], ['3203', 'Asker'], ['3301', 'Drammen'], ['3403', 'Hamar'], ['3905', 'Tønsberg'],
  ['4204', 'Kristiansand'], ['4601', 'Bergen'], ['5001', 'Trondheim'], ['5057', 'Ørland'], ['5501', 'Tromsø']
].map(([nr, navn]) => ({ nr, navn })).sort((a, b) => a.navn.localeCompare(b.navn, 'nb'));

const LAN_RENTE = { TERMINBELOEP_MAANED: 5.1, TERMINBELOEP_KVARTAL: 5.15 };

/* ═══ Lagring ═════════════════════════════════════════════════════ */

const LAN_LAGER = 'lan-klimavennlig-v2';

function lanLes() {
  try { return JSON.parse(localStorage.getItem(LAN_LAGER)) || {}; } catch { return {}; }
}
function lanSkriv(tilstand) {
  try { localStorage.setItem(LAN_LAGER, JSON.stringify(tilstand)); } catch { /* privat modus */ }
}
function lanTilstand() {
  const t = lanLes();
  if (!t.testperson || !LAN_TESTPERSONER[t.testperson]) t.testperson = 'gift';
  return t;
}
function lanOppdater(delta) {
  const t = { ...lanTilstand(), ...delta };
  lanSkriv(t);
  return t;
}
function lanTestdata() { return LAN_TESTPERSONER[lanTilstand().testperson]; }
function lanPerson() { return lanTestdata().person; }
function lanFulltNavn() { const p = lanPerson(); return `${p.fornavn} ${p.etternavn}`; }

/* ═══ Formatering ═════════════════════════════════════════════════ */

const lanTall = n => new Intl.NumberFormat('nb-NO').format(Math.round(Number(n) || 0));
const lanKr = n => `${lanTall(n)} kroner`;
const lanEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lanTo = n => String(n).padStart(2, '0');
const lanDato = d => `${lanTo(d.getDate())}.${lanTo(d.getMonth() + 1)}.${d.getFullYear()}`;
const lanDatoTid = d => `${lanDato(d)} - ${lanTo(d.getHours())}:${lanTo(d.getMinutes())}`;
const lanTidSek = d => `${lanDato(d)} kl. ${lanTo(d.getHours())}:${lanTo(d.getMinutes())}:${lanTo(d.getSeconds())}`;
const lanDatoFraIso = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; };

/* ═══ Ikoner ══════════════════════════════════════════════════════ */

const LAN_IKON = {
  pilHoyre: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m0 0l-6-6m6 6l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pilNed: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 9l7 7 7-7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  hus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.5 11 12 3.8l8.5 7.2M5.8 9.4V20h4.4v-5.5h3.6V20h4.4V9.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  send: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  blyant: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m4 20 1-4.5L16 4.5a2.1 2.1 0 0 1 3 3L8 18.5 4 20Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  soppel: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5M10 10v7M14 10v7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pluss: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  binders: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m20 11.5-7.8 7.8a5 5 0 0 1-7.1-7.1l8.3-8.3a3.3 3.3 0 0 1 4.7 4.7l-8.3 8.3a1.7 1.7 0 0 1-2.4-2.4l7.6-7.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  info: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7.6" r="1.15" fill="currentColor"/></svg>',
  varsel: '<svg width="24" height="24" viewBox="0 0 22 22" fill="none" aria-hidden="true"><path d="M11 2.06 20.94 19.94H1.06L11 2.06Z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 8.94v5.12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="11" cy="16.6" r=".9" fill="currentColor"/></svg>',
  feil: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 7v6.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17" r="1.3" fill="#fff"/></svg>',
  person: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  hake: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  fil: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 2.8h8l4.5 4.5V21H6V2.8Z M14 2.8V7.5h4.5" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  opplasting: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v4h16v-4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dokument: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 2.8h8l4.5 4.5V21H6V2.8Z M9 12h6M9 16h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  globus: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3Z" stroke="currentColor" stroke-width="1.7"/></svg>',
  utlogging: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

/* ═══ Topp og bunn ════════════════════════════════════════════════ */

function lanProtobar() {
  const t = lanTilstand();
  const valg = Object.entries(LAN_TESTPERSONER)
    .map(([id, p]) => `<option value="${id}" ${id === t.testperson ? 'selected' : ''}>${lanEsc(p.navn)}</option>`).join('');
  return `
<div class="lan-protobar">
  <span>Klikkbar kopi av dagens søknad · testdata, ingenting sendes</span>
  <label>Testperson <select id="lan-testperson">${valg}</select></label>
  <button type="button" id="lan-nullstill">Start på nytt</button>
</div>`;
}

function lanHeader() {
  return `
<a class="lan-skiplink" href="#hovedinnhold">Hopp til hovedinnhold</a>
${lanProtobar()}
<header class="lan-header">
  <div class="lan-header__rad">
    <a class="lan-header__logo" href="index.html">
      <img src="../ds/logo/husbanken-primary.png" alt="Husbanken">
      <span class="lan-header__tjeneste">${LAN_TJENESTE}</span>
    </a>
    <div class="lan-header__hoyre">
      <button type="button" class="lan-header__knapp" data-ikke-med="Nynorsk er ikke med i denne kopien. Tekstene er på bokmål.">${LAN_IKON.globus}<span>Språk</span></button>
      <span class="lan-header__bruker">${LAN_IKON.person}<span class="lan-header__navn">${lanEsc(lanFulltNavn())}</span></span>
      <button type="button" class="lan-header__knapp" data-ikke-med="Innlogging og utlogging er ikke med i denne kopien. Flyten starter som om du allerede er logget inn med BankID.">${LAN_IKON.utlogging}<span>Logg ut</span></button>
    </div>
  </div>
</header>`;
}

function lanFooter() {
  return `
<footer class="lan-footer">
  <div class="lan-footer__innhold">
    <h2>Om lån og tilskudd fra Husbanken</h2>
    <ul>
      <li><a href="https://www.husbanken.no/om-husbanken/personvern/" target="_blank" rel="noopener">Personvern</a></li>
      <li><a href="https://uustatus.no/" target="_blank" rel="noopener">Tilgjengelighetserklæring <span class="lan-sr">åpnes i nytt vindu</span></a></li>
    </ul>
    <p class="lan-footer__notat">Klikkbar gjenskaping av dagens selvbetjeningsløsning, laget for designarbeid.
      Ingen innlogging, ingen backend. Svarene lagres bare i denne nettleseren.</p>
  </div>
</footer>`;
}

function lanMonter() {
  const topp = document.getElementById('lan-topp');
  const bunn = document.getElementById('lan-bunn');
  if (topp) topp.innerHTML = lanHeader();
  if (bunn) bunn.innerHTML = lanFooter();

  const velger = document.getElementById('lan-testperson');
  if (velger) velger.addEventListener('change', () => {
    lanNullstill(velger.value);
    location.href = 'index.html';
  });
  const nullstill = document.getElementById('lan-nullstill');
  if (nullstill) nullstill.addEventListener('click', async () => {
    const ok = await lanBekreft({
      tittel: 'Starte på nytt?',
      tekst: 'Søknaden og alle svarene i denne kopien slettes fra nettleseren.',
      bekreft: 'Start på nytt', avbryt: 'Avbryt', destruktiv: true
    });
    if (ok) { lanNullstill(lanTilstand().testperson); location.href = 'index.html'; }
  });

  document.addEventListener('click', e => {
    const k = e.target.closest('[data-ikke-med]');
    if (!k) return;
    e.preventDefault();
    lanBekreft({ tittel: 'Ikke med i denne kopien', tekst: k.dataset.ikkeMed, bekreft: 'Lukk' });
  });
  lanInitLesMer(document);
}

function lanNullstill(testperson) {
  lanSkriv({ testperson });
}

/* ═══ Les mer ═════════════════════════════════════════════════════ */

let lanLesMerTeller = 0;
function lanLesMer(tittel, innhold) {
  const id = `lesmer-${++lanLesMerTeller}`;
  return `
<div class="lan-lesmer" data-lesmer>
  <button type="button" class="lan-lesmer__knapp" aria-expanded="false" aria-controls="${id}">${LAN_IKON.pilNed}<span>${tittel}</span></button>
  <div class="lan-lesmer__innhold" id="${id}" hidden>${innhold}</div>
</div>`;
}
function lanInitLesMer(rot) {
  rot.querySelectorAll('[data-lesmer]').forEach(boks => {
    if (boks.dataset.klar) return;
    boks.dataset.klar = '1';
    const knapp = boks.querySelector('.lan-lesmer__knapp');
    const panel = boks.querySelector('.lan-lesmer__innhold');
    knapp.addEventListener('click', () => {
      const aapen = knapp.getAttribute('aria-expanded') === 'true';
      knapp.setAttribute('aria-expanded', String(!aapen));
      panel.hidden = aapen;
    });
  });
}

/* ═══ Dialog og spinner ═══════════════════════════════════════════ */

function lanBekreft({ tittel, tekst, bekreft = 'OK', avbryt = null, destruktiv = false }) {
  return new Promise(resolve => {
    const d = document.createElement('dialog');
    d.className = 'lan-modal';
    d.setAttribute('aria-labelledby', 'lan-modal-tittel');
    const avsnitt = (Array.isArray(tekst) ? tekst : [tekst]).map(t => `<p>${t}</p>`).join('');
    d.innerHTML = `
      <h2 class="lan-h3" id="lan-modal-tittel">${tittel}</h2>
      ${avsnitt}
      <div class="lan-knappegruppe">
        <button type="button" class="lan-knapp ${destruktiv ? 'lan-knapp--destruktiv' : 'lan-knapp--prominent'}" data-svar="ja">${bekreft}</button>
        ${avbryt ? `<button type="button" class="lan-knapp" data-svar="nei">${avbryt}</button>` : ''}
      </div>`;
    document.body.appendChild(d);
    const lukk = svar => { d.close(); d.remove(); resolve(svar); };
    d.addEventListener('click', e => {
      const k = e.target.closest('[data-svar]');
      if (k) lukk(k.dataset.svar === 'ja');
    });
    d.addEventListener('cancel', e => { e.preventDefault(); lukk(false); });
    d.showModal();
  });
}

function lanSpinner(tekst) {
  const s = document.createElement('div');
  s.className = 'lan-spinner';
  s.innerHTML = `<div class="lan-spinner__hjul" role="alert"><span class="lan-sr">${tekst}</span></div>`;
  document.body.appendChild(s);
  return () => s.remove();
}

function lanFokuserH1() {
  const h1 = document.querySelector('main h1');
  if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
}
