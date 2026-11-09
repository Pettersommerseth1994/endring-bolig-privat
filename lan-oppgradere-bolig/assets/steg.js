/* ──────────────────────────────────────────────────────────────────
   Stegene i «Søknad om lån til å bygge klimavennlig bolig»

   Bygget på MiljovennligBoligSoknad i dagens løsning. I versjon 2 er
   tiltakene og sertifikatene byttet med klimakravene: oppvarmet kjeller,
   klimagassavtrykk og klimagassbudsjett. Det er her du endrer flyten.
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

/* Grenseverdien for klimagassavtrykket er det høyeste tallet som
   kvalifiserer, og den er høyere når kjelleren er oppvarmet. */
const CO2_ENHET = 'kg CO₂-ekv./m² BTA';
const co2Grense = d => (d['bolig.oppvarmetkjeller'] === true ? 232 : 179);

const EIERSKAP = [
  { v: 'EIERSKAP_TOMT_JA', l: 'Ja, {jeg} eier tomten' },
  { v: 'EIERSKAP_TOMT_HAR_FESTEAVTALE', l: 'Nei, {jeg} har en festeavtale på tomten' },
  { v: 'EIERSKAP_TOMT_FREMTIDIG_FESTEAVTALE', l: 'Nei, men {jeg} skal feste tomten' },
  { v: 'EIERSKAP_TOMT_FREMTIDIG_KJOEP', l: 'Nei, men {jeg} skal kjøpe tomten' },
  { v: 'EIERSKAP_TOMT_ANNET', l: 'Annet' }
];
const kjoeperTomt = d => ['EIERSKAP_TOMT_JA', 'EIERSKAP_TOMT_FREMTIDIG_KJOEP'].includes(d.eierskaptomt);

const ANTALL_BILER = [
  { v: 'NONE', l: 'Ingen biler' }, { v: 'ONE', l: '1 bil' }, { v: 'TWO', l: '2 biler' }, { v: '3ORMORE', l: '3 eller flere biler' }
];

/* ═══ Beregninger ═════════════════════════════════════════════════ */

