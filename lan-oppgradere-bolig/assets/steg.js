/* ──────────────────────────────────────────────────────────────────
   Stegene i «Søknad om lån til å oppgradere bolig» for privatpersoner

   Bygget på OppgraderingSoknad i dagens løsning, med endringene fra
   Miro-tavla «Lån til endring av eksisterende bolig (privat)». Søkeren
   velger tilgjengelighet (flyt 1) eller energi, og energi deles i bedre
   energikarakter (flyt 2) og minst 30 prosent lavere energiforbruk
   (flyt 3). Det er her du endrer flyten.
   Hvert steg er et objekt:

     id, tittel        Stegets id i URL-en og overskriften
     synlig(d)         Når steget vises. Mangler den, vises steget alltid
     elementer         Innholdet, i rekkefølge
     neste(d)          Overstyrer hvilket steg som kommer etter
     vedNeste(d)       Kjøres når brukeren trykker Neste
     understeg         Ligger utenfor den vanlige rekkefølgen
     utkast            Understeg for ett element i en liste

   Elementtyper: ingress, tekst, panel, lesmer, vedleggskrav, gruppe,
   egen, beregnet, og feltene janei, radio, avkrysning, tekstfelt,
   tall, belop, dato, tekstomrade, kommune og fil. Et felt har felt,
   label, beskrivelse, feil og eventuelt synlig(d), valider(v, d),
   advarsel(v, d), min, maks, enhet og valgfri. advarsel gir en rød
   tekst under feltet mens man skriver, uten å stoppe Neste.

   endret: N merker elementet som endring nummer N i versjonsboksen,
   se versjoner.js.

   {du} {Du} {deg} {din} {Din} {dine} {ditt} {jeg} {Jeg} blir til
   flertall når søkeren låner sammen med noen.
   ────────────────────────────────────────────────────────────────── */

const P = () => lanPerson();
const ektefelle = () => P().ektefelle;
const erGift = () => ektefelle() && ektefelle().sivilstand === 'GIFT';
const har = (d, felt, verdi) => Array.isArray(d[felt]) && d[felt].includes(verdi);
const liste = (punkter, klasse = '') => `<ul class="${klasse}">${punkter.map(p => `<li>${p}</li>`).join('')}</ul>`;
const ekstern = (href, tekst) => `<a href="${href}" target="_blank" rel="noopener">${tekst} (åpnes i ny fane)</a>`;
const mobilGyldig = v => (String(v).replace(/\s/g, '').length !== 8 || !/^[49]\d{7}$/.test(String(v).replace(/\s/g, ''))
  ? 'Skriv et norsk mobilnummer, 8 siffer.' : null);

const heltall = v => /^\d+$/.test(String(v).replace(/\s/g, ''));

/* Veiene gjennom søknaden. Flytnumrene er de samme som på Miro-tavla. */
const erTilgjengelighet = d => d.tiltak === 'TILTAK_TILGJENGELIGHET';
const erEnergi = d => d.tiltak === 'TILTAK_ENERGI';
const erEnergikarakter = d => erEnergi(d) && d.energivei === 'ENERGIVEI_KARAKTER';
const erEnergiforbruk = d => erEnergi(d) && d.energivei === 'ENERGIVEI_FORBRUK';
const tiltakstype = d => (erEnergi(d) ? 'energieffektivisering' : 'tilgjengelighetstiltak');

/* Garasje gis bare til den som får bilstønad fra Nav */
const harGarasje = d => d['bolig.oenskergarasje'] === true && d['bolig.mottarstoettenavbil'] === true;

/* Spørsmålene om garasje står på «Velg tiltak» i både flyt 1 og energiveien.
   Om de skal være med på energiveien også, er et åpent spørsmål på tavla. */
const garasjeElementer = () => [
  { type: 'tekst', html: '<p>Hvis du har nedsatt funksjonsevne og mottar bilstønad fra Nav, kan du søke om at lånet også dekker bygging av garasje.</p>' },
  { type: 'janei', felt: 'bolig.oenskergarasje', label: 'Ønsker {du} å søke om lån til å bygge garasje?',
    beskrivelse: 'Du må kunne dokumentere at du mottar bilstønad fra Nav.', feil: 'Velg om {du} ønsker å søke om lån til å bygge garasje.' },
  { type: 'janei', felt: 'bolig.mottarstoettenavbil', synlig: d => d['bolig.oenskergarasje'] === true,
    label: 'Får du bilstønad fra Nav?', nei: 'Nei, det er ikke aktuelt for meg', feil: 'Velg om du får bilstønad fra Nav.' },
  { type: 'panel', variant: 'gul', synlig: d => d['bolig.mottarstoettenavbil'] === false,
    html: '<p class="lan-fet lan-mb0">Du kan ikke få lån til å bygge garasje</p><p>Kun mottakere av bilstønad fra Nav kan søke om lån til å bygge garasje samtidig med lån til å oppgradere boligen.</p>' }
];

const EIERSKAP = [
  { v: 'EIERSKAP_TOMT_JA', l: 'Ja, {jeg} eier tomten' },
  { v: 'EIERSKAP_TOMT_HAR_FESTEAVTALE', l: 'Nei, {jeg} har en festeavtale på tomten' },
  { v: 'EIERSKAP_TOMT_ANNET', l: 'Annet' }
];

/* Energikarakteren går fra A, som er best, til G. Boligen må ha C eller
   dårligere i dag. C, D og E må bli minst én karakter bedre, F og G minst
   to. Et svar som ikke holder, stopper ikke søkeren, men gir beskjed om at
   søknaden mest sannsynlig blir avslått. */
const KARAKTERER = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const KARAKTERVALG = [...KARAKTERER.map(k => ({ v: k, l: k })), { v: 'VET_IKKE', l: 'Vet ikke' }];

function energikarakterAvvik(d) {
  const foer = d['energi.karakterfoer'];
  const etter = d['energi.karakteretter'];
  if (!foer || !etter) return null;
  if (foer === 'VET_IKKE' || etter === 'VET_IKKE') {
    return 'Vi trenger energikarakteren før og etter oppgraderingen for å vurdere søknaden. En energirådgiver kan hjelpe {deg} med å finne den.';
  }
  const fra = KARAKTERER.indexOf(foer);
  const til = KARAKTERER.indexOf(etter);
  if (fra <= 1) return `Boligen har energikarakter ${foer} i dag. Vi gir bare lån til boliger som har energikarakter C eller dårligere før oppgraderingen.`;
  const krav = fra >= 5 ? 2 : 1;
  if (fra - til < krav) {
    return `Boliger med energikarakter ${foer} må bli minst ${krav === 2 ? 'to karakterer' : 'én karakter'} bedre, altså ${KARAKTERER[fra - krav]} eller bedre etter oppgraderingen.`;
  }
  return null;
}

const avslagPanel = melding => `<div class="lan-panel lan-panel--gul" role="status">
  <p class="lan-fet lan-mb0">Søknaden blir mest sannsynlig avslått</p>
  <p>${melding} {Du} kan likevel sende inn søknaden.</p></div>`;

const ANTALL_BILER = [
  { v: 'NONE', l: 'Ingen biler' }, { v: 'ONE', l: '1 bil' }, { v: 'TWO', l: '2 biler' }, { v: '3ORMORE', l: '3 eller flere biler' }
];

/* ═══ Beregninger ═════════════════════════════════════════════════ */

function bufferUtregning(d) {
  const v = felt => api.num(d[felt]);
  const valgtProsent = { TI_PROSENT: 10, FEM_PROSENT: 5, INGENTING: 0, ANNET: v('kostnader.bufferprosentannet') }[d['kostnader.bufferprosent']];
  const grunnlagFelt = [
    ['kostnader.oppgradering', 'oppgraderingskostnader'],
    ['kostnader.andreoppgraderinger', 'andre oppgraderinger'],
    ['kostnader.byggegarasje', 'byggekostnader (garasje)'],
    ['kostnader.energiraadgivning', 'energirådgiver'],
    ['kostnader.utendoersarbeid', 'utendørs arbeid'],
    ['kostnader.prosjektering', 'prosjektering, gebyr og avgifter'],
    ['kostnader.laanefinansiering', 'lånekostnader']
  ];
  const bufferGrunnlag = grunnlagFelt.reduce((sum, [f]) => sum + v(f), 0);
  const bufferVerdi = valgtProsent == null ? 0 : Math.round(bufferGrunnlag * (valgtProsent / 100));
  return {
    valgtProsent, bufferVerdi, bufferGrunnlag,
    grunnlagNavn: grunnlagFelt.filter(([f]) => v(f) > 0).map(([, n]) => n),
    totaleProsjektKostnader: bufferGrunnlag + bufferVerdi
  };
}

function terminbeloep(d) {
  const L = api.num(d['oekonomi.oensketlaanfrahusbanken']);
  const N = api.num(d['laan.nedbetalingstid']);
  const k = d['laan.terminbeloep'] === 'TERMINBELOEP_KVARTAL' ? 4 : 12;
  const R = LAN_RENTE[d['laan.terminbeloep']] ?? 1;
  const r = R / k / 100;
  const n = N * k;
  if (!L || !N || !n) return 0;
  if (d['laan.laanetype'] === 'LAANETYPE_ANNUITET') return Math.trunc(L * (r * (1 + r) ** n) / ((1 + r) ** n - 1));
  return Math.trunc(L / n + L * r);
}

/* ═══ Vedleggskrav, samlet fra hele søknaden ══════════════════════
   Stegene der kravet oppstår viser «Senere i søknaden ber vi deg
   laste opp». Selve opplastingen skjer i steget Vedlegg.
   ─────────────────────────────────────────────────────────────────── */

const valgtTiltak = d => !!d.tiltak;

