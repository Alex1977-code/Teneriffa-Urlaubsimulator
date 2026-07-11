'use strict';

/**
 * Teneriffa Urlaubssimulator – Echte Fotos
 *
 * Lädt zur Laufzeit fotorealistische Bilder der echten Orte über die
 * Wikipedia-REST-API (CORS-offen, stabil, mit Lizenzhinweis auf der
 * Artikelseite). Die aufgelösten Bild-URLs werden lokal gecacht.
 * Ohne Netz oder bei fehlendem Artikel bleibt der Emoji-Look erhalten.
 */
const BILDER = (() => {

  // Motiv → Wikipedia-Artikel. Erst de., dann en., dann es.wikipedia.org.
  const ARTIKEL = {
    // Aktivitäten
    'pool':            ['Costa Adeje'],
    'balkon':          ['Sonnenuntergang', 'Sunset'],
    'spa':             ['Wellness'],
    'playa-americas':  ['Playa de las Américas'],
    'siampark':        ['Siam Park'],
    'whalewatching':   ['Kurzflossen-Grindwal', 'Short-finned pilot whale'],
    'surfkurs':        ['El Médano', 'El Médano (Granadilla de Abona)'],
    'lacaleta':        ['Papas arrugadas'],
    'promenade':       ['Los Cristianos'],
    'cocktailbar':     ['Cocktail'],
    'abades':          ['Suppenschildkröte', 'Green sea turtle'],
    'paragliding':     ['Gleitschirmfliegen', 'Paragliding'],
    'barranco':        ['Barranco del Infierno', 'Barranco del Infierno (Tenerife)'],
    'masca':           ['Masca'],
    'losgigantes':     ['Los Gigantes', 'Acantilados de Los Gigantes'],
    'garachico':       ['Garachico'],
    'icod':            ['Drago milenario', 'Icod de los Vinos'],
    'teno':            ['Punta de Teno'],
    'cueva':           ['Cueva del Viento'],
    'teide':           ['Teide'],
    'roques':          ['Roques de García', 'Roque Cinchado'],
    'paisaje':         ['Paisaje Lunar', 'Vilaflor'],
    'sterne':          ['Milchstraße', 'Milky Way'],
    'puerto':          ['Puerto de la Cruz'],
    'loroparque':      ['Loro Parque'],
    'loro':            ['Loro Parque'],
    'botanico':        ['Botanischer Garten (Puerto de la Cruz)', 'Jardín de aclimatación de La Orotava'],
    'brunellis':       ['Steak'],
    'orotava':         ['La Orotava'],
    'guachinche':      ['Guachinche'],
    'teresitas':       ['Playa de las Teresitas'],
    'anaga':           ['Anaga-Gebirge', 'Anaga', 'Macizo de Anaga'],
    'lalaguna':        ['San Cristóbal de La Laguna'],
    'santacruz':       ['Santa Cruz de Tenerife'],
    'candelaria':      ['Candelaria (Teneriffa)', 'Candelaria, Tenerife'],
    'benijo':          ['Benijo', 'Taganana'],
    'hotelrestaurant': ['Buffet'],
    'siesta':          ['Siesta'],
    'tejita':          ['La Tejita', 'Montaña Roja (Teneriffa)', 'El Médano'],
    'karting':         ['Kartsport', 'Kart racing'],
    'chinyero':        ['Chinyero'],
    'bodega':          ['Tacoronte', 'Weinbau in Spanien', 'Canary Islands wine'],
    'guimar':          ['Pyramiden von Güímar', 'Pyramids of Güímar'],
    'palmetum':        ['Palmetum (Santa Cruz de Tenerife)', 'Palmetum of Santa Cruz de Tenerife'],
    'sanandres':       ['San Andrés (Teneriffa)', 'San Andrés (Santa Cruz de Tenerife)'],
    'auditorio':       ['Auditorio de Tenerife'],
    // Zusätzliche Fotomotive
    'sonnenuntergang': ['Sonnenuntergang', 'Sunset'],
    'wal':             ['Kurzflossen-Grindwal', 'Short-finned pilot whale'],
    'delfine':         ['Gemeiner Delfin', 'Common dolphin'],
    'schildkroete':    ['Suppenschildkröte', 'Green sea turtle'],
    'teide-anflug':    ['Teide'],
    'orca-splash':     ['Schwertwal', 'Orca'],
    'klippen':         ['Los Gigantes', 'Acantilados de Los Gigantes'],
    'caleton':         ['Garachico'],
    'drachenbaum':     ['Drago milenario', 'Kanarischer Drachenbaum'],
    'lavatunnel':      ['Cueva del Viento'],
    'papas':           ['Papas arrugadas'],
    'teide-gipfel':    ['Teide'],
    'paisaje-lunar':   ['Paisaje Lunar', 'Vilaflor'],
    'urlaubsflirt':    ['Sonnenuntergang', 'Sunset'],
  };

  const WIKIS = ['de', 'en', 'es'];
  const CACHE_KEY = 'tus_bilder_v1';

  let cache = {};
  try {
    if (typeof localStorage !== 'undefined')
      cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch (e) { cache = {}; }

  const fehlgeschlagen = new Set();   // nur für diese Sitzung
  const laufend = {};

  function cacheSpeichern() {
    try {
      if (typeof localStorage !== 'undefined')
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) { /* voll oder gesperrt – egal */ }
  }

  function skaliere(thumbUrl, breite) {
    // Wikipedia-Thumb-URLs tragen die Breite im Pfad: …/320px-Name.jpg
    return thumbUrl.replace(/\/(\d+)px-/, '/' + breite + 'px-');
  }

  async function frageWiki(wiki, artikel) {
    const url = 'https://' + wiki + '.wikipedia.org/api/rest_v1/page/summary/' +
      encodeURIComponent(artikel.replace(/ /g, '_'));
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return null;
    const json = await resp.json();
    if (!json.thumbnail || !json.thumbnail.source) return null;
    return {
      url: skaliere(json.thumbnail.source, 900),
      klein: skaliere(json.thumbnail.source, 480),
      artikelUrl: (json.content_urls && json.content_urls.desktop && json.content_urls.desktop.page) || url,
      titel: json.title || artikel,
    };
  }

  /** Liefert ein Promise auf {url, klein, artikelUrl, titel} oder null. */
  function hole(motiv) {
    if (cache[motiv]) return Promise.resolve(cache[motiv]);
    if (fehlgeschlagen.has(motiv) || !ARTIKEL[motiv]) return Promise.resolve(null);
    if (laufend[motiv]) return laufend[motiv];
    if (typeof fetch === 'undefined') return Promise.resolve(null);

    laufend[motiv] = (async () => {
      for (const artikel of ARTIKEL[motiv]) {
        for (const wiki of WIKIS) {
          try {
            const bild = await frageWiki(wiki, artikel);
            if (bild) { cache[motiv] = bild; cacheSpeichern(); return bild; }
          } catch (e) { /* offline oder blockiert → nächster Versuch */ }
        }
      }
      fehlgeschlagen.add(motiv);
      return null;
    })();
    return laufend[motiv];
  }

  // ---------------------------------------------------------------- Videos
  // Frei lizenzierte Kurzvideos direkt aus Wikimedia Commons – als kleine,
  // transkodierte Web-Dateien. Suche zur Laufzeit, Ergebnis wird gecacht.
  const VIDEO_SUCHE = {
    'teide':           ['Teide Tenerife', 'Teide timelapse'],
    'teide-gipfel':    ['Teide Tenerife'],
    'teide-anflug':    ['Tenerife aerial'],
    'masca':           ['Masca Tenerife', 'Tenerife gorge'],
    'siampark':        ['water slide', 'water park'],
    'whalewatching':   ['pilot whales', 'whale watching'],
    'wal':             ['pilot whales'],
    'delfine':         ['dolphins bow riding', 'dolphins swimming'],
    'loroparque':      ['Loro Parque', 'parrots'],
    'orca-splash':     ['orca surface', 'killer whale'],
    'sterne':          ['milky way timelapse', 'night sky timelapse'],
    'anaga':           ['Anaga Tenerife', 'laurel forest'],
    'losgigantes':     ['Los Gigantes Tenerife', 'Tenerife cliffs'],
    'klippen':         ['Los Gigantes Tenerife'],
    'abades':          ['green sea turtle swimming', 'sea turtle'],
    'schildkroete':    ['green sea turtle swimming'],
    'paragliding':     ['paragliding'],
    'cueva':           ['lava tube', 'cave'],
    'lavatunnel':      ['lava tube'],
    'teresitas':       ['Las Teresitas', 'Tenerife beach'],
    'garachico':       ['Garachico', 'natural pool'],
    'caleton':         ['Garachico'],
    'surfkurs':        ['surfing wave ocean', 'surfing'],
    'benijo':          ['Benijo', 'Tenerife beach waves'],
    'playa-americas':  ['Tenerife beach waves', 'Playa de las Américas', 'beach waves'],
    'tejita':          ['El Médano kitesurfing', 'Tenerife beach waves'],
    'puerto':          ['Puerto de la Cruz Tenerife'],
    'sonnenuntergang': ['ocean sunset timelapse', 'sunset timelapse'],
    'urlaubsflirt':    ['ocean sunset timelapse'],
    'paisaje':         ['Tenerife landscape'],
    'paisaje-lunar':   ['Tenerife landscape'],
    'pool':            ['swimming pool', 'hotel pool'],
    'spa':             ['spa massage', 'wellness'],
    'balkon':          ['ocean sunset timelapse'],
    'promenade':       ['Los Cristianos', 'Tenerife promenade'],
    'cocktailbar':     ['cocktail bartender', 'cocktail'],
    'lacaleta':        ['seafood grill', 'fish market'],
    'brunellis':       ['steak grilling', 'steakhouse'],
    'guachinche':      ['canarian food', 'spanish food'],
    'bodega':          ['wine cellar', 'vineyard'],
    'orotava':         ['La Orotava'],
    'lalaguna':        ['San Cristóbal de La Laguna', 'La Laguna Tenerife'],
    'santacruz':       ['Santa Cruz de Tenerife'],
    'candelaria':      ['Candelaria Tenerife'],
    'icod':            ['Drago Icod', 'dragon tree'],
    'drachenbaum':     ['Drago Icod', 'dragon tree'],
    'teno':            ['Punta de Teno', 'lighthouse ocean'],
    'barranco':        ['Barranco del Infierno', 'canyon waterfall'],
    'chinyero':        ['Tenerife volcano', 'volcanic landscape'],
    'roques':          ['Roques de García', 'Teide Tenerife'],
    'botanico':        ['botanical garden'],
    'palmetum':        ['palm trees garden', 'palm garden'],
    'sanandres':       ['Tenerife fishing village', 'fishing harbour'],
    'guimar':          ['Pyramids of Güímar', 'Tenerife'],
    'auditorio':       ['Auditorio de Tenerife', 'Santa Cruz de Tenerife'],
    'karting':         ['kart racing', 'go-kart'],
    'hotelrestaurant': ['buffet food'],
    'guimar-x':        ['Tenerife'],
  };

  const VIDEO_CACHE_KEY = 'tus_videos_v1';
  let videoCache = {};
  try {
    if (typeof localStorage !== 'undefined')
      videoCache = JSON.parse(localStorage.getItem(VIDEO_CACHE_KEY) || '{}');
  } catch (e) { videoCache = {}; }
  const videoFehlgeschlagen = new Set();
  const videoLaufend = {};

  function videoCacheSpeichern() {
    try {
      if (typeof localStorage !== 'undefined')
        localStorage.setItem(VIDEO_CACHE_KEY, JSON.stringify(videoCache));
    } catch (e) { /* egal */ }
  }

  async function videoSuchen(suchbegriff) {
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
      '&generator=search&gsrnamespace=6&gsrlimit=6' +
      '&gsrsearch=' + encodeURIComponent('filetype:video ' + suchbegriff) +
      '&prop=videoinfo&viprop=url|size|derivatives';
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return null;
    const json = await resp.json();
    const seiten = json.query && json.query.pages ? Object.values(json.query.pages) : [];
    seiten.sort((a, b) => (a.index || 99) - (b.index || 99));
    for (const seite of seiten) {
      const vi = seite.videoinfo && seite.videoinfo[0];
      if (!vi) continue;
      const dauer = vi.duration || 0;
      if (dauer && (dauer < 2 || dauer > 600)) continue;   // zu kurz/lang fürs Kino
      const ableitungen = (vi.derivatives || []).filter(d =>
        d.src && /video\/(webm|mp4)/.test(d.type || '') && d.height && d.height <= 720);
      if (!ableitungen.length) continue;
      ableitungen.sort((a, b) => b.height - a.height);     // beste Qualität ≤ 720p
      return {
        url: ableitungen[0].src,
        quelle: vi.descriptionurl || ('https://commons.wikimedia.org/wiki/' + encodeURIComponent(seite.title)),
        titel: seite.title.replace(/^File:/, '').replace(/\.\w+$/, ''),
      };
    }
    return null;
  }

  /** Liefert ein Promise auf {url, quelle, titel} oder null. */
  function videoHole(motiv) {
    if (videoCache[motiv]) return Promise.resolve(videoCache[motiv]);
    if (videoFehlgeschlagen.has(motiv) || !VIDEO_SUCHE[motiv]) return Promise.resolve(null);
    if (videoLaufend[motiv]) return videoLaufend[motiv];
    if (typeof fetch === 'undefined') return Promise.resolve(null);

    videoLaufend[motiv] = (async () => {
      const begriffe = Array.isArray(VIDEO_SUCHE[motiv]) ? VIDEO_SUCHE[motiv] : [VIDEO_SUCHE[motiv]];
      for (const begriff of begriffe) {
        try {
          const video = await videoSuchen(begriff);
          if (video) { videoCache[motiv] = video; videoCacheSpeichern(); return video; }
        } catch (e) { /* offline → Bild-Fallback */ }
      }
      videoFehlgeschlagen.add(motiv);
      return null;
    })();
    return videoLaufend[motiv];
  }

  /** Hängt ein Bild an ein <img>-Element, sobald es verfügbar ist. */
  function anzeigen(img, motiv, klein) {
    hole(motiv).then(bild => {
      if (!bild || !img.isConnected) return;
      img.src = klein ? bild.klein : bild.url;
      img.alt = bild.titel;
      img.title = bild.titel + ' – Foto: Wikipedia/Wikimedia Commons (Klick für Quelle & Lizenz)';
      img.dataset.quelle = bild.artikelUrl;
      img.addEventListener('load', () => img.classList.add('geladen'));
      img.addEventListener('error', () => img.remove());
    });
  }

  return { hole, anzeigen, videoHole, ARTIKEL, VIDEO_SUCHE };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BILDER;
