/* ──────────────────────────────────────────────────────────────────
   Versjonsvelger for prototypen av søknaden

   Samme boks som i papirsøknadene (../../assets/js/versjoner.js), men
   for en flyt med mange sider. Hver versjon er en egen mappe. Den siste
   ligger rett i lan-miljovennlig-bolig/, så lenker som er delt ut peker på
   det nyeste, og de eldre ligger frosset i v1/, v2/ og så videre. Alle
   versjonene laster denne fila, så lista står ett sted.

   Slik legger du til en ny versjon:
     1. Kopier sidene, assets/ og img/ til vN/, uten versjoner.js og
        versjoner.css. Rett stiene i kopien til ../../ds/ og
        ../assets/versjoner.*, som i v1/.
     2. Gi den nye versjonen sin egen LAN_LAGER i felles.js, så svarene
        ikke blandes mellom versjonene.
     3. Sett mappe: 'vN/' på den forrige versjonen her, og legg den nye
        nederst med mappe: ''.
     4. Sett data-versjon på <body> i alle sidene.

   Sidene sier selv hvilken versjon de er, med <body data-versjon="2">.

   Endringene i en versjon står i endringer. Nummeret er plassen i lista,
   og det samme nummeret settes på blokka det gjelder: data-endret="N" i
   sider.js, eller endret: N på elementet i steg.js. Bryteren «Vis
   endringene» markerer blokkene, og punktene i lista tar deg til dem.
   ────────────────────────────────────────────────────────────────── */

const LAN_VERSJONER = [
  {
    nr: 1,
    navn: 'Dagens løsning',
    dato: '28. september 2026',
    mappe: 'v1/'
  },
  {
    nr: 2,
    navn: 'Klimavennlig bolig',
    dato: '29. september 2026',
    mappe: '',
    endringer: [
      { side: 'hva-vil-du-soke-om.html', tekst: 'Lånet heter nå «Lån til å bygge klimavennlig bolig», med ny tekst om Husbankens klimakrav.' },
      { side: 'informasjon.html', tekst: 'Miljøvennlig er byttet med klimavennlig i tittelen og ellers i hele søknaden.' },
      { side: 'informasjon.html', tekst: 'Lånet er for boliger med lavt klimagassavtrykk, ikke lavt energiforbruk.' },
      { side: 'informasjon.html', tekst: 'Ny: «Dette skal til for å få lånet», med plassholdertekst.' },
      { side: 'informasjon.html', tekst: 'Klimabudsjett er lagt til i dokumentasjonen. Avsnittet om fleksibel planløsning er tatt ut.' },
      { side: 'soknad.html', steg: 'tiltak', tekst: 'Ny ingress: vi må vite om kjelleren er oppvarmet.' },
      { side: 'soknad.html', steg: 'tiltak', tekst: 'Ny gul varselboks om at grenseverdiene avhenger av kjelleren.' },
      { side: 'soknad.html', steg: 'tiltak', tekst: 'Oppvarmet kjeller erstatter valget mellom tiltak og sertifikat. Stegene «Velg tiltak» er borte.' },
      { side: 'soknad.html', steg: 'klimagassavtrykk', tekst: 'Nytt steg: klimagassavtrykk, med advarsel over 179, eller 232 med oppvarmet kjeller.' },
      { side: 'soknad.html', steg: 'klimagassbudsjett', tekst: 'Nytt steg: klimagassbudsjett etter NS 3720:2018, med advarsel hvis det mangler.' },
      { side: 'soknad.html', steg: 'boligsteg', tekst: 'BTA i stedet for BRA-i, og advarsel fra 1000 kvadratmeter.' },
      { side: 'soknad.html', steg: 'prosjektkostnadersteg', tekst: 'Klimarådgivning er med i prosjektkostnadene, bufferen og totalen.' },
      { side: 'soknad.html', steg: 'klimaraadgivningsteg', tekst: 'Nytt steg: kostnader til klimagassregnskap og -budsjett.' },
      { side: 'soknad.html', steg: 'vedleggsteg', tekst: 'Klimabudsjettet lastes opp her. Dokumentasjonen på byggeprosjektet kreves nå alltid.' },
      { side: 'soknad.html', steg: 'klimagassavtrykk', tekst: 'Ny forklaring: «Dette er kg CO₂-ekv./m² BTA», med utregning og eksempel.' }
    ]
  }
];

