# Planteray Cocktail Challenge – installationsguide

Sajten består av två delar:

| Del | Var den ligger | Vad den gör |
|---|---|---|
| **Webbsajten** (mappen `site`) | Netlify (gratis) | Det gästerna ser när de skannar QR-koden, plus adminvyn |
| **Röstdatabasen** (`backend/Code.gs`) | Ett Google-kalkylark du äger | Tar emot och räknar röster, stoppar dubbelröstning |
| **Bilderna** | Mappen "Planteray röstbilder" på din Google Drive | Gästernas bilder på drinkarna |

Det tar ungefär 20 minuter första gången. Du behöver ett Google-konto och ett gratis Netlify-konto.

> **Använd ett vanligt Gmail-konto**, inte ett jobbkonto från Google Workspace. Många företagskonton tillåter inte att filer delas med länk, och då kan bilderna inte visas i bildflödet.

---

## Steg 1 – Skapa röstdatabasen i Google Sheets

1. Gå till [sheets.new](https://sheets.new) och döp kalkylarket till t.ex. **Planteray röster**.
2. Välj **Tillägg → Apps Script**.
3. Radera allt som står i editorn. Klistra in hela innehållet i `backend/Code.gs`. Tryck på **Spara** (diskettikonen).
4. Välj funktionen **setup** i listan överst och tryck **Kör**.
   - Google frågar efter behörighet. Välj ditt konto.
   - Står det *"Google har inte verifierat appen"*: tryck **Avancerat → Gå till (projektnamn)** och sedan **Tillåt**. Det är ditt eget skript, så det är ofarligt.
   - Nu finns fliken **Röster** i kalkylarket och mappen **Planteray röstbilder** på din Drive. Skriptet behöver tillgång till både kalkylarket och Drive.
5. Sätt adminlösenordet: tryck på **kugghjulet (Projektinställningar)** i vänstermenyn. Scrolla ned till **Skriptegenskaper → Lägg till skriptegenskap**:
   - Egenskap: `ADMIN_PASSWORD`
   - Värde: ett lösenord du väljer
   - Tryck **Spara skriptegenskaper**.
6. Publicera som webbapp: **Distribuera → Ny distribution**, klicka på kugghjulet och välj **Webbapp**.
   - Kör som: **Jag**
   - Vem har åtkomst: **Alla** *(viktigt, annars kan gästerna inte rösta)*
   - Tryck **Distribuera** och kopiera **webbappens URL**. Den slutar på `/exec`.

## Steg 2 – Koppla sajten till databasen

Öppna `site/content.js` i en texteditor (t.ex. Anteckningar eller VS Code). Klistra in adressen:

```js
apiUrl: "https://script.google.com/macros/s/XXXXXXXX/exec",
```

Så länge `apiUrl` är tom körs sajten i **demoläge**. Då sparas röster bara i den egna mobilen och adminlösenordet är `demo`.

## Steg 3 – Fyll i innehållet

Allt innehåll finns i `site/content.js`: texter, barer, drinkar och Instagram-konton.

- **Bilder:** lägg filerna i `site/images/` och skriv filnamnet, t.ex. `"images/fjallbris.jpg"`. Kvadratiska bilder på cirka 1000×1000 px och under 500 kB blir bäst. Komprimera gärna med [squoosh.app](https://squoosh.app).
- **Logotyper:** kvadratiska. De visas som cirklar.
- **Instagram:** skriv kontonamnet utan @, t.ex. `"barlagunen"`.
- **Ny drink eller bar:** kopiera ett helt block `{ ... },` och ändra det. Varje drink pekar på en bar via barens `id`.
- **Ändra aldrig en drinks `id` efter att röstningen har startat.** Rösterna sparas på id:t.
- Byt texten om Planteray mot officiell varumärkestext och lägg gärna in deras logga.

## Steg 4 – Publicera sajten på Netlify

1. Gå till [app.netlify.com/drop](https://app.netlify.com/drop) och logga in (gratis).
2. Dra hela mappen **`site`** till sidan. Efter några sekunder är sajten live.
3. Under **Site configuration → Change site name** kan du välja en snyggare adress, t.ex. `planteray-challenge.netlify.app`.

**Uppdatera sajten senare:** gå till sajten i Netlify → **Deploys** och dra in mappen `site` igen. Adressen är densamma, så QR-koden fortsätter att fungera.

## Steg 5 – QR-kod

Skapa en QR-kod till sajtens adress, t.ex. i Canva eller med någon gratis QR-generator. Använd en **statisk** QR-kod som pekar direkt på din adress. "Dynamiska" QR-tjänster kan sluta fungera när en provperiod tar slut. Alla barer använder samma kod.

## Steg 6 – Testa före start

1. Öppna sajten i mobilen och rösta 3 gånger. Den fjärde rösten ska nekas.
2. Kontrollera att rösterna dyker upp i fliken **Röster** i kalkylarket.
3. Öppna `https://din-adress.netlify.app/admin.html` och logga in.
4. Tryck **Nollställ röster** i admin innan tävlingen startar. Teströsterna flyttas då till en arkivflik.

---

## Bilder och bildflödet

- **Gästen måste ta en bild på drinken för att kunna rösta.** På mobilen öppnas kameran direkt. Bilden krymps i mobilen innan den skickas (cirka 250 kB), så det går snabbt även på 4G.
- Gästen kan själv välja **"Visa min bild i bildflödet"**. Rutan är inte förvald. Bara då kan bilden visas på sajten, och bara då kan gästen fylla i sitt Instagram.
- Bilder som gästen inte valt att visa hamnar under **Ej för flödet** i admin och kan aldrig publiceras.
- **Granskning:** som standard hamnar nya bilder under **Att granska** i admin och syns först när du trycker **Godkänn**. Du kan stänga av granskningen i admin, så att bilderna visas direkt. Granskning rekommenderas: flödet är offentligt och syns under Planterays namn, så det är bra att kunna stoppa olämpliga bilder och hålla innehållet måttfullt enligt alkohollagen.
- Bildflödet uppdateras automatiskt för gästerna ungefär varje minut.
- Alla bilder sparas i Drive-mappen med drink, bar och Instagram i filbeskrivningen. Länken till varje bild finns också i kalkylarket.

## Adminvyn

Adress: `/admin.html` på din sajt. Där finns:

- Ställning per drink och per bar, antal röster och unika mobiler. Sidan uppdateras automatiskt var 30:e sekund.
- **Bilder:** godkänn eller dölj bilder till bildflödet, och slå på eller av granskningen.
- **Ladda ned resultat (CSV):** sammanställning som öppnas direkt i Excel.
- **Ladda ned alla röster (CSV):** varje enskild röst med tidpunkt.
- **Stäng/öppna röstningen:** stäng när tävlingen är slut.
- **Nollställ röster:** flyttar alla röster till en arkivflik. Inget raderas.

Lösenordet kontrolleras av Google-skriptet och finns inte i sajtens kod. Det går inte att se genom att granska sidan.

## Så fungerar fuskskyddet

- Varje mobil får ett anonymt slumpat ID när gästen öppnar sajten. Servern tillåter max 3 röster per ID, på olika drinkar. Spärren sitter i Google-skriptet, så den går inte att kringgå genom att ändra i webbläsaren.
- **Varför inte IP-adress?** Google Apps Script får inte veta besökarens IP. Alla gäster på samma bar-wifi delar dessutom samma IP, så en IP-spärr skulle stoppa ärliga gäster.
- **Vad kan gå att fuska med?** Den som rensar webbläsaren eller använder inkognitoläge får ett nytt ID. Håll koll i adminvyn: en drink som plötsligt får många röster inom några minuter syns under *Senaste röster*. Alla röster med tid och webbläsare finns också i kalkylarket.
- Vill du ha hårdare skydd kan man lägga till en **bar-kod** (en kort kod på baren som krävs för att rösta).

## Om du ändrar i `Code.gs` senare

**Har du redan installerat den första versionen (utan bilder)?** Klistra in den nya `Code.gs` över den gamla, spara och **kör `setup` igen**. Då läggs de nya kolumnerna och bildmappen till, och Google frågar efter tillgång till Drive. Gör sedan som nedan.

Spara och välj sedan **Distribuera → Hantera distributioner → pennan (Redigera) → Version: Ny version → Distribuera**. Då behålls samma adress. Väljer du *Ny distribution* får du en ny adress, och då måste `apiUrl` uppdateras.

Ändrar du antalet röster: ändra `MAX_VOTES` i `Code.gs` **och** `maxVotes` i `content.js`, och ändra texten i steg 3 under `howTo`.

## Kapacitet och personuppgifter

- Google Apps Script klarar tusentals röster under tävlingen. Varje röst tar 1–2 sekunder att registrera. Om väldigt många röstar exakt samtidigt kan någon enstaka gäst få meddelandet "försök igen om några sekunder". Rösten går då igenom vid nästa försök.
- Sajten sparar inga namn, e-postadresser eller IP-adresser. Den sparar ett anonymt slump-ID, vald drink, tidpunkt, webbläsartyp och bilden. Gästens Instagram sparas bara om gästen själv fyller i det.
- Bilder kan visa personer. Ta bort Drive-mappen och fliken Röster när tävlingen är avgjord och vinnaren utsedd, och skriv gärna i tävlingsvillkoren hur länge bilderna sparas.
- Bildlänkarna i Drive är svåra att gissa men inte hemliga. Den som har länken kan se bilden, även bilder som inte är med i flödet.

## Filer

```
site/
  index.html     Gästsidan
  admin.html     Adminvyn
  content.js     ← ALLT INNEHÅLL (texter, barer, drinkar, apiUrl)
  style.css      Färger och utseende (färgerna står överst)
  app.js         Gästsidans logik
  admin.js       Adminvyns logik
  api.js         Kommunikation med Google
  images/        Bilder och logotyper
backend/
  Code.gs        Klistras in i Google Apps Script
```
