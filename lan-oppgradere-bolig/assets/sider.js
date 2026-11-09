/* ──────────────────────────────────────────────────────────────────
   Sidene rundt skjemaet: forsiden, «Hva vil du søke om?»,
   informasjonssiden, kvitteringen og Min søknad.
   ────────────────────────────────────────────────────────────────── */

const IKKE_MED = 'Denne ordningen er ikke med i prototypen. Bare «Lån til å oppgradere bolig» er laget.';

function ordningskort(href, bilde, tittel, tekst, niva, endret) {
  const ikkeMed = href === '#' ? ` data-ikke-med="${IKKE_MED}"` : '';
  return `
    <a class="lan-ordning" href="${href}"${ikkeMed}${endret ? ` data-endret="${endret}"` : ''}>
      <img src="img/${bilde}" alt="">
      <span class="lan-ordning__tittel" role="heading" aria-level="${niva}">${tittel}</span>
      <span class="lan-ordning__tekst">${tekst}</span>
      <span class="lan-ordning__pil">${LAN_IKON.pilHoyre}</span>
    </a>`;
}

function hvaVilDuInnhold(niva) {
  const h = `h${niva}`;
  return `
    <${h} class="lan-h4">Tilskudd</${h}>
    <div class="lan-ordningsliste">
      ${ordningskort('#', 'illustrasjon-aldersvennlig-kompakt.svg', 'Tilskudd til aldersvennlig oppgradering', 'For deg som vil gjøre boligen mer egnet til å bli gammel i.', niva + 1)}
    </div>
    <${h} class="lan-h4">Lån</${h}>
    <div class="lan-ordningsliste">
      ${ordningskort('#', 'illustrasjon-miljovennlig-kompakt.svg', 'Lån til å bygge klimavennlig bolig', 'For deg som skal bygge en bolig med godt inneklima og lite utslipp av klimagasser.', niva + 1)}
      ${ordningskort('#', 'illustrasjon-livslop-kompakt.svg', 'Lån til å bygge bolig med livsløpsstandard', 'For deg som skal bygge en bolig tilpasset ulike faser i livet.', niva + 1)}
      ${ordningskort('informasjon.html', 'illustrasjon-oppgradere-kompakt.svg', 'Lån til å oppgradere bolig', 'For deg som skal gjøre boligen mer energieffektiv eller mer tilgjengelig.', niva + 1, 1)}
      ${ordningskort('#', 'illustrasjon-debitor-kompakt.svg', 'Lån til å kjøpe nybygget bolig', 'For deg som skal kjøpe en bolig i et prosjekt som er godkjent av Husbanken.', niva + 1)}
    </div>
    <${h} class="lan-h4" style="margin-bottom:var(--space-2)">Se også</${h}>
    <p class="lan-mb0"><a href="https://www.husbanken.no/startlaan/" target="_blank" rel="noopener">Startlån og tilskudd fra kommunen</a></p>
    <p style="margin-bottom:var(--space-6)">For deg som har langvarige problemer med å få boliglån i vanlig bank.</p>`;
}

const omLanOgTilskudd = () => `
  <h2 class="lan-h2">Om lån og tilskudd fra Husbanken</h2>
  <ul style="list-style:none;padding:0">
    <li><a href="https://www.husbanken.no/renter/" target="_blank" rel="noopener">Renter</a></li>
    <li><a href="https://www.husbanken.no/" target="_blank" rel="noopener">Gebyrer</a></li>
    <li><a href="https://www.husbanken.no/" target="_blank" rel="noopener">Overta lån i Husbanken</a></li>
    <li><a href="https://www.husbanken.no/" target="_blank" rel="noopener">Veileder for lån og tilskudd i Husbanken</a></li>
    <li><a href="https://lovdata.no/" target="_blank" rel="noopener">Forskrift om lån fra Husbanken på lovdata.no</a></li>
  </ul>`;

const brodsmuler = ledd => `
  <nav class="lan-crumbs" aria-label="Brødsmulesti"><ol>
    <li><a href="index.html">${LAN_TJENESTE}</a></li>
    ${ledd.map(([href, t]) => `<li>${href ? `<a href="${href}">${t}</a>` : `<span aria-current="page">${t}</span>`}</li>`).join('')}
  </ol></nav>`;

/* ═══ Forsiden ════════════════════════════════════════════════════ */