const VEDLEGGSKRAV = [
  { felt: 'boligkvalitet.fasadeplansnittvedlegg', synlig: valgtTiltak,
    label: 'fasade-, snitt- og plan-tegninger', overskrift: 'Last opp fasade-, snitt- og plantegninger',
    detaljer: ['Tegninger av alle fasader i byggeprosjektet', 'Tegninger av typiske snitt i byggeprosjektet',
      'Plantegninger for alle etasjer i byggeprosjektet'],
    feil: 'Last opp fasade-, snitt- og plantegningene.' },
  { felt: 'boligkvalitet.situasjonsplanvedlegg', synlig: erTilgjengelighet,
    label: 'situasjonsplan', overskrift: 'Last opp situasjonsplanen',
    beskrivelse: 'Situasjonsplanen er et kart som viser bygningen det søkes om, med hovedmålet på bygningen og avstand til nærmeste grense tegnet inn.',
    feil: 'Last opp situasjonsplanen.' },
  { felt: 'boligkvalitet.byggebeskrivelsevedlegg', synlig: valgtTiltak,
    label: 'byggebeskrivelse', overskrift: 'Last opp byggebeskrivelsen',
    beskrivelse: 'En faglig beskrivelse av prosjektet fra den som skal utføre arbeidet.',
    feil: 'Last opp byggebeskrivelsen.' },
  { felt: 'boligkvalitet.kontraktvedlegg', synlig: erTilgjengelighet,
    label: 'kontrakt eller avtale med entreprenør', overskrift: 'Last opp kontrakten eller avtalen med entreprenøren',
    beskrivelse: 'For eksempel avtalen med firmaet som skal gjøre arbeidet eller en entreprise.',
    feil: 'Last opp kontrakten eller avtalen med entreprenøren.' },
  { felt: 'boligkvalitet.rammetillatelsevedlegg', synlig: erTilgjengelighet,
    label: 'rammetillatelse eller igangsettingstillatelse fra kommunen', overskrift: 'Last opp rammetillatelsen eller igangsettingstillatelsen fra kommunen.',
    beskrivelse: 'Før vi kan behandle søknaden, må prosjektet ha fått minst rammetillatelse eller igangsettingstillatelse fra kommunen.',
    feil: 'Last opp rammetillatelsen eller igangsettingstillatelsen fra kommunen.' },
  { felt: 'energi.energiattestvedlegg', synlig: erEnergikarakter, endret: 20,
    label: 'energiattest for boligen', overskrift: 'Last opp energiattesten for boligen',
    beskrivelse: 'Energiattesten viser energikarakteren boligen har i dag.',
    feil: 'Last opp energiattesten for boligen.' },
  { felt: 'energi.uttalelsevedlegg', synlig: erEnergiforbruk, endret: 20,
    label: 'uttalelse fra energirådgiver', overskrift: 'Last opp uttalelsen fra energirådgiveren',
    beskrivelse: 'Uttalelsen viser hvor mye energiforbruket i boligen går ned etter oppgraderingen.',
    feil: 'Last opp uttalelsen fra energirådgiveren.' },
  { felt: 'energi.effektregnskapvedlegg', synlig: erEnergiforbruk, endret: 20,
    label: 'effektregnskap etter NS 3031:2025', overskrift: 'Last opp effektregnskapet',
    beskrivelse: 'Effektregnskapet må være laget etter NS 3031:2025.',
    feil: 'Last opp effektregnskapet.' },
  { felt: 'bolig.mottarstoettenavbilvedlegg', synlig: harGarasje,
    label: 'dokumentasjon på bilstønad fra Nav', overskrift: 'Last opp dokumentasjon på bilstønad fra Nav',
    feil: 'Last opp dokumentasjon på bilstønad fra Nav.' },
  { felt: 'festeavtalevedlegg', synlig: d => d.eierskaptomt === 'EIERSKAP_TOMT_HAR_FESTEAVTALE',
    label: 'festeavtale', overskrift: 'Last opp festeavtalen', feil: 'Du må laste opp festeavtalen.' },
  { felt: 'oekonomi.andrelaanfinansieringvedlegg', synlig: d => d['oekonomi.planleggerlaanfraandre'] === true,
    label: 'dokumentasjon på andre lån som skal finansiere oppgraderingen', overskrift: 'Last opp dokumentasjon på andre lån som skal finansiere oppgraderingen',
    beskrivelse: 'For eksempel et tilsagnsbrev eller en bekreftelse fra banken, eller fra den som skal gi lånet hvis det er et privat lån, som viser',
    detaljer: ['lånebeløpet', 'renten', 'terminbeløpet'],
    feil: 'Du må laste opp dokumentasjon på andre lån som skal finansiere boligen.' },
  { felt: 'oekonomi.egenkapitalvedlegg', synlig: d => (d['oekonomi.egenkapital.kilde'] || []).length > 0,
    label: 'dokumentasjon på egenkapital', overskrift: 'Last opp dokumentasjon på egenkapital',
    detaljer: d => [
      har(d, 'oekonomi.egenkapital.kilde', 'EGENKAPITAL_OPPSPARTE_MIDLER') && 'Last opp et bilde fra nettbanken eller en kontoutskrift som viser beløp og hvem som eier kontoen.',
      har(d, 'oekonomi.egenkapital.kilde', 'EGENKAPITAL_SALG_BOLIG') && 'Last opp en enkel verdivurdering av eiendommen som skal selges, for eksempel en e-takst.',
      har(d, 'oekonomi.egenkapital.kilde', 'EGENKAPITAL_ANNET') && 'Last opp dokumentasjon som viser annen egenkapital. Hvis pengene kommer fra salg av fond, aksjer eller eiendeler, last opp et bilde fra nettbanken eller en kontoutskrift som viser beløp og hvem som eier kontoen. Hvis pengene er gave eller forskudd på arv, last opp gavebrev eller en erklæring fra den som ga deg pengene.'
    ].filter(Boolean),
    feil: 'Du må laste opp dokumentasjon på egenkapitalen.' },
  { felt: 'oekonomi.mottarbarnebidragvedlegg', synlig: d => d['familie.mottarbarnebidrag'] === true,
    label: 'dokumentasjon på hvor mye du får i barnebidrag', overskrift: 'Last opp dokumentasjon på hvor mye du får i barnebidrag',
    beskrivelse: 'For eksempel et bilde fra nettbanken eller en kontoutskrift som viser beløpet og hvem som eier kontoen. Det kan også være en signert avtale.',
    feil: 'Du må laste opp dokumentasjon på hvor mye du får i barnebidrag.' },
  { felt: 'oekonomi.andreinntektervedlegg', synlig: d => d['oekonomi.andreInntekter'] === true,
    label: 'dokumentasjon på andre inntekter enn lønn, pensjon eller Nav-ytelser', overskrift: 'Last opp dokumentasjon på andre inntekter enn lønn, pensjon eller Nav-ytelser',
    beskrivelse: 'For eksempel et bilde fra nettbanken eller en kontoutskrift som viser beløpet og hvem som eier kontoen. Hvis du har inntekt fra utleie, laster du opp utleieavtalen.',
    feil: 'Du må laste opp dokumentasjon på andre inntekter enn lønn, pensjon eller Nav-ytelser.' },
  { felt: 'oekonomi.gjeldvedlegg', synlig: d => d['oekonomi.harDuGjeld'] === true,
    label: 'dokumentasjon på gjelden din', overskrift: 'Last opp dokumentasjon på gjelden din',
    beskrivelse: 'For eksempel skjermbilder fra nettbanken eller en kopi av betalingsplanen som viser',
    detaljer: ['navnet ditt', 'restgjelden (eller lånebeløpet hvis det er et rammelån)', 'renten', 'terminbeløpet', 'navnet til långiveren (hvis det er et privat lån)'],
    feil: 'Du må laste opp dokumentasjon på gjelden din.' }
];

/* ═══ Medlåntakerlista ════════════════════════════════════════════ */

const medlantakere = d => d.laanetakereliste || [];
const laast = p => p.erPartnerEktefelle && p.harMobil;
const husholdningTekst = p => (p.borISammeHusholdning ? 'Skal bo i husholdningen når lånet er tatt opp.' : 'Skal ikke bo i husholdningen når lånet er tatt opp.');

const MEDLANTAKERLISTE = {
  type: 'egen', id: 'medlantakere',
  render: d => {
    const l = medlantakere(d);
    return `
      ${l.length ? `<ul class="lan-personliste">${l.map((p, i) => `
        <li class="lan-person">
          <dl>
            <dt>Navn</dt><dd>${lanEsc(p.fulltNavn)}</dd>
            ${p.erPartnerEktefelle ? '' : `<dt>Husholdning</dt><dd>${husholdningTekst(p)}</dd>`}
            ${p.mobil ? `<dt>Mobilnummer</dt><dd>${lanEsc(p.mobil)}</dd>` : ''}
          </dl>
          ${laast(p) ? '' : `<div class="lan-knappegruppe">
            <button type="button" class="lan-knapp lan-knapp--lenke" data-handling="endre" data-indeks="${i}">${LAN_IKON.blyant}Endre informasjonen<span class="lan-sr"> på ${lanEsc(p.fulltNavn)}</span></button>
            <button type="button" class="lan-knapp lan-knapp--lenke" data-handling="fjern" data-indeks="${i}">${LAN_IKON.soppel}Fjern fra søknaden<span class="lan-sr"> (${lanEsc(p.fulltNavn)})</span></button>
          </div>`}
        </li>`).join('')}</ul>` : ''}
      <p><button type="button" class="lan-knapp lan-knapp--subtil" data-handling="legg-til">${LAN_IKON.pluss}Legg til en medlåntaker</button></p>`;
  },
  klikk: async (handling, data, api) => {
    const i = Number(data.indeks);
    if (handling === 'legg-til') api.startUtkast({ liste: 'laanetakereliste', fra: 'medlaantakersteg3', steg: 'laanetaker1' });
    if (handling === 'endre') api.startUtkast({ liste: 'laanetakereliste', indeks: i, fra: 'medlaantakersteg3', steg: 'laanetaker1' });
    if (handling === 'fjern') {
      const navn = lanEsc(D.laanetakereliste[i].fulltNavn);
      const ok = await lanBekreft({
        tittel: `Vil du fjerne ${navn} fra søknaden?`,
        tekst: `${navn} blir ikke med videre i søknaden. Hvis du angrer, kan du legge til medlåntakeren igjen senere.`,
        bekreft: 'Fjern medlåntakeren fra søknaden', avbryt: 'Avbryt', destruktiv: true
      });
      if (ok) { D.laanetakereliste.splice(i, 1); api.lagre(); api.oppdater(); document.querySelector('main h1').textContent = medlantakerTittel(D); }
    }
  },
  oppsummering: d => medlantakere(d).map(p => ({
    label: 'Medlåntaker',
    verdi: [lanEsc(p.fulltNavn), p.erPartnerEktefelle ? '' : husholdningTekst(p), p.mobil ? lanEsc(p.mobil) : ''].filter(Boolean).join('<br>')
  }))
};

function medlantakerTittel(d) {
  const n = medlantakere(d).length;
  return n === 0 ? 'Du har ingen medlåntakere' : n === 1 ? 'Du har lagt til 1 medlåntaker' : `Du har lagt til ${n} medlåntakere`;
}

/* ═══ Barnelista ══════════════════════════════════════════════════ */

const barnTekst = b => [`${lanEsc(b.alder)} år`, b.harBarnDeltFastBosted ? 'Bor hele tiden i husholdningen' : 'Bor ikke hele tiden i husholdningen',
  b.harBarnDeltFastBosted === false && b.hvorMyeBorBarnetHosDere ? `${lanEsc(b.hvorMyeBorBarnetHosDere)} prosent` : ''].filter(Boolean);

const BARNELISTE = {
  type: 'egen', id: 'barn',
  render: d => {
    const l = (d.barn || []).map((b, i) => ({ b, i })).reverse();
    return `
      <p>${l.length ? `${l.length} barn er lagt til.` : 'Ingen barn er lagt til.'}</p>
      <p><button type="button" class="lan-knapp lan-knapp--subtil" data-handling="legg-til">${LAN_IKON.pluss}Legg til et barn</button></p>
      ${l.length ? `<ul class="lan-personliste">${l.map(({ b, i }) => `
        <li class="lan-person" style="background:var(--lan-gra);border:0">
          <dl>
            <dt>Alder</dt><dd>${lanEsc(b.alder)} år</dd>
            <dt>Bor barnet hele tiden i husholdningen?</dt><dd>${b.harBarnDeltFastBosted ? 'Ja' : 'Nei'}</dd>
            ${b.harBarnDeltFastBosted === false ? `<dt>${tx('Hvor mye av tiden bor barnet hos {deg}?')}</dt><dd>${lanEsc(b.hvorMyeBorBarnetHosDere)} prosent</dd>` : ''}
          </dl>
          <div class="lan-knappegruppe">
            <button type="button" class="lan-knapp lan-knapp--lenke" data-handling="endre" data-indeks="${i}">${LAN_IKON.blyant}Endre informasjonen<span class="lan-sr"> på barnet (${lanEsc(b.alder)} år)</span></button>
            <button type="button" class="lan-knapp lan-knapp--lenke" data-handling="fjern" data-indeks="${i}">${LAN_IKON.soppel}Fjern fra søknaden<span class="lan-sr"> barn (${lanEsc(b.alder)} år)</span></button>
          </div>
        </li>`).join('')}</ul>` : ''}`;
  },
  klikk: async (handling, data, api) => {
    const i = Number(data.indeks);
    if (handling === 'legg-til') api.startUtkast({ liste: 'barn', fra: 'barnsteg2', steg: 'barn01' });
    if (handling === 'endre') api.startUtkast({ liste: 'barn', indeks: i, fra: 'barnsteg2', steg: 'barn01' });
    if (handling === 'fjern') {
      const alder = lanEsc(D.barn[i].alder);
      const ok = await lanBekreft({
        tittel: `Vil du fjerne barnet (${alder} år) fra søknaden?`,
        tekst: `Barnet (${alder} år) blir ikke med videre i søknaden. Hvis du angrer, kan du legge til barnet igjen senere.`,
        bekreft: 'Fjern barnet fra søknaden', avbryt: 'Avbryt', destruktiv: true
      });
      if (ok) { D.barn.splice(i, 1); api.lagre(); api.oppdater(); }
    }
  },
  oppsummering: d => (d.barn || []).map(b => ({ label: 'Barn', verdi: barnTekst(b).join('<br>') }))
};

/* ═══ Stegene ═════════════════════════════════════════════════════ */

