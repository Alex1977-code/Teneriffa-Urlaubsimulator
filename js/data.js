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

  // ------------------------------------------------------------ Unterkünfte
  const REGIONEN = {
    sued: { name: 'Costa Adeje (Süden)', icon: '🏖️',
            desc: 'Sonnengarantie, goldene Strände, Promenaden. Der Klassiker.' },
    nord: { name: 'Puerto de la Cruz (Norden)', icon: '🌺',
            desc: 'Grün, authentisch, kanarische Altstadt – dafür wechselhafteres Wetter.' },
  };

  const HOTELS = {
    spar:    { name: 'Pension Casa Lola', sterne: '★★', budgetProTag: 85,
               regen: 0,  erholungNacht: 0,
               desc: 'Einfach, sauber, familiär. Mehr Budget für Ausflüge.' },
    komfort: { name: 'Hotel Playa Azul', sterne: '★★★★', budgetProTag: 130,
               regen: 6,  erholungNacht: 1,
               desc: 'Pool, Buffet, Meerblick gegen Aufpreis. Der solide Mittelweg.' },
    deluxe:  { name: 'Palacio del Sol', sterne: '★★★★★', budgetProTag: 210,
               regen: 12, erholungNacht: 2,
               desc: 'Spa, Infinity-Pool, Zimmerservice. Erholung ab der ersten Nacht.' },
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
      sonne: 2, outdoor: 1, tags: ['entspannung'],
      desc: 'Liege reservieren, Buch aufschlagen, Piña Colada. Urlaub kann so einfach sein.' },
    { id: 'siesta', name: 'Siesta im kühlen Zimmer', icon: '😴', zone: 'hotel',
      slots: [1], dauer: 1, kosten: 0, energie: +22, erholung: +8, stimmung: +3, erlebnis: 0,
      sonne: 0, outdoor: 0, tags: ['entspannung'],
      desc: 'Die Kanarier wissen, warum. Mittagshitze verschlafen, abends fit sein.' },
    { id: 'balkon', name: 'Sonnenuntergang auf dem Balkon', icon: '🌅', zone: 'hotel',
      slots: [2], dauer: 1, kosten: 0, energie: +15, erholung: +10, stimmung: +6, erlebnis: 3,
      sonne: 0, outdoor: 1, tags: ['entspannung'], flagge: 'fruehSchlafen',
      foto: 'sonnenuntergang', fotoWetter: ['sonnig', 'leicht'],
      desc: 'Früher Abend, Blick aufs Meer, danach ins Bett. Morgen bist du topfit.' },
    { id: 'hotelrestaurant', name: 'Abendessen im Hotel', icon: '🍽️', zone: 'hotel',
      slots: [2], dauer: 1, kosten: 18, energie: +8, erholung: +8, stimmung: +5, erlebnis: 4,
      sonne: 0, outdoor: 0, tags: ['restaurant', 'entspannung'],
      desc: 'Buffet mit Blick auf den Pool. Kein Abenteuer, aber verlässlich gut.' },

    // ————— Südküste —————
    { id: 'playa-americas', name: 'Strandtag Playa de las Américas', icon: '🏖️', zone: 'sued',
      slots: [0, 1], dauer: 1, kosten: 8, energie: -12, erholung: +14, stimmung: +10, erlebnis: 8,
      sonne: 3, outdoor: 3, blockiertBei: ['regen'], tags: ['strand'],
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
      sonne: 0, outdoor: 0, tags: ['restaurant'], foto: 'papas',
      desc: 'Frischer Fisch, Papas arrugadas con Mojo, Meerblick. Das alte Fischerdorf kann Abendessen.' },
    { id: 'promenade', name: 'Abendbummel an der Promenade', icon: '🌴', zone: 'sued',
      slots: [2], dauer: 1, kosten: 6, energie: -8, erholung: +6, stimmung: +8, erlebnis: 6,
      sonne: 0, outdoor: 1, tags: ['bummeln'],
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
    { id: 'paragliding', name: 'Paragliding über Adeje', icon: '🪂', zone: 'sued',
      slots: [0, 1], dauer: 1, kosten: 95, energie: -18, erholung: 0, stimmung: +24, erlebnis: 34,
      sonne: 1, outdoor: 3, blockiertBei: ['windig', 'regen'], tags: ['action'],
      foto: 'paragliding', minLevel: 4,
      desc: 'Vom Ifonche-Plateau über die Küste segeln. Teneriffa aus der Bussard-Perspektive.' },

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
      sonne: 2, outdoor: 3, blockiertBei: ['windig', 'regen'], tags: ['strand', 'natur'], foto: 'caleton',
      desc: 'Ein Lavastrom formte 1706 diese Meerwasserbecken. Baden im erstarrten Vulkan.' },
    { id: 'icod', name: 'Drachenbaum & Altstadt von Icod', icon: '🌳', zone: 'west',
      slots: [0, 1], dauer: 1, kosten: 7, energie: -10, erholung: +6, stimmung: +6, erlebnis: 12,
      sonne: 1, outdoor: 1, tags: ['kultur'], foto: 'drachenbaum',
      desc: 'Der „Drago Milenario“ ist das Wahrzeichen der Insel – angeblich fast 1000 Jahre alt.' },
    { id: 'teno', name: 'Leuchtturm Punta de Teno', icon: '🗼', zone: 'west',
      slots: [0, 1], dauer: 1, kosten: 4, energie: -12, erholung: +8, stimmung: +8, erlebnis: 14,
      sonne: 2, outdoor: 2, blockiertBei: ['windig'], tags: ['natur'], foto: 'teno',
      desc: 'Der westlichste Punkt der Insel. Die Straße dorthin klebt spektakulär am Fels.' },

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
    { id: 'sterne', name: 'Sternenhimmel am Teide', icon: '✨', zone: 'teide',
      slots: [2], dauer: 1, kosten: 20, energie: -15, erholung: +6, stimmung: +16, erlebnis: 22,
      sonne: 0, outdoor: 3, blockiertBei: ['regen'], tags: ['natur'],
      foto: 'sterne', fotoWetter: ['sonnig', 'leicht'],
      desc: 'Über den Wolken, kaum Lichtverschmutzung – einer der besten Sternenhimmel Europas.' },

    // ————— Nordküste —————
    { id: 'puerto', name: 'Puerto de la Cruz & Playa Jardín', icon: '🌊', zone: 'nord',
      slots: [0, 1], dauer: 1, kosten: 10, energie: -14, erholung: +10, stimmung: +10, erlebnis: 14,
      sonne: 2, outdoor: 2, blockiertBei: ['regen'], tags: ['strand', 'kultur', 'bummeln'],
      desc: 'Schwarzer Sand, alte Hafenpromenade, kanarisches Lebensgefühl statt Bettenburg.' },
    { id: 'loroparque', name: 'Loro Parque (Ganztag)', icon: '🦜', zone: 'nord',
      slots: [0], dauer: 2, kosten: 44, energie: -25, erholung: +6, stimmung: +18, erlebnis: 26,
      sonne: 1, outdoor: 1, tags: ['familie'], foto: 'loro',
      desc: 'Die größte Papageien-Sammlung der Welt, Pinguine im Kunstschnee. Ein voller Tag.' },
    { id: 'botanico', name: 'Botanischer Garten', icon: '🌺', zone: 'nord',
      slots: [0, 1], dauer: 1, kosten: 5, energie: -8, erholung: +12, stimmung: +6, erlebnis: 10,
      sonne: 1, outdoor: 2, tags: ['natur', 'kultur'],
      desc: 'Seit 1788 sammeln sich hier tropische Pflanzen aus aller Welt. Eine grüne Oase.' },
    { id: 'guachinche', name: 'Guachinche-Abend', icon: '🍷', zone: 'nord',
      slots: [2], dauer: 1, kosten: 16, energie: -6, erholung: +12, stimmung: +16, erlebnis: 18,
      sonne: 0, outdoor: 0, tags: ['restaurant', 'geheim'], versteckt: true, foto: 'papas',
      desc: 'Improvisierte Weinstube in einer Garage: eigener Wein, deftige Hausmannskost, Handschrift-Speisekarte.' },

    // ————— Nordosten & Anaga —————
    { id: 'teresitas', name: 'Playa de las Teresitas', icon: '🏝️', zone: 'anaga',
      slots: [0, 1], dauer: 1, kosten: 6, energie: -10, erholung: +16, stimmung: +10, erlebnis: 10,
      sonne: 3, outdoor: 3, blockiertBei: ['regen'], tags: ['strand'], foto: 'teresitas',
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
    { id: 'benijo', name: 'Playa de Benijo (Geheimstrand)', icon: '🖤', zone: 'anaga',
      slots: [0, 1], dauer: 1, kosten: 4, energie: -16, erholung: +14, stimmung: +12, erlebnis: 18,
      sonne: 3, outdoor: 3, blockiertBei: ['windig', 'regen'], tags: ['strand', 'geheim'],
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
      bedingung: c => c.act.tags.includes('strand') && c.run.items.includes('schnorchelset'),
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

    { id: 'stau', icon: '🚗', gewicht: 2,
      text: 'Stau auf der TF-1! Ein Blechlawinen-Klassiker zwischen den Ausfahrten. Du stehst und stehst.',
      bedingung: c => c.run.transport === 'mietwagen' && c.hops >= 2,
      effekte: { stimmung: -6, energie: -4 } },

    { id: 'busverspaetung', icon: '🚌', gewicht: 2,
      text: 'Der TITSA-Bus kommt 25 Minuten zu spät. Der Fahrplan ist hier eher eine grobe Empfehlung.',
      bedingung: c => c.run.transport === 'bus' && c.hops >= 1,
      effekte: { stimmung: -5, energie: -4 } },

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
        { text: 'Nur schauen', effekte: { stimmung: 1 },
          antwort: 'Vielleicht ein andermal. Der Ladenbesitzer winkt dir freundlich nach.' },
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
  ];

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

  return {
    WETTER, WETTER_CHANCEN, ZONEN, TRANSPORT, REGIONEN, HOTELS, ITEMS,
    AKTIVITAETEN, FOTOS, EREIGNISSE, QUESTS, ERFOLGE, LEVELS, LEVEL_UNLOCKS,
    BEWERTUNGEN, SLOT_NAMEN, hops,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