function forsiden() {
  lanMonter();
  const t = lanTilstand();
  const s = t.soknad;
  const rot = document.getElementById('side');
  const hei = `<h1 class="lan-h1 lan-h1--forside"><span>Hei</span>,&nbsp;${lanEsc(lanFulltNavn())}</h1>`;

  if (!s) {
    rot.innerHTML = `${hei}
      <div style="margin-top:2em">
        <h2 class="lan-h4 lan-h4--regular" style="margin-bottom:var(--space-6)">Hva vil du søke om?</h2>
        ${hvaVilDuInnhold(3)}
      </div>
      ${omLanOgTilskudd()}`;
    return;
  }

  const pabegynt = s.status === 'pabegynt';
  rot.innerHTML = `${hei}
    <div style="margin-top:2em">
      ${pabegynt ? `
        <div style="margin-bottom:var(--space-6)">
          <h2 class="lan-h2">Påbegynte søknader</h2>
          <div class="lan-kort">
            <p class="lan-fet">${LAN_SKJEMANAVN}</p>
            <p>Sist endret: ${lanDatoTid(new Date(s.endret))}</p>
            <div class="lan-knappegruppe">
              <a class="lan-knapp lan-knapp--prominent" href="soknad.html">Fortsett<span class="lan-sr"> ${LAN_SKJEMANAVN}</span></a>
              <button type="button" class="lan-knapp lan-knapp--subtil" id="slett">${LAN_IKON.soppel}Slett<span class="lan-sr"> ${LAN_SKJEMANAVN}</span></button>
            </div>
          </div>
        </div>` : `
        <div style="margin-bottom:var(--space-6)">
          <h2 class="lan-h2">Mine søknader</h2>
          <a class="lan-lenkekort" href="min-soknad.html">
            <span>
              <p class="lan-fet">${LAN_SKJEMANAVN}</p>
              <p>${lanDatoTid(new Date(s.sendt))}</p>
              <span class="lan-tag">Sendt</span>
            </span>
            ${LAN_IKON.pilHoyre}
          </a>
        </div>`}
      <div class="lan-knappegruppe" style="margin-bottom:var(--space-6)">
        <a class="lan-knapp" href="hva-vil-du-soke-om.html">Start ny søknad</a>
      </div>
    </div>
    ${omLanOgTilskudd()}`;

  const slett = document.getElementById('slett');
  if (slett) slett.addEventListener('click', async () => {
    const ok = await lanBekreft({ tittel: 'Slett søknad', tekst: 'Er du sikker på at du vil slette søknaden?', bekreft: 'Slett', avbryt: 'Avbryt', destruktiv: true });
    if (ok) { lanNullstill(t.testperson); location.reload(); }
  });
}

/* ═══ Hva vil du søke om? ═════════════════════════════════════════ */

function hvaVilDu() {
  lanMonter();
  document.getElementById('side').innerHTML = `
    ${brodsmuler([[null, 'Hva vil du søke om?']])}
    <h1 class="lan-h2" style="margin:var(--space-4) 0 var(--space-6)">Hva vil du søke om?</h1>
    ${hvaVilDuInnhold(2)}
    ${omLanOgTilskudd()}`;
}

/* ═══ Informasjonssiden ═══════════════════════════════════════════ */