const SKJEMA_STEG = [

  /* ─── Kontaktinformasjon ─────────────────────────────────────── */
  {
    id: 'kontaktinfosteg',
    tittel: 'Kontakt&shy;informasjon',
    elementer: [
      { type: 'beregnet', felt: 'soeker.soekernavn', label: 'Navn', verdi: () => lanFulltNavn() },
      { type: 'beregnet', felt: 'soeker.soekermobil', label: 'Mobilnummer', verdi: () => P().mobil || undefined },
      { type: 'beregnet', felt: 'soeker.soekerepost', label: 'E-postadresse', verdi: () => P().epost || undefined },
      { type: 'ingress', tekst: 'Sjekk at kontakt&shy;informasjonen din er riktig. En rådgiver vil bruke den til å kontakte deg så snart vi har vurdert søknaden.' },
      { type: 'panel', variant: 'gra', html: () => `
        <p>Fra Kontakt- og reservasjons&shy;registeret</p>
        <dl>
          ${P().mobil ? `<dt>Mobilnummer</dt><dd>${P().mobil}</dd>` : ''}
          ${P().epost ? `<dt>E-postadresse</dt><dd>${P().epost}</dd>` : ''}
        </dl>` },
      { type: 'tekst', html: `<p>Hvis kontaktinformasjonen ikke er riktig, må du endre denne i ${ekstern('https://minprofil.kontaktregisteret.no/', 'Kontakt- og reservasjonsregisteret')} før du sender inn søknaden.</p>` }
    ],
    neste: () => (!P().mobil || !P().epost ? 'kontaktinfomangler' : null)
  },
  {
    id: 'kontaktinfomangler', understeg: true, blindvei: true,
    tittel: 'Før du kan gå videre, må du legge inn kontakt&shy;informasjonen din i Kontakt- og reservasjons&shy;registeret',
    elementer: [
      { type: 'ingress', tekst: 'Vi trenger kontakt&shy;informasjonen din for at en rådgiver skal kunne kontakte deg.' },
      { type: 'tekst', html: `<p>${ekstern('https://minprofil.kontaktregisteret.no/', 'Gå til Kontakt- og reservasjons&shy;registeret')}</p>
        <p>Når du har lagt inn kontakt&shy;informasjonen din, kan du gå tilbake hit for å fortsette på søknaden.</p>` }
    ]
  },

  /* ─── Medlåntaker ────────────────────────────────────────────── */
  {
    id: 'medlaantakersteg',
    tittel: 'Medlåntaker',
    elementer: [
      { type: 'ingress', tekst: () => (ektefelle()
        ? `Velg om du vil ta opp lånet sammen med ${erGift() ? 'ektefellen' : 'partneren'} din.`
        : 'En medlåntaker kan være en samboer, et familiemedlem eller andre som skal ta opp lånet sammen med deg.') },
      { type: 'panel', variant: 'gra', synlig: () => !!ektefelle(), html: () => `
        <p>Fra Folkeregisteret</p>
        <dl><dt>${erGift() ? 'Ektefelle' : 'Registrert partner'}</dt><dd>${lanEsc(ektefelle().fornavn)} ${lanEsc(ektefelle().etternavn)}</dd></dl>` },
      { type: 'panel', variant: 'bla', html: () => `
        <p class="lan-fet">${ektefelle() ? `Som medlåntaker vil ${lanEsc(ektefelle().fornavn)} ha like stort ansvar for lånet som deg` : 'En medlåntaker har like stort ansvar for lånet som deg'}</p>
        <p>Dere blir begge ansvarlige for at hele lånet blir tilbakebetalt.</p>` },
      { type: 'janei', felt: 'laanetakere.medEktefelle', synlig: () => !!ektefelle(),
        label: () => `Søker du om lån sammen med ${lanEsc(ektefelle().fornavn)}?`,
        ja: ektefelle() ? `Ja, legg til ${lanEsc(ektefelle().fornavn)} som en medlåntaker` : 'Ja',
        feil: 'Velg ja hvis dere skal søke lån sammen.' },
      { type: 'tekst', synlig: d => d['laanetakere.medEktefelle'] === true, html: () => {
        const n = lanEsc(ektefelle().fornavn);
        return `<p class="lan-sekundaer" style="margin-top:calc(-1 * var(--space-5));margin-bottom:var(--space-6)">Når søknaden er sendt inn, må ${n} logge inn og fylle ut et eget skjema. ${n} får se det du sender inn, unntatt det som handler om din personlige økonomi.</p>`;
      } },
      { type: 'janei', felt: 'laanetakere.sammenMedNoen',
        synlig: d => !ektefelle() || d['laanetakere.medEktefelle'] === false,
        label: () => (ektefelle() ? 'Søker du om lån sammen med noen andre?' : 'Vil du legge til en medlåntaker?'),
        beskrivelse: () => (ektefelle() ? 'For eksempel en slektning eller andre du vil ta opp lånet med.' : ''),
        nei: 'Nei, jeg søker alene',
        feil: 'Velg om du vil søke sammen med en medlåntaker.' }
    ],
    vedNeste: d => {
      const e = ektefelle();
      let l = medlantakere(d);
      if (d['laanetakere.medEktefelle'] === true && !l.some(p => p.erPartnerEktefelle)) {
        l = [{ erLagtTil: true, harEpost: e.harEpost, harMobil: e.harMobil, erPartnerEktefelle: true, fulltNavn: `${e.fornavn} ${e.etternavn}`, personnummer: e.fnr }, ...l];
      }
      if (d['laanetakere.medEktefelle'] !== true) l = l.filter(p => !p.erPartnerEktefelle);
      if (d['laanetakere.sammenMedNoen'] !== true) l = l.filter(p => p.erPartnerEktefelle);
      d.laanetakereliste = l;
      if (d['laanetakere.sammenMedNoen'] === true && !l.length) {
        return { utkast: { liste: 'laanetakereliste', fra: 'medlaantakersteg', steg: 'laanetaker1' } };
      }
      return null;
    }
  },
  {
    id: 'laanetaker1', understeg: true, utkast: true, utkastFra: 'medlaantakersteg',
    tittel: u => (u.erLagtTil ? 'Endre medlåntaker' : 'Legg til en medlåntaker'),
    nesteTekst: () => 'Neste',
    elementer: [
      { type: 'ingress', synlig: u => !u.erLagtTil, tekst: 'Medlåntakeren får se det du sender inn, unntatt det som handler om din personlige økonomi.' },
      { type: 'tekstfelt', felt: 'fulltNavn', synlig: u => !u.erLagtTil, label: 'Fullt navn', autocomplete: 'off',
        feil: 'Skriv inn fullt navn til personen du vil legge til.' },
      { type: 'panel', variant: 'gra', synlig: u => !!u.erLagtTil, html: u => `<dl><dt>Fullt navn</dt><dd>${lanEsc(u.fulltNavn)}</dd></dl>` },
      { type: 'tekstfelt', felt: 'personnummer', synlig: u => !u.erLagtTil, label: 'Fødselsnummer', beskrivelse: '11 siffer.',
        feil: 'Skriv fødselsnummeret til personen du vil legge til, 11 siffer.',
        valider: (v, u, d) => {
          const fnr = String(v).replace(/\s/g, '');
          if (!/^\d{11}$/.test(fnr)) return 'Skriv fødselsnummeret til personen du vil legge til, 11 siffer.';
          if (fnr === P().fnr) return 'Du kan ikke legge til deg selv som medlåntaker.';
          if (medlantakere(d).some((p, i) => p.personnummer === fnr && i !== M.utkast.indeks)) return 'Personen med dette fødselsnummeret er allerede lagt til som medlåntaker.';
          return null;
        } },
      { type: 'tekstfelt', felt: 'mobil', synlig: u => u.harMobil !== true, label: 'Mobilnummer', beskrivelse: '8 siffer.', autocomplete: 'off',
        feil: 'Skriv mobilnummeret til medlåntakeren, 8 siffer.', valider: mobilGyldig },
      { type: 'janei', felt: 'borISammeHusholdning', synlig: u => !u.erPartnerEktefelle,
        label: 'Skal dere bo i samme husholdning når lånet er tatt opp?',
        feil: 'Velg om dere skal bo i samme husholdning etter at lånet er tatt opp.' },
      { type: 'panel', variant: 'bla', synlig: u => !u.erLagtTil, html: `<p class="lan-fet">Medlåntakeren må gi sitt samtykke</p>
        <p>Når du sender inn søknaden, får medlåntakeren en SMS med beskjed om å logge inn og fylle ut et eget skjema.</p>` }
    ],
    vedNeste: (u, d, m, api) => { api.lagreUtkast({ erLagtTil: true }); return 'medlaantakersteg3'; }
  },
  {
    id: 'medlaantakersteg2', skipHistorikk: true,
    synlig: d => d['laanetakere.medEktefelle'] === true && !!ektefelle() && !ektefelle().harMobil,
    tittel: () => `Kontaktinformasjon ${erGift() ? 'ektefelle' : 'partner'}`,
    elementer: [
      { type: 'tekstfelt', felt: 'laanetakere.ektefellemobil', label: 'Mobilnummer til ektefelle', autocomplete: 'off',
        feil: 'Skriv mobilnummeret til medlåntakeren, 8 siffer.', valider: mobilGyldig }
    ],
    vedNeste: d => {
      const p = medlantakere(d).find(p => p.erPartnerEktefelle);
      if (p) p.mobil = d['laanetakere.ektefellemobil'];
      return null;
    }
  },
  {
    id: 'medlaantakersteg3',
    synlig: d => d['laanetakere.medEktefelle'] === true || d['laanetakere.sammenMedNoen'] === true,
    tittel: medlantakerTittel,
    elementer: [
      MEDLANTAKERLISTE,
      { type: 'tekst', live: true, synlig: d => medlantakere(d).length > 0,
        html: d => `<p class="lan-sekundaer">Når du sender inn søknaden, får ${medlantakere(d).length === 1 ? 'medlåntakeren' : 'medlåntakerne'} en SMS med beskjed om å logge inn og fylle ut et eget skjema.</p>` },
      { type: 'panel', variant: 'bla', synlig: d => medlantakere(d).length === 0,
        html: '<p class="lan-fet">Er det bare deg som skal søke om dette lånet?</p><p>Hvis du går til neste steg vil svaret bli endret til at du ikke søker om lån sammen med noen.</p>' }
    ],
    vedNeste: d => {
      if (!medlantakere(d).length) {
        if (ektefelle()) d['laanetakere.medEktefelle'] = false;
        d['laanetakere.sammenMedNoen'] = false;
      }
      return null;
    }
  },

  /* ─── Tiltak ─────────────────────────────────────────────────── */
  {
    id: 'tiltak',
    tittel: 'Tiltak',
    elementer: [
      { type: 'ingress', endret: 5, tekst: '{Du} kan søke om lån til å oppgradere boligen på én av to måter: gjøre den mer tilgjengelig, eller gjøre den mer energieffektiv.' },
      { type: 'panel', variant: 'gul', ikon: LAN_IKON.varsel,
        html: `<p>Vi gir ikke lån til vanlig vedlikehold eller oppussing. For mer informasjon, se ${ekstern('https://husbanken.no/bransje/veileder-laan/lan-til-boligkvalitet/oppgradering-av-eksisterende-bolig/', 'Veileder for lån fra Husbanken')}.</p>` },
      { type: 'lesmer', endret: 6, tittel: 'Dette er kravene for å få lån', html: () => tx(`
        <p>{Du} må velge mellom å</p>
        <ul>
          <li>gjøre boligen mer tilgjengelig, med 1 eller flere av disse tiltakene:
            <ul><li>Trinnfri adkomstvei</li><li>Oppgradering av inngangsdør eller -parti</li><li>Overbygd inngangsparti med plass til vogn</li>
              <li>Endret inngangsplan</li><li>Terskelfrie døråpninger</li><li>Tilgjengelig bad</li><li>Andre tiltak som gir bedre tilgjengelighet</li></ul></li>
          <li>gjøre boligen mer energieffektiv, på en av disse måtene:
            <ul><li>forbedre energikarakteren. Boligen må ha energikarakter C eller dårligere i dag. Med C, D eller E må den bli minst én karakter bedre, og med F eller G minst to.</li>
              <li>redusere energiforbruket med minst 30 prosent. En energirådgiver må beregne reduksjonen.</li></ul></li>
        </ul>
        <p>Hvis {du} har vedtak om bilstønad fra Nav, kan {du} søke om lån til å bygge garasje sammen med de valgte tiltakene.</p>`) },
      { type: 'radio', felt: 'tiltak', endret: 7, label: 'Hva søker {du} om lån til?', beskrivelse: 'Du velger tiltakene på neste steg.',
        feil: 'Velg hva {du} søker om lån til.',
        valg: [
          { v: 'TILTAK_TILGJENGELIGHET', l: 'Gjøre boligen mer tilgjengelig', b: 'For eksempel trinnfri adkomst, terskelfrie døråpninger eller tilgjengelig bad.' },
          { v: 'TILTAK_ENERGI', l: 'Gjøre boligen mer energieffektiv', b: 'For eksempel etterisolering, nye vinduer eller varmepumpe.' }
        ] }
    ]
  },

  /* ─── Flyt 1: tilgjengelighet ─────────────────────────────────── */
  {
    id: 'tiltaktilgjengelighet',
    synlig: erTilgjengelighet,
    tittel: 'Velg tiltak',
    elementer: [
      { type: 'avkrysning', felt: 'tilgjengelighet.tiltak', endret: 8, label: 'Hvilke tiltak skal {du} gjennomføre?', beskrivelse: 'Velg minst 1.',
        feil: 'Velg hvilke tiltak {du} skal gjennomføre.',
        valg: [
          { v: 'TRINNFRI_ADKOMST', l: 'Trinnfri adkomstvei' },
          { v: 'INNGANGSPARTI', l: 'Oppgradering av inngangsdør eller -parti' },
          { v: 'OVERBYGD_INNGANG', l: 'Overbygd inngangsparti med plass til vogn' },
          { v: 'INNGANGSPLAN', l: 'Endret inngangsplan' },
          { v: 'TERSKELFRIE_DORER', l: 'Terskelfrie døråpninger' },
          { v: 'TILGJENGELIG_BAD', l: 'Tilgjengelig bad' },
          { v: 'ANNET', l: 'Annet' }
        ] },
      { type: 'tekstomrade', felt: 'tilgjengelighet.annet', endret: 8, synlig: d => har(d, 'tilgjengelighet.tiltak', 'ANNET'), maks: 1000,
        label: 'Beskriv tiltaket', feil: 'Beskriv tiltaket {du} skal gjennomføre.',
        feilMaks: 'Beskrivelsen av tiltaket må være på 1000 tegn eller mindre.' },
      ...garasjeElementer(),
      { type: 'vedleggskrav', krav: ['boligkvalitet.fasadeplansnittvedlegg', 'boligkvalitet.situasjonsplanvedlegg', 'boligkvalitet.byggebeskrivelsevedlegg',
        'boligkvalitet.kontraktvedlegg', 'boligkvalitet.rammetillatelsevedlegg', 'bolig.mottarstoettenavbilvedlegg'] }
    ]
  },

  /* ─── Flyt 2 og 3: energi ─────────────────────────────────────── */
  {
    id: 'tiltakenergi',
    synlig: erEnergi,
    tittel: 'Velg tiltak',
    elementer: [
      { type: 'radio', felt: 'energivei', endret: 9, label: 'Hvordan skal boligen bli mer energieffektiv?',
        feil: 'Velg om {du} skal forbedre energikarakteren eller redusere energiforbruket.',
        valg: [
          { v: 'ENERGIVEI_KARAKTER', l: 'Forbedre energikarakteren', b: 'Boligen må bli én eller to karakterer bedre, avhengig av karakteren i dag.' },
          { v: 'ENERGIVEI_FORBRUK', l: 'Redusere energiforbruket med minst 30 prosent', b: 'En energirådgiver må beregne hvor mye forbruket går ned.' }
        ] },
      { type: 'lesmer', endret: 9, tittel: 'Dette er forskjellen på energikarakter og redusert energiforbruk', html: () => tx(`
        <p><b>Energikarakteren</b> står på energiattesten for boligen og går fra A til G, der A er best. Den viser hvor mye energi boligen trenger sammenlignet med andre boliger, ut fra blant annet isolasjon, vinduer og oppvarming.</p>
        <p><b>Redusert energiforbruk</b> viser hvor mye mindre energi akkurat denne boligen bruker etter oppgraderingen. En energirådgiver beregner det i et effektregnskap.</p>
        <p>Velg energikarakter hvis oppgraderingen løfter boligen nok karakterer. Velg redusert energiforbruk hvis boligen bruker mye mindre energi, men ikke går opp nok karakterer.</p>`) },
      { type: 'panel', variant: 'bla', ikon: true, endret: 10, synlig: erEnergikarakter, html: `<p class="lan-fet">Vi anbefaler å bruke en energirådgiver</p>
        <p>En energirådgiver kan vurdere hvilke tiltak som gir best effekt, og hvilken energikarakter boligen kan få etter oppgraderingen. Det finnes også energikalkulatorer på nett som kan gi {deg} et anslag.</p>` },
      { type: 'panel', variant: 'bla', ikon: true, endret: 10, synlig: erEnergiforbruk, html: `<p class="lan-fet">{Du} må bruke en energirådgiver</p>
        <p>For å få lån må en energirådgiver beregne hvor mye energiforbruket i boligen går ned. {Du} laster opp uttalelsen fra energirådgiveren og effektregnskapet senere i søknaden.</p>` },
      { type: 'avkrysning', felt: 'energi.tiltak', endret: 11, label: 'Hvilke tiltak skal {du} gjennomføre?',
        beskrivelse: 'Her er noen vanlige tiltak. Velg de som passer, eller velg Annet og beskriv tiltaket.',
        feil: 'Velg hvilke tiltak {du} skal gjennomføre.',
        valg: [
          { v: 'ETTERISOLERE_VEGGER', l: 'Etterisolere yttervegger' },
          { v: 'ETTERISOLERE_TAK', l: 'Etterisolere tak eller loft' },
          { v: 'VINDUER_DORER', l: 'Bytte vinduer og ytterdører' },
          { v: 'VARMEPUMPE', l: 'Installere varmepumpe' },
          { v: 'VENTILASJON', l: 'Installere balansert ventilasjon med varmegjenvinning' },
          { v: 'ANNET', l: 'Annet' }
        ] },
      { type: 'tekstomrade', felt: 'energi.annet', endret: 11, synlig: d => har(d, 'energi.tiltak', 'ANNET'), maks: 1000,
        label: 'Beskriv tiltaket', feil: 'Beskriv tiltaket {du} skal gjennomføre.',
        feilMaks: 'Beskrivelsen av tiltaket må være på 1000 tegn eller mindre.' },
      ...garasjeElementer(),
      { type: 'vedleggskrav', endret: 12, krav: ['boligkvalitet.fasadeplansnittvedlegg', 'boligkvalitet.byggebeskrivelsevedlegg',
        'energi.energiattestvedlegg', 'energi.uttalelsevedlegg', 'energi.effektregnskapvedlegg', 'bolig.mottarstoettenavbilvedlegg'] }
    ]
  },
  {
    id: 'energimerkesteg',
    synlig: erEnergikarakter,
    tittel: 'Energimerke',
    elementer: [
      { type: 'ingress', endret: 13, tekst: 'For å vurdere om oppgraderingen gir stor nok forbedring, trenger vi å vite energimerket på boligen før og etter oppgraderingen.' },
      { type: 'radio', felt: 'energi.karakterfoer', rad: true, label: 'Hva er energimerket på boligen i dag?', valg: KARAKTERVALG,
        feil: 'Velg hva energimerket på boligen er i dag.' },
      { type: 'radio', felt: 'energi.karakteretter', rad: true, label: 'Hva blir energimerket etter oppgraderingen?', valg: KARAKTERVALG,
        feil: 'Velg hva energimerket blir etter oppgraderingen.' },
      { type: 'tekst', live: true, endret: 13, synlig: d => !!energikarakterAvvik(d), html: d => tx(avslagPanel(energikarakterAvvik(d)), d) },
      { type: 'lesmer', tittel: 'Dette er kravene til energimerket', html: `<ul class="lan-mb0">
          <li>Vi gir bare lån til boliger som har energikarakter C eller dårligere før oppgraderingen.</li>
          <li>Boliger med energikarakter C, D eller E må bli minst én karakter bedre.</li>
          <li>Boliger med energikarakter F eller G må bli minst to karakterer bedre.</li>
        </ul>` }
    ]
  },
  {
    id: 'energiforbruksteg',
    synlig: erEnergiforbruk,
    tittel: 'Redusert energiforbruk',
    elementer: [
      { type: 'ingress', endret: 14, tekst: 'For å få lån må oppgraderingen redusere energiforbruket i boligen med minst 30 prosent.' },
      { type: 'panel', variant: 'bla', ikon: true, endret: 14, html: '<p>{Du} må bruke en energirådgiver. Energirådgiveren beregner reduksjonen i et effektregnskap etter NS 3031:2025.</p>' },
      { type: 'tall', felt: 'energi.reduksjonprosent', endret: 14, enhet: 'prosent', maks: 100,
        label: 'Hvor mange prosent reduksjon i boligens energiforbruk forventer {du}?',
        beskrivelse: 'Tallet står i uttalelsen fra energirådgiveren.',
        feil: 'Skriv hvor mange prosent {du} forventer at energiforbruket går ned.',
        feilTall: 'Reduksjonen kan bare være tall, for eksempel 35.', feilMaks: 'Reduksjonen kan ikke være mer enn 100 prosent.' },
      { type: 'tekst', live: true, endret: 14, synlig: d => heltall(d['energi.reduksjonprosent'] ?? '') && api.num(d['energi.reduksjonprosent']) < 30,
        html: d => tx(avslagPanel('Energiforbruket må gå ned med minst 30 prosent for å få lån.'), d) }
    ]
  },

  /* ─── Eiendommen og boligen ──────────────────────────────────── */
  {
    id: 'gardogbruksnummersteg',
    tittel: 'Gårds- og bruksnummer',
    elementer: [
      { type: 'ingress', tekst: 'For å vite hvilken bolig {du} skal oppgradere, trenger vi gårds- og bruksnummeret til eiendommen.' },
      { type: 'kommune', felt: 'bolig.kommunenavn', label: 'Hvilken kommune ligger eiendommen i?',
        beskrivelse: 'Skriv navnet på kommunen og velg kommunen fra listen.', feil: 'Velg hvilken kommune eiendommen ligger i.' },
      { type: 'tall', felt: 'bolig.gnr', label: 'Gårdsnummer', feil: 'Skriv gårdsnummeret.', feilTall: 'Gårdsnummeret kan bare være tall, for eksempel 12.' },
      { type: 'tall', felt: 'bolig.bnr', label: 'Bruksnummer', feil: 'Skriv bruksnummeret.', feilTall: 'Bruksnummeret kan bare være tall, for eksempel 12.' },
      { type: 'tall', felt: 'bolig.festenr', label: 'Festenummer (valgfritt)', valgfri: true, feilTall: 'Festenummeret kan bare være tall, for eksempel 12.' },
      { type: 'tall', felt: 'bolig.seksjonsnr', label: 'Seksjonsnummer (valgfritt)', valgfri: true, feilTall: 'Seksjonsnummeret kan bare være tall, for eksempel 12.' },
      { type: 'tekst', html: `<p>Vet du ikke hva gårds- og bruksnummeret er? Du kan finne det ved å søke opp eiendommen i ${ekstern('https://eiendomsregisteret.kartverket.no/', 'Eiendomsregisteret')}</p>` }
    ]
  },
  {
    id: 'eiendomsteg',
    tittel: 'Eiendommen',
    elementer: [
      { type: 'radio', felt: 'eierskaptomt', label: 'Eier {du} tomten?', feil: 'Velg om {du} eier tomten.', valg: EIERSKAP },
      { type: 'tekstomrade', felt: 'eierskaptomtannet', synlig: d => d.eierskaptomt === 'EIERSKAP_TOMT_ANNET',
        label: 'Hva er situasjonen for tomten?', feil: 'Beskriv situasjonen for tomten.' },
      { type: 'vedleggskrav', krav: ['festeavtalevedlegg'] }
    ]
  },
  {
    id: 'boligsteg',
    tittel: 'Boligen',
    elementer: [
      { type: 'tall', felt: 'bolig.stoerrelse', enhet: 'kvadratmeter', min: 1,
        label: 'Hvor stor blir boligen innvendig, målt i kvadratmeter BRA-i?', feil: 'Skriv hvor stor boligen blir innvendig.',
        feilTall: 'Størrelsen på boligen kan bare være tall, for eksempel 84.' },
      { type: 'lesmer', tittel: 'Dette er BRA-i', html: '<p>BRA-i betyr internt bruksareal. Det er arealet innenfor ytterveggene i boligen, i alle etasjer. Innvendige vegger regnes med, men ikke boder og andre rom som ligger utenfor selve boligen.</p>' },
      { type: 'tall', felt: 'bolig.garasjestoerrelse', synlig: harGarasje, enhet: 'kvadratmeter', min: 1,
        label: 'Hvor stor blir garasjen innvendig, målt i kvadratmeter?', feil: 'Skriv hvor stor garasjen blir innvendig.',
        feilTall: 'Størrelsen på garasjen kan bare være tall, for eksempel 40.' },
      { type: 'avkrysning', felt: 'bolig.bruksomraade', label: 'Hvordan kommer {du} til å bruke boligen?',
        feil: 'Velg hvordan {du} kommer til å bruke boligen.',
        valg: [{ v: 'BRUKSOMRAADE_VI_SKAL_BO', l: '{Jeg} skal bo i den' }, { v: 'BRUKSOMRAADE_VI_SKAL_LEIE_UT', l: '{Jeg} skal leie den ut' }, { v: 'BRUKSOMRAADE_ANNET', l: 'Annet' }] },
      { type: 'belop', felt: 'bolig.hvisUtleieBeloep', synlig: d => har(d, 'bolig.bruksomraade', 'BRUKSOMRAADE_VI_SKAL_LEIE_UT'), min: 1,
        label: 'Hva forventer {du} å ha i leieinntekter i måneden?', feil: 'Skriv hvor mye {du} forventer å ha i leieinntekter i måneden.' },
      { type: 'tekstomrade', felt: 'bolig.hvisAnnet', synlig: d => har(d, 'bolig.bruksomraade', 'BRUKSOMRAADE_ANNET'), maks: 1000,
        label: 'Beskriv hvordan {du} kommer til å bruke boligen', feil: 'Skriv hvordan boligen vil bli brukt.',
        feilMaks: 'Beskrivelsen av hvordan boligen vil bli brukt må være på 1000 tegn eller mindre.' }
    ]
  },
  {
    id: 'byggeprosjektsteg',
    tittel: 'Byggeprosjektet',
    elementer: [
      { type: 'gruppe', elementer: [
        { type: 'dato', felt: 'bygginfo.forventetoppstartsdato', fremtid: true, label: 'Når forventer {du} at byggearbeidet starter?',
          beskrivelse: 'Usikker? Velg omtrent når {du} forventer at byggearbeidet starter.',
          feil: 'Velg når {du} forventer at byggearbeidet starter. Datoen kan være omtrentlig.',
          feilMin: 'Datoen for når {du} forventer at byggearbeidet starter må være i framtiden.' },
        { type: 'dato', felt: 'bygginfo.forventetfullfortdato', fremtid: true, label: 'Når forventer {du} at byggearbeidet er ferdig?',
          beskrivelse: 'Usikker? Velg omtrent når {du} forventer at byggearbeidet er ferdig.',
          feil: 'Velg når {du} forventer at byggearbeidet er ferdig. Datoen kan være omtrentlig.',
          feilMin: 'Datoen for når {du} forventer at byggearbeidet er ferdig må være i framtiden.' }
      ], valider: d => (d['bygginfo.forventetoppstartsdato'] && d['bygginfo.forventetfullfortdato'] && d['bygginfo.forventetoppstartsdato'] > d['bygginfo.forventetfullfortdato']
        ? 'Datoen for når {du} forventer at byggearbeidet er ferdig må være etter datoen for når byggearbeidet starter.' : null) },
      { type: 'janei', felt: 'bygginfo.prosjekttidligerevurdert', label: 'Har prosjektet {du} søker om blitt vurdert av Husbanken tidligere?',
        feil: 'Velg om prosjektet {du} søker om har blitt vurdert av Husbanken tidligere.' },
      { type: 'tekstfelt', felt: 'bygginfo.tidligeresaksnummer', synlig: d => d['bygginfo.prosjekttidligerevurdert'] === true, valgfri: true, maks: 32,
        label: 'Hva er saksnummeret? (valgfritt)', beskrivelse: 'For eksempel 01837261 eller 2024/2-32. Tips: Det står øverst i brev fra Husbanken.',
        feilMaks: 'Saksnummeret kan ikke være lenger enn 32 tegn.' }
    ]
  },

  /* ─── Prosjektkostnader ──────────────────────────────────────── */
  {
    id: 'prosjektkostnadersteg',
    tittel: 'Prosjektkostnader',
    elementer: [
      { type: 'ingress', tekst: 'I de neste stegene ber vi deg oppgi kostnadene {du} regner med for prosjektet. Summen av kostnadene påvirker hvor mye {du} kan få i lån.' },
      { type: 'panel', variant: 'bla', ikon: true, endret: 15, html: d => `
        <p>Du vil bli bedt om å fylle ut, hver for seg, kostnader til</p>
        ${liste(['oppgraderingskostnader', erEnergi(d) && 'energirådgiver', 'utendørs arbeid', 'prosjektering, gebyrer og avgifter', 'lånekostnader', 'buffer til uforutsette kostnader'].filter(Boolean))}
        <p>${tx('Oppgi både kostnader {du} regner med, og kostnader {du} allerede har betalt.')}</p>` },
      { type: 'tekst', html: '<p class="lan-sekundaer">Når {du} søker, må {du} ha et budsjett med prosjektkostnader, basert på kontrakt og pristilbud fra entreprenøren. Kontakt entreprenøren hvis {du} mangler noen av kostnadene.</p>' }
    ]
  },
  {
    id: 'oppgraderingskostnader',
    tittel: 'Oppgraderings&shy;kostnader',
    elementer: [
      { type: 'ingress', tekst: 'Skriv hvor store kostnader {du} regner med for å gjennomføre de valgte tiltakene.' },
      { type: 'belop', felt: 'kostnader.oppgradering', enhet: 'kroner inkludert mva.',
        label: 'Hvor store kostnader regner {du} med for oppgraderingen?',
        beskrivelse: 'Tips: {Du} kan få et anslag på kostnadene fra de som skal utføre arbeidet.',
        feil: 'Skriv hvor store kostnader {du} regner med for oppgraderingen.' },
      { type: 'belop', felt: 'kostnader.byggegarasje', enhet: 'kroner inkludert mva.', synlig: harGarasje,
        label: 'Hvor store kostnader regner {du} med for å bygge garasjen?', feil: 'Skriv hvor store kostnader {du} regner med for å bygge garasjen.' },
      { type: 'panel', variant: 'bla', ikon: true, endret: 16, html: d => tx(`<p>Lånet skal i all hovedsak gå til ${tiltakstype(d)}, men en begrenset del av lånet kan gå til andre oppgraderinger som gir boligen en moderne standard.</p>
        <p>Oppgi derfor alle kostnadene {du} har i prosjektet. Saksbehandleren vurderer de andre kostnadene i dialog med {deg}.</p>`, d) },
      { type: 'janei', felt: 'kostnader.harandreoppgraderinger', endret: 17,
        label: d => `Planlegger {du} å gjøre noe annet enn ${tiltakstype(d)} samtidig?`,
        beskrivelse: 'For eksempel nytt kjøkken eller nye overflater.',
        feil: 'Velg om {du} planlegger å gjøre andre oppgraderinger samtidig.' },
      { type: 'gruppe', synlig: d => d['kostnader.harandreoppgraderinger'] === true, elementer: [
        { type: 'belop', felt: 'kostnader.andreoppgraderinger', endret: 17, enhet: 'kroner inkludert mva.', min: 1,
          label: 'Hvor mye vil de andre oppgraderingskostnadene være?', feil: 'Skriv hvor mye de andre oppgraderingskostnadene vil være.' },
        { type: 'tekstomrade', felt: 'kostnader.andreoppgraderingerbeskrivelse', endret: 17, maks: 1000,
          label: 'Beskriv de andre oppgraderingene', beskrivelse: 'Skriv hva som skal gjøres, og gjerne hva beløpet er basert på.',
          feil: 'Beskriv de andre oppgraderingene.', feilMaks: 'Beskrivelsen må være på 1000 tegn eller mindre.' }
      ] }
    ]
  },
  {
    id: 'utendoerskostnader',
    tittel: 'Utendørs arbeid',
    elementer: [
      { type: 'ingress', tekst: 'Skriv hvor store kostnader {du} regner med for arbeid med terreng og tomt, inkludert vann, avløp, strøm og vei.' },
      { type: 'lesmer', tittel: 'Eksempler på kostnader', html: `${liste(['graving og planering', 'fjerning av masser, sprenging og drenering', 'tilkjøring av pukk og grus', 'opparbeiding av tomt, støttemurer og plen', 'vann, avløp, strøm og vei'])}
        <p>Ikke ta med offentlige gebyrer. Det kommer på et senere steg.</p>` },
      { type: 'belop', felt: 'kostnader.utendoersarbeid', enhet: 'kroner inkludert mva.',
        label: 'Hvor store kostnader regner {du} med for utendørs arbeid?', feil: 'Skriv hvor store kostnader {du} regner med for utendørs arbeid.' }
    ]
  },
  {
    id: 'energiraadgivningsteg',
    synlig: erEnergi,
    tittel: 'Kostnader til energi&shy;rådgiver',
    elementer: [
      { type: 'ingress', endret: 18, tekst: 'Skriv hvor store kostnader {du} regner med til energirådgiver, for eksempel for energiattest, uttalelse og effektregnskap.' },
      { type: 'belop', felt: 'kostnader.energiraadgivning', endret: 18, enhet: 'kroner inkludert mva.',
        label: 'Hvor store kostnader regner {du} med til energirådgiver?', beskrivelse: 'Hvis {du} ikke har kostnader til energirådgiver, skriv: 0',
        feil: 'Skriv hvor store kostnader {du} regner med til energirådgiver.' }
    ]
  },
  {
    id: 'prosjekteringsteg',
    tittel: 'Prosjektering, gebyrer og avgifter',
    elementer: [
      { type: 'ingress', tekst: 'Skriv hvor store kostnader {du} regner med for prosjektering og administrasjon.' },
      { type: 'lesmer', tittel: 'Eksempler på kostnader', html: `<ul>
          <li>arbeid med tegninger og søknader</li>
          <li>offentlige gebyrer, som${liste(['saksbehandlingsgebyr', 'tilknytningsgebyr', 'matrikkelgebyr'], 'lan-mb0')}</li>
          <li>byggestrøm</li><li>avfallshåndtering</li><li>uavhengig kontroll</li>
        </ul>` },
      { type: 'belop', felt: 'kostnader.prosjektering', enhet: 'kroner inkludert mva.',
        label: 'Hvor store kostnader regner {du} med for prosjektering, gebyrer og avgifter?',
        feil: 'Skriv hvor store kostnader {du} regner med for prosjektering, gebyrer og avgifter.' }
    ]
  },
  {
    id: 'lanekostnader',
    tittel: 'Lånekostnader',
    elementer: [
      { type: 'ingress', tekst: 'En del byggeprosjekter finansieres med byggelån eller annen finansiering. Har {du} det, kan {du} ta med rentekostnader og provisjon i prosjektkostnadene.' },
      { type: 'tekst', html: '<p style="margin-bottom:var(--space-6)">Tips: Spør banken om de kan gi et estimat.</p>' },
      { type: 'belop', felt: 'kostnader.laanefinansiering', beskrivelse: 'Hvis {du} ikke har lånekostnader, skriv: 0',
        label: 'Hvor store lånekostnader regner {du} med?', feil: 'Skriv hvor store lånekostnader {du} regner med.' }
    ]
  },
  {
    id: 'buffer',
    tittel: 'Buffer til uforutsette kostnader',
    elementer: [
      { type: 'ingress', tekst: 'Vi anbefaler å sette av 5–10 prosent av kostnadene til uforutsette utgifter i byggeperioden.' },
      { type: 'tekst', html: `<p class="lan-mb0">For eksempel</p>${liste(['en økning i kostnadene på grunn av økte priser', 'andre uforutsette kostnader'])}` },
      { type: 'radio', felt: 'kostnader.bufferprosent', label: 'Hvor mange prosent setter {du} av til uforutsette kostnader?',
        beskrivelse: 'Beløpet beregnes og vises under.', feil: 'Velg hvor mange prosent {du} setter av til uforutsette kostnader.',
        valg: [{ v: 'INGENTING', l: 'Ingenting' }, { v: 'FEM_PROSENT', l: '5 prosent' }, { v: 'TI_PROSENT', l: '10 prosent' }, { v: 'ANNET', l: 'Annen prosent' }] },
      { type: 'tall', felt: 'kostnader.bufferprosentannet', synlig: d => d['kostnader.bufferprosent'] === 'ANNET', enhet: 'prosent',
        label: 'Hvor mange prosent vil {du} sette av?', feil: 'Skriv hvor mange prosent {du} vil sette av til uforutsette kostnader.',
        feilTall: 'Prosenten {du} vil sette av kan bare være tall, for eksempel 12.' },
      { type: 'tekst', live: true, html: d => {
        const b = bufferUtregning(d);
        if (b.valgtProsent == null) return `<div class="lan-panel lan-panel--gra" role="status"><p class="lan-mb0">Buffer til uforutsette kostnader</p>
          <p class="lan-sekundaer">Velg en prosent for å se hvor mye det blir i kroner.</p></div>`;
        const navn = b.grunnlagNavn.includes('byggekostnader (hus)') && b.grunnlagNavn.includes('byggekostnader (garasje)')
          ? [...b.grunnlagNavn.filter(n => !n.startsWith('byggekostnader')), 'byggekostnader'] : b.grunnlagNavn;
        return `<div class="lan-panel lan-panel--${b.valgtProsent ? 'gronn' : 'gra'}" role="status">
          <p class="lan-mb0">Buffer til uforutsette kostnader</p>
          <p class="lan-stor-tall">${lanKr(b.bufferVerdi)}</p>
          ${b.bufferVerdi > 1 ? `<p style="margin-top:var(--space-3)">Bufferen er ${b.valgtProsent} prosent av kostnadene du har fylt ut til</p>${liste(navn, 'lan-mb0')}` : ''}
        </div>`;
      } },
      { type: 'beregnet', felt: 'kostnader.bufferVerdiOppsummering', label: 'Buffer til uforutsette kostnader', enhet: 'kroner',
        verdi: d => (bufferUtregning(d).valgtProsent == null ? undefined : bufferUtregning(d).bufferVerdi) },
      { type: 'tekst', live: true, synlig: d => (bufferUtregning(d).valgtProsent ?? 0) >= 30, html: d => `<div class="lan-panel lan-panel--gul">
        <p class="lan-fet lan-mb0">${bufferUtregning(d).valgtProsent} prosent er en stor buffer</p><p>Er du sikker på at det er riktig?</p></div>` }
    ]
  },
  {
    id: 'totaleprosjektkostnader',
    tittel: 'Totale prosjektkostnader',
    elementer: [
      { type: 'ingress', tekst: 'Sjekk at tallene er riktige før du går videre til neste steg.' },
      { type: 'panel', variant: 'gra', html: d => `<p class="lan-mb0">Totale prosjektkostnader inkludert buffer</p>
        <p class="lan-stor-tall">${lanKr(bufferUtregning(d).totaleProsjektKostnader)}</p>` },
      { type: 'panel', variant: 'bla', endret: 19, html: d => {
        const linjer = [
          ['Oppgraderingskostnader', d['kostnader.oppgradering'] ?? 0, true, 'oppgraderingskostnader'],
          ['Andre oppgraderinger', d['kostnader.andreoppgraderinger'], true, 'oppgraderingskostnader'],
          ['Bygge garasjen', d['kostnader.byggegarasje'], true, 'oppgraderingskostnader'],
          ['Energirådgiver', d['kostnader.energiraadgivning'], true, 'energiraadgivningsteg'],
          ['Utendørs arbeid', d['kostnader.utendoersarbeid'], true, 'utendoerskostnader'],
          ['Prosjektering, gebyrer og avgifter', d['kostnader.prosjektering'], true, 'prosjekteringsteg'],
          ['Lånekostnader', d['kostnader.laanefinansiering'] ?? 0, false, 'lanekostnader'],
          ['Buffer til uforutsette kostnader', bufferUtregning(d).bufferVerdi, false, 'buffer']
        ].filter(([, v]) => v != null);
        return `<p>Beløpet over er totalen av kostnadene på de forrige stegene:</p>
          ${linjer.map(([l, v, mva, steg], i) => `<div${i ? ' style="margin-top:var(--space-4)"' : ''}>
            <p class="lan-fet lan-mb0">${l}</p>
            <p class="lan-mb0">${lanKr(api.num(v))}${mva ? ' inkludert mva.' : ''}</p>
            <button type="button" class="lan-knapp lan-knapp--lenke" data-gaa-til="${steg}">Endre<span class="lan-sr"> svaret på ${l}</span></button>
          </div>`).join('')}`;
      } },
      { type: 'beregnet', felt: 'bygginfo.samledebyggekostnader', label: 'Totale prosjektkostnader inkludert buffer', enhet: 'kroner',
        verdi: d => bufferUtregning(d).totaleProsjektKostnader }
    ]
  },

  /* ─── Lån og egenkapital ─────────────────────────────────────── */
  {
    id: 'finansieringsteg',
    tittel: 'Lån og egenkapital',
    elementer: [
      { type: 'tekst', html: `<div class="lan-guide"><img src="img/hb-avatar-default.svg" alt="">
        <p>${'{Du} kan søke om lån på opptil 90 prosent av prosjekt&shy;kostnadene. Resten må {du} dekke med egenkapital eller andre lån.'}</p></div>` },
      { type: 'panel', variant: 'gra', html: d => `<p class="lan-fet lan-mb0">Totale prosjektkostnader</p><p>${lanKr(bufferUtregning(d).totaleProsjektKostnader)}</p>` },
      { type: 'belop', felt: 'oekonomi.oensketlaanfrahusbanken', min: 1, label: 'Hvor mye ønsker {du} å ta opp i lån fra Husbanken?', feil: 'Skriv ønsket lånebeløp.' },
      { type: 'belop', felt: 'oekonomi.egenkapital.beloep', label: 'Hvor mye egenkapital skal {du} bruke?', feil: 'Skriv hvor mye egenkapital {du} skal bruke.' },
      { type: 'avkrysning', felt: 'oekonomi.egenkapital.kilde', label: 'Hvor får {du} egenkapitalen fra?', beskrivelse: 'Velg alle som er aktuelle.',
        feil: 'Velg hvor {du} får egenkapitalen fra.',
        valg: [
          { v: 'EGENKAPITAL_OPPSPARTE_MIDLER', l: 'Oppsparte midler (penger på konto)' },
          { v: 'EGENKAPITAL_SALG_BOLIG', l: 'Overskudd fra salg av bolig' },
          { v: 'EGENKAPITAL_ANNET', l: 'Annen egenkapital', b: 'For eksempel forskudd på arv, realiserte verdier fra fond og aksjer, salg av eiendeler, gave.' }
        ] },
      { type: 'tekstomrade', felt: 'oekonomi.egenkapital.beskrivannet', synlig: d => har(d, 'oekonomi.egenkapital.kilde', 'EGENKAPITAL_ANNET'), maks: 1000,
        label: 'Beskriv hvor annen egenkapital vil komme fra', feil: 'Beskriv hvor annen egenkapital vil komme fra.',
        feilMaks: 'Beskrivelsen av hvor annen egenkapital vil komme fra må være på 1000 tegn eller mindre.' },
      { type: 'janei', felt: 'oekonomi.planleggerlaanfraandre', label: 'Skal {du} ta opp andre lån for å finansiere oppgraderingen?',
        feil: 'Velg om det skal tas opp andre lån som en del av finansieringen.' },
      { type: 'belop', felt: 'oekonomi.laanfraandre', synlig: d => d['oekonomi.planleggerlaanfraandre'] === true, min: 1,
        label: 'Hvor mye av kostnadene planlegger {du} å finansiere med andre lån?', feil: 'Skriv hvor mye som skal finansieres med andre lån.' },
      { type: 'tekst', live: true, html: d => {
        const deler = [['Lån fra Husbanken', d['oekonomi.oensketlaanfrahusbanken']], ['Egenkapital', d['oekonomi.egenkapital.beloep']], ['Lån fra andre', d['oekonomi.laanfraandre']]]
          .filter(([, v]) => v != null && v !== '');
        const tittel = `<p class="lan-fet">${tx('Finansieringsplanen {din}')}</p>`;
        if (!deler.length) return `<div class="lan-panel lan-panel--gra" role="status">${tittel}<p class="lan-sekundaer">Svar på spørsmålene over for å se finansieringsplanen.</p></div>`;
        const sum = deler.reduce((s, [, v]) => s + api.num(v), 0);
        return `<div class="lan-panel lan-panel--bla" role="status">${tittel}
          <dl>${deler.map(([l, v]) => `<dt>${l}</dt><dd>${lanKr(api.num(v))}</dd>`).join('')}<dt>Totalt</dt><dd>${lanKr(sum)}</dd></dl></div>`;
      } },
      { type: 'tekst', live: true, synlig: d => {
        const ek = d['oekonomi.egenkapital.beloep'];
        const andreJa = d['oekonomi.planleggerlaanfraandre'] === true;
        const laan = d['oekonomi.oensketlaanfrahusbanken'];
        const nok = (ek != null || andreJa) && laan != null && (!andreJa || d['oekonomi.laanfraandre'] != null);
        if (!nok || !api.num(laan)) return false;
        return (api.num(ek) + (andreJa ? api.num(d['oekonomi.laanfraandre']) : 0)) / api.num(laan) < 0.1;
      }, html: '<div class="lan-panel lan-panel--gul"><p class="lan-fet lan-mb0">Finansieringen er ikke helt i mål enda</p><p>Egenkapitalen er under minstekravet på 10 prosent.</p></div>' },
      { type: 'vedleggskrav', krav: ['oekonomi.andrelaanfinansieringvedlegg', 'oekonomi.egenkapitalvedlegg'] }
    ]
  },

  /* ─── Lånetype og nedbetaling ────────────────────────────────── */
  {
    id: 'laansteg',
    tittel: 'Lånetype og nedbetaling',
    elementer: [
      { type: 'panel', variant: 'gra', html: d => (d['oekonomi.oensketlaanfrahusbanken'] != null
        ? `<p class="lan-fet lan-mb0">Ønsket lån fra Husbanken</p><p>${lanTall(api.num(d['oekonomi.oensketlaanfrahusbanken']))} kr</p>` : '') },
      { type: 'radio', felt: 'laan.laanetype', label: 'Hvilken lånetype ønsker {du}?', feil: 'Velg ønsket lånetype.',
        valg: [{ v: 'LAANETYPE_ANNUITET', l: 'Annuitetslån' }, { v: 'LAANETYPE_SERIE', l: 'Serielån' }] },
      { type: 'lesmer', tittel: 'Dette er forskjellen på annuitetslån og serielån', html: '<p>Med annuitetslån betaler du omtrent like mye hver gang, så lenge renten ikke endres. Med serielån betaler du mer i starten, mindre etter hvert, og totalt mindre i renter. Gitt samme rente og nedbetalingstid, vil serielån være billigere. Mange velger likevel annuitetslån fordi første betaling er lavere og utgiftene mer forutsigbare.</p>' },
      { type: 'tall', felt: 'laan.nedbetalingstid', enhet: 'år', min: 1, maks: 30, label: 'Hvor lang nedbetalingstid ønsker {du}?', beskrivelse: '30 år eller kortere.',
        feil: 'Skriv ønsket lengde på nedbetalingstiden.', feilMin: 'Nedbetalingstiden må være 1 år eller mer.',
        feilMaks: 'Nedbetalingstiden må være 30 år eller mindre.', feilTall: 'Nedbetalingstiden kan bare være tall, for eksempel 30.' },
      { type: 'radio', felt: 'laan.terminbeloep', label: 'Hvor ofte vil {du} betale ned lånet?',
        beskrivelse: 'Tips: Med betaling hver måned, vil {du} normalt betale mindre renter totalt.', feil: 'Velg hvor ofte {du} vil betale ned lånet.',
        valg: [{ v: 'TERMINBELOEP_MAANED', l: 'Hver måned' }, { v: 'TERMINBELOEP_KVARTAL', l: 'Hver 3. måned' }] },
      { type: 'radio', felt: 'laan.forfallsdato', label: 'Hvilken forfallsdato ønsker {du} på fakturaen?',
        beskrivelse: 'Tips: Velg den første datoen etter at lønnen eller pensjonen er utbetalt.', feil: 'Velg ønsket forfallsdato på fakturaen.',
        valg: [{ v: 'FORFALLSDATO_FOERSTE', l: 'Den 1. i måneden' }, { v: 'FORFALLSDATO_TOLVTE', l: 'Den 12. i måneden' }, { v: 'FORFALLSDATO_TJUENDE', l: 'Den 20. i måneden' }] },
      { type: 'tekst', live: true, html: d => {
        const klar = d['laan.terminbeloep'] && d['laan.laanetype'] && d['laan.nedbetalingstid'];
        if (!klar) return `<div class="lan-panel lan-panel--gra" role="status"><p>${tx('Svar på spørsmålene over for å se hvor mye {du} vil betale på lånet.')}</p></div>`;
        const termin = d['laan.terminbeloep'] === 'TERMINBELOEP_KVARTAL' ? 'hver 3. måned' : 'i måneden';
        const rente = String(LAN_RENTE[d['laan.terminbeloep']]).replace('.', ',');
        return `<div class="lan-panel lan-panel--bla" role="status"><p class="lan-mb0">${tx('{Du} betaler i starten omtrent')}</p>
          <p class="lan-stor-tall" style="margin-bottom:var(--space-3)">${lanTall(terminbeloep(d))} kroner ${termin}</p>
          <p>Dette beløpet er summen av avdrag og renter, basert på svarene dine lenger opp og dagens rente på ${rente} prosent.</p></div>`;
      } }
    ]
  },

  /* ─── Barn ───────────────────────────────────────────────────── */
  {
    id: 'barnsteg',
    tittel: 'Barn',
    elementer: [
      { type: 'ingress', tekst: 'Vi trenger å vite om alle barn under 18 år i husholdningen. Det gjelder også adoptivbarn, fosterbarn og andre barn som {du} har økonomisk ansvar for.' },
      { type: 'janei', felt: 'familie.harBarn', label: 'Bor det barn under 18 år i husholdningen?', feil: 'Velg om det bor barn under 18 år i husholdningen.' }
    ],
    vedNeste: d => (d['familie.harBarn'] === true && !(d.barn || []).length
      ? { utkast: { liste: 'barn', fra: 'barnsteg', steg: 'barn01' } } : null)
  },
  {
    id: 'barn01', understeg: true, utkast: true, utkastFra: 'barnsteg',
    tittel: 'Legg til et barn',
    nesteTekst: (u, d, m) => (m.utkast.fra === 'barnsteg' ? 'Neste' : m.utkast.ny ? 'Legg til barnet' : 'Lagre og fortsett'),
    elementer: [
      { type: 'tall', felt: 'alder', enhet: 'år', maks: 17, label: 'Alder', feil: 'Skriv alderen på barnet.',
        feilMaks: 'Alderen på barnet må være under 18. Barn som er 18 år eller eldre regnes ikke som en del av husstanden, selv om de bor hjemme.',
        feilTall: 'Alderen kan bare være tall, for eksempel 5.' },
      { type: 'janei', felt: 'harBarnDeltFastBosted', label: 'Bor barnet hele tiden i husholdningen?', feil: 'Velg om barnet bor hele tiden i husholdningen.' },
      { type: 'tall', felt: 'hvorMyeBorBarnetHosDere', synlig: u => u.harBarnDeltFastBosted === false, enhet: 'prosent', min: 1, maks: 99,
        label: 'Hvor mye av tiden bor barnet hos {deg}?',
        feil: 'Skriv hvor mye av tiden barnet bor i husholdningen i prosent, for eksempel 50.',
        feilMin: 'Sjekk at tiden barnet bor i husholdningen er skrevet riktig. Svaret må være i prosent, for eksempel 50.',
        feilMaks: 'Sjekk at tiden barnet bor i husholdningen er skrevet riktig. Svaret må være i prosent, for eksempel 50.',
        feilTall: 'Tiden barnet bor hos {deg} må være i prosenter skrevet som tall, for eksempel 50.' },
      { type: 'tekst', html: '<p>Du kan legge til flere barn på neste steg.</p>' }
    ],
    vedNeste: (u, d, m, api) => {
      if (u.harBarnDeltFastBosted !== false) delete u.hvorMyeBorBarnetHosDere;
      api.lagreUtkast();
      return 'barnsteg2';
    }
  },
  {
    id: 'barnsteg2',
    synlig: d => d['familie.harBarn'] === true,
    tittel: 'Barn som hører til husholdningen',
    elementer: [
      BARNELISTE,
      { type: 'panel', variant: 'bla', synlig: d => !(d.barn || []).length,
        html: '<p class="lan-fet">Skal det ikke være noen barn i husholdningen?</p><p>Hvis du går videre til neste steg blir søknaden endret til at det ikke er barn i husholdningen.</p>' }
    ],
    vedNeste: d => { if (!(d.barn || []).length) d['familie.harBarn'] = false; return null; }
  },

  /* ─── Utgifter ───────────────────────────────────────────────── */
  {
    id: 'utgiftsteg',
    tittel: 'Utgifter i husholdningen',
    elementer: [
      { type: 'ingress', tekst: () => (flertall()
        ? 'Når vi beregner hvor stort lån dere kan betjene, tar vi utgangspunkt i utgiftene i SIFOs referansebudsjett og legger til svarene deres fra søknaden.'
        : 'Når vi beregner hvor stort lån du kan betjene, tar vi utgangspunkt i utgiftene i SIFOs referansebudsjett og legger til svarene dine fra søknaden.') },
      { type: 'lesmer', tittel: 'Dette er SIFOs referansebudsjett', html: '<p>Referansebudsjettet er laget av Forbruksforskningsinstituttet SIFO og viser hva en husholdning trenger å bruke på varer og tjenester for et vanlig liv i Norge. Budsjettet dekker både løpende utgifter som mat, klær og hygieneartikler, og sjeldnere utgifter til mer varige ting som møbler og elektronisk utstyr.</p>' },
      { type: 'belop', felt: 'familie.sfo', synlig: d => d['familie.harBarn'] === true,
        label: 'Hva betaler {du} totalt hver måned for barnehage og skolefritidsordning?',
        feil: 'Skriv de totale utgiftene til barnehage og skolefritidsordning, for eksempel 0, 6000, eller 12000.' },
      { type: 'janei', felt: 'bil.harbiletterlaanetertattopp', label: 'Har {du} bil?', feil: 'Velg ja hvis det er en bil i husholdningen.' },
      { type: 'gruppe', synlig: d => d['bil.harbiletterlaanetertattopp'] === true, elementer: [
        { type: 'radio', felt: 'bil.hvormangefossil', label: 'Hvor mange fossilbiler har {du}?', valg: ANTALL_BILER,
          feil: 'Velg antallet fossilbiler i husholdningen, for eksempel 1 eller ingen.' },
        { type: 'radio', felt: 'bil.hvormangeelbiler', label: 'Hvor mange elbiler har {du}?', valg: ANTALL_BILER,
          feil: 'Velg antallet elbiler i husholdningen, for eksempel 1 eller ingen.' }
      ], valider: d => (d['bil.hvormangefossil'] === 'NONE' && d['bil.hvormangeelbiler'] === 'NONE'
        ? 'Velg minst 1 av enten fossilbil eller elbil. Velg fossilbil hvis det er bensin eller diesel. Velg elbil hvis det er hybrid.' : null) },
      { type: 'janei', felt: 'bil.leaserbil', synlig: d => d['bil.harbiletterlaanetertattopp'] === true,
        label: 'Leaser {du} bil?', feil: 'Velg om det er en leaset bil i husholdningen.' },
      { type: 'belop', felt: 'bil.leasingkost', synlig: d => d['bil.harbiletterlaanetertattopp'] === true && d['bil.leaserbil'] === true, min: 1,
        label: 'Hva betaler {du} i måneden for leasing?', feil: 'Skriv de månedlige utgiftene til leasing.' }
    ]
  },

  /* ─── Din personlige økonomi ─────────────────────────────────── */
  {
    id: 'oekonomisteg',
    tittel: 'Din personlige økonomi',
    elementer: [
      { type: 'ingress', tekst: 'På de neste stegene vil vi stille deg noen spørsmål om din personlige økonomiske situasjon, for å vurdere hvor mye du kan låne.' },
      { type: 'panel', variant: 'bla', synlig: d => medlantakere(d).length > 0, html: d => `<p class="lan-fet">Svar kun for deg selv, ikke på vegne av andre</p>
        <p>${medlantakere(d).length === 1
          ? 'Etter at du har sendt inn søknaden vil medlåntakeren din logge inn og svare på spørsmål om sin personlige økonomiske situasjon.'
          : 'Etter at du har sendt inn søknaden vil medlåntakerne dine logge inn og svare på spørsmål om deres personlige økonomiske situasjoner.'}</p>` },
      { type: 'panel', variant: 'bla', html: `<p>Vi henter opplysninger om deg:</p>
        ${liste(['Sivilstatus og barn under 18 år fra Folkeregisteret', 'Arbeidsforhold fra Nav', 'Inntekter fra Skatteetaten', 'Eiendom fra Kartverket', 'Den siste skattemeldingen fra Skatteetaten', 'Forbrukslån, kredittkort og kjøpekreditter fra Gjeldsregisteret'])}
        <p>Vi henter bare inn det vi trenger for å behandle søknaden.</p>` }
    ]
  },
  {
    id: 'oekonomisteg2',
    tittel: 'Din familiesituasjon',
    elementer: [
      { type: 'panel', variant: 'gra', html: () => sivilstatusHtml(),
        oppsummering: () => [{ label: 'Din sivilstatus hentet fra Folkeregisteret', verdi: sivilstatusHtml(true) }] },
      { type: 'panel', variant: 'gra', html: () => barnFregHtml(),
        oppsummering: () => [{ label: 'Dine barn under 18 år hentet fra Folkeregisteret', verdi: barnFregHtml(true) }] },
      { type: 'tekstomrade', felt: 'familie.familiekorreksjon', valgfri: true,
        label: 'Fortell oss hvis opplysningene fra Folkeregisteret ikke stemmer (valgfritt)', beskrivelse: 'Du trenger ikke skrive noe i dette feltet hvis alt stemmer.' },
      { type: 'janei', felt: 'familie.ensligforsoerger', synlig: d => d['familie.harBarn'] === true,
        label: 'Får du utvidet barnetrygd fra Nav?', beskrivelse: 'Du kan få mer i barnetrygd fra Nav hvis du bor alene med barn.',
        feil: 'Velg om du får utvidet barnetrygd.' },
      { type: 'janei', felt: 'familie.mottarbarnebidrag', synlig: () => P().harBarnUnder18,
        label: 'Får du barnebidrag?', beskrivelse: 'Barnebidrag er penger du får fra den andre forelderen når dere ikke bor sammen.',
        feil: 'Velg om du får barnebidrag.' },
      { type: 'belop', felt: 'familie.mottarbarnebidragkroner', synlig: d => d['familie.mottarbarnebidrag'] === true, min: 1,
        label: 'Hvor mye får du i barnebidrag i måneden?', feil: 'Skriv hvor mye du får i barnebidrag i måneden.' },
      { type: 'janei', felt: 'familie.betalerbarnebidrag', synlig: () => P().harBarnUnder18,
        label: 'Betaler du barnebidrag?', feil: 'Velg om du betaler barnebidrag.' },
      { type: 'belop', felt: 'familie.betalerbarnebidragkroner', synlig: d => d['familie.betalerbarnebidrag'] === true, min: 1,
        label: 'Hva betaler du i barnebidrag i måneden?', feil: 'Skriv hva du betaler i barnebidrag i måneden.' },
      { type: 'vedleggskrav', krav: ['oekonomi.mottarbarnebidragvedlegg'] }
    ]
  },
  {
    id: 'oekonomisteg3',
    tittel: 'Dine inntekter',
    elementer: [
      { type: 'panel', variant: 'gra', html: () => inntekterHtml(),
        oppsummering: () => [{ label: 'Dine inntekter hentet fra Skatteetaten (siste 12 måneder)', verdi: inntekterHtml(true) }] },
      { type: 'lesmer', tittel: 'Slik regner vi ut inntekter', html: '<p>Vi legger sammen det som er rapportert inn som inntekt de siste 12 månedene. Vi gjør det samme med pensjon, trygd og ytelser fra Nav. Beløpet er før skatt.</p>' },
      { type: 'tekstomrade', felt: 'oekonomi.inntektkorreksjon', valgfri: true, maks: 1000,
        label: 'Fortell oss hvis opplysningene fra Skatteetaten ikke stemmer (valgfritt)', beskrivelse: 'Du trenger ikke skrive noe i dette feltet hvis alt stemmer.',
        feilMaks: 'Svaret på hva som ikke stemmer med opplysningene fra Skattetaten må være på 1000 tegn eller mindre.' },
      { type: 'janei', felt: 'oekonomi.andreInntekter', label: 'Har du andre faste inntekter enn de vi har hentet fra Skattetaten?',
        beskrivelse: 'For eksempel skattefrie leieinntekter eller ekstrainntekter.',
        feil: 'Velg om du har andre faste inntekter enn de vi har hentet fra Skattetaten.' },
      { type: 'tekstomrade', felt: 'oekonomi.andreInntekterBeloep', synlig: d => d['oekonomi.andreInntekter'] === true, maks: 1000,
        label: 'Beskriv de andre inntektene dine', beskrivelse: 'Skriv hva inntekten er, beløpet og hvor ofte du får pengene på konto.',
        feil: 'Beskriv de andre inntektene dine', feilMaks: 'Beskrivelsen av de andre inntektene dine må være på 1000 tegn eller mindre.' },
      { type: 'radio', felt: 'oekonomi.endringioekonomi', label: 'Vet du om inntektene dine vil endre seg de neste månedene?',
        beskrivelse: 'For eksempel større endringer i lønn, pensjon, offentlige ytelser.', feil: 'Velg om inntektene dine vil endre seg de neste månedene.',
        valg: [{ v: 'JA', l: 'Ja' }, { v: 'USIKKER', l: 'Jeg er usikker' }, { v: 'NEI', l: 'Nei' }] },
      { type: 'gruppe', synlig: d => ['JA', 'USIKKER'].includes(d['oekonomi.endringioekonomi']), elementer: [
        { type: 'tekstomrade', felt: 'oekonomi.beskrivendringoekonomi', maks: 1000, label: 'Beskriv endringen i inntekten din',
          beskrivelse: 'Skriv hva som har endret seg og beløpet. Beløpet kan være omtrentlig.', feil: 'Beskriv endringen i inntekten din',
          feilMaks: 'Beskrivelsen av endringen i inntekten din må være på 1000 tegn eller mindre.' },
        { type: 'panel', variant: 'gronn', html: '<p>Hvis du har dokumentasjon på endringen i inntekten, kan du laste den opp senere i søknaden.</p>' }
      ] },
      { type: 'vedleggskrav', krav: ['oekonomi.andreinntektervedlegg'] }
    ]
  },
  {
    id: 'oekonomisteg4',
    tittel: 'Eiendom du eier',
    elementer: [
      { type: 'panel', variant: 'gra', html: () => eiendomHtml(),
        oppsummering: () => [{ label: 'Dine eiendommer hentet fra Kartverket', verdi: eiendomHtml(true) }] },
      { type: 'lesmer', tittel: 'Dette gjør du hvis det mangler en eiendom', html: `<p>Skriv adressen i feltet under.</p><p>Det er noen eiendommer vi ikke kan hente fra Kartverket, som:</p>
        ${liste(['Eiendom du nettopp har kjøpt eller overtatt', 'Leiligheter i aksjeselskap (aksjeleiligheter)'])}` },
      { type: 'tekstomrade', felt: 'oekonomi.eiendomKorreksjon', valgfri: true, maks: 1000,
        label: 'Fortell oss hvis opplysningene fra Kartverket ikke stemmer (valgfritt)', beskrivelse: 'Du trenger ikke skrive noe i dette feltet hvis alt stemmer.',
        feilMaks: 'Svaret på hva som ikke stemmer med opplysningene fra Kartverket må være på 1000 tegn eller mindre.' },
      { type: 'tekst', html: '<p style="margin-bottom:var(--space-5)">Vi trenger også å vite hva som vil skje med eiendom du eier i dag. Skriv hva som vil skje. Hvis det er flere eiendommer, skriv også adressen.</p>' },
      { type: 'tekstomrade', felt: 'oekonomi.planForEiendom', synlig: () => lanTestdata().eiendommer.length > 0, maks: 1000,
        label: 'Hva planlegger du å gjøre med eiendom du eier?', beskrivelse: 'For eksempel selge, leie ut eller beholde.',
        feil: 'Skriv hva du planlegger å gjøre med eiendom du eier.',
        feilMaks: 'Svaret på hva du planlegger å gjøre med eiendommen må være på 1000 tegn eller mindre.' }
    ]
  },
  {
    id: 'oekonomisteg5',
    tittel: 'Din gjeld',
    elementer: [
      { type: 'ingress', tekst: 'Til slutt trenger vi informasjon om lån som står i ditt navn.' },
      { type: 'panel', variant: 'bla', html: `
        <p class="lan-fet lan-mb0">Har du forbrukslån, kredittkort eller kjøpekreditter?</p><p>Du trenger ikke fortelle oss om det. Vi henter denne informasjonen fra Gjeldsregisteret.</p>
        <p class="lan-fet lan-mb0">Planlegger du å innfri et lån snart?</p><p>Da ønsker vi likevel å vite om lånet.</p>
        <p class="lan-fet lan-mb0">Har du et lån sammen med noen?</p><p>Da vil vi vite om den delen av lånet som står i ditt navn.</p>` },
      { type: 'janei', felt: 'oekonomi.harDuGjeld', label: 'Har du gjeld i dag?', feil: 'Velg om du har gjeld i dag.' },
      { type: 'avkrysning', felt: 'oekonomi.eksisterendelaan', synlig: d => d['oekonomi.harDuGjeld'] === true,
        label: 'Hva slags gjeld har du?', beskrivelse: 'Velg alle som gjelder deg.', feil: 'Velg hva slags gjeld du har. Du må velge minst 1.',
        valg: [
          { v: 'EKSISTERENDE_LAAN_STUDIE', l: 'Studielån' }, { v: 'EKSISTERENDE_LAAN_BOLIG', l: 'Boliglån' }, { v: 'EKSISTERENDE_LAAN_BIL', l: 'Billån' },
          { v: 'EKSISTERENDE_LAAN_PRIVAT_LAAN', l: 'Privat lån' }, { v: 'EKSISTERENDE_LAAN_ANDRE_MOT_SIKKERHET', l: 'Annet' }
        ] },
      { type: 'tekstomrade', felt: 'oekonomi.andrelaan', synlig: d => har(d, 'oekonomi.eksisterendelaan', 'EKSISTERENDE_LAAN_ANDRE_MOT_SIKKERHET'),
        label: 'Beskriv andre typer lån du har', feil: 'Skriv hvilke andre lån du har.' },
      { type: 'vedleggskrav', krav: ['oekonomi.gjeldvedlegg'] }
    ]
  },

  /* ─── Vedlegg ────────────────────────────────────────────────── */
  {
    id: 'vedleggsteg',
    tittel: 'Vedlegg og andre opplysninger',
    elementer: [
      { type: 'ingress', tekst: 'Det eneste som gjenstår nå er at du laster opp dokumentasjonen vi trenger for å behandle søknaden.' },
      { type: 'panel', variant: 'gra', synlig: d => VEDLEGGSKRAV.some(k => k.synlig(d)), html: d => `<div class="lan-vedleggskrav">${LAN_IKON.binders}<div>
        <p class="lan-fet">Basert på svarene dine må du legge ved</p>
        ${liste(VEDLEGGSKRAV.filter(k => k.synlig(d)).map(k => tx(k.label, d)))}
        <p class="lan-fet lan-mb0">Trenger du mer tid?</p>
        <p>Alt er lagret. Du kan trygt gå ut av søknaden og komme tilbake når du er klar til å fortsette.</p></div></div>` },
      ...VEDLEGGSKRAV.map(k => ({
        type: 'fil', felt: k.felt, synlig: k.synlig, label: k.overskrift, oppsLabel: k.label, endret: k.endret,
        beskrivelse: k.beskrivelse, detaljer: k.detaljer, feil: k.feil
      })),
      { type: 'janei', felt: 'vedlegg.leggtilnoemer', label: 'Vil du legge til andre opplysninger?',
        beskrivelse: 'For eksempel en melding eller andre vedlegg.', feil: 'Velg om du vil legge til noe mer.' },
      { type: 'gruppe', synlig: d => d['vedlegg.leggtilnoemer'] === true,
        tittel: '<h2 class="lan-h3">Andre opplysninger</h2><p class="lan-sekundaer">Du kan skrive en tekst, laste opp en fil, eller gjøre begge deler.</p>',
        elementer: [
          { type: 'tekstomrade', felt: 'vedlegg.noemertekst', valgfri: true, maks: 1000,
            label: 'Er noe mer vi burde vite om som er relevant for søknaden? (valgfritt)',
            beskrivelse: 'Ikke del informasjon om helse eller personlig informasjon om andre.',
            feilMaks: 'Teksten med informasjon vi burde vite om må være på 1000 tegn eller mindre.' },
          { type: 'fil', felt: 'vedlegg.noemervedlegg', valgfri: true, liten: true, label: 'Last opp flere vedlegg (valgfritt)', oppsLabel: 'Andre vedlegg',
            beskrivelse: 'For eksempel en ny arbeidskontrakt eller en pensjonsberegning.' }
        ],
        valider: d => (!d['vedlegg.noemertekst'] && !(d['vedlegg.noemervedlegg'] || []).length
          ? 'Du må enten skrive en tekst, laste opp et vedlegg, eller gjøre begge deler.' : null) }
    ]
  }
];