(function () {
  const kropp = document.body;
  const naa = Number(kropp.dataset.versjon);
  const gjeldende = LAN_VERSJONER.find(v => v.nr === naa);
  if (!gjeldende) return;
  const siste = LAN_VERSJONER[LAN_VERSJONER.length - 1];

  /* Rota er mappa over denne fila, der den siste versjonen ligger. En
     celle lenker til samme side i den andre versjonen. */
  const rotUrl = new URL('../', document.currentScript.src);
  const side = location.pathname.split('/').pop() || 'index.html';
  const lenke = v => new URL(v.mappe + side, rotUrl).href;

  const celler = LAN_VERSJONER.map(v => {
    const tittel = `Versjon ${v.nr}, ${v.navn}, ${v.dato}`;
    return v.nr === naa
      ? `<span class="versjoner__celle" aria-current="page" title="${tittel}">${v.nr}</span>`
      : `<a class="versjoner__celle" href="${lenke(v)}" title="${tittel}">${v.nr}</a>`;
  }).join('');

  const endringer = gjeldende.endringer || [];
  const punkter = endringer.map((e, i) => `
      <li><button type="button" data-endring="${i + 1}" title="${e.tekst}">
        <span class="nr">${i + 1}</span>
        <span class="tekst">${e.tekst}</span>
      </button></li>`).join('');

  const rot = document.createElement('nav');
  rot.className = 'versjoner';
  rot.setAttribute('aria-label', 'Versjoner av prototypen');
  rot.innerHTML = `
    <div class="versjoner__rad">
      <span class="versjoner__hint">Versjoner</span>
      <div class="versjoner__celler">${celler}</div>
    </div>
    <p class="versjoner__endring">
      <b>${gjeldende.nr}. ${gjeldende.navn}, ${gjeldende.dato}</b>
      ${naa !== siste.nr ? `<em class="versjoner__eldre">Dette er en eldre versjon.</em>
        <a href="${lenke(siste)}">Gå til den siste</a>.` : ''}
    </p>
    ${endringer.length ? `
      <label class="versjoner__bryter">
        <input type="checkbox" id="vis-endringer">
        <span class="versjoner__spor"></span>
        <span class="versjoner__bryter-tekst">Vis endringene
          <span class="versjoner__antall">(${endringer.length})</span>
        </span>
      </label>
      <ul class="versjoner__liste" hidden>${punkter}</ul>` : ''}`;

  /* Etter headeren, så skiplenken fortsatt er det første man tabber til */
  const topp = document.getElementById('lan-topp');
  if (topp) topp.after(rot); else kropp.prepend(rot);

  if (!endringer.length) return;

  /* Går til en markert blokk på siden. Ligger den inne i en lukket
     «les mer», åpnes den først. */
  function visEndring(nr) {
    document.querySelectorAll('[data-endret].er-valgt').forEach(m => m.classList.remove('er-valgt'));
    const el = document.querySelector(`[data-endret="${nr}"]:not([hidden])`);
    if (!el) return;
    const innhold = el.closest('.lan-lesmer__innhold');
    if (innhold && innhold.hidden) innhold.parentElement.querySelector('.lan-lesmer__knapp').click();
    el.classList.add('er-valgt');
    el.scrollIntoView({ block: 'center' });
  }

  const LAGER = 'lan-viser-endringer';
  const boks = rot.querySelector('#vis-endringer');
  const liste = rot.querySelector('.versjoner__liste');

  function tegn(paa) {
    kropp.classList.toggle('viser-endringer', paa);
    liste.hidden = !paa;
  }

  boks.addEventListener('change', () => {
    tegn(boks.checked);
    try { localStorage.setItem(LAGER, boks.checked ? '1' : '0'); } catch (e) { /* privat modus */ }
  });

  /* Endringen kan ligge på en annen side eller et annet steg. Innenfor
     skjemaet bytter vi steg direkte. Ellers går vi dit, med nummeret i
     adressen, og viser blokka når siden er tegnet. Et steg i skjemaet
     krever en påbegynt søknad, så den opprettes om den mangler. */
  liste.addEventListener('click', e => {
    const knapp = e.target.closest('[data-endring]');
    if (!knapp) return;
    const nr = Number(knapp.dataset.endring);
    const endring = endringer[nr - 1];
    const stegNaa = new URLSearchParams(location.search).get('steg');

    if (endring.side === side && (!endring.steg || endring.steg === stegNaa)) { visEndring(nr); return; }
    if (endring.side === side && typeof gaaTil === 'function') { gaaTil(endring.steg); visEndring(nr); return; }
    if (endring.side === 'soknad.html') {
      const s = lanTilstand().soknad;
      if (!s || s.status !== 'pabegynt') nySoknad();
    }
    location.href = `${endring.side}${endring.steg ? `?steg=${endring.steg}` : ''}#endring-${nr}`;
  });

  let paa = false;
  try { paa = localStorage.getItem(LAGER) === '1'; } catch (e) { /* privat modus */ }
  boks.checked = paa;
  tegn(paa);

  /* Skjemaet skriver om adressen når det starter, så nummeret leses nå */
  const maal = /^#endring-(\d+)$/.exec(location.hash);
  if (maal) {
    window.addEventListener('DOMContentLoaded', () => {
      visEndring(Number(maal[1]));
      history.replaceState(null, '', location.pathname + location.search);
    });
  }
})();