function informasjon() {
  lanMonter();
  const fornavn = lanPerson().fornavn;
  document.getElementById('side').innerHTML = `
    ${brodsmuler([['hva-vil-du-soke-om.html', 'Hva vil du søke om?'], [null, 'Oppgradere bolig']])}
    <h1 class="lan-h1" style="margin-top:var(--space-4)">Søk om lån til å oppgradere bolig</h1>

    <div class="lan-guide lan-guide--stor">
      <img src="img/hb-avatar-poster.svg" alt="">
      <p class="lan-guide__hei">Hei, ${lanEsc(fornavn)}!</p>
      <p data-endret="2">Dette lånet er for deg som skal oppgradere boligen din, enten for å gjøre den mer energieffektiv eller for å gjøre den mer tilgjengelig.</p>
      <div class="lan-panel lan-panel--bla">
        <p class="lan-fet" style="font-size:var(--text-lg)">Viktig informasjon til deg som vil søke</p>
        <ul class="lan-mb0">
          <li>Du kan ikke få lån hvis byggingen allerede har startet.</li>
          <li>Byggearbeidet må starte senest seks måneder etter at lånet er innvilget.</li>
          <li data-endret="3">Prosjektkostnadene må være minst 2G, altså to ganger ${ekstern('https://www.nav.no/grunnbelopet', 'grunnbeløpet i folketrygden')}.</li>
          <li>Lånet kan ikke brukes til refinansiering.</li>
          <li>Vi gir ikke lån til vanlig vedlikehold eller oppussing.</li>
        </ul>
      </div>
      <p class="lan-mb0"><a href="https://www.husbanken.no/person/lan-fra-husbanken/oppgradering/" target="_blank" rel="noopener">Mer om dette lånet (åpnes i ny fane)</a></p>
    </div>

    <div class="lan-panel lan-panel--lilla" style="margin-top:var(--space-6)">
      <h2 class="lan-h3">Velg riktig lån</h2>
      <p>Disse to lånene blir ofte forvekslet. Sjekk hvilket lån som passer for deg.</p>
      <p class="lan-fet lan-mb0">Startlån og tilskudd fra kommunen</p>
      <p>Dette lånet er for deg som skal tilpasse boligen på grunn av alder eller nedsatt funksjonsevne, og ikke får lån i en vanlig bank. I noen kommuner kan du kombinere startlånet med et tilskudd.</p>
      <p>${ekstern('https://husbanken.no/person/startlaan/soke-startlaan-og-tilskudd/', 'Gå til startlån og tilskudd')}</p>
      <p class="lan-fet lan-mb0">Lån til å oppgradere bolig</p>
      <p data-endret="4">Dette lånet er for deg som skal gjøre større oppgraderinger som gjør boligen mer energieffektiv eller mer tilgjengelig.</p>
      <p class="lan-mb0">Les videre hvis det er denne typen oppgradering du skal søke om lån til.</p>
    </div>

    <h2 class="lan-h2">Før du søker</h2>
    <ul>
      <li>Det tar omtrent 20 minutter å søke hvis du har dokumentasjonen klar.</li>
      <li>Du kan ta en pause når som helst. Svarene dine lagres automatisk.</li>
      <li>Hvis du søker sammen med noen, må medlåntakeren logge på og fylle ut et eget skjema etter at du har sendt inn søknaden.</li>
      <li>Saksbehandlingstiden er mellom 3 og 6 uker.</li>
    </ul>

    <div style="margin:var(--space-6) 0">
      <hr class="lan-skille">
      ${lanLesMer('Vi henter og bruker personopplysninger om deg', `
        <p>Husbanken kan innhente og behandle personopplysninger som er nødvendige for å saksbehandle og forvalte våre lån- og tilskuddsordninger, jf. § 10 i Husbankloven. Opplysningene kan også brukes til forskning, statistikk og analyse, test/feilretting og til å kontrollere innvilgede lån/tilskudd.</p>
        <p>For mer informasjon om behandlingen av personopplysninger, herunder retten til å klage (forvaltningsloven § 14), hvilke kilder opplysningene blir hentet fra og hva de skal brukes til, <a href="https://www.husbanken.no/person/lan-fra-husbanken/personvern-personliglanetaker/" target="_blank" rel="noopener">les mer på husbanken.no</a>. Her får du også informasjon om din rett til innsyn, retting, sletting mv. I tillegg får du kontaktopplysninger til personvernombud, informasjon om utlevering av opplysningene, oppbevaringstid for opplysningene mv.</p>`)}
      <hr class="lan-skille">
      ${lanLesMer('Slik søker du sammen med noen', `
        <p>Når du fyller ut søknaden, legger du til de du skal søke sammen med. Disse blir medlåntakere og vil ha like stort ansvar for lånet som deg.</p>
        <p>Når søknaden er sendt inn, får medlåntakere en SMS der vi ber de logge inn og bekrefte om de vil være med på lånet. Vi kan først behandle søknaden når alle har sagt ja.</p>
        <p>Hvis en av dere ikke kan logge på med BankID, må alle <a href="https://husbanken.no/person/lan-fra-husbanken/oppgradering/" target="_blank" rel="noopener">søke på papir</a>.</p>`)}
      <hr class="lan-skille">
      ${lanLesMer('Dokumentasjon du må laste opp', `
        <p>Du må laste opp følgende dokumentasjon på prosjektet:</p>
        <ul><li>Fasade-, snitt- og plantegninger</li><li>Byggebeskrivelse</li></ul>
        <p>Hvilken annen dokumentasjon du må laste opp, kommer an på hva du skal oppgradere:</p>
        <ul data-endret="20">
          <li>Situasjonsplan, kontrakt eller avtale med entreprenør, og rammetillatelse eller igangsettingstillatelse fra kommunen (hvis du skal gjøre boligen mer tilgjengelig)</li>
          <li>Energiattest for boligen (hvis du skal forbedre energikarakteren)</li>
          <li>Uttalelse fra energirådgiver og effektregnskap etter NS 3031:2025 (hvis du skal redusere energiforbruket med minst 30 prosent)</li>
        </ul>
        <p>Du må også dokumentere egenkapital og gjeld. Ut fra hva du svarer i søknaden, kan du bli bedt om å laste opp:</p>
        <ul>
          <li>Kontoutskrift eller bilde fra nettbanken som viser egenkapital</li>
          <li>Betalingsplan eller bilde fra nettbanken som viser gjelden, renten på lånet og terminbeløpet (hvis du har lån)</li>
          <li>Verdivurdering eller e-takst (hvis du selger eiendom for å finansiere oppgraderingen)</li>
          <li>Lånedokument fra banken (hvis du tar opp et annet lån for å finansiere oppgraderingen)</li>
          <li>Erklæring fra giveren (hvis du får gave eller forskudd på arv)</li>
        </ul>`)}
      <hr class="lan-skille">
    </div>

    <button type="button" class="lan-knapp lan-knapp--prominent lan-knapp--stor" id="start">Start søknaden ${LAN_IKON.pilHoyre}</button>`;
  lanInitLesMer(document);

  document.getElementById('start').addEventListener('click', async e => {
    const s = lanTilstand().soknad;
    if (s && s.status === 'pabegynt') {
      const ok = await lanBekreft({
        tittel: 'Du har allerede en påbegynt søknad',
        tekst: 'Denne kopien holder bare én søknad om gangen. Starter du en ny, slettes den du har påbegynt.',
        bekreft: 'Start ny søknad', avbryt: 'Avbryt', destruktiv: true
      });
      if (!ok) return;
    }
    e.target.disabled = true;
    nySoknad();
    location.href = 'soknad.html?steg=kontaktinfosteg';
  });
}