/* ═══ Opplysninger «hentet fra registrene» ════════════════════════ */

const SIVILSTAND = {
  UOPPGITT: 'Uoppgitt', UGIFT: 'Ugift', GIFT: 'Gift', ENKEELLERENKEMANN: 'Enke eller enkemann', SKILT: 'Skilt', SEPARERT: 'Separert',
  REGISTRERTPARTNER: 'Registrert partner', SEPARERTPARTNER: 'Separert partner', SKILTPARTNER: 'Skilt partner', GJENLEVENDEPARTNER: 'Gjenlevende partner'
};

function sivilstatusHtml(kort = false) {
  const p = P();
  const e = ['GIFT', 'REGISTRERTPARTNER'].includes(p.sivilstand) && p.ektefelle ? `<br>${lanEsc(p.ektefelle.fornavn)} ${lanEsc(p.ektefelle.etternavn)}` : '';
  const verdi = `<span class="lan-fet">${SIVILSTAND[p.sivilstand]}</span>${e}`;
  return kort ? verdi : `<p>Din sivilstatus hentet fra Folkeregisteret</p><p>${verdi}</p>`;
}

function barnFregHtml(kort = false) {
  const b = P().barn || [];
  const verdi = b.length ? b.map(x => `<span class="lan-fet">${x.kjoenn === 'KVINNE' ? 'Jente' : 'Gutt'}</span><br>${x.alder} år`).join('<br>')
    : '<span class="lan-sekundaer">Ingen barn under 18 år</span>';
  return kort ? verdi : `<p>Dine barn under 18 år hentet fra Folkeregisteret</p><p>${verdi}</p>`;
}

