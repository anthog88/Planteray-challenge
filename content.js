/* =====================================================================
   INNEHÅLL FÖR RÖSTNINGSSAJTEN
   ---------------------------------------------------------------------
   Allt du behöver ändra finns i den här filen. Ändra texterna mellan
   citattecknen "så här". Glöm inte kommatecknen mellan raderna.

   Bilder: lägg bildfilen i mappen "images" och skriv filnamnet nedan,
   t.ex. "images/mojito.jpg". Kvadratiska bilder (t.ex. 1000x1000 px)
   blir snyggast. Logotyper blir runda, så kvadratiska fungerar bäst.
   ===================================================================== */

window.CONTEST = {

  /* --- KOPPLING TILL GOOGLE-KALKYLARKET ---------------------------------
     Klistra in webbapp-adressen från Apps Script här (se GUIDE.md).
     Lämnar du den tom körs sajten i DEMO-läge: röster sparas bara i den
     egna mobilen och lösenordet till admin är "demo". */
  apiUrl: "https://script.google.com/macros/s/AKfycbz2vtXaSFnDF_5RnymRGwbSh6mHp-oIR3yNK_GfKcVoCnbeI-kXHDzPyACb1q9PtbcN/exec",

  /* Antal röster per gäst. Måste vara samma som MAX_VOTES i Google-skriptet. */
  maxVotes: 3,

  /* --- ÅLDERSSPÄRR (visas innan man kommer in på sidan) ------------------ */
  ageGate: {
    title: "Är du 18 år eller äldre?",
    text: "Sidan innehåller information om alkohol och är bara till för dig som har fyllt 18\u00a0år.",
    yes: "Ja, jag är 18 år eller äldre",
    no: "Nej, jag är under 18",
    denied: "Du måste vara 18 år eller äldre för att besöka sidan.",
    small: "Njut ansvarsfullt."
  },

  /* --- STARTSIDA -------------------------------------------------------- */
  eventName: "Planteray Destination: Slussen",
  tagline: "Slussens bästa romcocktail",
  intro: "Barer har skapat varsin cocktail med Planteray, prova alla & rösta fram din favorit!",
  period: "Röstningen pågår 14\u00a0december\u00a0– 31\u00a0januari",

  /* Ruta under rubriken "Cocktails" om tävlingen för gästerna */
  prize: {
    title: "Vinn ett Planteray-kit!",
    text: "Rösta på 3 cocktails med ditt Instagram ifyllt varje gång och tagga barens Instagram, så är du med och tävlar om ett Planteray-kit."
  },

  /* Kort text om varumärket. Byt gärna mot officiell text från Planteray. */
  brandTitle: "Om Planteray",
  /* Länkar skrivs så här: [text som visas](https://adress.se) */
  brandText:
    "Planteray Rum är resultatet av ett kreativt samarbete mellan den franska cognacsproducenten " +
    "[Maison Ferrand](https://springwine.se/producenter/sprit/brandy-och-cognac/cognac-ferrand/) " +
    "& de bästa romproducenterna runt om i världen. Från Karibien, Syd- och Centralamerika väljer dom " +
    "noggrant ut rom från respektive destilleri. Rommen lagras i produktionsregionen & skeppas sedan över " +
    "till Frankrike för den slutliga lagringen. Hantverksarbetet och den karakteristiska dubbellagringen har " +
    "gett Planteray och ägaren Alexandre Gabriel en oerhört aktad ställning i dryckesvärlden & de är idag " +
    "närmast kultförklarade både av bartenders och romfantaster.",

  howTo: [
    { title: "Beställ och smaka", text: "Beställ tävlingsdrinken på någon av de deltagande barerna." },
    { title: "Fota och rösta", text: "Tryck på Rösta vid drinken och ta en bild på den med mobilen. Bilden bekräftar din röst." },
    { title: "Du har 3 röster", text: "Du kan rösta på tre olika drinkar. Vill du kan din bild visas i bildflödet, gärna med ditt Instagram." }
  ],

  /* Liten text längst ned på sidan */
  footer: "Arrangeras av Spring Wine & Spirits. Njut ansvarsfullt. 18\u00a0år.",

  /* --- BARERNA ----------------------------------------------------------
     id:        kort unikt namn utan mellanslag/å/ä/ö. Används av drinkarna.
     instagram: kontonamnet UTAN @, t.ex. "barlagunen"
     mapsUrl:   länk till Google Maps (valfri). Lämnas den tom skapas
                en kartlänk automatiskt från adressen. */
  bars: [
    {
      id: "lagunen",
      name: "Bar Lagunen",
      city: "Åre",
      description: "Exempeltext. Avslappnad cocktailbar med utsikt över sjön och fokus på tropiska klassiker.",
      address: "Exempelgatan 1, 837 52 Åre",
      mapsUrl: "",
      website: "https://example.com",
      instagram: "exempelbar_1",
      logo: "images/bar-1-logo.svg"
    },
    {
      id: "fjallsjon",
      name: "Restaurang Fjällsjön",
      city: "Åre",
      description: "Exempeltext. Restaurang med fjällnära råvaror och en bar som gillar att experimentera.",
      address: "Exempelvägen 2, 837 52 Åre",
      mapsUrl: "",
      website: "https://example.com",
      instagram: "exempelbar_2",
      logo: "images/bar-2-logo.svg"
    },
    {
      id: "kajen",
      name: "Cocktailbaren Kajen",
      city: "Stockholm",
      description: "Exempeltext. Liten bar vid vattnet med ett kort men genomtänkt cocktailmeny.",
      address: "Exempelkajen 3, 111 11 Stockholm",
      mapsUrl: "",
      website: "",
      instagram: "exempelbar_3",
      logo: "images/bar-3-logo.svg"
    },
    {
      id: "tropik",
      name: "Bistro Tropik",
      city: "Göteborg",
      description: "Exempeltext. Bistro med karibiska smaker och en rombar med över 50 sorter.",
      address: "Exempelplatsen 4, 411 11 Göteborg",
      mapsUrl: "",
      website: "https://example.com",
      instagram: "exempelbar_4",
      logo: "images/bar-4-logo.svg"
    }
  ],

  /* --- DRINKARNA --------------------------------------------------------
     id:    kort unikt namn utan mellanslag/å/ä/ö. ÄNDRA INTE id efter att
            röstningen har startat, då tappar drinken sina röster i admin.
     bar:   samma id som baren ovan. */
  drinks: [
    {
      id: "solnedgang",
      name: "Solnedgång i Åre",
      bar: "lagunen",
      image: "images/drink-1.svg",
      description: "Exempeltext. Fruktig och frisk sour med ananas och en touch av kanel.",
      ingredients: ["Planteray 3 Stars", "Ananas", "Lime", "Kanelsirap", "Äggvita"]
    },
    {
      id: "fjallbris",
      name: "Fjällbris",
      bar: "fjallsjon",
      image: "images/drink-2.svg",
      description: "Exempeltext. Highball med rabarber och tonic. Lätt och törstsläckande.",
      ingredients: ["Planteray O.F.T.D.", "Rabarbercordial", "Tonic", "Citron"]
    },
    {
      id: "kajtiki",
      name: "Kajens Tiki",
      bar: "kajen",
      image: "images/drink-3.svg",
      description: "Exempeltext. Klassisk tiki med passionsfrukt, mandel och mynta.",
      ingredients: ["Planteray Original Dark", "Passionsfrukt", "Orgeat", "Lime", "Mynta"]
    },
    {
      id: "tropiskold",
      name: "Tropisk Old Fashioned",
      bar: "tropik",
      image: "images/drink-4.svg",
      description: "Exempeltext. Rund och komplex old fashioned med banan och apelsinzest.",
      ingredients: ["Planteray Xaymaca", "Banansirap", "Angostura", "Apelsinzest"]
    }
  ]
};