/* ═══ Kvitteringen ════════════════════════════════════════════════ */

function bekreftelse() {
  lanMonter();
  const s = lanTilstand().soknad;
  if (!s || s.status !== 'innsendt') { location.href = 'index.html'; return; }
  const n = (s.data.laanetakereliste || []).length;
  const medlantakerPanel = n ? `
    <div class="lan-panel lan-panel--bla" style="margin-top:var(--space-2)">
      <h3 class="lan-h4">${n === 1 ? 'Vi trenger opplysninger fra medlåntakeren før vi kan behandle søknaden' : 'Vi trenger opplysninger fra alle medlåntakerene før vi kan behandle søknaden'}</h3>
      <p>${n === 1 ? 'Medlåntakeren vil få en SMS fra oss og må logge inn og fylle ut et eget skjema.' : 'Medlåntakerene vil få en SMS fra oss og må logge inn og fylle ut et eget skjema.'}</p>
    </div>` : '';
  document.getElementById('side').innerHTML = `
    <div class="lan-kvittering-bilde">${papirfly()}</div>
    <h1 class="lan-h1" style="margin-top:var(--space-4)">${n ? 'Din del av søknaden er sendt inn' : 'Takk for søknaden'}</h1>
    ${n ? '' : '<p class="lan-ingress">Søknaden er sendt inn.</p>'}
    <p>Du får en kvittering på e-post, og du finner søknaden under Mine søknader.</p>
    <h2 class="lan-h3 lan-mt">Hva skjer videre?</h2>
    ${n ? medlantakerPanel : '<p>En rådgiver vil kontakte deg så snart vi har vurdert søknaden.</p><p>Saksbehandlingstiden er 3 til 6 uker.</p>'}
    <p class="lan-mt"><a class="lan-knapp lan-knapp--prominent" href="min-soknad.html" role="button">Gå til søknaden</a></p>`;
  if (n) document.title = `Din del av søknaden er sendt inn | ${LAN_TJENESTE}`;
  lanFokuserH1();
}

