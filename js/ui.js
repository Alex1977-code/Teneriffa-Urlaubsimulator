'use strict';

/**
 * Teneriffa Urlaubssimulator – Benutzeroberfläche
 * Rendert alle Bildschirme und verbindet sie mit der Spiel-Engine.
 */
const UI = (() => {
  const $ = sel => document.querySelector(sel);

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  const esc = s => String(s).replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // -------------------------------------------------------------- Bildschirme
  function zeigeScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('aktiv'));
    $('#screen-' + id).classList.add('aktiv');
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------- Modals
  const modalQueue = [];
  let modalOffen = false;

  function zeigeModal(cfg) {
    modalQueue.push(cfg);
    if (!modalOffen) naechstesModal();
  }

  function naechstesModal() {
    const cfg = modalQueue.shift();
    if (!cfg) { modalOffen = false; $('#modal-hintergrund').classList.add('versteckt'); return; }
    modalOffen = true;
    const box = $('#modal-box');
    box.innerHTML = '';
    box.className = cfg.klasse || '';
    if (cfg.icon) box.appendChild(el('div', 'modal-icon', cfg.icon));
    if (cfg.titel) box.appendChild(el('h3', 'modal-titel', esc(cfg.titel)));
    if (cfg.html) box.appendChild(el('div', 'modal-inhalt', cfg.html));
    const reihe = el('div', 'modal-buttons');
    (cfg.buttons || [{ text: 'Weiter' }]).forEach((b, i) => {
      const btn = el('button', 'btn ' + (i === 0 ? 'btn-primary' : ''), esc(b.text));
      btn.addEventListener('click', () => {
        naechstesModal();
        if (b.cb) b.cb();
      });
      reihe.appendChild(btn);
    });
    box.appendChild(reihe);
    $('#modal-hintergrund').classList.remove('versteckt');
    reihe.querySelector('button').focus();
  }

  function toast(html) {
    const t = el('div', 'toast', html);
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('sichtbar'), 30);
    setTimeout(() => { t.classList.remove('sichtbar'); setTimeout(() => t.remove(), 400); }, 3600);
  }

  function effekteHtml(zeilen) {
    return '<ul class="effekt-liste">' +
      zeilen.map(z => `<li><span>${z.icon}</span> ${esc(z.text)}</li>`).join('') + '</ul>';
  }

  function fotoBanner(fotoId) {
    const f = DATA.FOTOS[fotoId];
    return `<div class="foto-banner">📸 <strong>Neues Fotomotiv!</strong><br>` +
           `<span class="foto-name">${f.icon} ${esc(f.name)}</span></div>`;
  }

  // ------------------------------------------------------------------- Start
  function renderStart() {
    const m = Game.meta;
    const lvl = Game.level;
    const naechste = lvl < DATA.LEVELS.length ? DATA.LEVELS[lvl].xp : null;
    const fotoZahl = Object.keys(DATA.FOTOS).length;
    $('#start-profil').innerHTML = `
      <div class="profil-level">Level ${lvl} · <strong>${esc(Game.levelTitel)}</strong></div>
      <div class="xp-balken"><div class="xp-fuellung" style="width:${naechste ? Math.min(100, Math.round(((m.xp - DATA.LEVELS[lvl - 1].xp) / (naechste - DATA.LEVELS[lvl - 1].xp)) * 100)) : 100}%"></div></div>
      <div class="profil-details">${m.xp} XP${naechste ? ' · nächstes Level bei ' + naechste : ' · Maximum erreicht!'}
        <br>📸 ${m.fotos.length}/${fotoZahl} Motive · 🏅 ${m.erfolge.length}/${DATA.ERFOLGE.length} Erfolge · ✈️ ${m.urlaubeGesamt} Urlaube</div>`;
    $('#btn-fortsetzen').classList.toggle('versteckt', !Game.run);
  }

  // ------------------------------------------------------------------- Setup
  const cfg = { dauer: 7, region: 'sued', hotel: 'komfort', transport: 'mietwagen', items: [] };

  function optionsGruppe(titel, hinweis, optionen, aktiv, onWahl) {
    const wrap = el('div', 'setup-gruppe');
    wrap.appendChild(el('h3', '', titel));
    if (hinweis) wrap.appendChild(el('p', 'setup-hinweis', hinweis));
    const reihe = el('div', 'options-reihe');
    for (const o of optionen) {
      const karte = el('button', 'option-karte' + (o.id === aktiv ? ' gewaehlt' : ''),
        `<span class="option-icon">${o.icon}</span><span class="option-name">${esc(o.name)}</span>` +
        (o.detail ? `<span class="option-detail">${esc(o.detail)}</span>` : '') +
        (o.desc ? `<span class="option-desc">${esc(o.desc)}</span>` : ''));
      karte.addEventListener('click', () => { onWahl(o.id); renderSetup(); });
      reihe.appendChild(karte);
    }
    wrap.appendChild(reihe);
    return wrap;
  }

  function renderSetup() {
    const inhalt = $('#setup-inhalt');
    inhalt.innerHTML = '';

    inhalt.appendChild(optionsGruppe('📅 Wie lange bleibst du?', null, [
      { id: 7, icon: '7️⃣', name: '1 Woche', desc: 'Der Klassiker' },
      { id: 10, icon: '🔟', name: '10 Tage', desc: 'Zeit für den Norden' },
      { id: 14, icon: '🗓️', name: '2 Wochen', desc: 'Die ganze Insel' },
    ], cfg.dauer, id => { cfg.dauer = id; }));

    inhalt.appendChild(optionsGruppe('📍 Wo wohnst du?',
      'Der Süden ist sonnensicher, der Norden authentischer – und näher an Teide, Anaga & La Laguna.',
      Object.entries(DATA.REGIONEN).map(([id, r]) =>
        ({ id, icon: r.icon, name: r.name, desc: r.desc })),
      cfg.region, id => { cfg.region = id; }));

    inhalt.appendChild(optionsGruppe('🏨 Wie residierst du?',
      'Dein Reisestil bestimmt das Gesamtbudget – und wie gut du dich nachts erholst.',
      Object.entries(DATA.HOTELS).map(([id, h]) =>
        ({ id, icon: id === 'spar' ? '🛏️' : id === 'komfort' ? '🏨' : '🏰',
           name: `${h.name} ${h.sterne}`, detail: `Budget: ${h.budgetProTag} €/Tag`, desc: h.desc })),
      cfg.hotel, id => { cfg.hotel = id; }));

    inhalt.appendChild(optionsGruppe('🚗 Wie kommst du herum?', null,
      Object.entries(DATA.TRANSPORT).map(([id, t]) =>
        ({ id, icon: t.icon, name: t.name,
           detail: t.kostenProTag ? t.kostenProTag + ' €/Tag' : 'ab 1,50 € pro Fahrt', desc: t.desc })),
      cfg.transport, id => { cfg.transport = id; }));

    // Gepäck (Mehrfachauswahl)
    const gepaeck = el('div', 'setup-gruppe');
    gepaeck.appendChild(el('h3', '', '🧳 Was packst du ein?'));
    gepaeck.appendChild(el('p', 'setup-hinweis', 'Gute Ausrüstung kostet Budget, zahlt sich unterwegs aber aus.'));
    const reihe = el('div', 'options-reihe');
    for (const [id, it] of Object.entries(DATA.ITEMS)) {
      const karte = el('button', 'option-karte' + (cfg.items.includes(id) ? ' gewaehlt' : ''),
        `<span class="option-icon">${it.icon}</span><span class="option-name">${esc(it.name)}</span>` +
        `<span class="option-detail">${it.preis} €</span><span class="option-desc">${esc(it.desc)}</span>`);
      karte.addEventListener('click', () => {
        const i = cfg.items.indexOf(id);
        if (i >= 0) cfg.items.splice(i, 1); else cfg.items.push(id);
        renderSetup();
      });
      reihe.appendChild(karte);
    }
    gepaeck.appendChild(reihe);
    inhalt.appendChild(gepaeck);

    // Budgetvorschau
    const hotel = DATA.HOTELS[cfg.hotel];
    let budget = hotel.budgetProTag * cfg.dauer;
    const posten = [`Reisekasse: ${budget} €`];
    if (cfg.transport === 'mietwagen') {
      const mw = DATA.TRANSPORT.mietwagen.kostenProTag * cfg.dauer;
      budget -= mw; posten.push(`Mietwagen: −${mw} €`);
    }
    for (const id of cfg.items) { budget -= DATA.ITEMS[id].preis; posten.push(`${DATA.ITEMS[id].name}: −${DATA.ITEMS[id].preis} €`); }
    $('#setup-budget').innerHTML =
      `<div class="budget-posten">${posten.map(esc).join(' · ')}</div>` +
      `<div class="budget-summe">💶 Startbudget: <strong>${Math.max(0, budget)} €</strong></div>`;
  }

  // ----------------------------------------------------------------- Spieltag
  function renderSpiel() {
    const run = Game.run;
    if (!run) return;
    const D = DATA;

    // Kopfzeile
    const slotName = D.SLOT_NAMEN[run.slot];
    const hotel = D.HOTELS[run.hotel];
    $('#spiel-kopf').innerHTML = `
      <div class="kopf-links">
        <div class="kopf-tag">☀️ Tag ${run.tag} von ${run.dauer} · <strong>${slotName}</strong></div>
        <div class="kopf-ort">${D.REGIONEN[run.region].icon} ${esc(hotel.name)} ${hotel.sterne}, ${esc(D.REGIONEN[run.region].name)}</div>
      </div>
      <div class="kopf-budget">💶 ${run.budget} €</div>`;

    // Wetterleiste
    const wetterHtml = ['sued', 'nord', 'teide'].map(region => {
      const w = D.WETTER[run.wetter[region][run.tag]];
      const name = region === 'sued' ? 'Süden' : region === 'nord' ? 'Norden' : 'Teide';
      return `<div class="wetter-chip" title="${esc(w.name)}">${w.icon} <span>${name}</span></div>`;
    }).join('');
    const calima = run.wetter.sued[run.tag] === 'calima';
    $('#wetter-leiste').innerHTML =
      `<span class="wetter-label">Wetter heute:</span>${wetterHtml}` +
      (calima ? '<div class="calima-warnung">🌫️ Calima! Heißer Saharastaub liegt über der Insel – anstrengende Ausflüge lohnen heute kaum.</div>' : '');

    $('#aktivitaeten-titel').textContent =
      run.tag === run.dauer ? '🧳 Letzter Vormittag – was machst du vor dem Abflug?'
        : `Was unternimmst du am ${slotName}?`;

    renderStats();
    renderQuests();
    renderInventar();
    renderLog();
    renderAktivitaeten();
  }

  function balken(label, icon, wert, klasse) {
    return `<div class="stat">
      <div class="stat-zeile"><span>${icon} ${label}</span><span>${wert}</span></div>
      <div class="stat-balken"><div class="stat-fuellung ${klasse}" style="width:${wert}%"></div></div>
    </div>`;
  }

  function renderStats() {
    const run = Game.run;
    let html = '<h4>Dein Zustand</h4>';
    html += balken('Energie', '🔋', run.energie, run.energie < 25 ? 'rot' : 'gruen');
    html += balken('Stimmung', '😊', run.stimmung, run.stimmung < 30 ? 'rot' : 'gelb');
    html += balken('Erholung', '🧘', run.erholung, 'blau');
    if (run.sonnenbrand > 0)
      html += balken('Sonnenbrand', '🥵', run.sonnenbrand, 'orange');
    html += `<div class="stat-zeile klein"><span>⭐ Erlebnispunkte</span><span>${run.erlebnis}</span></div>`;
    if (run.souvenirs > 0)
      html += `<div class="stat-zeile klein"><span>🎁 Souvenirs</span><span>${run.souvenirs}</span></div>`;
    $('#stats-panel').innerHTML = html;
  }

  function renderQuests() {
    const run = Game.run;
    const rec = {
      erholung: run.erholung, budget: run.budget, fotosRun: run.fotosRun,
      zonenBesucht: run.zonenBesucht, restaurantAbende: run.restaurantAbende,
      wanderungen: run.wanderungen, kulturAusfluege: run.kulturAusfluege,
      strandTage: run.strandTage,
    };
    let html = '<h4>🎯 Deine Urlaubsziele <span class="hint">(+40 Punkte je Ziel)</span></h4>';
    for (const qid of run.quests) {
      const q = DATA.QUESTS.find(x => x.id === qid);
      let geschafft = false;
      try { geschafft = !!q.check(rec); } catch (e) { geschafft = false; }
      html += `<div class="quest ${geschafft ? 'geschafft' : ''}">
        <span class="quest-icon">${geschafft ? '✅' : q.icon}</span>
        <span><strong>${esc(q.name)}</strong><br><small>${esc(q.desc)}</small></span></div>`;
    }
    $('#quest-panel').innerHTML = html;
  }

  function renderInventar() {
    const run = Game.run;
    const panel = $('#inventar-panel');
    if (!run.items.length) { panel.innerHTML = '<h4>🧳 Gepäck</h4><p class="hint">Leichtes Gepäck – nur das Nötigste.</p>'; return; }
    panel.innerHTML = '<h4>🧳 Gepäck</h4><div class="inventar-reihe">' +
      run.items.map(id => `<span class="inventar-item" title="${esc(DATA.ITEMS[id].name)}">${DATA.ITEMS[id].icon}</span>`).join('') +
      '</div>';
  }

  function renderLog() {
    const run = Game.run;
    const eintraege = run.log.slice(-6).reverse();
    $('#log-panel').innerHTML = '<h4>📔 Reisetagebuch</h4>' +
      eintraege.map(e => `<div class="log-eintrag"><span>${e.icon}</span> <small>Tag ${e.tag}:</small> ${esc(e.text)}</div>`).join('');
  }

  function renderAktivitaeten() {
    const raster = $('#aktivitaeten-raster');
    raster.innerHTML = '';
    const liste = Game.aktivitaetenListe();

    // Sortierung: verfügbare zuerst, Hotel-Aktivitäten ans Ende ihrer Gruppe
    liste.sort((a, b) => (a.gesperrt ? 1 : 0) - (b.gesperrt ? 1 : 0) ||
                         DATA.hops(Game.run.region, a.act.zone === 'hotel' ? Game.run.region : a.act.zone) -
                         DATA.hops(Game.run.region, b.act.zone === 'hotel' ? Game.run.region : b.act.zone));

    for (const e of liste) {
      const { act } = e;
      const w = DATA.WETTER[e.wetterId];
      const zone = DATA.ZONEN[act.zone];
      const karte = el('button', 'akt-karte' + (e.gesperrt ? ' gesperrt' : ''));
      const energie = act.energieMitSchuhen !== undefined && Game.run.items.includes('wanderschuhe')
        ? act.energieMitSchuhen : act.energie;

      const chips = [];
      chips.push(`<span class="chip">${e.gesamtKosten > 0 ? e.gesamtKosten + ' €' : 'gratis'}</span>`);
      chips.push(`<span class="chip">🔋 ${energie - e.reiseEnergie > 0 ? '+' : ''}${energie - e.reiseEnergie}</span>`);
      if (act.dauer === 2) chips.push('<span class="chip chip-tag">🕐 Ganztag</span>');
      if (e.hops > 0) chips.push(`<span class="chip">${DATA.TRANSPORT[Game.run.transport].icon} ${e.hops > 1 ? 'lange ' : ''}Anfahrt</span>`);
      if (act.erholung >= 10) chips.push('<span class="chip chip-gruen">🧘 erholsam</span>');
      if (act.erlebnis >= 20) chips.push('<span class="chip chip-blau">⭐ Highlight</span>');
      if (act.foto && !Game.run.fotosRun.includes(act.foto)) chips.push('<span class="chip chip-foto">📸 Fotomotiv</span>');
      if (e.erschoepft && !e.gesperrt) chips.push('<span class="chip chip-warn">🥵 zu erschöpft?</span>');

      karte.innerHTML = `
        <div class="akt-kopf"><span class="akt-icon">${act.icon}</span>
          <div><div class="akt-name">${esc(act.name)}</div>
          <div class="akt-ort">${zone.icon} ${esc(zone.name)} · ${w.icon} ${esc(w.name)}</div></div>
        </div>
        <p class="akt-desc">${esc(act.desc)}</p>
        <div class="akt-chips">${chips.join('')}</div>
        ${e.gesperrt ? `<div class="akt-sperre">🚫 ${esc(e.gesperrt)}</div>` : ''}`;

      if (!e.gesperrt) karte.addEventListener('click', () => aktivitaetWaehlen(act.id));
      else karte.disabled = true;
      raster.appendChild(karte);
    }
  }

  // ------------------------------------------------------------ Aktivitätsfluss
  function aktivitaetWaehlen(id) {
    const res = Game.aktivitaetAusfuehren(id);
    if (!res) return;

    let html = effekteHtml(res.effekte);
    if (res.fotoNeu) html += fotoBanner(res.fotoNeu);
    if (res.warnung) html += `<div class="warn-banner">🥵 ${esc(res.warnung)}</div>`;

    zeigeModal({
      icon: res.act.icon, titel: res.act.name, html,
      buttons: [{ text: 'Weiter', cb: () => {
        if (res.ereignis) zeigeEreignis(res.ereignis);
        else weiter();
      } }],
    });
  }

  function zeigeEreignis(ereignis) {
    const buttons = ereignis.wahl
      ? ereignis.wahl.map((text, i) => ({ text, cb: () => ereignisAufloesen(i) }))
      : [{ text: 'Weiter', cb: () => ereignisAufloesen(0) }];
    zeigeModal({ icon: ereignis.icon, titel: 'Ein Moment am Wegesrand', html: `<p>${esc(ereignis.text)}</p>`, buttons, klasse: 'modal-ereignis' });
  }

  function ereignisAufloesen(wahlIndex) {
    const res = Game.ereignisEntscheiden(wahlIndex);
    if (!res) { weiter(); return; }
    let html = '';
    if (res.antwort) html += `<p>${esc(res.antwort)}</p>`;
    if (res.zeilen.length) html += effekteHtml(res.zeilen);
    if (res.fotoNeu) html += fotoBanner(res.fotoNeu);
    if (res.guachincheNeu) html += '<div class="foto-banner">🍷 <strong>Geheimtipp freigeschaltet:</strong> Guachinche-Abend (abends im Norden)</div>';
    if (!html) { weiter(); return; }
    zeigeModal({ icon: '✨', titel: 'Und dann …', html, buttons: [{ text: 'Weiter', cb: weiter }] });
  }

  function weiter() {
    const r = Game.fortfahren();
    if (r.typ === 'slot') { renderSpiel(); return; }
    if (r.typ === 'tagesende') { zeigeTagesende(r); return; }
    if (r.typ === 'urlaubsende') { renderEnde(r); return; }
    renderSpiel();
  }

  function zeigeTagesende(r) {
    const namen = { sued: 'Süden', nord: 'Norden', teide: 'Teide' };
    const prognose = Object.entries(r.wetterMorgen).map(([region, wid]) =>
      `<div class="wetter-chip">${DATA.WETTER[wid].icon} <span>${namen[region]}</span></div>`).join('');
    let html = effekteHtml(r.zeilen);
    html += `<div class="prognose"><strong>🌤️ Wetterbericht für Tag ${r.neuerTag}:</strong><div class="prognose-reihe">${prognose}</div>`;
    if (r.calima) html += '<p class="warn-text">🌫️ Achtung: Calima zieht auf!</p>';
    if (r.letzterTag) html += '<p class="warn-text">🧳 Morgen ist Abreisetag – nur noch der Vormittag bleibt!</p>';
    html += '</div>';
    zeigeModal({
      icon: '🌙', titel: `Gute Nacht – Tag ${r.neuerTag - 1} ist vorbei`, html,
      buttons: [{ text: `Auf zu Tag ${r.neuerTag}! ☀️`, cb: () => renderSpiel() }],
    });
  }

  // ------------------------------------------------------------- Urlaubsende
  function renderEnde(r) {
    zeigeScreen('ende');
    const teileHtml = r.teile.map(t =>
      `<tr><td>${t.icon} ${esc(t.name)}</td><td class="detail">${esc(t.detail)}</td><td class="punkte">${t.punkte}</td></tr>`).join('');

    const questsHtml = r.quests.map(q =>
      `<div class="quest ${q.geschafft ? 'geschafft' : 'verpasst'}">
        <span class="quest-icon">${q.geschafft ? '✅' : '❌'}</span>
        <span><strong>${esc(q.name)}</strong> – ${esc(q.desc)}</span></div>`).join('');

    const fotosHtml = r.fotosRun.length
      ? r.fotosRun.map(id => {
          const f = DATA.FOTOS[id];
          const neu = r.fotosNeuGesamt.includes(id);
          return `<div class="album-foto klein ${neu ? 'neu' : ''}"><span class="album-icon">${f.icon}</span>
                  <span class="album-name">${esc(f.name)}</span>${neu ? '<span class="neu-badge">NEU</span>' : ''}</div>`;
        }).join('')
      : '<p class="hint">Diesmal keine Fotos – die Insel hat noch so viele Motive für dich!</p>';

    const erfolgeHtml = r.erfolgeNeu.length
      ? '<h3>🏅 Neue Erfolge</h3>' + r.erfolgeNeu.map(e =>
          `<div class="erfolg-zeile">${e.icon} <strong>${esc(e.name)}</strong> – ${esc(e.desc)}</div>`).join('')
      : '';

    const levelHtml = r.lvlNachher > r.lvlVorher
      ? `<div class="levelup">🎉 <strong>Level ${r.lvlNachher}:</strong> ${esc(r.levelTitel)}!` +
        r.unlocks.map(u => `<br>🔓 ${esc(u)}`).join('') + '</div>'
      : `<div class="xp-info">+${r.xpGewinn} XP (gesamt ${r.xpGesamt}${r.naechstesLevelXp ? ' · Level ' + (r.lvlNachher + 1) + ' bei ' + r.naechstesLevelXp : ''})</div>`;

    $('#ende-inhalt').innerHTML = `
      <div class="ende-kopf">
        <div class="ende-icon">${r.bewertung.icon}</div>
        <h2>${esc(r.bewertung.titel)}</h2>
        <p>${esc(r.bewertung.text)}</p>
        <div class="ende-score">${r.score} <span>Urlaubspunkte</span></div>
        ${r.platz > 0 && r.platz <= 3 ? `<div class="platz-badge">🏆 Platz ${r.platz} deiner Bestenliste!</div>` : ''}
      </div>
      <div class="panel"><h3>📊 Abrechnung</h3><table class="score-tabelle">${teileHtml}
        <tr class="summe"><td>Gesamt</td><td></td><td class="punkte">${r.score}</td></tr></table></div>
      <div class="panel"><h3>🎯 Urlaubsziele</h3>${questsHtml}</div>
      <div class="panel"><h3>📸 Fotos dieser Reise</h3><div class="album-raster klein">${fotosHtml}</div></div>
      ${erfolgeHtml ? '<div class="panel">' + erfolgeHtml + '</div>' : ''}
      <div class="panel ende-fortschritt">${levelHtml}</div>
      <div class="ende-buttons">
        <button class="btn btn-primary btn-gross" id="btn-nochmal">✈️ Nächsten Urlaub buchen</button>
        <button class="btn" id="btn-ende-album">📸 Fotoalbum</button>
        <button class="btn" id="btn-ende-menue">🏠 Hauptmenü</button>
      </div>`;

    $('#btn-nochmal').addEventListener('click', () => { renderSetup(); zeigeScreen('setup'); });
    $('#btn-ende-album').addEventListener('click', () => { renderAlbum(); zeigeScreen('album'); });
    $('#btn-ende-menue').addEventListener('click', () => { renderStart(); zeigeScreen('start'); });
  }

  // ------------------------------------------------------------------- Album
  function renderAlbum() {
    const m = Game.meta;
    let html = `<div class="panel"><h3>📸 Fotomotive (${m.fotos.length}/${Object.keys(DATA.FOTOS).length})</h3>
      <p class="hint">Deine Sammlung wächst über alle Urlaube hinweg. Findest du alle Motive?</p>
      <div class="album-raster">`;
    for (const [id, f] of Object.entries(DATA.FOTOS)) {
      const hat = m.fotos.includes(id);
      html += `<div class="album-foto ${hat ? '' : 'gesperrt'}">
        <span class="album-icon">${hat ? f.icon : '❔'}</span>
        <span class="album-name">${hat ? esc(f.name) : '???'}</span>
        <span class="album-hinweis">${esc(f.hinweis)}</span></div>`;
    }
    html += '</div></div>';

    html += `<div class="panel"><h3>🏅 Erfolge (${m.erfolge.length}/${DATA.ERFOLGE.length})</h3><div class="erfolge-raster">`;
    for (const e of DATA.ERFOLGE) {
      const hat = m.erfolge.includes(e.id);
      html += `<div class="erfolg-karte ${hat ? '' : 'gesperrt'}">
        <span class="erfolg-icon">${hat ? e.icon : '🔒'}</span>
        <div><strong>${esc(e.name)}</strong><br><small>${esc(e.desc)}</small></div></div>`;
    }
    html += '</div></div>';
    $('#album-inhalt').innerHTML = html;
  }

  // -------------------------------------------------------------- Bestenliste
  function renderBesten() {
    const liste = Game.meta.bestenliste;
    if (!liste.length) {
      $('#besten-inhalt').innerHTML = '<div class="panel"><p class="hint">Noch keine abgeschlossenen Urlaube. Zeit für den ersten Abflug! ✈️</p></div>';
      return;
    }
    const zeilen = liste.map((b, i) => `<tr>
      <td>${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.'}</td>
      <td class="punkte">${b.score}</td>
      <td>${b.dauer} Tage · ${b.region === 'sued' ? 'Süden' : 'Norden'}</td>
      <td>📸 ${b.fotos}</td><td class="detail">${esc(b.datum)}</td></tr>`).join('');
    $('#besten-inhalt').innerHTML = `<div class="panel"><table class="besten-tabelle">
      <tr><th></th><th>Punkte</th><th>Reise</th><th>Fotos</th><th>Datum</th></tr>${zeilen}</table></div>`;
  }

  // ------------------------------------------------------- Urlaub fortsetzen
  function fortsetzen() {
    renderSpiel();
    zeigeScreen('spiel');
    const run = Game.run;
    if (!run || !run.pending) return;
    // Der Spielstand wurde mitten in einer Auflösung gespeichert – sauber weiterspielen
    if (run.pending.typ === 'ereignis') {
      const e = DATA.EREIGNISSE.find(x => x.id === run.pending.id);
      if (e) { zeigeEreignis({ id: e.id, icon: e.icon, text: e.text, wahl: e.wahl ? e.wahl.map(w => w.text) : null }); return; }
      run.pending.typ = 'weiter';
    }
    weiter();
  }

  // ------------------------------------------------------------------- Init
  function init() {
    renderStart();

    $('#btn-neu').addEventListener('click', () => {
      if (Game.run) {
        zeigeModal({
          icon: '⚠️', titel: 'Laufenden Urlaub verwerfen?',
          html: '<p>Du hast noch einen angefangenen Urlaub. Ein neuer Urlaub verwirft den alten Spielstand.</p>',
          buttons: [
            { text: 'Alten Urlaub fortsetzen', cb: fortsetzen },
            { text: 'Neu buchen', cb: () => { Game.urlaubAbbrechen(); renderSetup(); zeigeScreen('setup'); } },
          ],
        });
        return;
      }
      renderSetup(); zeigeScreen('setup');
    });
    $('#btn-fortsetzen').addEventListener('click', fortsetzen);
    $('#btn-album').addEventListener('click', () => { renderAlbum(); zeigeScreen('album'); });
    $('#btn-besten').addEventListener('click', () => { renderBesten(); zeigeScreen('besten'); });
    $('#btn-hilfe').addEventListener('click', () => zeigeScreen('hilfe'));

    document.querySelectorAll('.btn-zurueck').forEach(b =>
      b.addEventListener('click', () => { renderStart(); zeigeScreen(b.dataset.ziel); }));

    $('#btn-abflug').addEventListener('click', () => {
      Game.neuerUrlaub(cfg);
      renderSpiel();
      zeigeScreen('spiel');
      toast(`✈️ Willkommen auf Teneriffa! ${cfg.dauer} Tage ${DATA.REGIONEN[cfg.region].name} warten auf dich.`);
    });

    $('#btn-abbrechen').addEventListener('click', () => {
      zeigeModal({
        icon: '🛫', titel: 'Urlaub wirklich abbrechen?',
        html: '<p>Der Urlaub wird ohne Wertung beendet – Fortschritt dieses Durchgangs geht verloren.</p>',
        buttons: [
          { text: 'Weiter urlauben', cb: () => {} },
          { text: 'Abbrechen & zum Menü', cb: () => { Game.urlaubAbbrechen(); renderStart(); zeigeScreen('start'); } },
        ],
      });
    });

  }

  return { init, renderSpiel, zeigeScreen };
})();
