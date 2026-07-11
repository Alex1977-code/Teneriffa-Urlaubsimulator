'use strict';

/**
 * Teneriffa Urlaubssimulator – Spiel-Engine
 * Reine Spiellogik ohne DOM-Zugriffe. Persistenz über localStorage
 * (mit In-Memory-Fallback, damit die Engine auch in Node testbar ist).
 */
const Game = (() => {
  const D = (typeof DATA !== 'undefined') ? DATA : require('./data.js');

  // ------------------------------------------------------------ Persistenz
  const speicher = (() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('__tus_test', '1');
        localStorage.removeItem('__tus_test');
        return localStorage;
      }
    } catch (e) { /* Safari privater Modus etc. */ }
    const mem = {};
    return {
      getItem: k => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: k => { delete mem[k]; },
    };
  })();

  const META_KEY = 'tus_meta_v1';
  const RUN_KEY = 'tus_run_v1';

  function metaLaden() {
    try {
      const raw = speicher.getItem(META_KEY);
      if (raw) return Object.assign(metaNeu(), JSON.parse(raw));
    } catch (e) { /* korrupte Daten ignorieren */ }
    return metaNeu();
  }

  function metaNeu() {
    return { xp: 0, erfolge: [], fotos: [], urlaubeGesamt: 0, bestenliste: [] };
  }

  function metaSpeichern() { speicher.setItem(META_KEY, JSON.stringify(meta)); }
  function runSpeichern() {
    if (run) speicher.setItem(RUN_KEY, JSON.stringify(run));
    else speicher.removeItem(RUN_KEY);
  }

  let meta = metaLaden();
  let run = null;
  try {
    const raw = speicher.getItem(RUN_KEY);
    if (raw) run = JSON.parse(raw);
  } catch (e) { run = null; }

  // ---------------------------------------------------------------- Helfer
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const zufall = arr => arr[Math.floor(Math.random() * arr.length)];

  function gewichtet(chancen) {
    const summe = chancen.reduce((s, [, g]) => s + g, 0);
    let w = Math.random() * summe;
    for (const [id, g] of chancen) { w -= g; if (w <= 0) return id; }
    return chancen[0][0];
  }

  function level(xp) {
    let lvl = 1;
    for (let i = 0; i < D.LEVELS.length; i++) if (xp >= D.LEVELS[i].xp) lvl = i + 1;
    return lvl;
  }

  function levelTitel(lvl) { return D.LEVELS[clamp(lvl, 1, D.LEVELS.length) - 1].titel; }

  // ---------------------------------------------------------------- Wetter
  function wetterGenerieren(dauer) {
    const plan = {};
    for (const region of ['sued', 'nord', 'teide']) {
      plan[region] = [null]; // Index 0 ungenutzt, Tage ab 1
      for (let t = 1; t <= dauer; t++) plan[region].push(gewichtet(D.WETTER_CHANCEN[region]));
    }
    // Calima: seltenes Insel-Ereignis, überzieht 1–2 Tage die ganze Insel
    if (Math.random() < 0.10 && dauer >= 4) {
      const start = 2 + Math.floor(Math.random() * (dauer - 3));
      const tage = Math.random() < 0.5 ? 1 : 2;
      for (let t = start; t < start + tage && t <= dauer; t++)
        for (const region of ['sued', 'nord', 'teide']) plan[region][t] = 'calima';
    }
    return plan;
  }

  function wetterFuerZone(zone, tag) {
    const wRegion = D.ZONEN[zone].wetter || D.ZONEN[run.region].wetter || 'sued';
    return run.wetter[wRegion][tag];
  }

  function wetterFaktor(act, wetterId) {
    const w = D.WETTER[wetterId];
    const outdoor = act.outdoor || 0;
    return 1 - (1 - w.faktor) * (outdoor / 3);
  }

  // ------------------------------------------------------------------ Flug
  // Erzeugt die Anreise als Ereignis-Zeitachse. Effekte werden sofort auf den
  // Spielstand angewendet; die UI spielt die Zeilen nur noch „in Echtzeit“ ab.
  function flugGenerieren() {
    const zeilen = [];
    const wende = (icon, text, effekte) => {
      const chips = [];
      if (effekte) {
        if (effekte.stimmung) { run.stimmung = clamp(run.stimmung + effekte.stimmung, 0, 100);
          chips.push(`😊 ${effekte.stimmung > 0 ? '+' : ''}${effekte.stimmung}`); }
        if (effekte.stress) { run.stress = clamp(run.stress + effekte.stress, 0, 100);
          chips.push(`😰 Stress ${effekte.stress > 0 ? '+' : ''}${effekte.stress}`); }
        if (effekte.energie) { run.energie = clamp(run.energie + effekte.energie, 0, 100);
          chips.push(`🔋 ${effekte.energie > 0 ? '+' : ''}${effekte.energie}`); }
        if (effekte.erlebnis) { run.erlebnis += effekte.erlebnis; chips.push(`⭐ +${effekte.erlebnis}`); }
        if (effekte.foto && !run.fotosRun.includes(effekte.foto)) {
          run.fotosRun.push(effekte.foto); chips.push('📸 Fotomotiv!'); }
        if (effekte.flag) run.flags[effekte.flag] = true;
      }
      zeilen.push({ icon, text, chips });
    };

    wende('🛄', 'Flughafen, viel zu früh am Morgen. Boarding für deinen Flug nach Teneriffa Süd.');

    if (Math.random() < 0.28) {
      const minuten = 20 + Math.floor(Math.random() * 71);
      wende('⏳', `Technische Überprüfung: Dein Flieger hebt mit ${minuten} Minuten Verspätung ab. Die Anzeigetafel kennt kein Mitleid.`,
        { stress: Math.min(18, 6 + Math.round(minuten / 8)), stimmung: -5, energie: minuten > 45 ? -5 : 0 });
    } else {
      wende('🛫', 'Pünktlicher Abflug auf die Minute – der Urlaub beginnt entspannt über den Wolken.',
        { stimmung: 4, stress: -3 });
    }

    if (Math.random() < 0.22)
      wende('🎢', 'Über der Biskaya wird es ruppig – „Bitte angeschnallt bleiben.“ Dein Getränk übt Wellenreiten.',
        { stress: 6 });

    if (Math.random() < 0.35)
      wende('🧊', 'Getränkeservice: Deine Cola kommt randvoll mit Eiswürfeln – dabei hattest du extra „ohne“ gesagt.',
        { stress: 4, stimmung: -2 });
    else
      wende('🥤', 'Getränkeservice, ein überraschend gutes Sandwich und ein halber Film. So lässt es sich reisen.',
        { stimmung: 3 });

    if (!run.flags.guachincheEntdeckt && Math.random() < 0.18)
      wende('💬', 'Deine Sitznachbarin fliegt „nach Hause“: Sie schwärmt dir von einer Guachinche vor, in der ihre Tante kocht – und malt dir eine Wegskizze.',
        { erlebnis: 4, flag: 'guachincheEntdeckt' });

    if (Math.random() < 0.45)
      wende('🌋', 'Fensterplatz-Moment beim Anflug: Der Teide durchbricht das Wolkenmeer wie eine Insel über der Insel!',
        { stimmung: 6, foto: 'teide-anflug' });

    wende('🛬', 'Butterweiche Landung auf Teneriffa Süd, Applaus in Reihe 23. ¡Bienvenidos!');

    if (Math.random() < 0.10) {
      run.kofferWeg = true;
      run.kofferTag = 3;
      run.kofferVerloren = true;
      wende('🧳', 'Am Gepäckband dreht sich alles – nur dein Koffer nicht. „In Madrid hängengeblieben, wird nachgeliefert.“ Na super.',
        { stress: 22, stimmung: -8 });
    } else {
      wende('🧳', 'Dein Koffer gehört zu den ersten auf dem Band – wenn das kein gutes Omen ist.',
        { stimmung: 2 });
    }

    const zimmerLos = Math.random();
    if (zimmerLos < 0.25) {
      wende('🌅', 'Check-in-Überraschung: oberste Etage, großer Balkon, Meerblick. Dieses Zimmer atmet Urlaub.',
        { stimmung: 8, stress: -5, flag: 'zimmerSchoen' });
    } else if (zimmerLos < 0.40) {
      wende('🔊', 'Dein Zimmer geht zum Parkplatz raus, und der Minikühlschrank brummt wie ein Moped. Das kann ja heiter werden.',
        { stress: 10, stimmung: -5, flag: 'zimmerLaut' });
    } else {
      wende('🛏️', 'Solides Zimmer mit kleinem Balkon und Blick auf die Pool-Landschaft – passt.');
    }

    run.flug = { zeilen, gesehen: false };
  }

  function flugBestaetigen() {
    if (run && run.flug) { run.flug.gesehen = true; runSpeichern(); }
  }

  // Gepäck ist nur nutzbar, wenn der Koffer auch wirklich angekommen ist
  function hatItem(id) {
    return !!run && run.items.includes(id) && !run.kofferWeg;
  }

  // ------------------------------------------------------------- Inselfahrt
  // Wendet ein Effekt-Objekt an und liefert lesbare Chips für die UI.
  function effekteAnwenden(effekte) {
    const chips = [];
    if (!effekte) return chips;
    if (effekte.budget) { run.budget = Math.max(0, run.budget + effekte.budget);
      chips.push(`💶 ${effekte.budget > 0 ? '+' : ''}${effekte.budget} €`); }
    if (effekte.energie) { run.energie = clamp(run.energie + effekte.energie, 0, 100);
      chips.push(`🔋 ${effekte.energie > 0 ? '+' : ''}${effekte.energie}`); }
    if (effekte.stimmung) { run.stimmung = clamp(run.stimmung + effekte.stimmung, 0, 100);
      chips.push(`😊 ${effekte.stimmung > 0 ? '+' : ''}${effekte.stimmung}`); }
    if (effekte.erholung) { run.erholung = clamp(run.erholung + effekte.erholung, 0, 100);
      chips.push(`🧘 ${effekte.erholung > 0 ? '+' : ''}${effekte.erholung}`); }
    if (effekte.stress) { run.stress = clamp(run.stress + effekte.stress, 0, 100);
      chips.push(`😰 Stress ${effekte.stress > 0 ? '+' : ''}${effekte.stress}`); }
    if (effekte.erlebnis) { run.erlebnis += effekte.erlebnis; chips.push(`⭐ +${effekte.erlebnis}`); }
    return chips;
  }

  function fahrtGenerieren(zielZone, anzahlHops) {
    const pool = D.FAHRT_EREIGNISSE[run.transport];
    const zeilen = [{
      icon: D.TRANSPORT[run.transport].icon,
      text: zufall(D.FAHRT_BASIS[run.transport]),
      chips: [],
    }];
    if (Math.random() < 0.55) {
      const id = gewichtet(pool.map(e => [e.id, e.gewicht || 1]));
      const ereignis = pool.find(e => e.id === id);
      if (ereignis)
        zeilen.push({ icon: ereignis.icon, text: ereignis.text, chips: effekteAnwenden(ereignis.effekte) });
    }
    return { von: run.region, nach: zielZone, transport: run.transport, hops: anzahlHops, zeilen };
  }

  // Ergebnis des Selbstfahr-Minispiels (nur Mietwagen).
  // treffer = Rempler, stil = Fahrstil-Punkte (Überholmanöver, knappe Ausweicher).
  function fahrtBewerten(treffer, stil) {
    if (!run) return null;
    stil = stil || 0;
    run.fahrstilBestes = Math.max(run.fahrstilBestes || 0, stil);
    let icon, text, effekte;
    if (treffer === 0) {
      icon = '🏁'; text = 'Keine Schrecksekunde, jede Kurve gesessen – du fährst wie ein Einheimischer!';
      effekte = { stimmung: 5, stress: -4, erlebnis: 5 };
      meta.perfekteFahrt = true; metaSpeichern();
    } else if (treffer <= 3) {
      icon = '🚗'; text = 'Gut angekommen – mit ein paar Schrecksekunden und einem entschuldigenden Winken.';
      effekte = { stress: 2 };
    } else {
      icon = '😅'; text = 'Wilde Fahrt! Die Felgen haben Bordstein-Bekanntschaft gemacht. Das bleibt unter uns.';
      effekte = { stress: 7, stimmung: -4, energie: -4 };
    }
    if (stil >= 150) {
      text += ' Und dieser Fahrstil: Überholmanöver wie ein Insel-Racer!';
      effekte.erlebnis = (effekte.erlebnis || 0) + Math.min(12, Math.round(stil / 20));
      effekte.stimmung = (effekte.stimmung || 0) + 3;
    } else if (stil >= 60) {
      effekte.erlebnis = (effekte.erlebnis || 0) + Math.min(8, Math.round(stil / 15));
    }
    const chips = effekteAnwenden(effekte);
    if (stil > 0) chips.unshift(`🏎️ Fahrstil: ${stil} Punkte`);
    runSpeichern();
    return { icon, text, chips };
  }

  // Effekte aus Bonusleveln (z. B. Kart-Rennen) anwenden
  function bonusAnwenden(effekte) {
    if (!run) return [];
    const chips = effekteAnwenden(effekte);
    runSpeichern();
    return chips;
  }

  // Perfekt getimter Foto-Auslöser (Kino-Minispiel)
  function fotoPerfekt() {
    if (!run) return null;
    run.erlebnis += 5;
    run.stimmung = clamp(run.stimmung + 2, 0, 100);
    meta.perfektesFoto = true;
    metaSpeichern();
    runSpeichern();
    return { erlebnis: 5, stimmung: 2 };
  }

  // ------------------------------------------------------------ Neuer Lauf
  function neuerUrlaub(cfg) {
    const hotel = D.HOTELS[cfg.region][cfg.hotel];
    const dauer = cfg.dauer;
    let budget = Math.round(hotel.budgetProTag * dauer);

    if (cfg.transport === 'mietwagen') budget -= D.TRANSPORT.mietwagen.kostenProTag * dauer;
    const items = [];
    for (const it of cfg.items || []) {
      if (D.ITEMS[it] && !items.includes(it)) { items.push(it); budget -= D.ITEMS[it].preis; }
    }
    budget = Math.max(0, budget);

    // 3 zufällige Urlaubsziele (Quests)
    const questPool = D.QUESTS.slice();
    const quests = [];
    while (quests.length < 3 && questPool.length) {
      const i = Math.floor(Math.random() * questPool.length);
      quests.push(questPool.splice(i, 1)[0].id);
    }

    run = {
      region: cfg.region, hotel: cfg.hotel, transport: cfg.transport, dauer,
      tag: 1, slot: 1, // Tag 1: Ankunft am Mittag – der Vormittag geht für die Anreise drauf
      budget, energie: 65, stimmung: 70, erholung: 10, erlebnis: 0, sonnenbrand: 0,
      stress: 15, kofferWeg: false, kofferTag: 0, kofferVerloren: false,
      flirt: { stufe: 0, name: null },
      items, souvenirs: 0, quests,
      wetter: wetterGenerieren(dauer),
      flags: { guachincheEntdeckt: items.includes('reisefuehrer'), hotelUpgrade: false,
               fruehSchlafen: false, sonnenbrandWarnung: false,
               zimmerSchoen: false, zimmerLaut: false },
      fotosRun: [], zonenBesucht: [], restaurantAbende: 0, wanderungen: 0,
      kulturAusfluege: 0, strandTage: 0, actionZahl: 0, aktZaehler: {},
      log: [], pending: null, flug: null,
    };
    flugGenerieren();
    logEintrag('🛬', `Ankunft auf Teneriffa! Transfer nach ${D.REGIONEN[cfg.region].name.split(' (')[0]}, Check-in im ${hotel.name} ${hotel.sterne} – der Urlaub beginnt am Nachmittag.`);
    runSpeichern();
    return run;
  }

  function logEintrag(icon, text) {
    run.log.push({ tag: run.tag, slot: run.slot, icon, text });
    if (run.log.length > 200) run.log.shift();
  }

  // ------------------------------------------- Aktivitäten für aktuellen Slot
  function aktivitaetenListe() {
    const lvl = level(meta.xp);
    const liste = [];
    for (const act of D.AKTIVITAETEN) {
      if (!act.slots.includes(run.slot)) continue;
      if (act.versteckt && !run.flags.guachincheEntdeckt) continue;
      if (act.minLevel && lvl < act.minLevel) continue;
      if (act.nurHotel && !act.nurHotel.includes(run.hotel)) continue;

      const zone = act.zone === 'hotel' ? 'hotel' : act.zone;
      const zielZone = zone === 'hotel' ? run.region : zone;
      const anzahlHops = D.hops(run.region, zone === 'hotel' ? run.region : zone);
      const t = D.TRANSPORT[run.transport];
      const reiseKosten = anzahlHops * t.hopKosten;
      const reiseEnergie = anzahlHops * t.hopEnergie;
      const wetterId = wetterFuerZone(zielZone, run.tag);
      const gesamtKosten = act.kosten + reiseKosten;

      let gesperrt = null;
      if ((act.blockiertBei || []).includes(wetterId))
        gesperrt = `Bei ${D.WETTER[wetterId].name.toLowerCase()}em Wetter nicht möglich`;
      else if (act.dauer === 2 && run.tag === run.dauer)
        gesperrt = 'Heute ist Abreisetag – keine Zeit für einen Ganztagesausflug';
      else if (gesamtKosten > run.budget)
        gesperrt = 'Zu teuer für dein restliches Budget';

      liste.push({
        act, wetterId, hops: anzahlHops, reiseKosten, reiseEnergie, gesamtKosten,
        faktor: wetterFaktor(act, wetterId), gesperrt,
        erschoepft: effektiveEnergie(act) < 0 &&
                    (run.energie - reiseEnergie + effektiveEnergie(act)) < 0,
      });
    }
    return liste;
  }

  function effektiveEnergie(act) {
    if (act.energieMitSchuhen !== undefined && hatItem('wanderschuhe'))
      return act.energieMitSchuhen;
    return act.energie;
  }

  // ------------------------------------------------------ Aktivität ausführen
  function aktivitaetAusfuehren(actId) {
    if (run.pending) return null;   // erst die laufende Auflösung abschließen
    const eintrag = aktivitaetenListe().find(e => e.act.id === actId);
    if (!eintrag || eintrag.gesperrt) return null;
    const { act, wetterId, hops: anzahlHops, reiseKosten, reiseEnergie, faktor } = eintrag;

    const effekte = [];
    const vorher = { energie: run.energie };

    // Kosten & Anreise – längere Strecken werden zur kleinen Reise-Sequenz
    run.budget -= act.kosten + reiseKosten;
    if (reiseEnergie) run.energie = clamp(run.energie - reiseEnergie, 0, 100);
    let fahrt = null;
    if (anzahlHops > 0) {
      const t = D.TRANSPORT[run.transport];
      fahrt = fahrtGenerieren(act.zone, anzahlHops);
      fahrt.actId = act.id;
      effekte.push({ icon: t.icon, text: `Anfahrt in die Region ${D.ZONEN[act.zone].name} (${reiseKosten ? reiseKosten + ' €, ' : ''}${reiseEnergie} Energie)` });
    }

    // Erschöpfungs-Check: Wer sich völlig verausgabt, hat weniger davon
    const energieDelta = effektiveEnergie(act);
    let ertragsFaktor = faktor;
    let erschoepft = false;
    if (energieDelta < 0 && run.energie + energieDelta < 0) {
      erschoepft = true;
      ertragsFaktor *= 0.5;
      run.stimmung = clamp(run.stimmung - 6, 0, 100);
      run.stress = clamp(run.stress + 6, 0, 100);
    }
    run.energie = clamp(run.energie + energieDelta, 0, 100);

    // Erträge (positive Werte wetterskaliert)
    const skaliere = v => (v > 0 ? Math.round(v * ertragsFaktor) : v);

    // Neuigkeitswert: Wiederholte Aktivitäten sind nur noch halb so aufregend
    const wiederholungen = run.aktZaehler[act.id] || 0;
    run.aktZaehler[act.id] = wiederholungen + 1;
    const neuFaktor = Math.max(0.25, Math.pow(0.5, wiederholungen));

    // Erholungs-Softcap: Je erholter du bist, desto weniger bringt noch mehr Faulenzen
    const erholungsCap = Math.max(0, 1 - run.erholung / 110);

    // Wer innerlich unter Strom steht, kann nicht richtig abschalten
    const stressBremse = run.stress >= 70 ? 0.5 : 1;

    const dErholung = Math.round(skaliere(act.erholung || 0) * (act.erholung > 0 ? erholungsCap * stressBremse : 1));
    const dStimmung = skaliere(act.stimmung || 0);
    const dErlebnis = Math.round(skaliere(act.erlebnis || 0) * neuFaktor);
    const dStress = act.stress || 0;
    run.erholung = clamp(run.erholung + dErholung, 0, 100);
    run.stimmung = clamp(run.stimmung + dStimmung, 0, 100);
    run.stress = clamp(run.stress + dStress, 0, 100);
    run.erlebnis += dErlebnis;

    // Sonnenbrand
    const sonnenPunkte = (act.sonne || 0) * D.WETTER[wetterId].sonne;
    if (sonnenPunkte > 0) {
      let brand = sonnenPunkte * 2.2;
      if (hatItem('sonnencreme')) brand *= 0.3;
      run.sonnenbrand = clamp(run.sonnenbrand + Math.round(brand), 0, 100);
    }

    // Foto?
    let fotoNeu = null;
    if (act.foto && !run.fotosRun.includes(act.foto)) {
      const wetterOk = !act.fotoWetter || act.fotoWetter.includes(wetterId);
      if (wetterOk) {
        run.fotosRun.push(act.foto);
        fotoNeu = act.foto;
      } else if (act.fotoWetter) {
        effekte.push({ icon: '🌫️', text: 'Leider keine klare Sicht – das Foto wäre bei besserem Wetter drin gewesen.' });
      }
    }

    // Zähler für Quests & Erfolge
    if (!run.zonenBesucht.includes(act.zone) && act.zone !== 'hotel') run.zonenBesucht.push(act.zone);
    if (act.tags.includes('restaurant') && act.zone !== 'hotel') run.restaurantAbende++;
    if (act.tags.includes('wandern')) run.wanderungen++;
    if (act.tags.includes('kultur')) run.kulturAusfluege++;
    if (act.tags.includes('strand')) run.strandTage++;
    if (act.tags.includes('action')) run.actionZahl++;
    if (act.id === 'guachinche') run.guachincheBesucht = true;
    if (act.flagge) run.flags[act.flagge] = true;

    // Effektzeilen für die UI
    if (erschoepft) effekte.push({ icon: '🥵', text: 'Du warst völlig erschöpft – das war nur halb so schön wie möglich.' });
    if (wiederholungen > 0 && (act.erlebnis || 0) > 0)
      effekte.push({ icon: '🔁', text: 'Kennst du schon – der Neuigkeitswert lässt nach.' });
    if (stressBremse < 1 && (act.erholung || 0) > 0)
      effekte.push({ icon: '😰', text: 'Dein Kopf kommt nicht zur Ruhe – so erholt sich niemand richtig.' });
    if (faktor < 0.8 && (act.outdoor || 0) >= 2)
      effekte.push({ icon: D.WETTER[wetterId].icon, text: `Das Wetter (${D.WETTER[wetterId].name}) hat das Erlebnis etwas getrübt.` });
    if (dErholung) effekte.push({ icon: '🧘', text: `Erholung ${dErholung > 0 ? '+' : ''}${dErholung}` });
    if (dStimmung) effekte.push({ icon: '😊', text: `Stimmung ${dStimmung > 0 ? '+' : ''}${dStimmung}` });
    if (dStress) effekte.push({ icon: '😮‍💨', text: `Stress ${dStress > 0 ? '+' : ''}${dStress}` });
    if (dErlebnis) effekte.push({ icon: '⭐', text: `Erlebnispunkte +${dErlebnis}` });
    if (act.kosten + reiseKosten > 0) effekte.push({ icon: '💶', text: `Ausgaben: ${act.kosten + reiseKosten} €` });
    const energieGesamt = run.energie - vorher.energie;
    effekte.push({ icon: '🔋', text: `Energie ${energieGesamt > 0 ? '+' : ''}${energieGesamt}` });

    logEintrag(act.icon, act.name);

    // Sonnenbrand-Warnung (einmalig)
    let warnung = null;
    if (run.sonnenbrand >= 60 && !run.flags.sonnenbrandWarnung) {
      run.flags.sonnenbrandWarnung = true;
      run.stimmung = clamp(run.stimmung - 8, 0, 100);
      run.stress = clamp(run.stress + 8, 0, 100);
      warnung = 'Autsch – Sonnenbrand! Deine Schultern glühen. Heute Abend hilft nur After-Sun und Schatten.';
      logEintrag('🥵', 'Sonnenbrand!');
    }

    // Zufallsereignis?
    let ereignis = null;
    if (Math.random() < 0.34) {
      const ctx = { act, zone: act.zone, wetterId, run, hops: anzahlHops, hatItem };
      const passende = D.EREIGNISSE.filter(e => {
        try { return e.bedingung(ctx); } catch (err) { return false; }
      });
      if (passende.length) {
        const gewichte = passende.map(e => [e.id, e.gewicht || 1]);
        const id = gewichtet(gewichte);
        ereignis = passende.find(e => e.id === id);
        // Der Urlaubsflirt bekommt beim Kennenlernen einen Namen
        if (ereignis.text.includes('%NAME%') && !run.flirt.name)
          run.flirt.name = zufall(D.FLIRT_NAMEN);
        run.pending = { typ: 'ereignis', id: ereignis.id, dauer: act.dauer,
                        text: ereignis.text.replace(/%NAME%/g, run.flirt.name || '') };
      }
    }
    if (!run.pending) run.pending = { typ: 'weiter', dauer: act.dauer };

    runSpeichern();
    return {
      act, effekte, fotoNeu, warnung, fahrt,
      ereignis: ereignis ? { id: ereignis.id, icon: ereignis.icon, text: run.pending.text,
                             wahl: ereignis.wahl ? ereignis.wahl.map(w => w.text) : null } : null,
    };
  }

  // ------------------------------------------------- Ereignis auflösen
  function ereignisEntscheiden(wahlIndex) {
    if (!run.pending || run.pending.typ !== 'ereignis') return null;
    const ereignis = D.EREIGNISSE.find(e => e.id === run.pending.id);
    if (!ereignis) { run.pending.typ = 'weiter'; runSpeichern(); return null; }

    let effekte, antwort = null;
    if (ereignis.wahl) {
      const wahl = ereignis.wahl[clamp(wahlIndex || 0, 0, ereignis.wahl.length - 1)];
      if (wahl.zufall) {
        // Risiko-Entscheidung: Der Ausgang wird ausgewürfelt
        let wurf = Math.random();
        let ausgang = wahl.zufall[wahl.zufall.length - 1];
        for (const kandidat of wahl.zufall) {
          wurf -= kandidat.p;
          if (wurf <= 0) { ausgang = kandidat; break; }
        }
        effekte = ausgang.effekte; antwort = ausgang.antwort;
      } else {
        effekte = wahl.effekte; antwort = wahl.antwort;
      }
    } else {
      effekte = ereignis.effekte;
    }

    const zeilen = [];
    let fotoNeu = null;
    if (effekte.budget) { run.budget = Math.max(0, run.budget + effekte.budget);
      zeilen.push({ icon: '💶', text: `${effekte.budget > 0 ? '+' : ''}${effekte.budget} €` }); }
    if (effekte.energie) { run.energie = clamp(run.energie + effekte.energie, 0, 100);
      zeilen.push({ icon: '🔋', text: `Energie ${effekte.energie > 0 ? '+' : ''}${effekte.energie}` }); }
    if (effekte.stimmung) { run.stimmung = clamp(run.stimmung + effekte.stimmung, 0, 100);
      zeilen.push({ icon: '😊', text: `Stimmung ${effekte.stimmung > 0 ? '+' : ''}${effekte.stimmung}` }); }
    if (effekte.erholung) { run.erholung = clamp(run.erholung + effekte.erholung, 0, 100);
      zeilen.push({ icon: '🧘', text: `Erholung ${effekte.erholung > 0 ? '+' : ''}${effekte.erholung}` }); }
    if (effekte.stress) { run.stress = clamp(run.stress + effekte.stress, 0, 100);
      zeilen.push({ icon: '😮‍💨', text: `Stress ${effekte.stress > 0 ? '+' : ''}${effekte.stress}` }); }
    if (effekte.erlebnis) { run.erlebnis += effekte.erlebnis;
      zeilen.push({ icon: '⭐', text: `Erlebnispunkte +${effekte.erlebnis}` }); }
    if (effekte.souvenir) { run.souvenirs += effekte.souvenir;
      zeilen.push({ icon: '🎁', text: 'Souvenir eingepackt' }); }
    if (effekte.flag) run.flags[effekte.flag] = true;
    if (effekte.flirt) {
      run.flirt.stufe = Math.max(run.flirt.stufe, effekte.flirt);
      zeilen.push({ icon: '💞', text: effekte.flirt >= 3
        ? `Diesen Abend mit ${run.flirt.name} vergisst du nicht.`
        : `Du und ${run.flirt.name} – das könnte was werden.` });
    }
    if (effekte.foto && !run.fotosRun.includes(effekte.foto)) {
      run.fotosRun.push(effekte.foto); fotoNeu = effekte.foto;
    }

    const logText = (run.pending.text || ereignis.text).replace(/%NAME%/g, run.flirt.name || '');
    logEintrag(ereignis.icon, logText.slice(0, 60) + (logText.length > 60 ? '…' : ''));
    run.pending.typ = 'weiter';
    runSpeichern();
    return { zeilen, antwort, fotoNeu,
             guachincheNeu: effekte.flag === 'guachincheEntdeckt' };
  }

  // ------------------------------------------------------- Zeit voranschreiten
  function fortfahren() {
    if (!run.pending || run.pending.typ !== 'weiter') return { typ: 'fehler' };
    const dauer = run.pending.dauer || 1;
    run.pending = null;
    run.slot += dauer;

    const letzterTag = run.tag === run.dauer;
    if (letzterTag && run.slot >= 1) return urlaubBeenden();
    if (run.slot > 2) return tagBeenden();
    runSpeichern();
    return { typ: 'slot' };
  }

  function tagBeenden() {
    const hotel = D.HOTELS[run.region][run.hotel];
    let regen = 30 + hotel.regen;
    if (run.flags.fruehSchlafen) { regen += 8; run.flags.fruehSchlafen = false; }
    if (run.flags.hotelUpgrade) regen += 3;
    if (run.flags.zimmerLaut) regen -= 5;

    const zeilen = [];
    run.energie = clamp(run.energie + regen, 0, 100);
    zeilen.push({ icon: '🛏️', text: `Eine Nacht im ${hotel.name}: +${regen} Energie` +
      (run.flags.zimmerLaut ? ' (der brummende Kühlschrank fordert Tribut)' : '') });

    if (hotel.erholungNacht) {
      run.erholung = clamp(run.erholung + hotel.erholungNacht, 0, 100);
      zeilen.push({ icon: '🧖', text: `Hotelkomfort: +${hotel.erholungNacht} Erholung` });
    }

    // Über Nacht fällt Stress ab – ein schönes Zimmer hilft dabei
    let stressAbbau = 5 + (run.hotel === 'deluxe' ? 3 : 0) + (run.flags.zimmerSchoen ? 3 : 0)
      - (run.flags.zimmerLaut ? 2 : 0);
    run.stress = clamp(run.stress - stressAbbau, 0, 100);
    zeilen.push({ icon: '😮‍💨', text: `Stress −${stressAbbau}` +
      (run.flags.zimmerSchoen ? ' (mit Meerblick schläft es sich besser)' : '') });

    if (run.flags.zimmerSchoen) run.erholung = clamp(run.erholung + 1, 0, 100);

    if (run.stress >= 60) {
      run.stimmung = clamp(run.stimmung - 6, 0, 100);
      run.erholung = clamp(run.erholung - 3, 0, 100);
      zeilen.push({ icon: '😰', text: 'Du wälzt dich im Bett – zu viel Stress: −6 Stimmung, −3 Erholung' });
    }

    if (run.sonnenbrand >= 60) {
      run.stimmung = clamp(run.stimmung - 8, 0, 100);
      run.erholung = clamp(run.erholung - 4, 0, 100);
      zeilen.push({ icon: '🥵', text: 'Der Sonnenbrand brennt: −8 Stimmung, −4 Erholung' });
    }
    run.sonnenbrand = clamp(run.sonnenbrand - 12, 0, 100);
    if (run.flags.sonnenbrandWarnung && run.sonnenbrand < 40) run.flags.sonnenbrandWarnung = false;

    // Stimmung pendelt sich über Nacht Richtung Ausgangslage ein
    run.stimmung = clamp(Math.round(run.stimmung + (65 - run.stimmung) * 0.15), 0, 100);

    run.tag += 1;
    run.slot = 0;

    // Nachgelieferter Koffer trifft ein
    if (run.kofferWeg && run.tag >= run.kofferTag) {
      run.kofferWeg = false;
      run.stress = clamp(run.stress - 10, 0, 100);
      run.stimmung = clamp(run.stimmung + 8, 0, 100);
      zeilen.push({ icon: '🧳', text: 'Dein Koffer wurde nachgeliefert! Endlich frische Klamotten. Stress −10, Stimmung +8' });
      logEintrag('🧳', 'Der verlorene Koffer ist wieder da!');
    }

    // Wettervorhersage für den neuen Tag
    const morgen = {
      sued: run.wetter.sued[run.tag], nord: run.wetter.nord[run.tag], teide: run.wetter.teide[run.tag],
    };
    const calima = morgen.sued === 'calima';

    logEintrag('🌙', `Tag ${run.tag - 1} ist zu Ende.`);
    runSpeichern();
    return { typ: 'tagesende', zeilen, neuerTag: run.tag, letzterTag: run.tag === run.dauer,
             wetterMorgen: morgen, calima };
  }

  // -------------------------------------------------------- Urlaub beenden
  function urlaubBeenden() {
    const rec = {
      erholung: run.erholung, stimmung: run.stimmung, erlebnis: run.erlebnis,
      budget: run.budget, fotosRun: run.fotosRun, zonenBesucht: run.zonenBesucht,
      restaurantAbende: run.restaurantAbende, wanderungen: run.wanderungen,
      kulturAusfluege: run.kulturAusfluege, strandTage: run.strandTage,
      actionZahl: run.actionZahl, guachincheBesucht: !!run.guachincheBesucht,
      souvenirs: run.souvenirs, dauer: run.dauer,
      stress: run.stress, kofferVerloren: run.kofferVerloren,
      flirtStufe: run.flirt.stufe, fahrstil: run.fahrstilBestes || 0,
    };

    // Quests auswerten
    const quests = run.quests.map(qid => {
      const q = D.QUESTS.find(x => x.id === qid);
      return { id: qid, name: q.name, icon: q.icon, desc: q.desc, geschafft: !!q.check(rec) };
    });
    const questBonus = quests.filter(q => q.geschafft).length * 40;

    // Punktestand
    const teile = [
      { name: 'Erholung', icon: '🧘', punkte: rec.erholung * 3, detail: `${rec.erholung} × 3` },
      { name: 'Erlebnisse', icon: '⭐', punkte: rec.erlebnis, detail: `${rec.erlebnis} Punkte` },
      { name: 'Stimmung am Abreisetag', icon: '😊', punkte: rec.stimmung, detail: `${rec.stimmung} Punkte` },
      { name: 'Fotomotive', icon: '📸', punkte: rec.fotosRun.length * 10, detail: `${rec.fotosRun.length} × 10` },
      { name: 'Souvenirs', icon: '🎁', punkte: rec.souvenirs * 5, detail: `${rec.souvenirs} × 5` },
      { name: 'Urlaubsziele', icon: '🎯', punkte: questBonus, detail: `${quests.filter(q => q.geschafft).length} von 3 geschafft` },
      { name: 'Restbudget', icon: '💶', punkte: Math.min(80, Math.round(rec.budget / 10)), detail: `${rec.budget} €` },
      { name: 'Stresslevel bei Abreise', icon: '😰', punkte: -rec.stress, detail: `${rec.stress} Stress` },
    ];
    const score = teile.reduce((s, t) => s + t.punkte, 0);
    rec.score = score;

    // Längere Urlaube sammeln naturgemäß mehr Punkte – die Messlatte wächst mit
    const dauerFaktor = 0.55 + 0.45 * (run.dauer / 7);
    const bewertung = D.BEWERTUNGEN.find(b => score >= Math.round(b.min * dauerFaktor));
    rec.bewertungIndex = D.BEWERTUNGEN.indexOf(bewertung);

    // Meta-Fortschritt
    const lvlVorher = level(meta.xp);
    meta.urlaubeGesamt += 1;
    const fotosNeuGesamt = run.fotosRun.filter(f => !meta.fotos.includes(f));
    meta.fotos.push(...fotosNeuGesamt);
    const xpGewinn = Math.round(score / 8);
    meta.xp += xpGewinn;
    const lvlNachher = level(meta.xp);

    const unlocks = [];
    for (let l = lvlVorher + 1; l <= lvlNachher; l++)
      if (D.LEVEL_UNLOCKS[l]) unlocks.push(D.LEVEL_UNLOCKS[l]);

    // Erfolge prüfen
    const erfolgeNeu = [];
    for (const e of D.ERFOLGE) {
      if (meta.erfolge.includes(e.id)) continue;
      let ok = false;
      try { ok = !!e.check(rec, meta); } catch (err) { ok = false; }
      if (ok) { meta.erfolge.push(e.id); erfolgeNeu.push(e); }
    }

    // Bestenliste
    meta.bestenliste.push({
      score, datum: new Date().toISOString().slice(0, 10), dauer: run.dauer,
      region: run.region, fotos: run.fotosRun.length,
    });
    meta.bestenliste.sort((a, b) => b.score - a.score);
    meta.bestenliste = meta.bestenliste.slice(0, 10);

    metaSpeichern();
    const ergebnis = {
      typ: 'urlaubsende', score, teile, bewertung, quests,
      fotosRun: run.fotosRun.slice(), fotosNeuGesamt, erfolgeNeu, unlocks,
      xpGewinn, xpGesamt: meta.xp, lvlVorher, lvlNachher,
      levelTitel: levelTitel(lvlNachher),
      naechstesLevelXp: lvlNachher < D.LEVELS.length ? D.LEVELS[lvlNachher].xp : null,
      platz: meta.bestenliste.findIndex(b => b.score === score) + 1,
    };
    run = null;
    runSpeichern();
    return ergebnis;
  }

  function urlaubAbbrechen() { run = null; runSpeichern(); }

  // ------------------------------------------------------------------- API
  return {
    get meta() { return meta; },
    get run() { return run; },
    get level() { return level(meta.xp); },
    get levelTitel() { return levelTitel(level(meta.xp)); },
    levelFuerXp: level,
    titelFuerLevel: levelTitel,
    neuerUrlaub, aktivitaetenListe, aktivitaetAusfuehren,
    ereignisEntscheiden, fortfahren, urlaubAbbrechen,
    wetterFuerZone, flugBestaetigen, hatItem, fahrtBewerten, fotoPerfekt, bonusAnwenden,
    _reset() { meta = metaNeu(); run = null; metaSpeichern(); runSpeichern(); },
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Game;
