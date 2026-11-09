# Lån til å bygge klimavennlig bolig

Klikkbar prototype av søknaden om lån i Husbankens selvbetjeningsløsning,
fra forsiden etter innlogging til innsendt søknad og Min søknad. Versjon 1
er en gjenskaping av dagens søknad om lån til å bygge miljøvennlig bolig
(`MiljovennligBoligSoknad`). Versjon 2 bytter tiltakene med klimakravene.
Laget for å teste flyten fra start til slutt og for å gjøre endringer i den.

- Ingen innlogging. Flyten starter som om man er logget inn med BankID.
- Ingen backend. Svarene lagres bare i nettleseren.
- Opplysningene som ellers hentes fra Folkeregisteret, KRR, Skatteetaten,
  Kartverket og renteoppslaget, er oppdiktede testdata.
- Ingen kildekode, konfigurasjon eller data er kopiert fra Husbankens repo.
  Tekstene, feltene, vilkårene og feilmeldingene er skrevet av derfra, og
  illustrasjonene er appens egne.

## Kjør lokalt

Fra rota av repoet:

```bash
python3 -m http.server 4321
```

Åpne så <http://localhost:4321/lan-miljovennlig-bolig/>.

## Versjonene

Boksen «Versjoner» lar deg hoppe mellom versjonene, på samme side.
Bryteren «Vis endringene» markerer det som er endret, og punktene i lista
tar deg til riktig side og riktig steg. Boksen er den samme som i
papirsøknadene, og lista står i [`assets/versjoner.js`](assets/versjoner.js),
sammen med hvordan du legger til en ny versjon.

| Versjon | Mappe | Hva som endret seg |
| --- | --- | --- |
| 1, 28. september 2026 | `v1/` | Dagens søknad om lån til å bygge miljøvennlig bolig, gjenskapt. |
| 2, 29. september 2026 | denne mappa | Klimavennlig i stedet for miljøvennlig. Oppvarmet kjeller erstatter tiltak og sertifikat, og det er nye steg for klimagassavtrykk, klimagassbudsjett etter NS 3720:2018 og kostnader til klimarådgivning. BTA i stedet for BRA-i, advarsel fra 1000 kvadratmeter, og klimabudsjettet som vedlegg. |

Den siste versjonen ligger alltid rett i `lan-miljovennlig-bolig/`, så lenker
som er delt ut peker på det nyeste. Hver versjon lagrer svarene sine for seg.

## Testpersoner

Stripa øverst lar deg bytte testperson. Da starter søknaden på nytt.

| Testperson | Hva den viser |
| --- | --- |
| Gift, med barn og eiendom | Ektefellen kan legges til som medlåntaker, og tekstene går over til «dere». Barn og eiendom fra registrene. |
| Enslig, uten barn og eiendom | Medlåntaker legges til for hånd, med navn og fødselsnummer. |
| Registrert partner uten mobil i KRR | Ekstra steg for partnerens mobilnummer. |
| Mangler mobil i KRR | Blindveien på første steg. |

## Filene

| Fil | Innhold |
| --- | --- |
| `index.html` | Forsiden: «Hei, Kari Nordmann», ordningene, påbegynte og innsendte søknader. |
| `hva-vil-du-soke-om.html` | «Hva vil du søke om?» |
| `informasjon.html` | Informasjonssiden med «Start søknaden». |
| `soknad.html` | Skjemaet, ett steg om gangen, og oppsummeringen. |
| `bekreftelse.html` | Kvitteringen. |
| `min-soknad.html`, `se-soknaden.html` | Min søknad med tidslinje, og den innsendte søknaden. |
| `assets/steg.js` | **Alle stegene.** Tekster, felt, vilkår, feilmeldinger og vedleggskrav. |
| `assets/skjema.js` | Skjemamotoren: synlighet, validering, navigasjon, lagring og oppsummering. |
| `assets/felles.js` | Testpersoner, header, footer og dialoger. |
| `assets/sider.js` | Sidene rundt skjemaet. |
| `assets/versjoner.js`, `assets/versjoner.css` | Versjonsboksen, felles for alle versjonene. |
| `assets/lan.css` | Utseendet, bygget på `../ds/colors_and_type.css`. |

## Slik endrer du flyten

Alt om stegene står i `assets/steg.js`. Hvert steg er et objekt med `id`,
`tittel` og en liste med `elementer`. Et spørsmål ser slik ut:

```js
{ type: 'janei', felt: 'bolig.oenskergarasje',
  label: 'Ønsker {du} at lånet også skal dekke bygging av garasje?',
  feil: 'Velg om lånet også skal dekke bygging av garasje.' }
```

- **Vis et felt bare noen ganger:** legg til `synlig: d => d['bolig.oenskergarasje'] === true`.
  Et felt som skjules, tømmes. Svaret kommer tilbake om feltet vises igjen.
- **Du eller dere:** skriv `{du}`, `{Du}`, `{deg}`, `{din}`, `{dine}`, `{jeg}` eller `{Jeg}`.
  Motoren bytter til flertall når søkeren låner sammen med noen.
- **Flytt, fjern eller legg til et steg:** endre rekkefølgen i `SKJEMA_STEG`.
  Oppsummeringen følger etter av seg selv.
- **Et nytt vedleggskrav:** legg det i `VEDLEGGSKRAV`. Det dukker opp i
  Vedlegg-steget når vilkåret er oppfylt.
- **En advarsel under et felt:** legg til `advarsel: (v, d) => tekst eller null`.
  Den vises mens man skriver, men stopper ikke Neste.

Typene som finnes er `janei`, `radio`, `avkrysning`, `tekstfelt`, `tall`,
`belop`, `dato`, `tekstomrade`, `kommune` og `fil`, pluss `ingress`, `tekst`,
`panel`, `lesmer`, `vedleggskrav`, `gruppe` og `beregnet`.

## Stegene

Kontaktinformasjon → Medlåntaker → Tiltak (oppvarmet kjeller) →
Klimagassavtrykk → Klimagassbudsjett → Gårds- og bruksnummer → Eiendommen →
Boligen → Byggeprosjektet → Prosjektkostnader → Kjøp av tomten → Utendørs
arbeid → Byggekostnader → Kostnader til klimagassregnskap og -budsjett →
Prosjektering, gebyrer og avgifter → Lånekostnader → Buffer → Totale prosjektkostnader → Lån og
egenkapital → Lånetype og nedbetaling → Barn → Utgifter i husholdningen → Din
personlige økonomi → Din familiesituasjon → Dine inntekter → Eiendom du eier →
Din gjeld → Vedlegg og andre opplysninger → Oppsummering.

Steg som ikke gjelder, hoppes over, akkurat som i dag. «Kjøp av tomten» vises
for eksempel bare når søkeren eier tomten eller skal kjøpe den.

## Avvik fra dagens løsning

- Én søknad om gangen, lagret i nettleseren.
- Språkvalg, utlogging, ettersending og andre
  ordninger enn denne er ikke med. Knappene sier fra om det.
- Fødselsnummeret til en medlåntaker sjekkes bare for 11 siffer, ikke for
  kontrollsiffer og alder.
- Rentene er faste testverdier: 5,1 prosent med betaling hver måned og
  5,15 prosent hver 3. måned.
