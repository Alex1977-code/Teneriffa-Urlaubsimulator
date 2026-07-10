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

  return { hole, anzeigen, ARTIKEL };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BILDER;
