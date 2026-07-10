'use strict';

/**
 * Headless-Simulationstest für die Spiel-Engine.
 * Spielt viele zufällige Urlaube komplett durch und prüft Invarianten.
 * Ausführen mit:  node test/simulation.js
 */
const Game = require('../js/game.js');
const DATA = require('../js/data.js');

let fehler = 0;
const pruefe = (bedingung, text) => {
  if (!bedingung) { fehler++; console.error('  ❌ ' + text); }
};

const DURCHLAEUFE = 300;
const scores = [];

for (let n = 0; n < DURCHLAEUFE; n++) {
  Game._reset();
  // Meta-Level zufällig vorbelegen, damit auch Level-Unlocks getestet werden
  Game.meta.xp = Math.random() < 0.5 ? 0 : Math.floor(Math.random() * 2400);

  const cfg = {
    dauer: [7, 10, 14][Math.floor(Math.random() * 3)],
    region: Math.random() < 0.5 ? 'sued' : 'nord',
    hotel: ['spar', 'komfort', 'deluxe'][Math.floor(Math.random() * 3)],
    transport: Math.random() < 0.5 ? 'mietwagen' : 'bus',
    items: Object.keys(DATA.ITEMS).filter(() => Math.random() < 0.4),
  };
  Game.neuerUrlaub(cfg);

  let ende = null;
  let schritte = 0;
  while (!ende && schritte < 500) {
    schritte++;
    const run = Game.run;
    pruefe(run.budget >= 0, `Budget negativ: ${run.budget}`);
    pruefe(run.energie >= 0 && run.energie <= 100, `Energie außerhalb 0–100: ${run.energie}`);
    pruefe(run.stimmung >= 0 && run.stimmung <= 100, `Stimmung außerhalb 0–100: ${run.stimmung}`);
    pruefe(run.erholung >= 0 && run.erholung <= 100, `Erholung außerhalb 0–100: ${run.erholung}`);
    pruefe(run.stress >= 0 && run.stress <= 100, `Stress außerhalb 0–100: ${run.stress}`);
    pruefe(run.flug && run.flug.zeilen.length >= 5, 'Flug-Zeitachse fehlt oder zu kurz');
    pruefe(run.slot >= 0 && run.slot <= 2, `Ungültiger Slot: ${run.slot}`);
    pruefe(run.tag >= 1 && run.tag <= run.dauer, `Ungültiger Tag: ${run.tag}/${run.dauer}`);

    const liste = Game.aktivitaetenListe();
    pruefe(liste.length > 0, `Keine Aktivitäten für Tag ${run.tag}, Slot ${run.slot}`);
    const verfuegbar = liste.filter(e => !e.gesperrt);
    pruefe(verfuegbar.length > 0,
      `Keine verfügbare Aktivität (Tag ${run.tag}, Slot ${run.slot}, Budget ${run.budget})`);
    if (!verfuegbar.length) break;

    const wahl = verfuegbar[Math.floor(Math.random() * verfuegbar.length)];
    const res = Game.aktivitaetAusfuehren(wahl.act.id);
    pruefe(res !== null, `Ausführung fehlgeschlagen: ${wahl.act.id}`);
    if (!res) break;

    if (res.fahrt) {
      pruefe(res.fahrt.zeilen.length >= 1, 'Fahrt ohne Zeilen');
      pruefe(res.fahrt.von && res.fahrt.nach, 'Fahrt ohne Start/Ziel');
      // Gelegentlich selbst fahren (Minispiel-Ergebnis simulieren)
      if (res.fahrt.transport === 'mietwagen' && Math.random() < 0.5) {
        const ergebnis = Game.fahrtBewerten(Math.floor(Math.random() * 5));
        pruefe(ergebnis && ergebnis.text, 'Fahrtbewertung ohne Ergebnis');
      }
    }

    if (res.ereignis) {
      const anzahlWahlen = res.ereignis.wahl ? res.ereignis.wahl.length : 1;
      const eRes = Game.ereignisEntscheiden(Math.floor(Math.random() * anzahlWahlen));
      pruefe(eRes !== null, `Ereignisauflösung fehlgeschlagen: ${res.ereignis.id}`);
    }

    const r = Game.fortfahren();
    pruefe(['slot', 'tagesende', 'urlaubsende'].includes(r.typ), `Unerwarteter Fortschritt-Typ: ${r.typ}`);
    if (r.typ === 'urlaubsende') ende = r;
  }

  pruefe(ende !== null, `Urlaub endete nicht (${schritte} Schritte, cfg ${JSON.stringify(cfg)})`);
  if (!ende) continue;

  pruefe(Number.isFinite(ende.score), `Ungültiger Score: ${ende.score}`);
  pruefe(ende.teile.reduce((s, t) => s + t.punkte, 0) === ende.score, 'Score-Teile summieren nicht zum Gesamtscore');
  pruefe(ende.quests.length === 3, `Erwartet 3 Quests, erhalten ${ende.quests.length}`);
  pruefe(!!ende.bewertung, 'Keine Bewertung ermittelt');
  pruefe(Game.run === null, 'Run wurde nach Urlaubsende nicht gelöscht');
  pruefe(Game.meta.urlaubeGesamt >= 1, 'Meta-Zähler nicht erhöht');
  pruefe(Game.meta.bestenliste.length >= 1 && Game.meta.bestenliste.length <= 10, 'Bestenliste außerhalb 1–10 Einträgen');
  scores.push(ende.score);
}

// Datenkonsistenz: referenzierte Fotos existieren
for (const a of DATA.AKTIVITAETEN) {
  if (a.foto) pruefe(DATA.FOTOS[a.foto], `Aktivität ${a.id} referenziert unbekanntes Foto '${a.foto}'`);
  pruefe(a.slots.every(s => s >= 0 && s <= 2), `Aktivität ${a.id} hat ungültige Slots`);
  pruefe(DATA.ZONEN[a.zone], `Aktivität ${a.id} hat unbekannte Zone '${a.zone}'`);
}
for (const e of DATA.EREIGNISSE) {
  const effekteListe = e.wahl
    ? e.wahl.flatMap(w => w.zufall ? w.zufall.map(z => z.effekte) : [w.effekte])
    : [e.effekte];
  for (const eff of effekteListe) {
    pruefe(eff, `Ereignis ${e.id} hat eine Wahl ohne Effekte`);
    if (eff && eff.foto) pruefe(DATA.FOTOS[eff.foto], `Ereignis ${e.id} referenziert unbekanntes Foto '${eff.foto}'`);
  }
  if (e.wahl) for (const w of e.wahl)
    if (w.zufall) pruefe(Math.abs(w.zufall.reduce((s, z) => s + z.p, 0) - 1) < 0.01,
      `Ereignis ${e.id}: Zufallswahrscheinlichkeiten summieren nicht zu 1`);
}

const schnitt = Math.round(scores.reduce((s, x) => s + x, 0) / scores.length);
console.log(`\n${DURCHLAEUFE} Urlaube simuliert (Zufallsspieler).`);
console.log(`Score: min ${Math.min(...scores)} · Ø ${schnitt} · max ${Math.max(...scores)}`);

if (fehler) {
  console.error(`\n❌ ${fehler} Fehler gefunden.`);
  process.exit(1);
} else {
  console.log('✅ Alle Invarianten halten.');
}