function inntekterHtml(kort = false) {
  const inn = lanTestdata().inntekter;
  const verdi = inn.length ? inn.map(i => {
    const navn = i.arbeidsgiver.toLowerCase() === 'nav' ? `${i.inntekttype} fra ${i.arbeidsgiver}` : i.arbeidsgiver;
    const stilling = i.stillingsprosent && i.stillingsprosent.length ? `<br>${i.stillingsprosent.map(s => `${s} prosent stilling`).join(', ')}` : '';
    return `<span class="lan-fet">${lanEsc(navn)}</span>${stilling}<br>${lanEsc(i.inntekt)} kroner`;
  }).join('<br><br>') : '<span class="lan-sekundaer">Ingen inntekter de siste 12 månedene</span>';
  return kort ? verdi : `<p>Dine inntekter hentet fra Skatteetaten (de siste 12 månedene)</p><p>${verdi}</p>`;
}

function eiendomHtml(kort = false) {
  const eiendommer = [...lanTestdata().eiendommer].sort((a, b) => (a.boligtype === 'PRIMARBOLIG' ? -1 : 0) - (b.boligtype === 'PRIMARBOLIG' ? -1 : 0));
  const verdi = eiendommer.length ? eiendommer.map(e => {
    const a = e.adresse;
    const tittel = a.gateadresse ? `${a.gateadresse} ${a.gatenummer ?? ''}${a.gatebokstav ?? ''}` : `Matrikkelnummer ${a.matrikkelnummer}`;
    return `<span class="lan-fet">${lanEsc(tittel)}</span>${e.boligtype === 'PRIMARBOLIG' ? '<br>Primærbolig' : ''}
      <br>Du eier ${e.eierskapsprosent} prosent ${lanEsc(e.eierskapsdetalj)}${a.gateadresse ? `<br><span class="lan-sekundaer">Matrikkelnummer ${lanEsc(a.matrikkelnummer)}</span>` : ''}`;
  }).join('<br><br>') : '<span class="lan-sekundaer">Ingen eiendommer er registrert på deg</span>';
  return kort ? verdi : `<p>Dine eiendommer hentet fra Kartverket</p><p>${verdi}</p>`;
}