function bufferUtregning(d) {
  const v = felt => api.num(d[felt]);
  const valgtProsent = { TI_PROSENT: 10, FEM_PROSENT: 5, INGENTING: 0, ANNET: v('kostnader.bufferprosentannet') }[d['kostnader.bufferprosent']];
  const grunnlagFelt = [
    ['kostnader.utendoersarbeid', 'utendørs arbeid'],
    ['kostnader.byggehus', 'byggekostnader (hus)'],
    ['kostnader.byggegarasje', 'byggekostnader (garasje)'],
    ['kostnader.klimaraadgivning', 'klimarådgivning'],
    ['kostnader.prosjektering', 'prosjektering, gebyr og avgifter'],
    ['kostnader.laanefinansiering', 'lånekostnader']
  ];
  const bufferGrunnlag = grunnlagFelt.reduce((sum, [f]) => sum + v(f), 0);
  const tomt = v('kostnader.kjoepesumtomt') + v('kostnader.antattkjoepesumtomt');
  const bufferVerdi = valgtProsent == null ? 0 : Math.round(bufferGrunnlag * (valgtProsent / 100));
  return {
    valgtProsent, bufferVerdi, bufferGrunnlag,
    grunnlagNavn: grunnlagFelt.filter(([f]) => v(f) > 0).map(([, n]) => n),
    totaleProsjektKostnader: tomt + bufferGrunnlag + bufferVerdi
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

/* Dokumentasjonen på byggeprosjektet hang før på tiltakene. Nå som de er
   borte, kreves den alltid. */
const alltid = () => true;

const VEDLEGGSKRAV = [
  { felt: 'boligkvalitet.fasadeplansnittvedlegg', synlig: alltid,
    label: 'fasade-, snitt- og plan-tegninger', overskrift: 'Last opp fasade-, snitt- og plantegninger',
    detaljer: ['Tegninger av alle fasader i byggeprosjektet', 'Tegninger av typiske snitt i byggeprosjektet',
      'Plantegninger for alle etasjer i byggeprosjektet'],
    feil: 'Last opp fasade-, snitt- og plantegningene.' },
  { felt: 'boligkvalitet.situasjonsplanvedlegg', synlig: alltid,
    label: 'situasjonsplan', overskrift: 'Last opp situasjonsplanen',
    beskrivelse: 'Situasjonsplanen er et kart som viser bygningen det søkes om, med hovedmålet på bygningen og avstand til nærmeste grense tegnet inn.',
    feil: 'Last opp situasjonsplanen.' },
  { felt: 'boligkvalitet.byggebeskrivelsevedlegg', synlig: alltid,
    label: 'byggebeskrivelse', overskrift: 'Last opp byggebeskrivelsen',
    beskrivelse: 'En faglig beskrivelse, ofte fra entreprenøren.',
    feil: 'Last opp byggebeskrivelsen.' },
  { felt: 'boligkvalitet.kontraktvedlegg', synlig: alltid,
    label: 'kontrakt eller avtale med entreprenør', overskrift: 'Last opp kontrakten eller avtalen med entreprenøren',
    beskrivelse: 'For eksempel avtalen med firmaet som skal gjøre arbeidet eller en entreprise.',
    feil: 'Last opp kontrakten eller avtalen med entreprenøren.' },
  { felt: 'boligkvalitet.rammetillatelsevedlegg', synlig: alltid,
    label: 'rammetillatelse eller igangsettingstillatelse fra kommunen', overskrift: 'Last opp rammetillatelsen eller igangsettingstillatelsen fra kommunen.',
    beskrivelse: 'Før vi kan behandle søknaden, må prosjektet ha fått minst rammetillatelse eller igangsettingstillatelse fra kommunen.',
    feil: 'Last opp rammetillatelsen eller igangsettingstillatelsen fra kommunen.' },
  { felt: 'klima.klimabudsjettvedlegg', synlig: d => d['klima.harklimabudsjett'] !== false, endret: 14,
    label: 'klimabudsjett', overskrift: 'Last opp klimabudsjettet',
    beskrivelse: 'Klimabudsjettet må være laget etter NS 3720:2018.',
    feil: 'Last opp klimabudsjettet.' },
  { felt: 'utkastkjopekontraktellerfesteavtalevedlegg',
    synlig: d => ['EIERSKAP_TOMT_FREMTIDIG_KJOEP', 'EIERSKAP_TOMT_FREMTIDIG_FESTEAVTALE'].includes(d.eierskaptomt),
    label: d => (d.eierskaptomt === 'EIERSKAP_TOMT_FREMTIDIG_KJOEP' ? 'utkast til kjøpekontrakt' : 'utkast til festeavtale'),
    overskrift: d => (d.eierskaptomt === 'EIERSKAP_TOMT_FREMTIDIG_KJOEP' ? 'Last opp utkast til kjøpekontrakt' : 'Last opp utkast til festeavtale'),
    feil: d => (d.eierskaptomt === 'EIERSKAP_TOMT_FREMTIDIG_KJOEP' ? 'Du må laste opp utkast til kjøpekontrakt.' : 'Du må laste opp utkast til festeavtale.') },
  { felt: 'festeavtalevedlegg', synlig: d => d.eierskaptomt === 'EIERSKAP_TOMT_HAR_FESTEAVTALE',
    label: 'festeavtale', overskrift: 'Last opp festeavtalen', feil: 'Du må laste opp festeavtalen.' },
  { felt: 'oekonomi.andrelaanfinansieringvedlegg', synlig: d => d['oekonomi.planleggerlaanfraandre'] === true,
    label: 'dokumentasjon på andre lån som skal finansiere boligen', overskrift: 'Last opp dokumentasjon på andre lån som skal finansiere boligen',
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
      { type: 'ingress', endret: 6, tekst: 'For å kunne søke om lån til å bygge klimavennlig bolig må vi vite om kjelleren er oppvarmet eller ikke.' },
      { type: 'panel', variant: 'varsel', ikon: LAN_IKON.varsel, endret: 7,
        html: '<p>Grenseverdiene for å få lån til klimavennlig bolig er forskjellige om prosjektet har oppvarmet kjeller eller ikke.</p>' },
      { type: 'lesmer', tittel: 'Dette er kravene for å få lån', html: () => `
        <p>${tx('For å få lån må {du} oppfylle minst 3 av disse tiltakene')}:</p>
        <ul>
          <li>Materialene inneholder maks 0,1 vektprosent helse- og miljøfarlige stoffer</li>
          <li>Minimum 70 vektprosent blir kildesortert (80 vektprosent for bygg over 300 kvadratmeter)</li>
          <li>${tx('Det er fleksibilitet i planløsningen, hvor {du} må velge minst 1 av disse')}:
            <ul><li>Minst ett rom kan deles i to</li><li>To rom kan slås sammen</li><li>Det er mulig å etablere hybel med eget bad og kjøkkenløsning</li></ul></li>
          <li>Minst 10 forskjellige produkter har miljødokumentasjon</li>
          <li>Fossilt brensel er ikke brukt til oppvarming og tørk i byggeperioden</li>
        </ul>
        <p>${tx('Alternativt kan {du} få lån dersom boligen har fått et av disse sertifikatene')}:</p>
        <ul><li>Svanemerke</li><li>Breeam-NOR, enten:<ul><li>Very good</li><li>Excellent</li><li>Outstanding</li></ul></li></ul>
        <p>${tx('{Du} må oppbevare dokumentasjon på at kravene er oppfylt i 5 år fra lånet blir utbetalt.')}</p>` },
      { type: 'tekst', html: `<p class="lan-mt" style="margin-bottom:var(--space-6)">For mer informasjon, se ${ekstern('https://www.husbanken.no/', 'Veileder for lån fra Husbanken')}.</p>` },
      { type: 'janei', felt: 'bolig.oppvarmetkjeller', endret: 8, label: 'Vil kjelleren være oppvarmet?',
        feil: 'Velg om kjelleren vil være oppvarmet.' }
    ]
  },
  {
    id: 'klimagassavtrykk',
    tittel: 'Klimagassavtrykk',
    elementer: [
      { type: 'tall', felt: 'klima.klimagassavtrykk', endret: 9, enhet: CO2_ENHET,
        label: 'Hva er antatt kg CO₂-ekv./m² BTA på prosjektet?',
        feil: 'Skriv antatt klimagassavtrykk for prosjektet.',
        feilTall: 'Klimagassavtrykket kan bare være tall, for eksempel 150.',
        advarsel: (v, d) => (heltall(v) && api.num(v) > co2Grense(d)
          ? `For å kvalifisere til dette lånet må CO₂-utslippet være ${co2Grense(d)} ${CO2_ENHET} eller lavere.` : null) },
      { type: 'lesmer', endret: 15, tittel: 'Dette er kg CO₂-ekv./m² BTA', html: d => tx(`
        <p>Tallet viser hvor store klimagassutslipp boligen gir, fordelt på hver kvadratmeter.</p>
        <ul>
          <li><b>kg CO₂-ekv.</b> betyr kilo CO₂-ekvivalenter. Alle klimagassene regnes om til den mengden CO₂ som gir samme effekt på klimaet, så de kan legges sammen.</li>
          <li><b>m² BTA</b> er bruttoarealet til boligen, det samme arealet {du} oppgir på steget Boligen.</li>
        </ul>
        <p class="lan-mb0">Slik regnes det ut:</p>
        <p class="lan-fet">Samlede klimagassutslipp i kg CO₂-ekv. ÷ BTA i m²</p>
        <p>For eksempel gir 150 000 kg CO₂-ekv. for en bolig på 1 000 m² BTA et klimagassavtrykk på 150 kg CO₂-ekv./m² BTA.</p>
        <p>{Du} finner tallet i klimagassbudsjettet for prosjektet, som er laget etter NS 3720:2018. For å få lånet må tallet være ${co2Grense(d)} eller lavere${d['bolig.oppvarmetkjeller'] === true ? ', siden kjelleren skal være oppvarmet' : d['bolig.oppvarmetkjeller'] === false ? ', siden kjelleren ikke skal være oppvarmet' : ''}.</p>`) }
    ]
  },
  {
    id: 'klimagassbudsjett',
    tittel: 'Klimagass&shy;budsjett',
    elementer: [
      { type: 'ingress', tekst: 'For å få lån krever vi at det er laget et klimagassbudsjett for prosjektet. Budsjettet viser hvor store klimagassutslipp boligen er beregnet å gi, og det må være laget etter Norsk Standard NS 3720:2018.' },
      { type: 'tekst', html: '<p style="margin-bottom:var(--space-6)">Budsjettet lages vanligvis av en klimarådgiver, arkitekten eller entreprenøren. {Du} laster det opp senere i søknaden.</p>' },
      { type: 'janei', felt: 'klima.harklimabudsjett', endret: 10,
        label: 'Er det blitt utformet et klimabudsjett for prosjektet etter NS 3720:2018?',
        feil: 'Velg om det er utformet et klimabudsjett for prosjektet.',
        advarsel: v => (v === false
          ? 'Uten et klimabudsjett etter NS 3720:2018 kvalifiserer {du} ikke til dette lånet. {Du} må få laget budsjettet før {du} søker.' : null) },
      { type: 'vedleggskrav', krav: ['klima.klimabudsjettvedlegg'] }
    ]
  },

  /* ─── Eiendommen og boligen ──────────────────────────────────── */
  {
    id: 'gardogbruksnummersteg',
    tittel: 'Gårds- og bruksnummer',
    elementer: [
      { type: 'ingress', tekst: 'For å vite hvor {du} skal bygge, trenger vi gårds- og bruksnummeret til eiendommen.' },
      { type: 'kommune', felt: 'bolig.kommunenavn', label: 'Hvilken kommune ligger eiendommen i?',
        beskrivelse: 'Skriv navnet på kommunen og velg kommunen fra listen.', feil: 'Velg hvilken kommune eiendommen ligger i.' },
      { type: 'janei', felt: 'bolig.harGnrBnr', label: 'Har eiendommen et gårds- og bruksnummer?', nei: 'Nei, ikke ennå',
        feil: 'Velg om eiendommen har et gårds- og bruksnummer.' },
      { type: 'panel', variant: 'bla', synlig: d => d['bolig.harGnrBnr'] === false,
        html: '<p>Husk å gi oss beskjed når eiendommen har fått et gårds- og bruksnummer.</p>' },
      { type: 'gruppe', synlig: d => d['bolig.harGnrBnr'] === true, elementer: [
        { type: 'tall', felt: 'bolig.gnr', label: 'Gårdsnummer', feil: 'Skriv gårdsnummeret.', feilTall: 'Gårdsnummeret kan bare være tall, for eksempel 12.' },
        { type: 'tall', felt: 'bolig.bnr', label: 'Bruksnummer', feil: 'Skriv bruksnummeret.', feilTall: 'Bruksnummeret kan bare være tall, for eksempel 12.' },
        { type: 'tall', felt: 'bolig.festenr', label: 'Festenummer (valgfritt)', valgfri: true, feilTall: 'Festenummeret kan bare være tall, for eksempel 12.' },
        { type: 'tall', felt: 'bolig.seksjonsnr', label: 'Seksjonsnummer (valgfritt)', valgfri: true, feilTall: 'Seksjonsnummeret kan bare være tall, for eksempel 12.' },
        { type: 'tekst', html: `<p>Vet du ikke hva gårds- og bruksnummeret er? Du kan finne det ved å søke opp eiendommen i ${ekstern('https://eiendomsregisteret.kartverket.no/', 'Eiendomsregisteret')}</p>` }
      ] }
    ]
  },
  {
    id: 'eiendomsteg',
    tittel: 'Eiendommen',
    elementer: [
      { type: 'radio', felt: 'eierskaptomt', label: 'Eier {du} tomten?', feil: 'Velg om {du} eier tomten.', valg: EIERSKAP },
      { type: 'tekstomrade', felt: 'eierskaptomtannet', synlig: d => d.eierskaptomt === 'EIERSKAP_TOMT_ANNET',
        label: 'Hva er situasjonen for tomten?', feil: 'Beskriv situasjonen for tomten.' },
      { type: 'vedleggskrav', krav: ['utkastkjopekontraktellerfesteavtalevedlegg', 'festeavtalevedlegg'] }
    ]
  },
  {
    id: 'boligsteg',
    tittel: 'Boligen',
    elementer: [
      { type: 'tall', felt: 'bolig.stoerrelse', endret: 11, enhet: 'kvadratmeter', min: 1,
        label: 'Hvor stor blir boligen, målt i kvadratmeter BTA?', feil: 'Skriv hvor stor boligen blir.',
        feilTall: 'Størrelsen på boligen kan bare være tall, for eksempel 84.',
        advarsel: v => (heltall(v) && api.num(v) >= 1000
          ? 'Som privatperson kan du kun oppføre boliger som er under 1000 kvm for å få dette lånet.' : null) },
      { type: 'lesmer', endret: 11, tittel: 'Dette er BTA', html: '<p>BTA betyr bruttoareal. Det er hele arealet i boligen, målt til utsiden av ytterveggene, i alle etasjer. Kjeller og loft regnes med, og det samme gjør arealet veggene tar opp. En garasje, bod eller et anneks som står for seg selv, regnes ikke med.</p>' },
      { type: 'janei', felt: 'bolig.oenskergarasje', label: 'Ønsker {du} at lånet også skal dekke bygging av garasje?',
        feil: 'Velg om lånet også skal dekke bygging av garasje.' },
      { type: 'tall', felt: 'bolig.garasjestoerrelse', synlig: d => d['bolig.oenskergarasje'] === true, enhet: 'kvadratmeter', min: 1,
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
      { type: 'panel', variant: 'bla', ikon: true, endret: 12, html: d => `
        <p>Du vil bli bedt om å fylle ut, hver for seg, kostnader til</p>
        ${liste([kjoeperTomt(d) && 'kjøp av tomten', 'utendørs arbeid', 'byggekostnader', 'klimarådgivning', 'prosjektering, gebyrer og avgifter', 'lånekostnader', 'buffer til uforutsette kostnader'].filter(Boolean))}
        <p>${tx('Oppgi både kostnader {du} regner med, og kostnader {du} allerede har betalt.')}</p>` },
      { type: 'tekst', html: '<p class="lan-sekundaer">Når {du} søker, må {du} ha et budsjett med prosjektkostnader, basert på kontrakt og pristilbud fra entreprenøren. Kontakt entreprenøren hvis {du} mangler noen av kostnadene.</p>' }
    ]
  },
  {
    id: 'kjoepavtomtensteg',
    synlig: kjoeperTomt,
    tittel: 'Kjøp av tomten',
    elementer: [
      { type: 'ingress', tekst: 'Kjøpesummen regnes med i prosjektkostnadene.' },
      { type: 'panel', variant: 'gra', html: d => `<p>Du har tidligere svart</p>
        <p class="lan-fet lan-mb0">${tx('Eier {du} tomten?')}</p>
        <p>${tx((EIERSKAP.find(o => o.v === d.eierskaptomt) || {}).l)}</p>` },
      { type: 'belop', felt: 'kostnader.kjoepesumtomt', synlig: d => d.eierskaptomt === 'EIERSKAP_TOMT_JA',
        label: 'Hva var kjøpesummen for tomten?', feil: 'Skriv hva kjøpesummen for tomten var.' },
      { type: 'belop', felt: 'kostnader.antattkjoepesumtomt', synlig: d => d.eierskaptomt === 'EIERSKAP_TOMT_FREMTIDIG_KJOEP',
        label: 'Hvor mye regner {du} med å betale for tomten?', feil: 'Skriv hvor mye {du} regner med å betale for tomten.' }
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
    id: 'byggekostnadersteg',
    tittel: 'Byggekostnader',
    elementer: [
      { type: 'ingress', tekst: 'Skriv hvor store kostnader {du} regner med for råbygg, innvendig arbeid og tekniske installasjoner.' },
      { type: 'lesmer', tittel: 'Eksempler på kostnader', html: `<ul>
          <li>råbygg</li>
          <li>innvendig arbeid${liste(['tak', 'gulv', 'vegger', 'trapper', 'fast inventar'], 'lan-mb0')}</li>
          <li>tekniske installasjoner${liste(['elektrisk arbeid, inkludert internett', 'VVS', 'ventilasjon', 'oppvarming', 'brann- og sikkerhetsanlegg'], 'lan-mb0')}</li>
        </ul>
        <p>Offentlige gebyrer og kostnader til byggestrøm og avfallshåndtering kommer på neste steg.</p>` },
      { type: 'belop', felt: 'kostnader.byggehus', enhet: 'kroner inkludert mva.',
        label: 'Hvor store kostnader regner {du} med for å bygge huset?', feil: 'Skriv hvor store kostnader {du} regner med for å bygge huset.' },
      { type: 'belop', felt: 'kostnader.byggegarasje', enhet: 'kroner inkludert mva.', synlig: d => d['bolig.oenskergarasje'] === true,
        label: 'Hvor store kostnader regner {du} med for å bygge garasjen?', feil: 'Skriv hvor store kostnader {du} regner med for å bygge garasjen.' }
    ]
  },
  {
    id: 'klimaraadgivningsteg',
    tittel: 'Kostnader knyttet til utarbeidelse av klimagass&shy;regnskap og -budsjett',
    elementer: [
      { type: 'ingress', tekst: 'Skriv hvor store kostnader {du} regner med til klimarådgivning.' },
      { type: 'belop', felt: 'kostnader.klimaraadgivning', endret: 13, enhet: 'kroner inkludert mva.',
        label: 'Hvor store kostnader regner {du} med til klimarådgivning?', feil: 'Skriv hvor store kostnader {du} regner med til klimarådgivning.' }
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
      { type: 'panel', variant: 'bla', html: d => {
        const tomt = d['kostnader.kjoepesumtomt'] ?? d['kostnader.antattkjoepesumtomt'];
        const linjer = [
          ['Kjøpesum for tomten', tomt, false, 'kjoepavtomtensteg'],
          ['Utendørs arbeid', d['kostnader.utendoersarbeid'], true, 'utendoerskostnader'],
          ['Bygge huset', d['kostnader.byggehus'] ?? 0, true, 'byggekostnadersteg'],
          ['Bygge garasjen', d['kostnader.byggegarasje'], true, 'byggekostnadersteg'],
          ['Klimarådgivning', d['kostnader.klimaraadgivning'], true, 'klimaraadgivningsteg'],
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
      { type: 'janei', felt: 'oekonomi.planleggerlaanfraandre', label: 'Skal {du} ta opp andre lån for å finansiere boligen?',
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