function papirfly() {
  return `<svg width="200" height="150" viewBox="0 0 200 150" role="img" aria-label="Illustrasjon som viser et papirfly for å bekrefte at søknad er sendt inn">
    <path d="M40 120c30-4 52-20 64-44" fill="none" stroke="#b7d89b" stroke-width="3" stroke-dasharray="6 7" stroke-linecap="round"/>
    <path d="M100 70 176 22 150 104 128 86Z" fill="#fff" stroke="#2c4656" stroke-width="3" stroke-linejoin="round"/>
    <path d="M100 70 176 22 128 86 124 108 112 82Z" fill="#e3ecf8" stroke="#2c4656" stroke-width="3" stroke-linejoin="round"/>
    <path d="M176 22 112 82" stroke="#2c4656" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}

/* ═══ Min søknad ══════════════════════════════════════════════════ */

function minSoknad() {
  lanMonter();
  const t = lanTilstand();
  const s = t.soknad;
  if (!s || s.status !== 'innsendt') { location.href = 'index.html'; return; }
  const sendt = new Date(s.sendt);
  const medlantakere = s.data.laanetakereliste || [];
  document.getElementById('side').innerHTML = `
    ${brodsmuler([[null, 'Min søknad']])}
    <div class="lan-illustrasjonspanel">
      <img src="img/illustrasjon-oppgradere-kompakt.svg" alt="Illustrasjon av en person som bærer en planke">
      <div>
        <h1 class="lan-h1">${LAN_SKJEMANAVN}</h1>
        <dl class="lan-metadata"><div><dt>Sendt</dt><dd>${lanDato(sendt)}</dd></div></dl>
      </div>
    </div>
    <div class="lan-knappegruppe">
      <a class="lan-knapp" href="se-soknaden.html">${LAN_IKON.dokument}Se søknaden</a>
      <button type="button" class="lan-knapp lan-knapp--prominent" data-ikke-med="Ettersending av dokumenter er ikke med i denne kopien.">${LAN_IKON.opplasting}Ettersend dokumenter</button>
      <button type="button" class="lan-knapp lan-knapp--subtil" id="trekk">${LAN_IKON.soppel}Trekk søknaden</button>
    </div>

    <h2 class="lan-h2 lan-mt">Dette skjer i saken din</h2>
    <ol class="lan-tidslinje" aria-label="Dette skjer i saken">
      <li>
        <h3>Søknaden er sendt inn</h3>
        <time datetime="${s.sendt}">${lanDatoTid(sendt)}</time>
        <p>Tusen takk! Vi har fått søknaden. Den vil bli behandlet så snart vi kan.</p>
        <a class="lan-knapp lan-knapp--lenke" href="se-soknaden.html">${LAN_IKON.dokument}Se søknaden</a>
      </li>
      <li class="lan-tidslinje--naa" aria-current="step">
        <div class="lan-tidslinje__boks">
          <h3>Vi vil behandle søknaden</h3>
          <p>Vi behandler søknaden, og svarer så snart vi kan. Hvis du har noe du vil legge til, kan du ettersende dokumenter.</p>
          <button type="button" class="lan-knapp lan-knapp--prominent" data-ikke-med="Ettersending av dokumenter er ikke med i denne kopien.">Ettersend dokumenter</button>
        </div>
      </li>
    </ol>

    <h2 class="lan-h2 lan-mt">Søkere</h2>
    <div class="lan-sokerkort">
      <p class="lan-fet" style="display:flex;gap:6px;align-items:center">${LAN_IKON.person}${lanEsc(lanFulltNavn())} (deg selv)</p>
      <p>Hovedlåntaker</p>
      <p class="lan-sokerkort__status">Har sendt ${LAN_IKON.hake}</p>
    </div>
    ${medlantakere.map(p => `
      <div class="lan-sokerkort" style="background:var(--lan-gra)">
        <p class="lan-fet" style="display:flex;gap:6px;align-items:center">${LAN_IKON.person}${lanEsc(p.fulltNavn)}</p>
        <p>Medlåntaker</p>
        <p class="lan-sekundaer lan-liten" style="margin-top:var(--space-2)">Venter på svar</p>
      </div>`).join('')}
    <p><button type="button" class="lan-knapp lan-knapp--subtil" data-ikke-med="Å legge til en medlåntaker etter innsending er ikke med i denne kopien.">${LAN_IKON.pluss}Legg til en medlåntaker</button></p>`;

  document.getElementById('trekk').addEventListener('click', async () => {
    const ok = await lanBekreft({
      tittel: 'Trekk søknaden',
      tekst: ['Er du sikker på at du vil trekke søknaden?', 'Trekker du søknaden vil prosessen avsluttes. Du vil måtte sende inn en ny søknad dersom du likevel ønsker å søke senere.'],
      bekreft: 'Trekk søknaden', avbryt: 'Avbryt', destruktiv: true
    });
    if (ok) { lanNullstill(t.testperson); location.href = 'index.html'; }
  });
}
