'use strict';

/**
 * Teneriffa Urlaubssimulator – Spieldaten
 * Alle Orte, Aktivitäten, Wetterlagen, Ereignisse, Fotos, Erfolge und Levels.
 */
const DATA = (() => {

  // ---------------------------------------------------------------- Wetter
  const WETTER = {
    sonnig:  { name: 'Sonnig',          icon: '☀️', faktor: 1.00, sonne: 3 },
    leicht:  { name: 'Leicht bewölkt',  icon: '🌤️', faktor: 0.95, sonne: 2 },
    wolkig:  { name: 'Wolkig',          icon: '⛅',  faktor: 0.85, sonne: 1 },
    bedeckt: { name: 'Bedeckt',         icon: '☁️', faktor: 0.70, sonne: 1 },
    regen:   { name: 'Regnerisch',      icon: '🌧️', faktor: 0.45, sonne: 0 },
    windig:  { name: 'Stürmisch',       icon: '💨',  faktor: 0.70, sonne: 2 },
    calima:  { name: 'Calima (Saharastaub)', icon: '🌫️', faktor: 0.60, sonne: 3 },
  };

  // Realistische Mikroklimata: Süden sonnenverwöhnt, Norden wechselhaft (Passatwolken)
  const WETTER_CHANCEN = {
    sued:  [['sonnig', 60], ['leicht', 24], ['wolkig', 10], ['bedeckt', 3], ['regen', 2], ['windig', 1]],
    nord:  [['sonnig', 28], ['leicht', 26], ['wolkig', 22], ['bedeckt', 13], ['regen', 9], ['windig', 2]],
    teide: [['sonnig', 55], ['leicht', 15], ['wolkig', 14], ['bedeckt', 4], ['windig', 12]],
  };

  // ----------------------------------------------------------------- Zonen
  const ZONEN = {
    hotel: { name: 'Dein Hotel',            icon: '🏨', wetter: null },
    sued:  { name: 'Südküste',              icon: '🏖️', wetter: 'sued' },
    west:  { name: 'Westküste & Teno',      icon: '⛰️', wetter: 'sued' },
    teide: { name: 'Teide-Nationalpark',    icon: '🌋', wetter: 'teide' },
    nord:  { name: 'Nordküste',             icon: '🌊', wetter: 'nord' },
    anaga: { name: 'Nordosten & Anaga',     icon: '🌿', wetter: 'nord' },
  };

  // Entfernungen in "Hops" (grobe Fahretappen)
  const HOPS = {
    'sued|west': 1, 'sued|teide': 1, 'sued|nord': 2, 'sued|anaga': 2,
    'west|teide': 1, 'west|nord': 1, 'west|anaga': 2,
    'teide|nord': 1, 'teide|anaga': 2,
    'nord|anaga': 1,
  };

  function hops(a, b) {
    if (a === b || a === 'hotel' || b === 'hotel') return 0;
    return HOPS[a + '|' + b] || HOPS[b + '|' + a] || 0;
  }

  // ------------------------------------------------------------- Transport
  const TRANSPORT = {
    mietwagen: {
      name: 'Mietwagen', icon: '🚗', kostenProTag: 28,
      hopKosten: 4, hopEnergie: 4,
      desc: 'Volle Freiheit auf der Insel. 28 € pro Tag plus Sprit, dafür bequem und schnell.',
    },
    bus: {
      name: 'TITSA-Bus', icon: '🚌', kostenProTag: 0,
      hopKosten: 3, hopEnergie: 8,
      desc: 'Die grünen Linienbusse fahren fast überall hin. Günstig, aber langsamer und anstrengender.',
    },
  };

  // ------------------------------------------------------------- Mietwagen
  // Gute und schlechte Autos: Tempo, Fahrverhalten, Gelände und Look
  const AUTOS = {
    klein: { name: 'Kleinwagen „Pulpo“', icon: '🚙', preisProTag: 22,
      tempo: 23, lenk: 1.5, grip: 0.95, gelaende: 0.5, farbe: '#d8d8d8', dunkel: '#9b9ba4', hell: '#f2f2f2',
      desc: 'Billig, wendig, etwas müde am Berg. Die Delle hinten war schon da – ehrlich.' },
    kompakt: { name: 'Kompakter „Insel-Flitzer“', icon: '🚗', preisProTag: 28,
      tempo: 26, lenk: 1.4, grip: 1, gelaende: 0.55, farbe: '#e63946', dunkel: '#a12633', hell: '#f2606c',
      desc: 'Der solide Klassiker: ausgewogen, zuverlässig, in Mietwagen-Rot.' },
    cabrio: { name: 'Cabrio „Sunset“', icon: '🏎️', preisProTag: 42,
      tempo: 31, lenk: 1.7, grip: 0.9, gelaende: 0.45, farbe: '#ffd166', dunkel: '#c99b2f', hell: '#ffe8a3',
      desc: 'Schnell, direkt, Haare im Wind – aber bei Regen tänzelt das Heck.' },
    jeep: { name: 'Alter Jeep „Barranco“', icon: '🛻', preisProTag: 32,
      tempo: 24, lenk: 1.25, grip: 1.08, gelaende: 0.85, farbe: '#2a9d8f', dunkel: '#1e6f66', hell: '#5fc4b8',
      desc: 'Gemütlich auf Asphalt, unbeirrbar daneben: Schotter und Pisten machen ihm nichts aus.' },
  };

  // ------------------------------------------------------------ Unterkünfte
  const REGIONEN = {
    sued: { name: 'Costa Adeje (Süden)', icon: '🏖️',
            desc: 'Sonnengarantie, goldene Strände, Promenaden. Der Klassiker.' },
    nord: { name: 'Puerto de la Cruz (Norden)', icon: '🌺',
            desc: 'Grün, authentisch, kanarische Altstadt – dafür wechselhafteres Wetter.' },
  };

  // Hotels je Region – im Norden u. a. das Bahía Príncipe San Felipe
  const HOTELS = {
    sued: {
      spar:    { name: 'Pensión Casa Lola', sterne: '★★', budgetProTag: 85,
                 regen: 0,  erholungNacht: 0,
                 desc: 'Einfach, sauber, familiär – zwei Gassen vom Strand. Mehr Budget für Ausflüge.' },
      komfort: { name: 'Hotel Playa Azul', sterne: '★★★★', budgetProTag: 130,
                 regen: 6,  erholungNacht: 1,
                 desc: 'Pool-Landschaft, Buffet, Meerblick gegen Aufpreis. Der solide Klassiker der Costa Adeje.' },
      deluxe:  { name: 'Gran Hotel Bahía del Duque', sterne: '★★★★★', budgetProTag: 210,
                 regen: 12, erholungNacht: 2,
                 desc: 'Die Grande Dame der Costa Adeje: Palmengärten, Privatstrand, Spa. Erholung ab Nacht eins.' },
    },
    nord: {
      spar:    { name: 'Pensión Los Geranios', sterne: '★★', budgetProTag: 85,
                 regen: 0,  erholungNacht: 0,
                 desc: 'Kanarisches Stadthaus in der Altstadt von Puerto – Holzbalkon und Blumentöpfe inklusive.' },
      komfort: { name: 'Hotel Bahía Príncipe San Felipe', sterne: '★★★★', budgetProTag: 130,
                 regen: 6,  erholungNacht: 1,
                 desc: 'Die Hochhaus-Ikone an der Playa Martiánez: Meerblick-Zimmer, große Poolterrasse, Abendshows.' },
      deluxe:  { name: 'Hotel Botánico & Oriental Spa', sterne: '★★★★★', budgetProTag: 210,
                 regen: 12, erholungNacht: 2,
                 desc: 'Herrschaftlich über Puerto de la Cruz, mit einem der besten Spas Spaniens. Teide-Blick vom Balkon.' },
    },
  };

  // ---------------------------------------------------------------- Gepäck
  const ITEMS = {
    sonnencreme:  { name: 'Sonnencreme LSF 50', icon: '🧴', preis: 12,
                    desc: 'Pflicht auf Teneriffa – die Sonne ist stärker, als sie sich anfühlt.' },
    wanderschuhe: { name: 'Wanderschuhe', icon: '🥾', preis: 45,
                    desc: 'Masca, Anaga & Teide machen mit gutem Schuhwerk viel weniger müde.' },
    schnorchelset:{ name: 'Schnorchelset', icon: '🤿', preis: 25,
                    desc: 'Mit etwas Glück triffst du am Strand eine Meeresschildkröte.' },
    reisefuehrer: { name: 'Reiseführer', icon: '📖', preis: 15,
                    desc: 'Verrät dir Geheimtipps – zum Beispiel, wo die Einheimischen essen.' },
  };

  // ------------------------------------------------------------ Aktivitäten
  // energie: negativ = anstrengend | sonne 0–3 = Sonnenexposition | outdoor 0–3 = Wetterabhängigkeit
  const AKTIVITAETEN = [
    // ————— Hotel —————
    { id: 'pool', name: 'Pool & Sonnenliege', icon: '🏊', zone: 'hotel',
      slots: [0, 1], dauer: 1, kosten: 0, energie: +12, erholung: +12, stimmung: +6, erlebnis: 2,
      stress: -6, sonne: 2, outdoor: 1, tags: ['entspannung'],
      desc: 'Liege reservieren, Buch aufschlagen, Piña Colada. Urlaub kann so einfach sein.' },
    { id: 'siesta', name: 'Siesta im kühlen Zimmer', icon: '😴', zone: 'hotel',
      slots: [1], dauer: 1, kosten: 0, energie: +22, erholung: +8, stimmung: +3, erlebnis: 0,
      stress: -8, sonne: 0, outdoor: 0, tags: ['entspannung'],
      desc: 'Die Kanarier wissen, warum. Mittagshitze verschlafen, abends fit sein.' },
    { id: 'balkon', name: 'Sonnenuntergang auf dem Balkon', icon: '🌅', zone: 'hotel',
      slots: [2], dauer: 1, kosten: 0, energie: +15, erholung: +10, stimmung: +6, erlebnis: 3,
      stress: -6, sonne: 0, outdoor: 1, tags: ['entspannung'], flagge: 'fruehSchlafen',
      foto: 'sonnenuntergang', fotoWetter: ['sonnig', 'leicht'],
      desc: 'Früher Abend, Blick aufs Meer, danach ins Bett. Morgen bist du topfit.' },
    { id: 'hotelrestaurant', name: 'Abendessen im Hotel', icon: '🍽️', zone: 'hotel',
      slots: [2], dauer: 1, kosten: 18, energie: +8, erholung: +8, stimmung: +5, erlebnis: 4,
      sonne: 0, outdoor: 0, stress: -3, tags: ['restaurant', 'entspannung'],
      desc: 'Buffet mit Blick auf den Pool. Kein Abenteuer, aber verlässlich gut.' },
    { id: 'spa', name: 'Spa & Wellness im Hotel', icon: '🧖', zone: 'hotel',
      slots: [0, 1], dauer: 1, kosten: 35, energie: +10, erholung: +14, stimmung: +6, erlebnis: 3,
      sonne: 0, outdoor: 0, stress: -16, nurHotel: ['komfort', 'deluxe'], tags: ['entspannung'],
      desc: 'Massage, Dampfbad, Ruheraum mit Meerblick. Der Stress bleibt an der Tür.' },
    { id: 'spieleabend', name: 'Spieleabend: Farkle in der Hotelbar', icon: '🎲', zone: 'hotel',
      slots: [2], dauer: 1, kosten: 6, energie: +8, erholung: +6, stimmung: +5, erlebnis: 5,
      stress: -5, sonne: 0, outdoor: 0, tags: ['entspannung'],
      desc: 'In der Hotelbar rasseln die Würfel: Karl aus Wuppertal fordert dich zum Farkle heraus.' },

    // ————— Südküste —————
    { id: 'playa-americas', name: 'Strandtag Playa de las Américas', icon: '🏖️', zone: 'sued',
      slots: [0, 1], dauer: 1, kosten: 8, energie: -12, erholung: +14, stimmung: +10, erlebnis: 8,
      stress: -4, sonne: 3, outdoor: 3, blockiertBei: ['regen'], tags: ['strand'],
      desc: 'Liegen, Eis, Atlantikrauschen. Zwischen Los Cristianos und Las Américas tobt das Strandleben.' },
    { id: 'siampark', name: 'Siam Park (Ganztag)', icon: '🎢', zone: 'sued',
      slots: [0], dauer: 2, kosten: 42, energie: -32, erholung: +6, stimmung: +22, erlebnis: 26,
      sonne: 2, outdoor: 2, blockiertBei: ['regen'], tags: ['action'], foto: 'siampark',
      desc: 'Einer der besten Wasserparks der Welt. Tower of Power: 28 Meter fast senkrecht.' },
    { id: 'whalewatching', name: 'Wal-Beobachtung ab Los Cristianos', icon: '🐋', zone: 'sued',
      slots: [0, 1], dauer: 1, kosten: 38, energie: -10, erholung: +8, stimmung: +14, erlebnis: 22,
      sonne: 2, outdoor: 2, blockiertBei: ['windig', 'regen'], tags: ['natur', 'boot'], foto: 'wal',
      desc: 'Vor der Südwestküste leben Grindwale das ganze Jahr. Sichtungsquote: sehr hoch.' },
    { id: 'surfkurs', name: 'Surfkurs in El Médano', icon: '🏄', zone: 'sued',
      slots: [0, 1], dauer: 1, kosten: 45, energie: -30, erholung: +2, stimmung: +16, erlebnis: 24,
      sonne: 2, outdoor: 3, blockiertBei: ['regen'], tags: ['action', 'strand'],
      desc: 'Der Wind von El Médano ist legendär. Nach zwei Stunden stehst du – vielleicht.' },
    { id: 'lacaleta', name: 'Fischessen in La Caleta', icon: '🐟', zone: 'sued',
      slots: [2], dauer: 1, kosten: 28, energie: -6, erholung: +10, stimmung: +12, erlebnis: 12,
      stress: -4, sonne: 0, outdoor: 0, tags: ['restaurant'], foto: 'papas',
      desc: 'Frischer Fisch, Papas arrugadas con Mojo, Meerblick. Das alte Fischerdorf kann Abendessen.' },
    { id: 'promenade', name: 'Abendbummel an der Promenade', icon: '🌴', zone: 'sued',
      slots: [2], dauer: 1, kosten: 6, energie: -8, erholung: +6, stimmung: +8, erlebnis: 6,
      stress: -3, sonne: 0, outdoor: 1, tags: ['bummeln'],
      foto: 'sonnenuntergang', fotoWetter: ['sonnig', 'leicht'],
      desc: 'Von Los Cristianos bis La Caleta am Meer entlang. Straßenkünstler inklusive.' },
    { id: 'cocktailbar', name: 'Cocktailbar & Livemusik', icon: '🍹', zone: 'sued',
      slots: [2], dauer: 1, kosten: 22, energie: -12, erholung: +4, stimmung: +14, erlebnis: 10,
      sonne: 0, outdoor: 0, tags: ['party'],
      desc: 'Mojito, Meeresrauschen, eine Band spielt Bamboléo. Der Abend wird länger als geplant.' },
    { id: 'abades', name: 'Schnorchel- & Tauchausflug Abades', icon: '🤿', zone: 'sued',
      slots: [0, 1], dauer: 1, kosten: 55, energie: -22, erholung: +6, stimmung: +14, erlebnis: 26,
      sonne: 2, outdoor: 2, blockiertBei: ['windig', 'regen'], tags: ['action', 'natur'],
      foto: 'schildkroete', minLevel: 3,
      desc: 'Glasklares Wasser, vulkanische Riffe – und mit Glück Grüne Meeresschildkröten.' },
    { id: 'barranco', name: 'Barranco del Infierno (Adeje)', icon: '🏜️', zone: 'sued',
      slots: [0, 1], dauer: 1, kosten: 9, energie: -24, energieMitSchuhen: -18,
      erholung: +6, stimmung: +10, erlebnis: 18,
      sonne: 2, outdoor: 3, blockiertBei: ['regen'], tags: ['wandern', 'natur'], foto: 'barranco',
      desc: 'Die „Höllenschlucht“ mit Wasserfall am Ende – Zutritt limitiert, also früh reservieren.' },
    { id: 'paragliding', name: 'Paragliding über Adeje', icon: '🪂', zone: 'sued',
      slots: [0, 1], dauer: 1, kosten: 95, energie: -18, erholung: 0, stimmung: +24, erlebnis: 34,
      sonne: 1, outdoor: 3, blockiertBei: ['windig', 'regen'], tags: ['action'],
      foto: 'paragliding', minLevel: 4,
      desc: 'Vom Ifonche-Plateau über die Küste segeln. Teneriffa aus der Bussard-Perspektive.' },
    { id: 'tejita', name: 'Playa La Tejita & Montaña Roja', icon: '🏜️', zone: 'sued',
      slots: [0, 1], dauer: 1, kosten: 5, energie: -14, erholung: +14, stimmung: +10, erlebnis: 14,
      stress: -5, sonne: 3, outdoor: 3, blockiertBei: ['regen', 'windig'], tags: ['strand', 'natur'],
      foto: 'tejita',
      desc: 'Einer der längsten Naturstrände der Insel, überragt vom roten Vulkankegel. Wild und wunderbar leer.' },
    { id: 'duque', name: 'Goldstrand Playa del Duque', icon: '🏖️', zone: 'sued',
      slots: [0, 1], dauer: 1, kosten: 12, energie: -10, erholung: +16, stimmung: +10, erlebnis: 12,
      stress: -6, sonne: 3, outdoor: 3, blockiertBei: ['regen'], tags: ['strand'],
      desc: 'Feiner goldener Sand, Strandpavillons, glasklares Wasser – der eleganteste Strand der Costa Adeje.' },
    { id: 'siammall', name: 'Familien-Shopping in der Siam Mall', icon: '🛍️', zone: 'sued',
      slots: [0, 1], dauer: 1, kosten: 30, energie: -12, erholung: +2, stimmung: +8, erlebnis: 10,
      sonne: 0, outdoor: 0, tags: ['bummeln'], nurGruppe: 'familie',
      desc: 'Die Familie stürmt die Läden – und du? Suchst mal wieder einen Parkplatz. Wer ist schneller?' },
    { id: 'karting', name: 'Kartbahn Teneriffa Süd', icon: '🏎️', zone: 'sued',
      slots: [0, 1], dauer: 1, kosten: 30, energie: -18, erholung: 0, stimmung: +18, erlebnis: 20,
      sonne: 1, outdoor: 2, blockiertBei: ['regen'], tags: ['action'],
      desc: 'Vollgas auf einer der besten Kartbahnen Europas – hier testet sogar mancher Profi im Winter.' },

    // ————— Westküste & Teno —————
    { id: 'masca', name: 'Masca-Schlucht-Wanderung (Ganztag)', icon: '🏞️', zone: 'west',
      slots: [0], dauer: 2, kosten: 20, energie: -45, energieMitSchuhen: -34,
      erholung: +4, stimmung: +16, erlebnis: 32,
      sonne: 2, outdoor: 3, blockiertBei: ['regen'], tags: ['wandern', 'natur'], foto: 'masca',
      desc: 'Vom Bergdorf durch die Schlucht bis zum Meer, zurück per Boot. Anstrengend – und unvergesslich.' },
    { id: 'losgigantes', name: 'Bootstour Los Gigantes', icon: '⛵', zone: 'west',
      slots: [0, 1], dauer: 1, kosten: 35, energie: -8, erholung: +10, stimmung: +12, erlebnis: 18,
      sonne: 2, outdoor: 2, blockiertBei: ['windig', 'regen'], tags: ['boot', 'natur'], foto: 'klippen',
      desc: '450 Meter hohe Steilklippen vom Wasser aus. Die Guanchen nannten sie „Mauer der Hölle“.' },
    { id: 'garachico', name: 'Naturpools El Caletón (Garachico)', icon: '💦', zone: 'west',
      slots: [0, 1], dauer: 1, kosten: 5, energie: -14, erholung: +12, stimmung: +10, erlebnis: 14,
      stress: -4, sonne: 2, outdoor: 3, blockiertBei: ['windig', 'regen'], tags: ['strand', 'natur'], foto: 'caleton',
      desc: 'Ein Lavastrom formte 1706 diese Meerwasserbecken. Baden im erstarrten Vulkan.' },
    { id: 'icod', name: 'Drachenbaum & Altstadt von Icod', icon: '🌳', zone: 'west',
      slots: [0, 1], dauer: 1, kosten: 7, energie: -10, erholung: +6, stimmung: +6, erlebnis: 12,
      sonne: 1, outdoor: 1, tags: ['kultur'], foto: 'drachenbaum',
      desc: 'Der „Drago Milenario“ ist das Wahrzeichen der Insel – angeblich fast 1000 Jahre alt.' },
    { id: 'teno', name: 'Leuchtturm Punta de Teno', icon: '🗼', zone: 'west',
      slots: [0, 1], dauer: 1, kosten: 4, energie: -12, erholung: +8, stimmung: +8, erlebnis: 14,
      sonne: 2, outdoor: 2, blockiertBei: ['windig'], tags: ['natur'], foto: 'teno',
      desc: 'Der westlichste Punkt der Insel. Die Straße dorthin klebt spektakulär am Fels.' },
    { id: 'chinyero', name: 'Chinyero-Vulkanrunde', icon: '🌑', zone: 'west',
      slots: [0, 1], dauer: 1, kosten: 0, energie: -22, energieMitSchuhen: -16,
      erholung: +8, stimmung: +10, erlebnis: 18,
      sonne: 2, outdoor: 3, tags: ['wandern', 'natur'], foto: 'chinyero',
      desc: 'Rund um den jüngsten Vulkan der Insel (Ausbruch 1909): schwarze Lava, Kiefern, große Stille.' },
    { id: 'cueva', name: 'Lavatunnel Cueva del Viento', icon: '🕳️', zone: 'west',
      slots: [0, 1], dauer: 1, kosten: 20, energie: -15, erholung: +2, stimmung: +10, erlebnis: 22,
      sonne: 0, outdoor: 0, tags: ['natur', 'action'], foto: 'lavatunnel',
      desc: 'Einer der längsten Lavatunnel der Welt, mit Helm und Stirnlampe. Perfekt für wolkige Tage.' },

    // ————— Teide-Nationalpark —————
    { id: 'teide', name: 'Seilbahn auf den Teide', icon: '🚡', zone: 'teide',
      slots: [0, 1], dauer: 1, kosten: 40, energie: -15, erholung: +4, stimmung: +14, erlebnis: 28,
      sonne: 2, outdoor: 2, blockiertBei: ['windig'], tags: ['natur'],
      foto: 'teide-gipfel', fotoWetter: ['sonnig', 'leicht'],
      desc: 'In 8 Minuten auf 3.555 m. Spaniens höchster Berg – für den Gipfel bräuchtest du ein Permit.' },
    { id: 'roques', name: 'Wanderung Roques de García', icon: '🪨', zone: 'teide',
      slots: [0, 1], dauer: 1, kosten: 0, energie: -25, energieMitSchuhen: -18,
      erholung: +8, stimmung: +10, erlebnis: 20,
      sonne: 2, outdoor: 3, tags: ['wandern', 'natur'], foto: 'roques',
      desc: 'Mondlandschaft aus Lava und Fels, der Teide immer im Rücken. Der berühmteste Rundweg der Insel.' },
    { id: 'paisaje', name: 'Wanderung Paisaje Lunar (Ganztag)', icon: '🌕', zone: 'teide',
      slots: [0], dauer: 2, kosten: 5, energie: -36, energieMitSchuhen: -27,
      erholung: +8, stimmung: +12, erlebnis: 26,
      sonne: 2, outdoor: 3, blockiertBei: ['regen'], tags: ['wandern', 'natur'], foto: 'paisaje-lunar',
      desc: 'Oberhalb von Vilaflor: weiße Bimsstein-Türme wie auf dem Mond. Ein Geheimtipp unter Wanderern.' },
    { id: 'sterne', name: 'Sternenhimmel am Teide', icon: '✨', zone: 'teide',
      slots: [2], dauer: 1, kosten: 20, energie: -15, erholung: +6, stimmung: +16, erlebnis: 22,
      stress: -5, sonne: 0, outdoor: 3, blockiertBei: ['regen'], tags: ['natur'],
      foto: 'sterne', fotoWetter: ['sonnig', 'leicht'],
      desc: 'Über den Wolken, kaum Lichtverschmutzung – einer der besten Sternenhimmel Europas.' },

    // ————— Nordküste —————
    { id: 'puerto', name: 'Puerto de la Cruz & Playa Jardín', icon: '🌊', zone: 'nord',
      slots: [0, 1], dauer: 1, kosten: 10, energie: -14, erholung: +10, stimmung: +10, erlebnis: 14,
      sonne: 2, outdoor: 2, blockiertBei: ['regen'], tags: ['strand', 'kultur', 'bummeln'],
      desc: 'Schwarzer Sand, alte Hafenpromenade, kanarisches Lebensgefühl statt Bettenburg.' },
    { id: 'loroparque', name: 'Loro Parque (Ganztag)', icon: '🦜', zone: 'nord',
      slots: [0], dauer: 2, kosten: 44, energie: -25, erholung: +10, stimmung: +18, erlebnis: 26,
      sonne: 1, outdoor: 1, stress: -5, tags: ['familie'], foto: 'loro',
      desc: 'Die größte Papageien-Sammlung der Welt, Pinguine im Kunstschnee. Ein voller Tag.' },
    { id: 'botanico', name: 'Botanischer Garten', icon: '🌺', zone: 'nord',
      slots: [0, 1], dauer: 1, kosten: 5, energie: -8, erholung: +12, stimmung: +6, erlebnis: 10,
      stress: -6, sonne: 1, outdoor: 2, tags: ['natur', 'kultur'],
      desc: 'Seit 1788 sammeln sich hier tropische Pflanzen aus aller Welt. Eine grüne Oase.' },
    { id: 'brunellis', name: 'Steakabend im Brunelli’s', icon: '🥩', zone: 'nord',
      slots: [2], dauer: 1, kosten: 55, energie: -6, erholung: +8, stimmung: +16, erlebnis: 16,
      stress: -8, sonne: 0, outdoor: 0, tags: ['restaurant'],
      desc: 'Das berühmte Steakhouse über der Brandung von Punta Brava – 800°-Grill, Panoramafenster, Wow.' },
    { id: 'orotava', name: 'La Orotava & Balkonhäuser', icon: '🏘️', zone: 'nord',
      slots: [0, 1], dauer: 1, kosten: 6, energie: -10, erholung: +5, stimmung: +8, erlebnis: 14,
      stress: -4, sonne: 1, outdoor: 1, tags: ['kultur'], foto: 'orotava',
      desc: 'Die Casa de los Balcones und steile Gassen voller Kolonialpracht – das schönste Dorf des Nordens.' },
    { id: 'bodega', name: 'Weinprobe in Tacoronte', icon: '🍇', zone: 'nord',
      slots: [0, 1], dauer: 1, kosten: 22, energie: -8, erholung: +8, stimmung: +12, erlebnis: 16,
      stress: -6, sonne: 0, outdoor: 0, tags: ['kultur'],
      desc: 'Kanarischer Wein von Vulkanhängen – die Reben wachsen hier seit 500 Jahren. Verkostung inklusive.' },
    { id: 'guachinche', name: 'Guachinche-Abend', icon: '🍷', zone: 'nord',
      slots: [2], dauer: 1, kosten: 16, energie: -6, erholung: +12, stimmung: +16, erlebnis: 18,
      stress: -6, sonne: 0, outdoor: 0, tags: ['restaurant', 'geheim'], versteckt: true, foto: 'papas',
      desc: 'Improvisierte Weinstube in einer Garage: eigener Wein, deftige Hausmannskost, Handschrift-Speisekarte.' },

    // ————— Nordosten & Anaga —————
    { id: 'teresitas', name: 'Playa de las Teresitas', icon: '🏝️', zone: 'anaga',
      slots: [0, 1], dauer: 1, kosten: 6, energie: -10, erholung: +16, stimmung: +10, erlebnis: 10,
      stress: -5, sonne: 3, outdoor: 3, blockiertBei: ['regen'], tags: ['strand'], foto: 'teresitas',
      desc: 'Goldener Sahara-Sand vor grünen Anaga-Bergen. Der Postkartenstrand der Hauptstädter.' },
    { id: 'anaga', name: 'Nebelwald-Wanderung im Anaga-Gebirge (Ganztag)', icon: '🌿', zone: 'anaga',
      slots: [0], dauer: 2, kosten: 6, energie: -38, energieMitSchuhen: -28,
      erholung: +10, stimmung: +12, erlebnis: 30,
      sonne: 1, outdoor: 3, tags: ['wandern', 'natur'], foto: 'anaga',
      desc: 'Uralter Lorbeerwald, moosbehangen und mystisch. UNESCO-Biosphärenreservat.' },
    { id: 'lalaguna', name: 'Altstadt von La Laguna', icon: '🏛️', zone: 'anaga',
      slots: [0, 1], dauer: 1, kosten: 8, energie: -10, erholung: +4, stimmung: +8, erlebnis: 14,
      sonne: 1, outdoor: 1, tags: ['kultur'], foto: 'lalaguna',
      desc: 'UNESCO-Welterbe: bunte Kolonialhäuser, Innenhöfe, Studentencafés. Das alte Herz der Insel.' },
    { id: 'santacruz', name: 'Santa Cruz & Markthalle', icon: '🛍️', zone: 'anaga',
      slots: [0, 1], dauer: 1, kosten: 15, energie: -12, erholung: +2, stimmung: +8, erlebnis: 12,
      sonne: 1, outdoor: 1, tags: ['kultur', 'bummeln'],
      desc: 'Mercado de Nuestra Señora de África: Käse, Mojo, Früchte. Danach Shopping auf der Calle Castillo.' },
    { id: 'candelaria', name: 'Basilika von Candelaria', icon: '🗿', zone: 'anaga',
      slots: [0, 1], dauer: 1, kosten: 4, energie: -8, erholung: +6, stimmung: +6, erlebnis: 12,
      sonne: 1, outdoor: 1, tags: ['kultur'], foto: 'candelaria',
      desc: 'Wallfahrtsort mit der Schwarzen Madonna – davor wachen die Bronzestatuen der neun Guanchen-Könige.' },
    { id: 'guimar', name: 'Pyramiden von Güímar', icon: '🔺', zone: 'anaga',
      slots: [0, 1], dauer: 1, kosten: 14, energie: -10, erholung: +4, stimmung: +8, erlebnis: 16,
      sonne: 2, outdoor: 2, tags: ['kultur'], foto: 'guimar',
      desc: 'Sechs rätselhafte Stufenpyramiden aus Lavagestein – Thor Heyerdahl persönlich hat hier geforscht.' },
    { id: 'palmetum', name: 'Palmetum von Santa Cruz', icon: '🌴', zone: 'anaga',
      slots: [0, 1], dauer: 1, kosten: 6, energie: -8, erholung: +10, stimmung: +6, erlebnis: 12,
      stress: -5, sonne: 2, outdoor: 3, tags: ['natur', 'kultur'],
      desc: 'Aus einer Mülldeponie wurde die größte Palmensammlung Europas – mit Blick über Hafen und Berge.' },
    { id: 'sanandres', name: 'San Andrés & frischer Fisch', icon: '🐟', zone: 'anaga',
      slots: [0, 1], dauer: 1, kosten: 24, energie: -8, erholung: +8, stimmung: +12, erlebnis: 14,
      stress: -4, sonne: 1, outdoor: 1, tags: ['kultur', 'restaurant'],
      desc: 'Das Fischerdorf neben den Teresitas: Wachsamer Uhrturm, enge Gassen und der beste Pulpo weit und breit.' },
    { id: 'auditorio', name: 'Konzertabend im Auditorio', icon: '🎻', zone: 'anaga',
      slots: [2], dauer: 1, kosten: 35, energie: -8, erholung: +6, stimmung: +14, erlebnis: 20,
      stress: -6, sonne: 0, outdoor: 0, tags: ['kultur'], foto: 'auditorio',
      desc: 'Calatravas weiße Welle über dem Meer – innen spielt das Sinfonieorchester von Teneriffa.' },
    { id: 'bauwerke', name: 'Historische Bauwerke-Tour', icon: '⛪', zone: 'anaga',
      slots: [0, 1], dauer: 1, kosten: 9, energie: -12, erholung: +4, stimmung: +8, erlebnis: 16,
      sonne: 1, outdoor: 1, tags: ['kultur'],
      desc: 'Iglesia de la Concepción, Castillo San Cristóbal, Herrenhäuser aus vier Jahrhunderten – Geschichte zum Anfassen.' },
    { id: 'benijo', name: 'Playa de Benijo (Geheimstrand)', icon: '🖤', zone: 'anaga',
      slots: [0, 1], dauer: 1, kosten: 4, energie: -16, erholung: +14, stimmung: +12, erlebnis: 18,
      stress: -6, sonne: 3, outdoor: 3, blockiertBei: ['windig', 'regen'], tags: ['strand', 'geheim'],
      foto: 'benijo', minLevel: 2,
      desc: 'Wilder schwarzer Sand, Felsnadeln in der Brandung, kaum Touristen. Der Lohn für die Serpentinen.' },
  ];

  // ------------------------------------------------------------------ Fotos
  const FOTOS = {
    'sonnenuntergang': { name: 'Sonnenuntergang über dem Atlantik', icon: '🌅', hinweis: 'Einen klaren Abend am Meer genießen.' },
    'siampark':        { name: 'Tower of Power', icon: '🎢', hinweis: 'Den Siam Park besuchen.' },
    'wal':             { name: 'Grindwal vor der Küste', icon: '🐋', hinweis: 'Eine Wal-Beobachtungstour machen.' },
    'delfine':         { name: 'Delfinschule am Bug', icon: '🐬', hinweis: 'Mit etwas Glück auf einer Bootstour.' },
    'schildkroete':    { name: 'Grüne Meeresschildkröte', icon: '🐢', hinweis: 'Schnorcheln – ein Schnorchelset hilft.' },
    'paragliding':     { name: 'Über den Dächern von Adeje', icon: '🪂', hinweis: 'Paragliding wagen (ab Level 4).' },
    'masca':           { name: 'Masca-Schlucht', icon: '🏞️', hinweis: 'Die große Schluchtwanderung schaffen.' },
    'klippen':         { name: 'Klippen von Los Gigantes', icon: '⛰️', hinweis: 'Die Steilwand vom Boot aus sehen.' },
    'caleton':         { name: 'Lavapools von Garachico', icon: '💦', hinweis: 'Im El Caletón baden.' },
    'drachenbaum':     { name: 'Drago Milenario', icon: '🌳', hinweis: 'Den uralten Drachenbaum in Icod besuchen.' },
    'teno':            { name: 'Leuchtturm am Ende der Welt', icon: '🗼', hinweis: 'Bis zur Punta de Teno fahren.' },
    'teide-gipfel':    { name: 'Blick vom Teide', icon: '🌋', hinweis: 'Bei klarem Wetter mit der Seilbahn hinauf.' },
    'roques':          { name: 'Roque Cinchado', icon: '🪨', hinweis: 'Die Roques de García umrunden.' },
    'sterne':          { name: 'Milchstraße über dem Teide', icon: '✨', hinweis: 'In einer klaren Nacht zum Teide fahren.' },
    'loro':            { name: 'Papageien-Parade', icon: '🦜', hinweis: 'Den Loro Parque besuchen.' },
    'teresitas':       { name: 'Goldener Sand der Teresitas', icon: '🏝️', hinweis: 'Den Stadtstrand von Santa Cruz besuchen.' },
    'anaga':           { name: 'Nebelwald von Anaga', icon: '🌿', hinweis: 'Durch den Lorbeerwald wandern.' },
    'lalaguna':        { name: 'Gassen von La Laguna', icon: '🏛️', hinweis: 'Die Welterbe-Altstadt erkunden.' },
    'candelaria':      { name: 'Die neun Guanchen-Könige', icon: '🗿', hinweis: 'Die Basilika von Candelaria besuchen.' },
    'benijo':          { name: 'Schwarzer Sand von Benijo', icon: '🖤', hinweis: 'Den Geheimstrand finden (ab Level 2).' },
    'papas':           { name: 'Papas arrugadas con Mojo', icon: '🥔', hinweis: 'Kanarisch essen gehen.' },
    'teide-anflug':    { name: 'Teide aus dem Flugzeugfenster', icon: '🛬', hinweis: 'Mit etwas Glück beim Anflug auf die Insel.' },
    'orca-splash':     { name: 'Volltreffer in der Splash-Zone', icon: '💦', hinweis: 'Bei der Orca-Show ganz vorne sitzen.' },
    'orotava':         { name: 'Balkonhäuser von La Orotava', icon: '🏘️', hinweis: 'Das schönste Dorf des Nordens besuchen.' },
    'paisaje-lunar':   { name: 'Mondlandschaft von Vilaflor', icon: '🌕', hinweis: 'Die Paisaje-Lunar-Wanderung schaffen.' },
    'barranco':        { name: 'Wasserfall der Höllenschlucht', icon: '🏜️', hinweis: 'Den Barranco del Infierno durchwandern.' },
    'lavatunnel':      { name: 'Im Bauch des Vulkans', icon: '🕳️', hinweis: 'Die Cueva del Viento erkunden.' },
    'urlaubsflirt':    { name: 'Sonnenuntergang zu zweit', icon: '💞', hinweis: 'Manche Begegnungen macht nur der Urlaub möglich …' },
    'tejita':          { name: 'Montaña Roja über La Tejita', icon: '🏜️', hinweis: 'Den wilden Naturstrand im Süden besuchen.' },
    'chinyero':        { name: 'Lavafeld des Chinyero', icon: '🌑', hinweis: 'Den jüngsten Vulkan der Insel umrunden.' },
    'guimar':          { name: 'Pyramiden von Güímar', icon: '🔺', hinweis: 'Das Rätsel der Stufenpyramiden besichtigen.' },
    'auditorio':       { name: 'Calatravas weiße Welle', icon: '🎻', hinweis: 'Einen Konzertabend im Auditorio erleben.' },
  };

  // ------------------------------------------------------------- Ereignisse
  // bedingung(ctx) mit ctx = { act, zone, wetterId, run, hops }
  const EREIGNISSE = [
    { id: 'delfine', icon: '🐬', gewicht: 3,
      text: 'Plötzlich Rufe an Deck: Eine Schule Delfine begleitet das Boot und springt im Bugwasser!',
      bedingung: c => c.act.tags.includes('boot'),
      effekte: { stimmung: 8, erlebnis: 10, foto: 'delfine' } },

    { id: 'grindwale', icon: '🐋', gewicht: 2,
      text: 'Der Kapitän stellt den Motor ab: Eine ganze Grindwal-Familie zieht ruhig direkt am Boot vorbei.',
      bedingung: c => c.act.id === 'whalewatching',
      effekte: { stimmung: 6, erlebnis: 12 } },

    { id: 'schildkroete', icon: '🐢', gewicht: 2,
      text: 'Du schnorchelst ein Stück hinaus – und gleitest plötzlich neben einer Meeresschildkröte her!',
      bedingung: c => c.act.tags.includes('strand') && c.hatItem('schnorchelset'),
      effekte: { stimmung: 8, erlebnis: 10, foto: 'schildkroete' } },

    { id: 'haendler', icon: '🕶️', gewicht: 2,
      text: 'Ein fliegender Händler hält dir eine „Original Ray-Ban“ für 15 € hin. Sie sieht … fast echt aus.',
      bedingung: c => c.zone === 'sued' && (c.act.tags.includes('strand') || c.act.tags.includes('bummeln')),
      wahl: [
        { text: 'Kaufen (15 €)', effekte: { budget: -15, stimmung: 4 },
          antwort: 'Der Bügel wackelt ein bisschen, aber du siehst fantastisch aus.' },
        { text: 'Freundlich ablehnen', effekte: { stimmung: 1 },
          antwort: '„Amigo, special price!“ – Er zieht lächelnd weiter.' },
      ] },

    { id: 'strassenmusiker', icon: '🎸', gewicht: 2,
      text: 'Ein Straßenmusiker spielt kanarische Timple-Musik – eine kleine Menschentraube lauscht.',
      bedingung: c => c.act.tags.includes('bummeln') || c.act.tags.includes('kultur'),
      wahl: [
        { text: 'Ein paar Münzen geben', effekte: { budget: -2, stimmung: 6, erlebnis: 4 },
          antwort: 'Er nickt dir zu und spielt eine Zugabe – nur für dich, so fühlt es sich an.' },
        { text: 'Kurz lauschen und weitergehen', effekte: { stimmung: 2 },
          antwort: 'Die Melodie begleitet dich noch eine Weile durch die Gassen.' },
      ] },

    { id: 'happyhour', icon: '🍹', gewicht: 2,
      text: 'Happy Hour! Alle Cocktails zum halben Preis – der Kellner zwinkert und bringt gleich zwei.',
      bedingung: c => c.act.tags.includes('party'),
      effekte: { budget: 8, stimmung: 6 } },

    { id: 'quallen', icon: '🎐', gewicht: 1,
      text: 'Gelbe Flagge: Quallen in der Bucht. Das Baden fällt heute leider kürzer aus.',
      bedingung: c => c.act.tags.includes('strand') && c.zone !== 'hotel',
      effekte: { stimmung: -8, erholung: -5 } },

    { id: 'hotelupgrade', icon: '🔑', gewicht: 1,
      text: 'An der Rezeption lächelt man dich an: „Wir haben Sie upgegradet – Zimmer mit Meerblick!“',
      bedingung: c => c.zone === 'hotel' && c.run.tag <= 3 && !c.run.flags.hotelUpgrade,
      effekte: { stimmung: 10, flag: 'hotelUpgrade' } },

    { id: 'guachinche-tipp', icon: '🍷', gewicht: 3,
      text: 'Ein älterer Herr kommt ins Plaudern: „Vergiss die Restaurants – geh in eine Guachinche. Ich zeig dir, wo.“',
      bedingung: c => (c.zone === 'nord' || c.zone === 'anaga') && !c.run.flags.guachincheEntdeckt,
      effekte: { stimmung: 4, erlebnis: 4, flag: 'guachincheEntdeckt' } },

    { id: 'aussicht', icon: '🌄', gewicht: 2,
      text: 'Hinter einer Wegbiegung öffnet sich ein Ausblick, der dich einfach stehen bleiben lässt.',
      bedingung: c => c.act.tags.includes('wandern'),
      effekte: { stimmung: 5, erlebnis: 8 } },

    { id: 'souvenirstand', icon: '🎁', gewicht: 2,
      text: 'Ein kleiner Laden verkauft handbemalte Keramik und Mojo-Sets. Das perfekte Mitbringsel?',
      bedingung: c => c.act.tags.includes('kultur') || c.act.tags.includes('bummeln'),
      wahl: [
        { text: 'Souvenir kaufen (12 €)', effekte: { budget: -12, souvenir: 1, stimmung: 3 },
          antwort: 'Sorgfältig eingepackt wandert es in deine Tasche. Zuhause wird man sich freuen.' },
        { text: 'Feilschen versuchen', zufall: [
          { p: 0.5, effekte: { budget: -7, souvenir: 1, stimmung: 5, erlebnis: 4 },
            antwort: '„Für dich: sieben Euro.“ Handschlag, Grinsen – du hast das Feilschen drauf!' },
          { p: 0.5, effekte: { stimmung: -2 },
            antwort: 'Der Händler verschränkt die Arme: „Das ist Handarbeit, amigo.“ Du ziehst ohne Souvenir ab.' },
        ] },
        { text: 'Nur schauen', effekte: { stimmung: 1 },
          antwort: 'Vielleicht ein andermal. Der Ladenbesitzer winkt dir freundlich nach.' },
      ] },

    { id: 'abkuerzung', icon: '🥾', gewicht: 2,
      text: 'Ein schmaler Trampelpfad zweigt ab – laut einem verblichenen Schild eine Abkürzung. Die Karte kennt ihn nicht.',
      bedingung: c => c.act.tags.includes('wandern'),
      wahl: [
        { text: 'Abkürzung riskieren', zufall: [
          { p: 0.6, effekte: { energie: 8, erlebnis: 6, stimmung: 4 },
            antwort: 'Der Pfad führt durch einen verwunschenen Kiefernhain direkt ans Ziel – Abenteuer geglückt!' },
          { p: 0.4, effekte: { energie: -10, stress: 6, stimmung: -3 },
            antwort: 'Nach zwanzig Minuten endet der Pfad im Gestrüpp. Zurück bleibt nur der Rückweg – und dein Stolz.' },
        ] },
        { text: 'Auf dem Wanderweg bleiben', effekte: { stimmung: 1 },
          antwort: 'Sicher ist sicher – und der offizielle Weg ist ja auch schön.' },
      ] },

    { id: 'klippensprung', icon: '🪨', gewicht: 2,
      text: 'Ein paar Einheimische springen von einem Felsvorsprung ins tiefblaue Becken. Einer winkt dir zu: „¡Venga!“',
      bedingung: c => c.act.id === 'garachico' || c.act.id === 'benijo',
      wahl: [
        { text: 'Springen!', zufall: [
          { p: 0.75, effekte: { stimmung: 10, erlebnis: 10, stress: -4 },
            antwort: 'Drei Sekunden Flug, ein sauberer Eintauchpunkt – die Locals klatschen. Was für ein Gefühl!' },
          { p: 0.25, effekte: { stimmung: -3, stress: 3, erlebnis: 4 },
            antwort: 'Bauchklatscher. Es klatscht doppelt – das Wasser und der Applaus. Autsch, aber eine Geschichte fürs Leben.' },
        ] },
        { text: 'Lieber zuschauen', effekte: { stimmung: 2 },
          antwort: 'Auch vom Beckenrand ist das Spektakel großartig.' },
      ] },

    { id: 'oma-rezept', icon: '👵', gewicht: 3,
      text: 'Die Wirtin setzt sich kurz zu dir und erklärt mit Händen und Füßen ihr Mojo-Rojo-Rezept.',
      bedingung: c => c.act.id === 'guachinche',
      effekte: { stimmung: 6, erlebnis: 10 } },

    { id: 'kratzer', icon: '🚙', gewicht: 1,
      text: 'Zurück am Parkplatz: ein Kratzer in der Stoßstange. War der schon da? Die Selbstbeteiligung sagt: egal.',
      bedingung: c => c.run.transport === 'mietwagen' && c.run.tag > 2 && c.hops >= 1,
      effekte: { budget: -25, stimmung: -5 } },

    { id: 'frischer-fisch', icon: '🎣', gewicht: 2,
      text: 'Der Kellner zeigt aufs Meer: „Der Fisch kam heute Morgen mit dem Kutter dort.“ Man schmeckt es.',
      bedingung: c => c.act.tags.includes('restaurant') && c.act.zone !== 'hotel',
      effekte: { stimmung: 4, erlebnis: 6 } },

    { id: 'regenbogen', icon: '🌈', gewicht: 2,
      text: 'Ein Schauer zieht durch – und spannt einen doppelten Regenbogen über das grüne Tal.',
      bedingung: c => (c.wetterId === 'regen' || c.wetterId === 'wolkig') && c.act.outdoor >= 2,
      effekte: { stimmung: 6, erlebnis: 4 } },

    { id: 'geldfund', icon: '💶', gewicht: 1,
      text: 'Im Sand blitzt etwas: ein zusammengefalteter 20-Euro-Schein. Kein Besitzer weit und breit.',
      bedingung: c => c.act.tags.includes('strand'),
      effekte: { budget: 20, stimmung: 4 } },

    { id: 'barraquito', icon: '☕', gewicht: 2,
      text: 'Du probierst einen Barraquito – Espresso, Kondensmilch, Likör 43, Zimt. Warum kennt den keiner zuhause?',
      bedingung: c => c.act.tags.includes('kultur') || c.act.tags.includes('bummeln'),
      effekte: { stimmung: 5, energie: 5, erlebnis: 4 } },

    { id: 'handtuecher', icon: '🏖️', gewicht: 3,
      text: 'Sechs Uhr aufgestanden wärst du besser: Sämtliche Liegen am Pool sind mit Handtüchern „reserviert“ – und weit und breit kein Besitzer in Sicht.',
      bedingung: c => c.act.id === 'pool',
      effekte: { stress: 8, stimmung: -4 } },

    { id: 'eiswuerfel', icon: '🧊', gewicht: 2,
      text: 'Dein Getränk kommt randvoll mit Eiswürfeln – dabei hattest du ausdrücklich „sin hielo, por favor“ gesagt.',
      bedingung: c => c.act.tags.includes('restaurant') || c.act.tags.includes('party'),
      effekte: { stress: 5, stimmung: -3 } },

    { id: 'orca-splash', icon: '💦', gewicht: 3,
      text: 'Du hast dich in die erste Reihe der Orca-Show gesetzt – die Splash-Zone! Ein Flossenschlag, und du bist von Kopf bis Fuß klatschnass. Das ganze Stadion lacht mit dir.',
      bedingung: c => c.act.id === 'loroparque',
      effekte: { stimmung: 10, erlebnis: 12, stress: -4, foto: 'orca-splash' } },

    { id: 'kisscam', icon: '💋', gewicht: 2,
      text: 'Zwischen zwei Shownummern schwenkt die Kiss-Cam durchs Publikum – und bleibt genau auf dir stehen! Du winkst, das Stadion jubelt.',
      bedingung: c => c.act.id === 'loroparque',
      effekte: { stimmung: 8, erlebnis: 6 } },

    { id: 'brunellis-fenster', icon: '🌅', gewicht: 3,
      text: 'Du bekommst den Fensterplatz direkt über der Brandung – während das Steak brutzelt, versinkt die Sonne im Atlantik. Und dann schickt der Küchenchef auch noch einen Gruß aus der Küche!',
      bedingung: c => c.act.id === 'brunellis',
      effekte: { stimmung: 10, erholung: 4, erlebnis: 8 } },

    { id: 'gruss-kueche', icon: '👨‍🍳', gewicht: 2,
      text: 'Ein kleiner Teller, den niemand bestellt hat: „Gruß aus der Küche!“ Der Kellner zwinkert – heute mag man dich hier besonders.',
      bedingung: c => c.act.tags.includes('restaurant'),
      effekte: { stimmung: 6, erlebnis: 6 } },

    // ————— Urlaubsflirt: eine kleine Geschichte in drei Akten —————
    { id: 'flirt-kennenlernen', icon: '💬', gewicht: 2,
      text: 'Du kommst mit %NAME% ins Gespräch – ihr lacht über dieselben Dinge, und die Zeit vergeht wie im Flug.',
      bedingung: c => (c.run.gruppe || 'single') !== 'familie' && c.run.flirt.stufe === 0 &&
        (c.act.tags.includes('strand') || c.act.tags.includes('party') ||
         c.act.tags.includes('bummeln') || c.act.id === 'pool'),
      wahl: [
        { text: 'Nummern austauschen', effekte: { stimmung: 6, erlebnis: 4, flirt: 1 },
          antwort: 'Ihr verabredet euch lose für die nächsten Tage. Du grinst noch eine Weile vor dich hin.' },
        { text: 'Nur nett plaudern', effekte: { stimmung: 3 },
          antwort: 'Ein schöner Moment – vielleicht läuft man sich ja nochmal über den Weg.' },
      ] },

    { id: 'flirt-wiedersehen', icon: '👋', gewicht: 4,
      text: 'Was für ein Zufall: %NAME% winkt dir von der anderen Straßenseite zu. „Na, wie wär’s – unternehmen wir was?“',
      bedingung: c => c.run.flirt.stufe === 1,
      wahl: [
        { text: 'Auf einen Cocktail einladen (12 €)', effekte: { budget: -12, stimmung: 10, erlebnis: 8, flirt: 2 },
          antwort: 'Ihr redet, bis die Eiswürfel geschmolzen sind. Für morgen Abend ist ein richtiges Date ausgemacht.' },
        { text: 'Heute lieber nicht', effekte: { stimmung: 1 },
          antwort: '„Schade – dann vielleicht ein andermal!“' },
      ] },

    { id: 'flirt-date', icon: '💞', gewicht: 5,
      text: 'Sonnenuntergangs-Date mit %NAME%: Ihr sitzt auf der Mole, teilt euch eine Tüte gebrannte Mandeln und redet, bis die Sterne rauskommen.',
      bedingung: c => c.run.flirt.stufe === 2 && c.run.slot === 2,
      effekte: { stimmung: 12, erholung: 6, erlebnis: 12, stress: -6, foto: 'urlaubsflirt', flirt: 3 } },
  ];

  const FLIRT_NAMEN = ['Marta aus Sevilla', 'Jonas aus Hamburg', 'Lucía aus La Laguna',
    'Ben aus Rotterdam', 'Aroa von der Nachbarinsel', 'Milo aus Wien'];

  // ------------------------------------------------------------ Inselfahrt
  // Anfahrten in andere Regionen laufen als kleine Reise-Sequenz ab.
  const FAHRT_BASIS = {
    mietwagen: [
      'Die TF-1 rollt – links das Meer, rechts der Vulkan.',
      'Durch Bananenplantagen und über Serpentinen …',
      'Das Navi sagt 40 Minuten. Die Aussicht sagt: nimm dir länger.',
    ],
    bus: [
      'Der grüne TITSA schaukelt gemütlich die Küstenstraße entlang.',
      'Fensterplatz im Linienbus – die Insel zieht wie ein Film vorbei.',
      'Der Busfahrer grüßt jeden zweiten Fußgänger. Man kennt sich.',
    ],
  };

  const FAHRT_EREIGNISSE = {
    mietwagen: [
      { id: 'stau', icon: '🚗', gewicht: 3,
        text: 'Stau auf der TF-1! Ein Blechlawinen-Klassiker zwischen den Ausfahrten.',
        effekte: { stress: 6, stimmung: -4, energie: -3 } },
      { id: 'ziegen', icon: '🐐', gewicht: 2,
        text: 'Eine Ziegenherde quert gemächlich die Straße – der Hirte grüßt lässig mit dem Stock.',
        effekte: { stimmung: 5, erlebnis: 3 } },
      { id: 'mirador', icon: '🌄', gewicht: 3,
        text: 'Spontaner Stopp an einem Mirador – unfassbarer Blick über Küste und Wolkenmeer.',
        effekte: { stimmung: 5, erlebnis: 5 } },
      { id: 'serpentinen', icon: '🌀', gewicht: 2,
        text: 'Serpentinen ohne Ende – dem inneren Beifahrer wird leicht flau.',
        effekte: { stress: 3, energie: -4 } },
      { id: 'tankstellen-barraquito', icon: '☕', gewicht: 2,
        text: 'Kurzer Stopp an der Tankstellenbar: ein Barraquito im Stehen. Beste Entscheidung des Tages.',
        effekte: { energie: 5, stimmung: 3 } },
    ],
    bus: [
      { id: 'busverspaetung', icon: '🚌', gewicht: 3,
        text: 'Der Bus kommt 25 Minuten zu spät. Der Fahrplan ist hier eher eine grobe Empfehlung.',
        effekte: { stress: 5, stimmung: -3, energie: -3 } },
      { id: 'senora', icon: '👵', gewicht: 2,
        text: 'Die Señora neben dir erzählt von früher – halb auf Spanisch, halb mit den Händen. Du verstehst alles.',
        effekte: { stimmung: 5, erlebnis: 4 } },
      { id: 'bananen-blick', icon: '🍌', gewicht: 3,
        text: 'Hinter der Kurve öffnet sich der Blick über endlose Bananenplantagen bis zum Meer.',
        effekte: { stimmung: 4, erlebnis: 3 } },
      { id: 'klimaanlage', icon: '🥶', gewicht: 1,
        text: 'Die Klimaanlage ist auf „Arktis“ eingestellt. Du wechselst zwei Reihen nach hinten.',
        effekte: { stress: 3 } },
    ],
  };

  // ---------------------------------------------------------------- Quests
  const QUESTS = [
    { id: 'q-wal', name: 'Meeresriesen', icon: '🐋', desc: 'Beobachte Wale oder Delfine',
      check: r => r.fotosRun.includes('wal') || r.fotosRun.includes('delfine') },
    { id: 'q-teide', name: 'Dem Vulkan ganz nah', icon: '🌋', desc: 'Besuche den Teide-Nationalpark',
      check: r => r.zonenBesucht.includes('teide') },
    { id: 'q-zonen', name: 'Inselentdecker', icon: '🗺️', desc: 'Erkunde mindestens 3 Regionen der Insel',
      check: r => r.zonenBesucht.filter(z => z !== 'hotel').length >= 3 },
    { id: 'q-fotos', name: 'Fotosafari', icon: '📸', desc: 'Sammle 5 neue Fotomotive',
      check: r => r.fotosRun.length >= 5 },
    { id: 'q-erholung', name: 'Tiefenentspannung', icon: '🧘', desc: 'Erreiche 80 Punkte Erholung',
      check: r => r.erholung >= 80 },
    { id: 'q-feinschmecker', name: 'Feinschmecker', icon: '🍽️', desc: 'Genieße 3 besondere Abendessen',
      check: r => r.restaurantAbende >= 3 },
    { id: 'q-wandern', name: 'Bergziege', icon: '🥾', desc: 'Absolviere 2 Wanderungen',
      check: r => r.wanderungen >= 2 },
    { id: 'q-budget', name: 'Gut gehaushaltet', icon: '💶', desc: 'Beende den Urlaub mit mind. 100 € Restbudget',
      check: r => r.budget >= 100 },
    { id: 'q-kultur', name: 'Kulturliebhaber', icon: '🏛️', desc: 'Unternimm 2 Kultur-Ausflüge',
      check: r => r.kulturAusfluege >= 2 },
    { id: 'q-strand', name: 'Salz auf der Haut', icon: '🏖️', desc: 'Verbringe 3 Strandtage',
      check: r => r.strandTage >= 3 },
    { id: 'q-zen', name: 'Runterkommen', icon: '😮‍💨', desc: 'Beende den Urlaub mit höchstens 25 Stress',
      check: r => r.stress <= 25 },
  ];

  // --------------------------------------------------------------- Erfolge
  const ERFOLGE = [
    { id: 'erster', name: 'Erster Urlaub', icon: '🛬', desc: 'Beende deinen ersten Teneriffa-Urlaub.',
      check: (r, m) => m.urlaubeGesamt >= 1 },
    { id: 'stammgast', name: 'Stammgast', icon: '🔁', desc: 'Beende 5 Urlaube.',
      check: (r, m) => m.urlaubeGesamt >= 5 },
    { id: 'walfluesterer', name: 'Walflüsterer', icon: '🐋', desc: 'Fotografiere einen Grindwal.',
      check: (r, m) => m.fotos.includes('wal') },
    { id: 'gipfelstuermer', name: 'Gipfelstürmer', icon: '🌋', desc: 'Fange den Blick vom Teide ein.',
      check: (r, m) => m.fotos.includes('teide-gipfel') },
    { id: 'sternengucker', name: 'Sternengucker', icon: '✨', desc: 'Fotografiere die Milchstraße über dem Teide.',
      check: (r, m) => m.fotos.includes('sterne') },
    { id: 'inselumrunder', name: 'Inselumrunder', icon: '🧭', desc: 'Besuche alle 5 Regionen in einem Urlaub.',
      check: r => r.zonenBesucht.filter(z => z !== 'hotel').length >= 5 },
    { id: 'tiefenentspannt', name: 'Tiefenentspannt', icon: '🧘', desc: 'Erreiche 90 Erholung in einem Urlaub.',
      check: r => r.erholung >= 90 },
    { id: 'fotograf', name: 'Inselfotograf', icon: '📷', desc: 'Sammle 8 Fotomotive in einem einzigen Urlaub.',
      check: r => r.fotosRun.length >= 8 },
    { id: 'sparfuchs', name: 'Sparfuchs', icon: '🦊', desc: 'Beende einen Urlaub mit über 150 € Restbudget.',
      check: r => r.budget > 150 },
    { id: 'geheimtipp', name: 'Wie ein Einheimischer', icon: '🍷', desc: 'Verbringe einen Abend in einer Guachinche.',
      check: r => r.guachincheBesucht },
    { id: 'abenteurer', name: 'Adrenalin-Junkie', icon: '🤙', desc: '3 Action-Aktivitäten in einem Urlaub.',
      check: r => r.actionZahl >= 3 },
    { id: 'traumurlaub', name: 'Traumurlaub', icon: '🏆', desc: 'Erreiche die Bewertung „Traumurlaub“ oder besser.',
      check: r => r.bewertungIndex <= 1 },
    { id: 'sammler', name: 'Motivsammler', icon: '🖼️', desc: 'Sammle insgesamt 12 verschiedene Fotomotive.',
      check: (r, m) => m.fotos.length >= 12 },
    { id: 'komplettist', name: 'Das komplette Album', icon: '💎', desc: 'Sammle alle Fotomotive der Insel.',
      check: (r, m) => m.fotos.length >= Object.keys(FOTOS).length },
    { id: 'zen', name: 'Zen-Meister', icon: '🧘‍♂️', desc: 'Beende einen Urlaub mit höchstens 15 Stress.',
      check: r => r.stress <= 15 },
    { id: 'kofferdrama', name: 'Koffer-Drama überstanden', icon: '🧳', desc: 'Verliere deinen Koffer und rette trotzdem den Urlaub (mind. „Richtig schöner Urlaub“).',
      check: r => r.kofferVerloren && r.bewertungIndex <= 2 },
    { id: 'splashzone', name: 'Klatschnass', icon: '💦', desc: 'Werde bei der Orca-Show von der Fontäne getroffen.',
      check: (r, m) => m.fotos.includes('orca-splash') },
    { id: 'sommerliebe', name: 'Sommerliebe', icon: '💞', desc: 'Erlebe das Sonnenuntergangs-Date deines Urlaubsflirts.',
      check: r => r.flirtStufe >= 3 },
    { id: 'rennfahrer', name: 'Wie ein Einheimischer', icon: '🏁', desc: 'Meistere eine Fahrt am Steuer ohne einen einzigen Rempler.',
      check: (r, m) => m.perfekteFahrt },
    { id: 'inselracer', name: 'Insel-Racer', icon: '🏎️', desc: 'Sammle 150 Fahrstil-Punkte in einer einzigen Fahrt (Überholen & knappe Manöver).',
      check: r => (r.fahrstil || 0) >= 150 },
    { id: 'fotokuenstler', name: 'Der perfekte Moment', icon: '📸', desc: 'Triff beim Fotografieren den perfekten Auslöse-Zeitpunkt.',
      check: (r, m) => m.perfektesFoto },
  ];

  // ---------------------------------------------------------------- Levels
  const LEVELS = [
    { xp: 0,    titel: 'Neuankömmling' },
    { xp: 80,   titel: 'Sonnenanbeter' },
    { xp: 200,  titel: 'Inselentdecker' },
    { xp: 360,  titel: 'Teide-Bezwinger' },
    { xp: 560,  titel: 'Geheimtipp-Jäger' },
    { xp: 800,  titel: 'Halbinsulaner' },
    { xp: 1080, titel: 'Inselkenner' },
    { xp: 1400, titel: 'Adoptiv-Canario' },
    { xp: 1760, titel: 'Teneriffa-Legende' },
    { xp: 2160, titel: 'Geist der Guanchen' },
  ];

  const LEVEL_UNLOCKS = {
    2: 'Neue Aktivität freigeschaltet: 🖤 Playa de Benijo (Geheimstrand)',
    3: 'Neue Aktivität freigeschaltet: 🤿 Schnorchel- & Tauchausflug Abades',
    4: 'Neue Aktivität freigeschaltet: 🪂 Paragliding über Adeje',
  };

  // ------------------------------------------------------------- Bewertung
  const BEWERTUNGEN = [
    { min: 920, titel: 'Der Urlaub deines Lebens', icon: '🏆',
      text: 'Du hast Teneriffa gelebt wie kaum jemand. Die Insel wird dich wiedersehen.' },
    { min: 820, titel: 'Traumurlaub', icon: '🌟',
      text: 'Erholt, voller Erlebnisse und mit einem Album voller Erinnerungen zurück.' },
    { min: 650, titel: 'Richtig schöner Urlaub', icon: '😎',
      text: 'Sonne getankt, Insel gesehen, gut gegessen. So darf Urlaub gerne sein.' },
    { min: 480, titel: 'Solider Urlaub', icon: '🙂',
      text: 'Ganz okay – aber Teneriffa hätte noch deutlich mehr für dich gehabt.' },
    { min: 0, titel: 'Na ja … Hauptsache mal weg', icon: '😅',
      text: 'Zwischen Erschöpfung und Fehlplanung ist der Urlaub etwas untergegangen. Nächstes Mal wird’s besser!' },
  ];

  const SLOT_NAMEN = ['Vormittag', 'Nachmittag', 'Abend'];

  // Highlights bekommen beim ersten Mal eine Kino-Sequenz
  const HIGHLIGHTS = ['siampark', 'whalewatching', 'masca', 'teide', 'sterne',
    'loroparque', 'paragliding', 'anaga', 'losgigantes', 'abades', 'paisaje', 'cueva'];

  return {
    WETTER, WETTER_CHANCEN, ZONEN, TRANSPORT, AUTOS, REGIONEN, HOTELS, ITEMS,
    AKTIVITAETEN, FOTOS, EREIGNISSE, QUESTS, ERFOLGE, LEVELS, LEVEL_UNLOCKS,
    BEWERTUNGEN, SLOT_NAMEN, hops,
    FLIRT_NAMEN, FAHRT_BASIS, FAHRT_EREIGNISSE, HIGHLIGHTS,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
