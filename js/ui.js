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

  // ------------------------------------------------ Welt-Highscore (online)
  // Gemeinsame Online-Bestenliste (kvdb.io). Sobald hier eine Bucket-URL
  // steht, melden alle Spieler ihre Urlaube automatisch dorthin.
  const HISCORE_FEST = 'https://kvdb.io/9vp5YEqVV7F3U4VCxSS7Wr/';   // gemeinsame Welt-Bestenliste
  const HISCORE_MUSTER = /^https:\/\/kvdb\.io\/[A-Za-z0-9]{6,}\/$/;
  function hiscoreUrl() {
    if (HISCORE_FEST) return HISCORE_FEST;
    const lokal = localStorage.getItem('tus_hiscore_url') || '';
    if (lokal && !HISCORE_MUSTER.test(lokal)) {
      localStorage.removeItem('tus_hiscore_url');   // kaputte Einrichtung aufräumen
      return '';
    }
    return lokal;
  }
  function hiscoreSenden(score) {
    if (!hiscoreUrl() || !score) return;
    const name = (localStorage.getItem('tus_name_v1') || 'Gast').slice(0, 14) || 'Gast';
    fetch(hiscoreUrl() + 's' + Date.now() + Math.floor(Math.random() * 1000), {
      method: 'PUT',
      body: name + '|' + score + '|' + new Date().toLocaleDateString('de-DE'),
    }).catch(() => { /* offline? macht nichts */ });
  }
  function hiscoreLaden() {
    if (!hiscoreUrl()) return Promise.resolve(null);
    return fetch(hiscoreUrl() + '?values=true&limit=500&format=json')
      .then(r => r.json())
      .then(liste => liste
        .map(([, v]) => {
          const t = String(v).split('|');
          return { name: t[0] || 'Gast', score: +t[1] || 0, datum: t[2] || '' };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 15))
      .catch(() => null);
  }

  // ------------------------------------------------------- Urlaubs-Story
  // Jeder Urlaub erzählt sich wie ein kleines Buch – Tag für Tag ein Kapitel.
  const KAPITEL = ['Salz auf der Haut', 'Der Duft von Sonnencreme', 'Straße der Serpentinen',
    'Unter dem Vulkan', 'Wo der Passat wohnt', 'Barraquito um vier', 'Die Insel ruft',
    'Zwischen Palmen und Wolkenmeer', 'Golden geht die Sonne', 'Ein Tag wie eine Postkarte'];
  function kapitelTitel(tag, dauer) {
    if (tag <= 1) return 'Ankommen im Paradies';
    if (tag >= dauer) return 'Der letzte Tanz';
    return KAPITEL[(tag * 3 + dauer) % KAPITEL.length];
  }

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

  // Quelle & Lizenz im Spiel anzeigen – nichts wirft dich mehr aus dem Spiel
  function zeigeQuelle(url) {
    if (!url) return;
    zeigeModal({
      icon: '📷', titel: 'Quelle & Lizenz',
      html: '<p>Dieses Foto/Video stammt von Wikipedia/Wikimedia Commons. ' +
        'Auf der Quellseite findest du Autor- und Lizenzangaben.</p>' +
        `<p class="hint">${esc(url)}</p>`,
      buttons: [
        { text: '↩ Zurück ins Spiel', cb: () => {} },
        { text: '🌐 Quellseite in neuem Tab', cb: () => {
          const a = el('a');
          a.href = url; a.target = '_blank'; a.rel = 'noopener';
          document.body.appendChild(a); a.click(); a.remove();
        } },
      ],
    });
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

  // Passendes Bildmotiv für eine Aktivität finden
  function motivFuerAct(act) {
    if (BILDER.ARTIKEL[act.id]) return act.id;
    if (act.foto && BILDER.ARTIKEL[act.foto]) return act.foto;
    return null;
  }

  // ------------------------------------------------------------- Inselkarte
  // Detaillierte Teneriffa-Karte: Autobahnen TF-1/TF-5, Städte und die Route
  // vom Hotelort zur echten geographischen Position des Ausflugsziels.
  const KARTE_ORTE = {
    hotelSued: [92, 196], hotelNord: [151, 63],
  };

  const KARTE_STAEDTE = [
    ['Costa Adeje', 92, 196], ['El Médano', 141, 200], ['Los Gigantes', 52, 132],
    ['Garachico', 78, 84], ['Icod', 93, 82], ['Puerto de la Cruz', 151, 63],
    ['La Laguna', 232, 73], ['Santa Cruz', 252, 90], ['Candelaria', 233, 116],
    ['Vilaflor', 133, 168], ['Masca', 46, 112],
  ];

  // TF-1 (Süd-/Ost-Autobahn), TF-5 (Nord) und die Westumfahrung als Polylinien
  const KARTE_STRASSEN = [
    [[92, 196], [104, 203], [141, 200], [180, 178], [222, 131], [233, 116], [252, 90]],
    [[252, 90], [232, 73], [205, 66], [178, 62], [151, 63], [120, 72], [93, 82], [78, 84]],
    [[78, 84], [60, 100], [58, 125], [52, 132], [62, 158], [75, 176], [92, 196]],
    [[133, 168], [138, 148], [140, 128]],
    [[153, 74], [147, 100], [140, 128]],
  ];

  // Aktivität → echte Position auf der Karte (Zonen-Punkt als Rückfall)
  const AKT_ORTE = {
    'playa-americas': [100, 201], 'siampark': [97, 197], 'whalewatching': [103, 206],
    'surfkurs': [141, 201], 'lacaleta': [87, 192], 'promenade': [102, 203],
    'cocktailbar': [99, 199], 'abades': [170, 182], 'paragliding': [95, 184],
    'duque': [86, 193], 'siammall': [96, 196], 'bauwerke': [246, 86],
    'barranco': [94, 187], 'tejita': [146, 199], 'karting': [122, 195],
    'masca': [46, 112], 'losgigantes': [52, 132], 'garachico': [78, 84],
    'icod': [93, 82], 'teno': [26, 100], 'cueva': [90, 88], 'chinyero': [98, 112],
    'teide': [140, 127], 'roques': [136, 134], 'sterne': [144, 130], 'paisaje': [134, 162],
    'puerto': [151, 63], 'loroparque': [146, 61], 'botanico': [155, 66],
    'guachinche': [162, 70], 'brunellis': [147, 59], 'orotava': [153, 74], 'bodega': [204, 64],
    'teresitas': [263, 80], 'anaga': [272, 58], 'lalaguna': [232, 73],
    'santacruz': [252, 90], 'candelaria': [233, 116], 'benijo': [278, 50],
    'guimar': [222, 131], 'palmetum': [250, 94], 'sanandres': [261, 83], 'auditorio': [249, 92],
  };

  const ZONEN_PUNKTE = {
    sued: [110, 195], west: [55, 120], teide: [140, 127], nord: [155, 65], anaga: [255, 80],
  };

  // Zwischenpunkte entlang der echten Straßen je (Startregion → Zielzone)
  const KARTE_VIAS = {
    sued: {
      sued: [], west: [[75, 176], [62, 158], [52, 132]],
      teide: [[112, 187], [133, 168], [138, 148]],
      nord: [[141, 200], [180, 178], [233, 116], [252, 90], [232, 73], [205, 66], [178, 62]],
      anaga: [[141, 200], [180, 178], [233, 116]],
    },
    nord: {
      nord: [], west: [[120, 72], [93, 82]],
      teide: [[153, 74], [147, 100]],
      sued: [[178, 62], [205, 66], [232, 73], [252, 90], [233, 116], [180, 178], [141, 200]],
      anaga: [[178, 62], [205, 66], [232, 73]],
    },
  };

  function routePunkte(fahrt) {
    const start = fahrt.von === 'nord' ? KARTE_ORTE.hotelNord : KARTE_ORTE.hotelSued;
    const ziel = AKT_ORTE[fahrt.actId] || ZONEN_PUNKTE[fahrt.nach] || ZONEN_PUNKTE.sued;
    const vias = (KARTE_VIAS[fahrt.von] || KARTE_VIAS.sued)[fahrt.nach] || [];
    return [start, ...vias, ziel];
  }

  function inselSvg(fahrt) {
    const punkte = routePunkte(fahrt);
    const start = punkte[0], ziel = punkte[punkte.length - 1];
    const act = DATA.AKTIVITAETEN.find(a => a.id === fahrt.actId);

    const strassen = KARTE_STRASSEN.map(linie =>
      `<polyline class="karte-strasse" points="${linie.map(p => p.join(',')).join(' ')}"/>`).join('');
    const staedte = KARTE_STAEDTE.map(([name, x, y]) =>
      `<circle cx="${x}" cy="${y}" r="2.4" class="karte-stadt"/>` +
      `<text x="${x + (x > 240 ? -4 : 4)}" y="${y - 4}" class="karte-label"` +
      ` text-anchor="${x > 240 ? 'end' : 'start'}">${esc(name)}</text>`).join('');
    const routeD = 'M' + punkte.map(p => p.join(',')).join(' L');

    return `
      <svg viewBox="0 0 320 240" id="karte-svg" role="img" aria-label="Route über Teneriffa">
        <path class="karte-insel" d="M300,45 Q285,38 245,52 Q210,55 185,58 Q150,63 120,72
          Q60,84 28,98 Q22,110 38,128 Q50,152 60,170 Q80,198 110,215 Q135,214 170,190
          Q205,165 235,128 Q258,105 272,88 Q292,66 300,45 Z"/>
        ${strassen}
        <text x="140" y="132" class="karte-teide" text-anchor="middle">🌋</text>
        ${staedte}
        <path id="karte-route" class="karte-route" d="${routeD}"/>
        <text x="${start[0]}" y="${start[1] - 6}" class="karte-marker" text-anchor="middle">🏨</text>
        <text x="${ziel[0]}" y="${ziel[1] - 6}" class="karte-marker" text-anchor="middle">${act ? act.icon : '📍'}</text>
        <text id="karte-fahrzeug" class="karte-fahrzeug" x="${start[0]}" y="${start[1]}"
          text-anchor="middle">${fahrt.transport === 'bus' ? '🚌' : '🚗'}</text>
      </svg>`;
  }

  function animiereRoute(dauerMs) {
    const route = document.getElementById('karte-route');
    const fahrzeug = document.getElementById('karte-fahrzeug');
    if (!route || !fahrzeug) return;
    const laenge = route.getTotalLength();
    route.style.strokeDasharray = laenge;
    route.style.strokeDashoffset = laenge;
    const start = performance.now();
    (function tick(now) {
      if (!fahrzeug.isConnected) return;
      const t = Math.min(1, (now - start) / dauerMs);
      const p = route.getPointAtLength(laenge * t);
      route.style.strokeDashoffset = laenge * (1 - t);
      fahrzeug.setAttribute('x', p.x);
      fahrzeug.setAttribute('y', p.y + 3);
      if (t < 1) requestAnimationFrame(tick);
    })(start);
  }

  // -------------------------------------------------------------- Inselfahrt
  function zeigeFahrt(res, weiterCb) {
    const fahrt = res.fahrt;
    const overlay = $('#fahrt-overlay');
    overlay.classList.remove('versteckt');
    const zielAct = DATA.AKTIVITAETEN.find(a => a.id === fahrt.actId);
    const startOrt = fahrt.von === 'nord' ? 'Puerto de la Cruz' : 'Costa Adeje';
    $('#fahrt-titel').textContent =
      `${fahrt.transport === 'bus' ? '🚌' : '🚗'} ${startOrt} → ${zielAct ? zielAct.name.replace(/ \(.*\)$/, '') : DATA.ZONEN[fahrt.nach].name}`;
    $('#fahrt-inselkarte').innerHTML = inselSvg(fahrt);
    $('#fahrspiel-wrap').classList.add('versteckt');
    $('#fahrt-inselkarte').classList.remove('versteckt');

    const log = $('#fahrt-log');
    log.innerHTML = '';
    fahrt.zeilen.forEach((zeile, i) => {
      setTimeout(() => {
        if (!overlay.isConnected || overlay.classList.contains('versteckt')) return;
        log.appendChild(el('div', 'flug-zeile sichtbar',
          `<span class="flug-zeile-icon">${zeile.icon}</span><div>${esc(zeile.text)}` +
          (zeile.chips.length ? '<div class="flug-chips">' + zeile.chips.map(c => `<span class="chip">${esc(c)}</span>`).join('') + '</div>' : '') +
          '</div>'));
      }, 600 + i * 1500);
    });
    animiereRoute(4200);

    const buttons = $('#fahrt-buttons');
    buttons.innerHTML = '';
    const schliessen = () => { overlay.classList.add('versteckt'); weiterCb(); };

    if (fahrt.transport === 'mietwagen') {
      const selbst = el('button', 'btn btn-primary', '🎮 Selbst ans Steuer');
      selbst.addEventListener('click', () => starteFahrspiel(fahrt, schliessen));
      buttons.appendChild(selbst);
      const chill = el('button', 'btn', '⏩ Entspannt ankommen');
      chill.addEventListener('click', schliessen);
      buttons.appendChild(chill);
    } else {
      const weiter = el('button', 'btn btn-primary', 'Ankommen');
      weiter.addEventListener('click', schliessen);
      buttons.appendChild(weiter);
    }
  }

  // ------------------------------------------------- Selbstfahren (Minispiel)
  // Pseudo-3D-Fahrt im Stil klassischer Rennspiele: Horizont, Kurvenperspektive,
  // Teide in der Ferne, Palmen am Straßenrand, Gegenverkehr und Tacho.
  let audioCtx = null;
  function piep(freq, dauerMs, typ, lautstaerke) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = typ || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(lautstaerke || 0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dauerMs / 1000);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dauerMs / 1000);
    } catch (e) { /* kein Ton verfügbar – halb so wild */ }
  }

  // Echte Ortsfotos als Spielkulissen (Wikipedia) – geladen und gecacht;
  // ohne Netz greift überall der gezeichnete Look.
  const fotoCache = {};
  function fotoLaden(motiv) {
    if (fotoCache[motiv]) return fotoCache[motiv];
    if (fotoCache[motiv] === null) return null;
    fotoCache[motiv] = null;
    try {
      BILDER.hole(motiv).then(bild => {
        if (!bild) return;
        const img = new Image();
        img.onload = () => { fotoCache[motiv] = img; };
        img.src = bild.url;
      }).catch(() => {});
    } catch (e) { /* egal */ }
    return null;
  }
  function fotoStreifen(ctx, img, x, y, b, h) {
    const q = Math.max(b / img.width, h / img.height);
    const sw = b / q, sh = h / q;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, b, h);
  }

  // Haptik: kurzes Vibrieren auf dem Handy (wo der Browser es erlaubt)
  function brumm(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* egal */ }
  }

  function starteFahrspiel(fahrt, fertigCb) {
    $('#fahrt-inselkarte').classList.add('versteckt');
    $('#fahrspiel-wrap').classList.remove('versteckt');
    $('#fahrspiel-hilfe').innerHTML = 'Lenken: ← → · Gas: ↑ · Bremse: ↓ · Turbo: Leertaste oder 🔥 · Kamera: C oder 🗺️ · Pause: P oder ⏸<br>' +
      'Überhole für 🏎️ Fahrstil-Punkte, sammle ⭐ Sterne und weiche Ziegen & Gegenverkehr aus!';
    $('#fahrt-buttons').innerHTML = '';

    const canvas = $('#fahrspiel-canvas');
    const ctx = canvas.getContext('2d');
    const W = 420, H = 460;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = 'min(420px, 100%)';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Pause (Taste P / ⏸) – der Countdown der Fahrt läuft weiter unten selbst
    const uhr = minispielUhr(canvas, ctx, W, H, null,
      { ohneCountdown: true, pauseBox: { x: W - 44, y: 70, b: 38, h: 30 } });

    // ————— GTA-Stil: echte 3D-Welt mit Verfolgerkamera —————
    // Eigene Mini-3D-Engine: Punkte werden perspektivisch projiziert, die
    // Kamera hängt mit Verzögerung hinter dem Auto, das wirklich lenkt.
    const HORIZONT = 150;
    const F = 300;                  // Brennweite (Pixel)
    const KAM_H = 3.4;              // Kamerahöhe (m)
    const KAM_ABSTAND = 8.5;        // Kamera hinter dem Auto (m)
    const HALB = 6.4;               // halbe Fahrbahnbreite (m)
    const COUNTDOWN = 2000;

    const hops = (fahrt && fahrt.hops) || 1;
    const S_END = window.FAHRSPIEL_DAUER
      ? (window.FAHRSPIEL_DAUER / 1000) * 18
      : 330 + hops * 130;                          // Streckenlänge (m)
    const ZEITLIMIT = Math.max(6, S_END / 6);      // Sekunden bis Auto-Ankunft
    const GESAMT_KM = 16 + hops * 17;

    // Umgebung passend zur echten Route
    const zielZone = fahrt ? (fahrt.nach === 'hotel' ? Game.run.region : fahrt.nach) : 'sued';
    const THEMEN = {
      sued:  { boden: '#e0cfa2', deko: ['🌵', '🌴', '🌵', '🏵️', '🦎', '⛱️'], himmel: ['#4ea8de', '#bde6f5'] },
      west:  { boden: '#d5c08c', deko: ['🌵', '🌴', '🪨', '🐐', '🌾'], himmel: ['#4ea8de', '#bde6f5'] },
      teide: { boden: '#93775e', deko: ['🌲', '🪨', '🌲', '🌋', '🌾'], himmel: ['#3d7fb8', '#a9d2e8'] },
      nord:  { boden: '#a2bd77', deko: ['🌴', '🌳', '🍌', '🌺', '🍇'], himmel: ['#5aa5cf', '#c9e6f0'] },
      anaga: { boden: '#88ad68', deko: ['🌳', '🌿', '🌲', '🍃', '🐦'], himmel: ['#5aa5cf', '#c9e6f0'] },
    };
    const thema = THEMEN[zielZone] || THEMEN.sued;
    const abdunkeln = (hex, f) => '#' + [1, 3, 5].map(i =>
      Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('');
    const bodenDunkel = abdunkeln(thema.boden, 0.9);
    const wagen = (Game.run && DATA.AUTOS[Game.run.auto]) || DATA.AUTOS.kompakt;
    const panoMotiv = { sued: 'playa-americas', west: 'losgigantes', teide: 'teide',
      nord: 'puerto', anaga: 'anaga' }[zielZone] || 'teide';
    fotoLaden(panoMotiv);
    let wetterId = 'sonnig';
    try { wetterId = Game.wetterFuerZone(zielZone, Game.run.tag); } catch (e) { /* egal */ }
    const regnet = wetterId === 'regen';
    const truebe = ['bedeckt', 'wolkig', 'windig'].includes(wetterId);
    const calima = wetterId === 'calima';
    const himmelFarben = regnet ? ['#5d6b7a', '#9aa7b2']
      : truebe ? ['#7d95a8', '#c2cfd8']
      : calima ? ['#c9a86a', '#e8d5a8'] : thema.himmel;

    // Straße als geschwungener 3D-Pfad (Stützpunkte alle 3 m)
    const SCHRITT = 3;
    const samples = [];
    {
      let x = 0, z = 0, richtung = 0;
      for (let s = 0; s <= S_END + 80; s += SCHRITT) {
        samples.push({ x, z, richtung });
        richtung += (Math.sin(s * 0.012) + 0.7 * Math.sin(s * 0.0045 + 1.7)) * 0.028;
        x += Math.sin(richtung) * SCHRITT;
        z += Math.cos(richtung) * SCHRITT;
      }
    }
    const samplesBei = s => samples[Math.max(0, Math.min(samples.length - 1, Math.round(s / SCHRITT)))];
    const rechtsVon = p => ({ x: Math.cos(p.richtung), z: -Math.sin(p.richtung) });

    // Randbewuchs, Warnschilder, Hindernisse, Ortsschild & Zielflagge
    const objekte = [];
    for (let s = 15; s < S_END + 40; s += 24 + Math.random() * 20) {
      const p = samplesBei(s), r = rechtsVon(p);
      const seite = Math.random() < 0.5 ? -1 : 1;
      const abstand = 9 + Math.random() * 14;
      objekte.push({ x: p.x + r.x * seite * abstand, z: p.z + r.z * seite * abstand,
        icon: thema.deko[Math.floor(Math.random() * thema.deko.length)], gr: 3.4 });
    }
    for (let i = 0; i < 40; i++) {
      const p = samplesBei(Math.random() * S_END), r = rechtsVon(p);
      const seite = Math.random() < 0.5 ? -1 : 1;
      objekte.push({ x: p.x + r.x * seite * (26 + Math.random() * 70),
        z: p.z + r.z * seite * (26 + Math.random() * 70),
        icon: thema.deko[Math.floor(Math.random() * thema.deko.length)], gr: 4.2 });
    }
    let letztesSchild = -999;
    for (let s = 40; s < S_END - 20; s += 15) {
      const dr = samplesBei(s + 30).richtung - samplesBei(s).richtung;
      if (Math.abs(dr) > 0.34 && s - letztesSchild > 70) {
        const p = samplesBei(s), r = rechtsVon(p);
        const seite = -Math.sign(dr);
        objekte.push({ x: p.x + r.x * seite * 9, z: p.z + r.z * seite * 9, icon: '⚠️', gr: 2.6 });
        letztesSchild = s;
      }
    }
    const hindernisse = [];
    for (let s = 55; s < S_END - 25; s += 42 + Math.random() * 30) {
      if (Math.random() < 0.6) {
        const p = samplesBei(s), r = rechtsVon(p);
        const q = (Math.random() * 2 - 1) * 4.2;
        hindernisse.push({ x: p.x + r.x * q, z: p.z + r.z * q,
          icon: ['🐐', '🕳️', '🚧'][Math.floor(Math.random() * 3)], gr: 2.4 });
      }
    }
    // Kanarische Häuser & Fincas am Straßenrand: Dörfer am Start und am Ziel,
    // dazwischen vereinzelte Höfe – weiße Wände, Terrakotta-Dächer.
    const haeuser = [];
    const WAENDE = ['#f4eee0', '#f6e7c6', '#eccfa4', '#f0e3d4'];
    const DAECHER = ['#b35a38', '#a0522d', '#c26a44'];
    const hausSetzen = s => {
      const p = samplesBei(s), r = rechtsVon(p);
      const seite = Math.random() < 0.5 ? -1 : 1;
      const abstand = 13 + Math.random() * 9;
      haeuser.push({ x: p.x + r.x * seite * abstand, z: p.z + r.z * seite * abstand,
        b: 5 + Math.random() * 3, h: 3.4 + Math.random() * 1.6,
        farbe: WAENDE[Math.floor(Math.random() * WAENDE.length)],
        dach: DAECHER[Math.floor(Math.random() * DAECHER.length)] });
    };
    for (let s = 12; s < Math.min(80, S_END * 0.3); s += 14 + Math.random() * 10) hausSetzen(s);
    for (let s = Math.max(0, S_END - 80); s < S_END - 8; s += 14 + Math.random() * 10) hausSetzen(s);
    for (let s = 110; s < S_END - 110; s += 70 + Math.random() * 60)
      if (Math.random() < 0.45) hausSetzen(s);

    // Leitplanken in den Kurven & Werbetafeln – 90er-Rennspiel-Look
    const planken = [];
    for (let sp = 20; sp < S_END - 10; sp += 9) {
      const dr = samplesBei(sp + 24).richtung - samplesBei(sp).richtung;
      if (Math.abs(dr) > 0.17) {
        const pp = samplesBei(sp), rp = rechtsVon(pp);
        const seiteP = -Math.sign(dr);
        planken.push({ x: pp.x + rp.x * seiteP * (HALB + 1.1), z: pp.z + rp.z * seiteP * (HALB + 1.1) });
      }
    }
    const REKLAME = ['SIAM PARK', 'LORO PARQUE', 'CASA DEL VINO', 'KART CLUB', 'EL MÉDANO SURF'];
    const plakate = [];
    for (let i = 0; i < 3; i++) {
      const sq = S_END * (0.22 + i * 0.27);
      const pq = samplesBei(sq), rq = rechtsVon(pq);
      const seiteQ = i % 2 ? -1 : 1;
      plakate.push({ x: pq.x + rq.x * seiteQ * 12, z: pq.z + rq.z * seiteQ * 12,
        text: REKLAME[(hops + i) % REKLAME.length] });
    }

    const zielName = fahrt ? DATA.ZONEN[fahrt.nach].name.split(' ')[0].replace('Nordosten', 'Anaga') : 'Ziel';
    const endP = samplesBei(S_END), endR = rechtsVon(endP);
    const schild = { x: endP.x + endR.x * 9, z: endP.z + endR.z * 9, text: zielName };
    const flagge = { x: endP.x, z: endP.z, icon: '🏁', gr: 4.5 };

    // Verkehr: langsame Autos zum Überholen & Gegenverkehr
    const verkehr = [];
    const anzahl = Math.max(2, Math.round(S_END / 55));
    for (let i = 0; i < anzahl; i++) {
      const gegen = Math.random() < 0.35;
      verkehr.push({
        s: 45 + Math.random() * (S_END - 80),
        spur: gegen ? -2.2 : 2.2,
        v: gegen ? 10 + Math.random() * 5 : 8 + Math.random() * 4,
        gegen,
        bus: gegen && Math.random() < 0.5,
        farbe: ['#3a6ea5', '#d8d8d8', '#454754', '#c46a2b', '#7b5aa6'][Math.floor(Math.random() * 5)],
        prevRel: 1, hitCd: 0,
      });
    }

    // Spielzustand
    let px = samples[0].x, pz = samples[0].z, heading = samples[0].richtung;
    let camYaw = heading, speed = 0, lenk = 0, lenkIst = 0, gas = 0;
    let roadIdx = 0, treffer = 0, stil = 0, blitz = 0, offroadZeit = 0, shake = 0;
    let boostRest = 3, boostZeit = 0, vorbei = false, countdownPiep = 3;
    let kamModus = 'chase', lenkZeiger = null;

    // Sammelsterne entlang der Strecke (Bonus!)
    const sterne = [];
    const sterneGesamt = Math.max(3, Math.round(S_END / 65));
    for (let i = 1; i <= sterneGesamt; i++) {
      const p = samplesBei(i * S_END / (sterneGesamt + 1)), r = rechtsVon(p);
      const q = (Math.random() * 2 - 1) * 4;
      sterne.push({ x: p.x + r.x * q, z: p.z + r.z * q, icon: '⭐', gr: 2.4 });
    }
    let sterneGesammelt = 0;

    // Wolken & Autofarben für den Verkehr
    const wolken = [{ az: -0.6, h: 34, gr: 26 }, { az: 1.4, h: 52, gr: 34 }, { az: 2.8, h: 40, gr: 22 }];
    const voegel = [{ az: 0.4, h: 58 }, { az: 2.1, h: 40 }];
    const AUTOFARBEN = ['#3a6ea5', '#d8d8d8', '#454754', '#c46a2b', '#7b5aa6'];
    const schweber = [];
    const start = performance.now();
    let letztes = start;

    function boost() {
      if (boostRest > 0 && boostZeit <= 0 && speed > 8 && !vorbei) {
        boostRest--; boostZeit = 1.5;
        piep(520, 200, 'square', 0.1);
      }
    }

    // Minimap-Vorberechnung (GTA lässt grüßen)
    let mmMinX = 1e9, mmMaxX = -1e9, mmMinZ = 1e9, mmMaxZ = -1e9;
    for (const p of samples) {
      mmMinX = Math.min(mmMinX, p.x); mmMaxX = Math.max(mmMaxX, p.x);
      mmMinZ = Math.min(mmMinZ, p.z); mmMaxZ = Math.max(mmMaxZ, p.z);
    }
    const MM = 78, MMX = 8, MMY = H - MM - 8;
    const mmSkala = (MM - 16) / Math.max(mmMaxX - mmMinX, mmMaxZ - mmMinZ, 1);
    const mmPx = wx => MMX + 8 + (wx - mmMinX) * mmSkala;
    const mmPz = wz => MMY + MM - 8 - (wz - mmMinZ) * mmSkala;

    // Motorgeräusch
    let motor = null;
    function motorStart() {
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const filter = audioCtx.createBiquadFilter();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth'; osc.frequency.value = 50;
        filter.type = 'lowpass'; filter.frequency.value = 220;
        gain.gain.value = 0.028;
        osc.connect(filter).connect(gain).connect(audioCtx.destination);
        osc.start();
        motor = { osc, gain };
      } catch (e) { motor = null; }
    }
    function motorStopp() {
      if (!motor) return;
      try {
        motor.gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        motor.osc.stop(audioCtx.currentTime + 0.45);
      } catch (e) { /* egal */ }
      motor = null;
    }

    function tasteRunter(e) {
      if (e.key === 'ArrowLeft' || e.key === 'a') { lenk = -1; e.preventDefault(); }
      if (e.key === 'ArrowRight' || e.key === 'd') { lenk = 1; e.preventDefault(); }
      if (e.key === 'ArrowUp' || e.key === 'w') { gas = 1; e.preventDefault(); }
      if (e.key === 'ArrowDown' || e.key === 's') { gas = -1; e.preventDefault(); }
      if (e.key === ' ') { boost(); e.preventDefault(); }
      if (e.key === 'c' || e.key === 'C') { kamModus = kamModus === 'chase' ? 'top' : 'chase'; }
    }
    function tasteHoch(e) {
      if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) lenk = 0;
      if (['ArrowUp', 'ArrowDown', 'w', 's'].includes(e.key)) gas = 0;
    }
    function zeigerRunter(e) {
      const box = canvas.getBoundingClientRect();
      const x = (e.clientX - box.left) / box.width * W;
      const y = (e.clientY - box.top) / box.height * H;
      if (x > W - 74 && y > H - 52) { boost(); e.preventDefault(); return; }
      if (x > W - 46 && y > 30 && y < 66) {
        kamModus = kamModus === 'chase' ? 'top' : 'chase';
        e.preventDefault(); return;
      }
      lenk = x < W / 2 ? -1 : 1;
      lenkZeiger = e.pointerId;      // Multi-Touch: Boost-Finger löst das Lenken nicht
      e.preventDefault();
    }
    const zeigerHoch = e => {
      if (lenkZeiger === null || e.pointerId === lenkZeiger) { lenk = 0; lenkZeiger = null; }
    };

    document.addEventListener('keydown', tasteRunter);
    document.addEventListener('keyup', tasteHoch);
    canvas.addEventListener('pointerdown', zeigerRunter);
    document.addEventListener('pointerup', zeigerHoch);

    function aufraeumen() {
      motorStopp();
      uhr.aufraeumen();
      document.removeEventListener('keydown', tasteRunter);
      document.removeEventListener('keyup', tasteHoch);
      canvas.removeEventListener('pointerdown', zeigerRunter);
      document.removeEventListener('pointerup', zeigerHoch);
    }

    const winkelNorm = a => {
      while (a > Math.PI) a -= 2 * Math.PI;
      while (a < -Math.PI) a += 2 * Math.PI;
      return a;
    };

    function zeichneAuto(x, y, neigung, bremst, boostet) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(neigung * 0.06);
      // Turbo-Flammen hinterm Heck
      if (boostet) {
        const fl = 10 + Math.random() * 12;
        const flamme = ctx.createLinearGradient(0, 14, 0, 14 + fl);
        flamme.addColorStop(0, 'rgba(255,209,102,0.95)');
        flamme.addColorStop(1, 'rgba(230,57,70,0)');
        ctx.fillStyle = flamme;
        ctx.beginPath();
        ctx.moveTo(-14, 12); ctx.lineTo(-8, 14 + fl); ctx.lineTo(-2, 12);
        ctx.moveTo(2, 12); ctx.lineTo(8, 14 + fl); ctx.lineTo(14, 12);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath(); ctx.ellipse(0, 16, 30, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#15161f';
      ctx.beginPath(); ctx.roundRect(-27, 3, 11, 14, 3); ctx.fill();
      ctx.beginPath(); ctx.roundRect(16, 3, 11, 14, 3); ctx.fill();
      // Karosserie mit Lackverlauf
      const lack = ctx.createLinearGradient(0, -8, 0, 16);
      lack.addColorStop(0, wagen.hell); lack.addColorStop(0.45, wagen.farbe); lack.addColorStop(1, wagen.dunkel);
      ctx.fillStyle = lack;
      ctx.beginPath(); ctx.roundRect(-24, -6, 48, 21, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath(); ctx.roundRect(-24, -6, 48, 6, [7, 7, 0, 0]); ctx.fill();
      // Kabine mit Heckscheibe
      const glas = ctx.createLinearGradient(0, -17, 0, -3);
      glas.addColorStop(0, '#3f5a86'); glas.addColorStop(1, '#22314d');
      ctx.fillStyle = glas;
      ctx.beginPath(); ctx.roundRect(-15, -17, 30, 13, 5); ctx.fill();
      ctx.fillStyle = 'rgba(200,225,245,0.35)';
      ctx.beginPath(); ctx.roundRect(-12, -15, 24, 5, 3); ctx.fill();
      ctx.fillStyle = wagen.farbe;
      ctx.beginPath(); ctx.roundRect(-17, -20, 34, 5, 2); ctx.fill();
      // Heckspoiler
      ctx.fillStyle = wagen.dunkel;
      ctx.fillRect(-20, -22, 40, 3);
      ctx.fillRect(-18, -19, 3, 4); ctx.fillRect(15, -19, 3, 4);
      // Rücklichter: glühen beim Bremsen
      ctx.fillStyle = bremst ? '#ff5b4d' : '#ffd166';
      ctx.beginPath(); ctx.roundRect(-23, 4, 8, 5, 2); ctx.fill();
      ctx.beginPath(); ctx.roundRect(15, 4, 8, 5, 2); ctx.fill();
      if (bremst) {
        ctx.fillStyle = 'rgba(255,80,60,0.35)';
        ctx.beginPath(); ctx.ellipse(-19, 7, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(19, 7, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
      }
      // Nummernschild
      ctx.fillStyle = '#f5f0e6';
      ctx.fillRect(-7, 7, 14, 6);
      ctx.fillStyle = '#2b2d42'; ctx.font = 'bold 5px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('TFS', 0, 12);
      ctx.restore();
    }

    function schleife(now) {
      if (vorbei) return;
      const dt = uhr.tick(now).dt;
      const seitStart = now - start - uhr.pausenMs;
      const fahrZeit = Math.max(0, seitStart - COUNTDOWN) / 1000;

      // Countdown
      if (seitStart < COUNTDOWN) {
        const rest = Math.ceil((COUNTDOWN - seitStart) / (COUNTDOWN / 3));
        if (rest < countdownPiep) { countdownPiep = rest; piep(440, 120, 'square'); }
      } else if (countdownPiep > 0) {
        countdownPiep = 0; piep(880, 220, 'square'); motorStart();
      }

      // Nächsten Straßenpunkt verfolgen (für Fortschritt & Abseits-Erkennung)
      const d2 = i => {
        const p = samples[Math.max(0, Math.min(samples.length - 1, i))];
        return (p.x - px) * (p.x - px) + (p.z - pz) * (p.z - pz);
      };
      for (let n = 0; n < 10 && roadIdx < samples.length - 1 && d2(roadIdx + 1) < d2(roadIdx); n++) roadIdx++;
      while (roadIdx > 0 && d2(roadIdx - 1) < d2(roadIdx)) roadIdx--;
      const roadS = roadIdx * SCHRITT;
      const seitAbstand = Math.sqrt(d2(roadIdx));
      const abseits = seitAbstand > HALB + 1.2;
      const fortschritt = Math.min(1, roadS / S_END);

      // Fahrphysik: echtes Lenken, Gas, Bremse, Turbo
      if (seitStart >= COUNTDOWN) {
        boostZeit = Math.max(0, boostZeit - dt);
        let zielTempo = boostZeit > 0 ? wagen.tempo + 12 : gas > 0 ? wagen.tempo : gas < 0 ? 4 : wagen.tempo * 0.7;
        if (abseits) zielTempo *= wagen.gelaende;
        speed += (zielTempo - speed) * dt * (gas < 0 ? 2.6 : boostZeit > 0 ? 2.0 : 0.9);
        lenkIst += (lenk - lenkIst) * Math.min(1, dt * 7);
        const griff = (regnet ? 0.82 : 1) * wagen.grip;
        heading += lenkIst * wagen.lenk * dt * Math.min(1, speed / 10) * griff;
        if (regnet && speed > 14) heading += (Math.random() - 0.5) * 0.5 * dt;
        px += Math.sin(heading) * speed * dt;
        pz += Math.cos(heading) * speed * dt;
      }
      if (motor) {
        try {
          motor.osc.frequency.value = 45 + (speed / 38) * 85;
          motor.gain.gain.value = uhr.pausiert ? 0.001 : 0.028;   // in der Pause ist Ruhe
        } catch (e) { /* egal */ }
      }

      // Abseits: Gerumpel & Zeitstrafe
      if (abseits && speed > 6) {
        offroadZeit += dt;
        if (offroadZeit > 1.0) { treffer++; blitz = 300; shake = 240; offroadZeit = 0; piep(120, 200, 'sawtooth', 0.12); }
      } else offroadZeit = 0;

      // Verkehr bewegen, Kollisionen & Überholmanöver
      for (const auto of verkehr) {
        auto.s += (auto.gegen ? -auto.v : auto.v) * dt;
        if (auto.gegen && auto.s < roadS - 40) auto.s = Math.min(S_END - 10, roadS + 170 + Math.random() * 80);
        const p = samplesBei(auto.s), r = rechtsVon(p);
        auto.x = p.x + r.x * auto.spur;
        auto.z = p.z + r.z * auto.spur;
        auto.hitCd = Math.max(0, auto.hitCd - dt);
        const abstand = Math.hypot(auto.x - px, auto.z - pz);
        if (abstand < 2.3 && auto.hitCd <= 0 && speed > 4) {
          treffer++; blitz = 300; shake = 400; auto.hitCd = 2; speed *= 0.55;
          piep(110, 260, 'sawtooth', 0.14);
          brumm(60);
        }
        const rel = auto.s - roadS;
        if (auto.prevRel > 0 && rel <= 0 && abstand >= 2.3) {
          if (!auto.gegen) {
            const punkte = 10 + (abstand < 4.5 ? 5 : 0) + (boostZeit > 0 ? 5 : 0);
            stil += punkte;
            schweber.push({ text: (abstand < 4.5 ? 'Knapp überholt! +' : 'Überholt! +') + punkte, alter: 0 });
            piep(760, 90, 'triangle', 0.06);
          } else if (abstand < 4.5 && speed > 14) {
            stil += 5;
            schweber.push({ text: 'Riskant! +5', alter: 0 });
          }
        }
        auto.prevRel = rel;
      }
      for (const h of hindernisse) {
        if (h.erledigt) continue;
        const abstand = Math.hypot(h.x - px, h.z - pz);
        if (abstand < 2.1 && speed > 4) {
          h.erledigt = true; treffer++; blitz = 300; shake = 400; piep(110, 260, 'sawtooth', 0.14);
        } else if (abstand < 3.6 && speed > 15 && Math.abs(winkelNorm(Math.atan2(h.x - px, h.z - pz) - heading)) > 1.7) {
          h.erledigt = true; stil += 5;
          schweber.push({ text: 'Riskant! +5', alter: 0 });
        }
      }

      // Sterne einsammeln
      for (const st of sterne) {
        if (st.weg) continue;
        if (Math.hypot(st.x - px, st.z - pz) < 2.8) {
          st.weg = true; sterneGesammelt++; stil += 8;
          schweber.push({ text: '⭐ Stern! +8', alter: 0 });
          piep(980, 120, 'triangle', 0.07);
          if (sterneGesammelt === sterneGesamt) {
            stil += 20;
            schweber.push({ text: '🌟 Alle Sterne! +20', alter: 0 });
          }
        }
      }

      // Kamera folgt mit Verzögerung (Chase-Cam)
      camYaw += winkelNorm(heading - camYaw) * Math.min(1, dt * 4.6);
      const sinY = Math.sin(camYaw), cosY = Math.cos(camYaw);
      const kamX = px - sinY * KAM_ABSTAND, kamZ = pz - cosY * KAM_ABSTAND;
      const projiziere = (x, z) => {
        const dx = x - kamX, dz = z - kamZ;
        return { rz: dx * sinY + dz * cosY, rx: dx * cosY - dz * sinY };
      };

      // ————— Zeichnen —————
      // Screen-Shake nach Kollisionen: der ganze Frame wackelt kurz
      ctx.save();
      if (shake > 0 && !uhr.pausiert) {
        const st = shake / 400;
        ctx.translate((Math.random() - 0.5) * 9 * st, (Math.random() - 0.5) * 7 * st);
        shake = Math.max(0, shake - dt * 1000);
      }
      if (kamModus === 'chase') {
      // Himmel, Sonne & Teide (dreht mit der Blickrichtung)
      const himmel = ctx.createLinearGradient(0, 0, 0, HORIZONT);
      himmel.addColorStop(0, himmelFarben[0]); himmel.addColorStop(1, himmelFarben[1]);
      ctx.fillStyle = himmel; ctx.fillRect(0, 0, W, HORIZONT);
      // Echtes Foto-Panorama des Zielortes – als breites Band, dreht mit
      const pano = fotoLaden(panoMotiv);
      if (pano && pano.width > 50) {
        const ph = HORIZONT + 4;
        const bandB = W * 1.9;                       // ein Foto ≈ zwei Bildschirmbreiten
        // Cover-Ausschnitt: obere Bildhälfte (dort sitzt der Horizont)
        const quellH = Math.min(pano.height, pano.width * (ph / bandB) * 2.2);
        const quellY = Math.max(0, (pano.height - quellH) * 0.3);
        let poff = (-camYaw * W * 0.55) % bandB;
        if (poff > 0) poff -= bandB;
        ctx.save();
        ctx.globalAlpha = truebe || regnet ? 0.55 : 0.9;
        for (let px2 = poff; px2 < W; px2 += bandB)
          ctx.drawImage(pano, 0, quellY, pano.width, quellH, px2, 0, bandB, ph);
        ctx.restore();
        const blende = ctx.createLinearGradient(0, 0, 0, ph);
        blende.addColorStop(0, himmelFarben[0] + '99');
        blende.addColorStop(0.55, himmelFarben[1] + '11');
        blende.addColorStop(1, himmelFarben[1] + '00');
        ctx.fillStyle = blende;
        ctx.fillRect(0, 0, W, ph);
      }
      const teideRel = winkelNorm(0.6 - camYaw);
      if (!pano && Math.abs(teideRel) < 1.15) {
        const tx = W / 2 + Math.tan(teideRel) * F;
        ctx.fillStyle = truebe || regnet ? '#6e7887' : '#8a7f8d';
        ctx.beginPath();
        ctx.moveTo(tx - 80, HORIZONT); ctx.lineTo(tx, HORIZONT - 46); ctx.lineTo(tx + 80, HORIZONT);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f5f0e6';
        ctx.beginPath();
        ctx.moveTo(tx - 16, HORIZONT - 37); ctx.lineTo(tx, HORIZONT - 46); ctx.lineTo(tx + 16, HORIZONT - 37);
        ctx.lineTo(tx + 9, HORIZONT - 32); ctx.lineTo(tx - 9, HORIZONT - 32);
        ctx.closePath(); ctx.fill();
      }
      if (!pano && !regnet && !truebe) {
        const sonneRel = winkelNorm(-1.8 - camYaw);
        if (Math.abs(sonneRel) < 1.2) {
          const sx = W / 2 + Math.tan(sonneRel) * F;
          const glut = ctx.createRadialGradient(sx, 40, 4, sx, 40, 44);
          glut.addColorStop(0, 'rgba(255,240,190,0.9)');
          glut.addColorStop(1, 'rgba(255,240,190,0)');
          ctx.fillStyle = glut;
          ctx.beginPath(); ctx.arc(sx, 40, 44, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = calima ? '#f0d9a0' : '#ffe8a3';
          ctx.beginPath(); ctx.arc(sx, 40, 16, 0, Math.PI * 2); ctx.fill();
        }
      }
      // Meer am Horizont (gegenüber dem Teide) & Wolken
      const meerRel = winkelNorm(0.6 + Math.PI - camYaw);
      if (!pano && Math.abs(meerRel) < 1.35) {
        ctx.fillStyle = 'rgba(31,111,165,' + (0.85 * Math.cos(meerRel * 1.1)).toFixed(2) + ')';
        ctx.fillRect(0, HORIZONT - 7, W, 7);
      }
      // Möwen ziehen über den Himmel
      for (const vogel of voegel) {
        vogel.az += dt * 0.05;
        const relV = winkelNorm(vogel.az - camYaw);
        if (Math.abs(relV) < 1.2) {
          const vx = W / 2 + Math.tan(relV) * F;
          const schlag = Math.sin(performance.now() / 130 + vogel.h) * 3;
          ctx.strokeStyle = 'rgba(40,45,60,0.75)'; ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(vx - 6, vogel.h - schlag); ctx.quadraticCurveTo(vx, vogel.h + 3, vx + 6, vogel.h - schlag);
          ctx.stroke();
        }
      }
      for (const wolke of wolken) {
        wolke.az += dt * 0.004;
        const rel = winkelNorm(wolke.az - camYaw);
        if (Math.abs(rel) > 1.2) continue;
        const wx = W / 2 + Math.tan(rel) * F;
        ctx.fillStyle = regnet || truebe ? 'rgba(220,226,232,0.8)' : 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.ellipse(wx, wolke.h, wolke.gr, wolke.gr * 0.4, 0, 0, Math.PI * 2);
        ctx.ellipse(wx + wolke.gr * 0.6, wolke.h + 4, wolke.gr * 0.6, wolke.gr * 0.26, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Boden & Dunst am Horizont
      ctx.fillStyle = thema.boden;
      ctx.fillRect(0, HORIZONT, W, H - HORIZONT);
      const dunst = ctx.createLinearGradient(0, HORIZONT, 0, HORIZONT + 46);
      dunst.addColorStop(0, himmelFarben[1] + 'e6');
      dunst.addColorStop(1, himmelFarben[1] + '00');
      ctx.fillStyle = dunst; ctx.fillRect(0, HORIZONT, W, 46);

      // Straße: Quad-Streifen von fern nach nah
      const von = Math.max(0, roadIdx - 6), bis = Math.min(samples.length - 1, roadIdx + 85);
      const punkte = [];
      for (let i = von; i <= bis; i++) {
        const p = samples[i], r = rechtsVon(p);
        const li = projiziere(p.x - r.x * HALB, p.z - r.z * HALB);
        const re = projiziere(p.x + r.x * HALB, p.z + r.z * HALB);
        if (li.rz < 0.6 || re.rz < 0.6) { punkte.push(null); continue; }
        punkte.push({
          lx: W / 2 + li.rx * F / li.rz, ly: HORIZONT + KAM_H * F / li.rz,
          rx: W / 2 + re.rx * F / re.rz, ry: HORIZONT + KAM_H * F / re.rz, i,
        });
      }
      // Durchgang 1: klassische 90er-Bodenstreifen über die volle Breite
      for (let n = punkte.length - 2; n >= 0; n--) {
        const a = punkte[n], b = punkte[n + 1];
        if (!a || !b) continue;
        const hell = Math.floor(a.i / 4) % 2 === 0;
        const bandOben = Math.min(b.ly, b.ry), bandUnten = Math.max(a.ly, a.ry);
        if (bandUnten > bandOben) {
          ctx.fillStyle = hell ? thema.boden : bodenDunkel;
          ctx.fillRect(0, bandOben, W, bandUnten - bandOben + 1);
        }
      }
      // Durchgang 2: die Straße selbst (übermalt die Bänder sauber)
      for (let n = punkte.length - 2; n >= 0; n--) {
        const a = punkte[n], b = punkte[n + 1];
        if (!a || !b) continue;
        const hell = Math.floor(a.i / 4) % 2 === 0;
        // Randstreifen (rot-weiß)
        ctx.fillStyle = hell ? '#e63946' : '#f5f0e6';
        ctx.beginPath();
        ctx.moveTo(a.lx - 6, a.ly); ctx.lineTo(a.rx + 6, a.ry);
        ctx.lineTo(b.rx + 6, b.ry); ctx.lineTo(b.lx - 6, b.ly);
        ctx.closePath(); ctx.fill();
        // Asphalt
        ctx.fillStyle = regnet ? (hell ? '#4e5058' : '#484a52') : (hell ? '#6b6d76' : '#63656e');
        ctx.beginPath();
        ctx.moveTo(a.lx, a.ly); ctx.lineTo(a.rx, a.ry);
        ctx.lineTo(b.rx, b.ry); ctx.lineTo(b.lx, b.ly);
        ctx.closePath(); ctx.fill();
        // Mittellinie
        if (a.i % 4 < 2) {
          ctx.fillStyle = '#f5f0e6';
          const amx = (a.lx + a.rx) / 2, amy = (a.ly + a.ry) / 2;
          const bmx = (b.lx + b.rx) / 2, bmy = (b.ly + b.ry) / 2;
          const ab = Math.max(1.4, (a.rx - a.lx) * 0.02);
          ctx.beginPath();
          ctx.moveTo(amx - ab, amy); ctx.lineTo(amx + ab, amy);
          ctx.lineTo(bmx + ab, bmy); ctx.lineTo(bmx - ab, bmy);
          ctx.closePath(); ctx.fill();
        }
      }

      // Objekte (Deko, Schilder, Hindernisse, Verkehr, Ziel) sortiert zeichnen
      const sichtbar = [];
      const sammle = (o, art) => {
        const pr = projiziere(o.x, o.z);
        if (pr.rz < 1 || pr.rz > 240) return;
        sichtbar.push({ o, art, rz: pr.rz,
          sx: W / 2 + pr.rx * F / pr.rz, sy: HORIZONT + KAM_H * F / pr.rz });
      };
      for (const o of objekte) sammle(o, 'deko');
      for (const pl of planken) sammle(pl, 'planke');
      for (const pk of plakate) sammle(pk, 'plakat');
      for (const hs of haeuser) sammle(hs, 'haus');
      for (const h of hindernisse) if (!h.erledigt || h.icon !== '🐐') sammle(h, 'deko');
      for (const st of sterne) if (!st.weg) sammle(st, 'deko');
      for (const auto of verkehr) sammle(auto, 'auto');
      sammle(flagge, 'deko');
      sammle(schild, 'schild');
      sichtbar.sort((a, b) => b.rz - a.rz);
      ctx.textAlign = 'center';
      for (const s of sichtbar) {
        if (s.art === 'schild') {
          const sw = 8 * F / s.rz, sh = 2.4 * F / s.rz;
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = '#2b2d42'; ctx.lineWidth = Math.max(1, 0.16 * F / s.rz);
          ctx.beginPath(); ctx.roundRect(s.sx - sw / 2, s.sy - sh - 1.4 * F / s.rz, sw, sh, 0.25 * F / s.rz);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#2b2d42';
          ctx.font = 'bold ' + Math.max(4, 1.1 * F / s.rz) + 'px sans-serif';
          ctx.fillText(s.o.text, s.sx, s.sy - sh / 2 - 1.4 * F / s.rz + 0.4 * F / s.rz);
          ctx.fillStyle = '#8a8d9c';
          ctx.fillRect(s.sx - 0.08 * F / s.rz, s.sy - 1.4 * F / s.rz, 0.16 * F / s.rz, 1.4 * F / s.rz);
        } else if (s.art === 'planke') {
          // Leitplanke: Pfosten + silberne Schiene
          const q = F / s.rz;
          ctx.fillStyle = '#8f939e';
          ctx.fillRect(s.sx - 0.08 * q, s.sy - 0.85 * q, 0.16 * q, 0.85 * q);
          ctx.fillStyle = '#cdd3dc';
          ctx.fillRect(s.sx - 0.8 * q, s.sy - 0.82 * q, 1.6 * q, 0.26 * q);
        } else if (s.art === 'plakat') {
          // Werbetafel wie in den Arcade-Racern der 90er
          const q = F / s.rz;
          const pb = 5 * q, phh = 1.9 * q;
          ctx.fillStyle = '#6b6f78';
          ctx.fillRect(s.sx - pb * 0.38, s.sy - phh - 1.6 * q, 0.14 * q, phh + 1.6 * q);
          ctx.fillRect(s.sx + pb * 0.26, s.sy - phh - 1.6 * q, 0.14 * q, phh + 1.6 * q);
          ctx.fillStyle = '#f5f0e6';
          ctx.strokeStyle = '#2b2d42'; ctx.lineWidth = Math.max(1, 0.1 * q);
          ctx.beginPath(); ctx.roundRect(s.sx - pb / 2, s.sy - phh - 1.6 * q, pb, phh, 0.2 * q);
          ctx.fill(); ctx.stroke();
          if (q > 7) gtaText(ctx, s.o.text, s.sx, s.sy - 1.6 * q - phh * 0.3, phh * 0.38, '#e63946');
        } else if (s.art === 'haus') {
          // Kanarisches Haus: weiße Wand, Terrakotta-Dach, Fenster & Tür
          const q = F / s.rz;
          const bw = s.o.b * q, bh = s.o.h * q;
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.beginPath(); ctx.ellipse(s.sx, s.sy + 1, bw * 0.55, bw * 0.1, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = s.o.farbe;
          ctx.fillRect(s.sx - bw / 2, s.sy - bh, bw, bh);
          ctx.fillStyle = 'rgba(0,0,0,0.08)';
          ctx.fillRect(s.sx + bw * 0.28, s.sy - bh, bw * 0.22, bh);
          ctx.fillStyle = s.o.dach;
          ctx.beginPath();
          ctx.moveTo(s.sx - bw * 0.58, s.sy - bh);
          ctx.lineTo(s.sx - bw * 0.3, s.sy - bh * 1.38);
          ctx.lineTo(s.sx + bw * 0.3, s.sy - bh * 1.38);
          ctx.lineTo(s.sx + bw * 0.58, s.sy - bh);
          ctx.closePath(); ctx.fill();
          if (bw > 14) {
            ctx.fillStyle = 'rgba(43,60,90,0.85)';
            ctx.fillRect(s.sx - bw * 0.34, s.sy - bh * 0.72, bw * 0.2, bh * 0.28);
            ctx.fillRect(s.sx + bw * 0.14, s.sy - bh * 0.72, bw * 0.2, bh * 0.28);
            ctx.fillStyle = '#7a5230';
            ctx.fillRect(s.sx - bw * 0.09, s.sy - bh * 0.42, bw * 0.18, bh * 0.42);
          }
        } else if (s.art === 'auto') {
          // Verkehr als gezeichnetes Auto (Heck- bzw. Frontansicht)
          const q = F / s.rz;
          const bw = (s.o.bus ? 2.3 : 1.8) * q, bh = (s.o.bus ? 2.5 : 1.45) * q;
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.beginPath(); ctx.ellipse(s.sx, s.sy, bw * 0.62, bw * 0.15, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#1d1f2a';
          ctx.fillRect(s.sx - bw * 0.46, s.sy - bh * 0.16, bw * 0.2, bh * 0.18);
          ctx.fillRect(s.sx + bw * 0.26, s.sy - bh * 0.16, bw * 0.2, bh * 0.18);
          ctx.fillStyle = s.o.bus ? '#2a9d8f' : s.o.farbe;
          ctx.beginPath(); ctx.roundRect(s.sx - bw / 2, s.sy - bh, bw, bh * 0.92, bw * 0.14); ctx.fill();
          ctx.fillStyle = 'rgba(210,230,240,0.9)';
          ctx.beginPath(); ctx.roundRect(s.sx - bw * 0.32, s.sy - bh * 0.94, bw * 0.64, bh * 0.34, bw * 0.08); ctx.fill();
          if (s.o.gegen) {
            ctx.fillStyle = '#fff7cc';
            ctx.beginPath();
            ctx.arc(s.sx - bw * 0.3, s.sy - bh * 0.22, Math.max(1, bw * 0.09), 0, Math.PI * 2);
            ctx.arc(s.sx + bw * 0.3, s.sy - bh * 0.22, Math.max(1, bw * 0.09), 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = '#e63946';
            ctx.fillRect(s.sx - bw * 0.42, s.sy - bh * 0.28, bw * 0.16, bh * 0.1);
            ctx.fillRect(s.sx + bw * 0.26, s.sy - bh * 0.28, bw * 0.16, bh * 0.1);
          }
        } else {
          const groesse = Math.min(96, Math.max(5, (s.o.gr || 3) * F / s.rz));
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.beginPath(); ctx.ellipse(s.sx, s.sy + 1, groesse * 0.3, groesse * 0.08, 0, 0, Math.PI * 2); ctx.fill();
          ctx.font = groesse + 'px serif';
          ctx.fillText(s.o.icon, s.sx, s.sy);
        }
      }

      // Auto: hängt in Kurven sichtbar seitlich in der Kamera (Chase-Cam-Gefühl)
      const versatz = Math.max(-52, Math.min(52, Math.sin(winkelNorm(heading - camYaw)) * 150));
      const ruettel = abseits && speed > 6 ? (Math.random() - 0.5) * 4 : 0;
      zeichneAuto(W / 2 + versatz + ruettel, H - 62 + ruettel * 0.5,
        lenkIst + winkelNorm(heading - camYaw) * 2, gas < 0 && speed > 5, boostZeit > 0);

      } else {
        // ————— Top-Down-Ansicht (klassischer Draufsicht-Look) —————
        const skala = 2.6;
        const sinH = Math.sin(heading), cosH = Math.cos(heading);
        const topP = (x, z) => {
          const dx = x - px, dz = z - pz;
          return {
            sx: W / 2 + (dx * cosH - dz * sinH) * skala,
            sy: H * 0.62 - (dx * sinH + dz * cosH) * skala,
          };
        };
        ctx.fillStyle = thema.boden;
        ctx.fillRect(0, 0, W, H);

        // Straße: Randstreifen, Asphalt, Mittellinie
        const pfad = new Path2D();
        const vonT = Math.max(0, roadIdx - 55), bisT = Math.min(samples.length - 1, roadIdx + 55);
        for (let i = vonT; i <= bisT; i++) {
          const p = topP(samples[i].x, samples[i].z);
          if (i === vonT) pfad.moveTo(p.sx, p.sy); else pfad.lineTo(p.sx, p.sy);
        }
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.strokeStyle = '#e63946';
        ctx.lineWidth = (HALB * 2 + 1.6) * skala;
        ctx.stroke(pfad);
        ctx.strokeStyle = regnet ? '#4e5058' : '#67696f';
        ctx.lineWidth = HALB * 2 * skala;
        ctx.stroke(pfad);
        ctx.strokeStyle = '#f5f0e6';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([12, 12]);
        ctx.stroke(pfad);
        ctx.setLineDash([]);

        // Häuser als kleine Grundrisse mit Dachfarbe
        for (const hs of haeuser) {
          if (Math.hypot(hs.x - px, hs.z - pz) > 110) continue;
          const p = topP(hs.x, hs.z);
          const g = hs.b * skala * 0.6;
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.fillRect(p.sx - g / 2 + 1.5, p.sy - g / 2 + 1.5, g, g);
          ctx.fillStyle = hs.dach;
          ctx.fillRect(p.sx - g / 2, p.sy - g / 2, g, g);
          ctx.strokeStyle = hs.farbe; ctx.lineWidth = 1.4;
          ctx.strokeRect(p.sx - g / 2, p.sy - g / 2, g, g);
        }

        // Objekte in Sichtweite
        ctx.textAlign = 'center';
        const topZeichne = (o, gr) => {
          if (Math.hypot(o.x - px, o.z - pz) > 110) return;
          const p = topP(o.x, o.z);
          ctx.fillStyle = 'rgba(0,0,0,0.16)';
          ctx.beginPath(); ctx.ellipse(p.sx + 1.4, p.sy + 1.8, gr * skala * 0.55, gr * skala * 0.3, 0, 0, Math.PI * 2); ctx.fill();
          ctx.font = Math.round(gr * skala * 1.9) + 'px serif';
          ctx.fillText(o.icon, p.sx, p.sy + gr * skala * 0.6);
        };
        for (const o of objekte) topZeichne(o, 2.6);
        for (const h of hindernisse) if (!h.erledigt || h.icon !== '🐐') topZeichne(h, 2.2);
        for (const st of sterne) if (!st.weg) topZeichne(st, 2.2);
        topZeichne(flagge, 3.2);

        // Verkehr als Draufsicht-Autos, in Fahrtrichtung gedreht
        for (const auto of verkehr) {
          if (Math.hypot(auto.x - px, auto.z - pz) > 110) continue;
          const p = topP(auto.x, auto.z);
          const richt = samplesBei(auto.s).richtung + (auto.gegen ? Math.PI : 0);
          ctx.save();
          ctx.translate(p.sx, p.sy);
          ctx.rotate(richt - heading);
          const bw = 1.8 * skala, bl = (auto.bus ? 5 : 3.4) * skala;
          ctx.fillStyle = auto.bus ? '#2a9d8f' : auto.farbe;
          ctx.beginPath(); ctx.roundRect(-bw / 2, -bl / 2, bw, bl, bw * 0.25); ctx.fill();
          ctx.fillStyle = 'rgba(210,230,240,0.9)';
          ctx.fillRect(-bw * 0.32, -bl * 0.32, bw * 0.64, bl * 0.2);
          ctx.restore();
        }

        // Spielerauto (zeigt immer nach oben)
        ctx.save();
        ctx.translate(W / 2, H * 0.62);
        const abw = 1.9 * skala, abl = 3.6 * skala;
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.ellipse(1.5, 2, abw * 0.7, abl * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = wagen.farbe;
        ctx.beginPath(); ctx.roundRect(-abw / 2, -abl / 2, abw, abl, abw * 0.28); ctx.fill();
        ctx.fillStyle = '#2b3a55';
        ctx.fillRect(-abw * 0.32, -abl * 0.3, abw * 0.64, abl * 0.22);
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(-abw * 0.4, -abl * 0.5, abw * 0.18, abl * 0.08);
        ctx.fillRect(abw * 0.22, -abl * 0.5, abw * 0.18, abl * 0.08);
        ctx.restore();
      }

      // Turbo-Linien
      if (boostZeit > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 10; i++) {
          const sy = Math.random() * H;
          const laenge = 20 + Math.random() * 40;
          const sx = Math.random() < 0.5 ? Math.random() * 50 : W - Math.random() * 50;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + laenge); ctx.stroke();
        }
      }
      // Regen & Calima
      if (regnet) {
        ctx.strokeStyle = 'rgba(210,228,245,0.4)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 34; i++) {
          const rx2 = Math.random() * W, ry2 = Math.random() * H;
          ctx.beginPath(); ctx.moveTo(rx2, ry2); ctx.lineTo(rx2 - 2, ry2 + 11); ctx.stroke();
        }
      }
      if (calima) { ctx.fillStyle = 'rgba(222,190,120,0.15)'; ctx.fillRect(0, 0, W, H); }
      if (blitz > 0) {
        blitz -= dt * 1000;
        ctx.fillStyle = 'rgba(230,57,70,0.28)'; ctx.fillRect(0, 0, W, H);
      }

      // Schwebende Stil-Texte
      for (const s of schweber) {
        s.alter += dt;
        ctx.globalAlpha = Math.max(0, 1 - s.alter / 1.1);
        gtaText(ctx, s.text, W / 2, H - 130 - s.alter * 55, 18,
          s.text.includes('⭐') || s.text.includes('🌟') ? '#ffd166' : '#3ddc97');
      }
      ctx.globalAlpha = 1;
      while (schweber.length && schweber[0].alter > 1.1) schweber.shift();

      // Zu weit weg von der Straße?
      if (seitAbstand > 22 && seitStart > COUNTDOWN)
        gtaText(ctx, '↩ Zurück zur Straße!', W / 2, 60, 19, '#ff5b6a');

      // Minimap (unten links) – nur in der Verfolgerkamera
      if (kamModus === 'chase') {
      ctx.fillStyle = 'rgba(43,45,66,0.66)';
      ctx.beginPath(); ctx.roundRect(MMX, MMY, MM, MM, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < samples.length; i += 6) {
        const mx = mmPx(samples[i].x), my = mmPz(samples[i].z);
        if (i === 0) ctx.moveTo(mx, my); else ctx.lineTo(mx, my);
      }
      ctx.stroke();
      ctx.fillStyle = '#f4a261';
      ctx.beginPath(); ctx.arc(mmPx(endP.x), mmPz(endP.z), 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.translate(mmPx(px), mmPz(pz));
      ctx.rotate(heading);
      ctx.fillStyle = '#e63946';
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(3.6, 4); ctx.lineTo(-3.6, 4); ctx.closePath(); ctx.fill();
      ctx.restore();
      }

      // Film-Vignette & großer Arcade-Tacho (90er-Look)
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.44, W / 2, H / 2, H * 0.84);
      vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(10,12,20,0.32)');
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
      gtaText(ctx, String(Math.round(speed * 3.6)), W / 2, H - 24, 30,
        boostZeit > 0 ? '#ff5b6a' : '#ffd166');
      gtaText(ctx, 'km/h', W / 2, H - 8, 11, '#fff');

      zeichneTouchPfeile(ctx, W, H, lenk);

      // Kamera-Umschalter (Taste C oder Tippen)
      ctx.fillStyle = 'rgba(43,45,66,0.55)';
      ctx.beginPath(); ctx.roundRect(W - 44, 32, 38, 30, 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '16px serif'; ctx.textAlign = 'center';
      ctx.fillText(kamModus === 'chase' ? '🗺️' : '🎥', W - 25, 53);

      // Turbo-Knopf
      ctx.fillStyle = boostRest > 0 ? 'rgba(43,45,66,0.65)' : 'rgba(43,45,66,0.3)';
      ctx.beginPath(); ctx.roundRect(W - 70, H - 48, 64, 40, 10); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('🔥×' + boostRest, W - 38, H - 23);

      // HUD oben
      ctx.fillStyle = 'rgba(43,45,66,0.72)';
      ctx.fillRect(0, 0, W, 26);
      ctx.fillStyle = '#f5f0e6';
      ctx.fillRect(88, 10, W - 200, 6);
      ctx.fillStyle = '#f4a261';
      ctx.fillRect(88, 10, (W - 200) * fortschritt, 6);
      gtaText(ctx, '💥 ' + treffer, 6, 19, 12, treffer > 0 ? '#ff5b6a' : '#fff', 'left');
      gtaText(ctx, '🏎️ ' + stil, 46, 19, 12, '#ffd166', 'left');
      gtaText(ctx, '🏁 ' + Math.max(0, Math.ceil(GESAMT_KM * (1 - fortschritt))) + ' km · ' +
        Math.round(speed * 3.6) + ' km/h', W - 6, 19, 12, '#fff', 'right');

      // Countdown-Overlay mit Erklärung
      if (seitStart < COUNTDOWN) {
        ctx.fillStyle = 'rgba(20,21,31,0.55)'; ctx.fillRect(0, 0, W, H);
        const nr = Math.ceil((COUNTDOWN - seitStart) / (COUNTDOWN / 3));
        gtaText(ctx, String(nr), W / 2, H / 2 - 30, 72, ['#3ddc97', '#ffd166', '#ff5b6a'][nr - 1] || '#ffd166');
        gtaText(ctx, 'Fahrt nach ' + zielName, W / 2, H / 2 + 16, 20, '#59c2ff');
        gtaText(ctx, 'Lenken ← → · Gas ↑ · Bremse ↓', W / 2, H / 2 + 46, 14, '#fff');
        gtaText(ctx, 'Turbo: Leertaste · Pause: P', W / 2, H / 2 + 70, 14, '#fff');
      }

      // Angekommen? (oder Zeitlimit: irgendwann ist jeder mal da)
      if (roadS >= S_END - 6 || fahrZeit > ZEITLIMIT) {
        vorbei = true;
        aufraeumen();
        ctx.restore();
        ctx.fillStyle = 'rgba(20,21,31,0.55)'; ctx.fillRect(0, 0, W, H);
        gtaText(ctx, '🏁 ' + zielName, W / 2, H / 2 - 14, 32, '#ffd166');
        gtaText(ctx, 'ERREICHT!', W / 2, H / 2 + 22, 26, '#3ddc97');
        piep(660, 150, 'square'); setTimeout(() => piep(880, 250, 'square'), 160);

        const ergebnis = Game.fahrtBewerten(treffer, stil);
        $('#fahrt-log').appendChild(el('div', 'flug-zeile sichtbar',
          `<span class="flug-zeile-icon">${ergebnis.icon}</span><div>${esc(ergebnis.text)}` +
          (ergebnis.chips.length ? '<div class="flug-chips">' + ergebnis.chips.map(c => `<span class="chip">${esc(c)}</span>`).join('') + '</div>' : '') +
          '</div>'));
        const weiter = el('button', 'btn btn-primary', 'Weiter');
        weiter.addEventListener('click', () => { $('#fahrt-overlay').classList.add('versteckt'); fertigCb(); });
        $('#fahrt-buttons').appendChild(weiter);
        renderStats();
        return;
      }
      ctx.restore();
      uhr.zeichnen();
      requestAnimationFrame(schleife);
    }

    requestAnimationFrame(schleife);
  }


  // ------------------------------------------------------ Minispiel-Gerüst
  const IST_TOUCH = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

  function zeichneTouchPfeile(ctx, W, H, aktiv) {
    if (!IST_TOUCH) return;
    // Gedrückte Seite leuchtet auf – klares Touch-Feedback
    ctx.fillStyle = aktiv < 0 ? 'rgba(230,57,70,0.55)' : 'rgba(43,45,66,0.26)';
    ctx.beginPath(); ctx.roundRect(8, H - 48, 52, 40, 10); ctx.fill();
    ctx.fillStyle = aktiv > 0 ? 'rgba(230,57,70,0.55)' : 'rgba(43,45,66,0.26)';
    ctx.beginPath(); ctx.roundRect(66, H - 48, 52, 40, 10); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('◀', 34, H - 21);
    ctx.fillText('▶', 92, H - 21);
  }

  // ------------------------------------ GTA-Schrift, Countdown & Pause
  // Fette, bunte Schrift mit dicker schwarzer Umrandung – Open-World-Stil.
  function gtaText(ctx, text, x, y, gr, farbe, align) {
    ctx.save();
    ctx.font = 'italic 900 ' + gr + 'px "Arial Black", Impact, "Segoe UI", sans-serif';
    ctx.textAlign = align || 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#14151f';
    ctx.lineWidth = Math.max(1.6, gr * 0.16);
    ctx.strokeText(text, x, y);
    ctx.fillStyle = farbe || '#ffd166';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // Gemeinsame Spieluhr für alle Action-Minispiele: Countdown mit Erklärung
  // vor dem Start und Pause per Taste P oder ⏸-Knopf. Die zurückgegebene
  // Spielzeit läuft nur, wenn wirklich gespielt wird.
  function minispielUhr(canvas, ctx, W, H, erklaerung, opts) {
    opts = opts || {};
    const dauer = opts.ohneCountdown || window.MINISPIEL_SCHNELL ? 0 : 2800;
    const box = opts.pauseBox || { x: W - 42, y: 32, b: 36, h: 30 };
    let letztes = null, zeit = 0, pausenMs = 0, rest = dauer, piepNr = 4;
    let pausiert = false, fertig = false;

    function tick(now) {
      if (letztes === null) letztes = now;
      const roh = Math.min(50, now - letztes);
      letztes = now;
      if (pausiert) { pausenMs += roh; return { dt: 0, zeit, laeuft: false }; }
      if (rest > 0) {
        rest -= roh;
        pausenMs += roh;
        const nr = Math.ceil(Math.max(0, rest) / (dauer / 3));
        if (nr < piepNr) { piepNr = nr; piep(nr === 0 ? 880 : 440, nr === 0 ? 220 : 120, 'square'); }
        if (rest > 0) return { dt: 0, zeit, laeuft: false };
      }
      const dt = roh / 1000;
      zeit += dt;
      return { dt, zeit, laeuft: true };
    }

    function zeichnen() {
      if (fertig) return;
      // ⏸-Knopf
      ctx.save();
      ctx.fillStyle = pausiert ? 'rgba(255,209,102,0.92)' : 'rgba(20,21,31,0.55)';
      ctx.beginPath(); ctx.roundRect(box.x, box.y, box.b, box.h, 8); ctx.fill();
      ctx.fillStyle = pausiert ? '#14151f' : '#fff';
      const bx = box.x + box.b / 2, by = box.y + box.h / 2;
      ctx.fillRect(bx - 6, by - 7, 4, 14);
      ctx.fillRect(bx + 2, by - 7, 4, 14);
      ctx.restore();
      if (rest > 0 && !pausiert) {
        ctx.fillStyle = 'rgba(20,21,31,0.62)';
        ctx.fillRect(0, 0, W, H);
        const nr = Math.max(1, Math.ceil(rest / (dauer / 3)));
        gtaText(ctx, String(nr), W / 2, H * 0.32, 68, ['#3ddc97', '#ffd166', '#ff5b6a'][nr - 1] || '#ffd166');
        (erklaerung || []).forEach((zeile, i) =>
          gtaText(ctx, zeile, W / 2, H * 0.32 + 46 + i * 27, 15, i === 0 ? '#59c2ff' : '#fff'));
        gtaText(ctx, 'Pause: Taste P oder ⏸', W / 2, H - 16, 12, '#f4a261');
      } else if (pausiert) {
        ctx.fillStyle = 'rgba(20,21,31,0.68)';
        ctx.fillRect(0, 0, W, H);
        gtaText(ctx, 'PAUSE', W / 2, H / 2 - 8, 46, '#ffd166');
        gtaText(ctx, 'Weiter: Tippen oder Taste P', W / 2, H / 2 + 28, 14, '#fff');
      }
    }

    function stop(e) { e.preventDefault(); e.stopImmediatePropagation(); }
    function zeiger(e) {
      if (fertig) return;
      const b = canvas.getBoundingClientRect();
      const x = (e.clientX - b.left) / b.width * W;
      const y = (e.clientY - b.top) / b.height * H;
      if (pausiert) { pausiert = false; stop(e); return; }
      if (x >= box.x && x <= box.x + box.b && y >= box.y && y <= box.y + box.h) {
        pausiert = true; stop(e); return;
      }
      if (rest > 0) stop(e);   // während des Countdowns noch keine Eingaben
    }
    function taste(e) {
      if (fertig || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'p' || e.key === 'P') { pausiert = !pausiert; stop(e); return; }
      if (pausiert || rest > 0) {
        if (pausiert && (e.key === ' ' || e.key === 'Enter')) { pausiert = false; stop(e); return; }
        if (e.key.length === 1 || e.key.startsWith('Arrow') || e.key === 'Enter') stop(e);
      }
    }
    canvas.addEventListener('pointerdown', zeiger, true);
    document.addEventListener('keydown', taste, true);
    return {
      tick, zeichnen,
      get pausiert() { return pausiert; },
      get pausenMs() { return pausenMs; },
      get zeit() { return zeit; },
      aufraeumen() {
        fertig = true;
        canvas.removeEventListener('pointerdown', zeiger, true);
        document.removeEventListener('keydown', taste, true);
      },
    };
  }

  function minispielFenster(titel, hinweis, hoehe) {
    const overlay = $('#fahrt-overlay');
    overlay.classList.remove('versteckt');
    $('#fahrt-titel').textContent = titel;
    $('#fahrt-inselkarte').classList.add('versteckt');
    $('#fahrspiel-wrap').classList.remove('versteckt');
    $('#fahrspiel-hilfe').innerHTML = hinweis;
    $('#fahrt-log').innerHTML = '';
    $('#fahrt-buttons').innerHTML = '';
    const canvas = $('#fahrspiel-canvas');
    const ctx = canvas.getContext('2d');
    const W = 340, H = hoehe || 420;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = 'min(340px, 100%)';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { overlay, canvas, ctx, W, H };
  }

  function minispielErgebnis(icon, text, effekte, extraChips, fertigCb) {
    const chips = Game.run ? Game.bonusAnwenden(effekte || {}) : [];
    if (extraChips) chips.unshift(...extraChips);
    $('#fahrt-log').appendChild(el('div', 'flug-zeile sichtbar',
      `<span class="flug-zeile-icon">${icon}</span><div>${esc(text)}` +
      (chips.length ? '<div class="flug-chips">' + chips.map(c => `<span class="chip">${esc(c)}</span>`).join('') + '</div>' : '') +
      '</div>'));
    const weiter = el('button', 'btn btn-primary', 'Weiter');
    weiter.addEventListener('click', () => { $('#fahrt-overlay').classList.add('versteckt'); fertigCb(); });
    $('#fahrt-buttons').appendChild(weiter);
    if (Game.run) renderStats();
  }

  // ------------------------------------------- Minispiel: Koffer vom Band
  // Ovales Gepäckband mit Warnleuchte: Alle Koffer sehen fast gleich aus.
  // Steuere dein Männchen um das Band und schnapp dir GENAU deinen Koffer!
  function starteKofferSpiel(fertigCb) {
    const { canvas, ctx, W, H } = minispielFenster(
      '🧳 Gepäckband – schnapp dir deinen Koffer!',
      'Alle Koffer sehen fast gleich aus – vergleiche <strong>Gurt-Farbe und Sticker</strong> mit deinem Koffer ' +
      'oben links! Tippen = Männchen läuft hin (Pfeiltasten/WASD gehen auch). Koffer in Reichweite antippen ' +
      'oder Leertaste = zugreifen.', 420);

    // Ovales Band mit Klappe links und Warnleuchte
    const CX = W / 2, CY = 232, RX = 122, RY = 60;
    const KLAPPE = Math.PI;
    const posAuf = th => ({ x: CX + Math.cos(th) * RX, y: CY + Math.sin(th) * RY });

    // Alle Koffer im gleichen Anthrazit – nur Gurtband und Sticker unterscheiden sich
    const BASIS = '#41454f';
    const GURTE = ['#e63946', '#ffd166', '#2a9d8f', null];
    const STICKER = ['🌺', '✈️', '⭐', null];
    const zufallStil = () => ({
      gurt: GURTE[Math.floor(Math.random() * GURTE.length)],
      sticker: STICKER[Math.floor(Math.random() * STICKER.length)],
    });
    const ziel = zufallStil();
    const gleich = (a, b) => a.gurt === b.gurt && a.sticker === b.sticker;

    const koffer = [];
    let spawnIn = 0.3, spawnZaehler = 0, zielDa = false;
    let fehlgriffe = 0, blitz = 0, leuchte = 0, vorbei = false, endeIn = -1, gewonnen = false;
    const schweber = [];

    // Dein Männchen + wartende Mitreisende (oben ums Band verteilt)
    const du = { x: CX, y: H - 30, schritt: 0, blick: 1, tempo: 108 };
    let laufZiel = null;
    const tasten = { l: 0, r: 0, o: 0, u: 0 };
    const menge = [3.6, 4.15, 4.7, 5.25, 5.8].map((th, i) => ({
      x: CX + Math.cos(th) * (RX + 40), y: CY + Math.sin(th) * (RY + 32),
      icon: ['🧍', '🧍‍♀️', '👵', '🧑‍🦱', '🧔'][i], greiftIn: 5 + i * 3 + Math.random() * 4,
    }));
    const uhr = minispielUhr(canvas, ctx, W, H,
      ['Alle Koffer sehen fast gleich aus!', 'Merk dir Gurt-Farbe & Sticker']);

    function zeichneKoffer(x, y, k, gross) {
      const b = gross ? 52 : 40, h = gross ? 34 : 26;
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(x, y + h / 2 + 3, b * 0.55, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#23252d';
      ctx.fillRect(x - 7, y - h / 2 - 5, 14, 7);
      const lack = ctx.createLinearGradient(x, y - h / 2, x, y + h / 2);
      lack.addColorStop(0, '#565b68'); lack.addColorStop(0.25, BASIS); lack.addColorStop(1, '#2e313a');
      ctx.fillStyle = lack;
      ctx.beginPath(); ctx.roundRect(x - b / 2, y - h / 2, b, h, 5); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x - b / 2 + 7, y - h / 2); ctx.lineTo(x - b / 2 + 7, y + h / 2); ctx.stroke();
      if (k.gurt) { ctx.fillStyle = k.gurt; ctx.fillRect(x + b * 0.06, y - h / 2, b * 0.16, h); }
      if (k.sticker) {
        ctx.font = (gross ? 14 : 11) + 'px serif'; ctx.textAlign = 'center';
        ctx.fillText(k.sticker, x - b * 0.22, y + h * 0.22);
      }
    }

    function fertig(icon, text, effekte, extra) {
      if (vorbei) return;
      vorbei = true;
      aufraeumen();
      minispielErgebnis(icon, text, effekte, extra, fertigCb);
    }

    // Tippen: Koffer in Reichweite greifen – sonst läuft das Männchen hin
    function zeigerRunter(e) {
      if (vorbei || gewonnen) return;
      const box = canvas.getBoundingClientRect();
      const mx = (e.clientX - box.left) / box.width * W;
      const my = (e.clientY - box.top) / box.height * H;
      for (const k of koffer) {
        const p = posAuf(k.th);
        if (Math.hypot(mx - p.x, my - p.y) < 26 && Math.hypot(du.x - p.x, du.y - p.y) < 52) {
          greifen(k, p);
          e.preventDefault();
          return;
        }
      }
      laufZiel = {
        x: Math.max(12, Math.min(W - 12, mx)),
        y: Math.max(120, Math.min(H - 14, my)),
      };
      e.preventDefault();
    }
    function greifen(k, p) {
      if (k.istZiel) {
        gewonnen = true; endeIn = 1.1; leuchte = 1;
        koffer.splice(koffer.indexOf(k), 1);
        piep(880, 180, 'triangle', 0.09); setTimeout(() => piep(1100, 220, 'triangle', 0.09), 130);
        brumm(40);
      } else {
        fehlgriffe++; blitz = 250; k.peinlich = 1;
        schweber.push({ x: p.x, y: p.y - 22, text: 'Falscher Koffer!', alter: 0 });
        piep(180, 180, 'sawtooth', 0.1);
        brumm(50);
      }
    }
    function naechstenGreifen() {           // Leertaste: nächster Koffer in Reichweite
      let beste = null, dist = 52;
      for (const k of koffer) {
        const p = posAuf(k.th);
        const d = Math.hypot(du.x - p.x, du.y - p.y);
        if (d < dist) { dist = d; beste = { k, p }; }
      }
      if (beste) greifen(beste.k, beste.p);
    }
    function tasteRunter(e) {
      const map = { ArrowLeft: 'l', a: 'l', ArrowRight: 'r', d: 'r', ArrowUp: 'o', w: 'o', ArrowDown: 'u', s: 'u' };
      if (map[e.key]) { tasten[map[e.key]] = 1; laufZiel = null; e.preventDefault(); }
      else if (e.key === ' ' && !vorbei && !gewonnen) { naechstenGreifen(); e.preventDefault(); }
    }
    function tasteHoch(e) {
      const map = { ArrowLeft: 'l', a: 'l', ArrowRight: 'r', d: 'r', ArrowUp: 'o', w: 'o', ArrowDown: 'u', s: 'u' };
      if (map[e.key]) tasten[map[e.key]] = 0;
    }
    canvas.addEventListener('pointerdown', zeigerRunter);
    document.addEventListener('keydown', tasteRunter);
    document.addEventListener('keyup', tasteHoch);
    function aufraeumen() {
      uhr.aufraeumen();
      canvas.removeEventListener('pointerdown', zeigerRunter);
      document.removeEventListener('keydown', tasteRunter);
      document.removeEventListener('keyup', tasteHoch);
    }

    if (window.MINISPIEL_SCHNELL) {
      setTimeout(() => fertig('🧳', 'Koffer gesichert!', { stimmung: 2 }), 700);
    }

    function schleife(now) {
      if (vorbei) return;
      const t = uhr.tick(now);
      const dt = t.dt, zeit = t.zeit;

      // Nachschub aus der Klappe – die Warnleuchte blitzt bei jedem Koffer
      spawnIn -= dt;
      if (spawnIn <= 0 && koffer.length < 9) {
        spawnIn = 1.1 + Math.random() * 0.7;
        spawnZaehler++;
        const istZiel = !zielDa && !gewonnen && (spawnZaehler % 6 === 5 || Math.random() < 0.2);
        let stil;
        if (istZiel) { stil = ziel; zielDa = true; }
        else { do { stil = zufallStil(); } while (gleich(stil, ziel)); }
        koffer.push({ th: KLAPPE, gurt: stil.gurt, sticker: stil.sticker, istZiel, peinlich: 0 });
        leuchte = 1;
      }
      leuchte = Math.max(0, leuchte - dt * 1.4);
      for (const k of koffer) {
        k.th += 0.5 * dt;
        if (k.peinlich > 0) k.peinlich = Math.max(0, k.peinlich - dt * 2);
      }

      // Wartende greifen sich ab und zu einen fremden Koffer
      for (const m of menge) {
        m.greiftIn -= dt;
        if (m.greiftIn > 0) continue;
        m.greiftIn = 6 + Math.random() * 8;
        for (let i = koffer.length - 1; i >= 0; i--) {
          const p = posAuf(koffer[i].th);
          if (!koffer[i].istZiel && Math.hypot(m.x - p.x, m.y - p.y) < 56) {
            koffer.splice(i, 1);
            schweber.push({ x: m.x, y: m.y - 24, text: '„Meiner!“', alter: 0 });
            piep(300, 90, 'square', 0.04);
            break;
          }
        }
      }

      // Dein Männchen läuft (ums Band herum, nicht hindurch)
      if (!gewonnen) {
        let vx = tasten.r - tasten.l, vy = tasten.u - tasten.o;
        if (vx || vy) {
          const n = Math.hypot(vx, vy);
          vx = vx / n * du.tempo; vy = vy / n * du.tempo;
        } else if (laufZiel) {
          const dx = laufZiel.x - du.x, dy = laufZiel.y - du.y, d = Math.hypot(dx, dy);
          if (d > 4) { vx = dx / d * du.tempo; vy = dy / d * du.tempo; }
          else laufZiel = null;
        }
        if (vx || vy) {
          du.x = Math.max(12, Math.min(W - 12, du.x + vx * dt));
          du.y = Math.max(120, Math.min(H - 12, du.y + vy * dt));
          du.schritt += Math.hypot(vx, vy) * dt;
          if (vx) du.blick = Math.sign(vx);
        }
        // Nicht über das Band laufen: sanft nach außen schieben
        const ex = (du.x - CX) / (RX + 26), ey = (du.y - CY) / (RY + 24);
        const e2 = ex * ex + ey * ey;
        if (e2 < 1) {
          const f = 1 / Math.sqrt(e2 || 0.01);
          du.x = CX + (du.x - CX) * f;
          du.y = CY + (du.y - CY) * f;
          laufZiel = null;
        }
      }

      if (endeIn > 0) {
        endeIn -= dt;
        if (endeIn <= 0) {
          if (fehlgriffe === 0 && zeit < 18)
            fertig('🧳', 'Erster Griff, richtiger Koffer – die Umstehenden sind neidisch auf deinen Blick fürs Detail.',
              { stimmung: 4, stress: -3, erlebnis: 2 });
          else if (fehlgriffe <= 2)
            fertig('🧳', 'Koffer gesichert! Ein kurzer Moment der Verwirrung, aber am Ende zählt das Ergebnis.',
              { stimmung: 2, stress: -1 });
          else
            fertig('🧳', 'Koffer gefunden – nach ein paar sehr peinlichen Fremdgriffen. Die Dame am Band schaut noch immer streng.',
              { stimmung: 1, stress: 2 });
          return;
        }
      }

      if (!gewonnen && zeit > 40) {
        fertig('🧳', 'Irgendwann kommt jeder Koffer – deiner eben ganz zum Schluss. Hauptsache, er ist da.',
          { stress: 2 });
        return;
      }

      // ————— Zeichnen: Ankunftshalle mit ovalem Band —————
      const wand = ctx.createLinearGradient(0, 0, 0, 118);
      wand.addColorStop(0, '#c3cad4'); wand.addColorStop(1, '#dfe3e8');
      ctx.fillStyle = wand; ctx.fillRect(0, 0, W, 118);
      const fotoK = fotoLaden('teide');
      if (fotoK) fotoStreifen(ctx, fotoK, 126, 34, W - 138, 34);
      else { ctx.fillStyle = 'rgba(120,180,220,0.5)'; ctx.fillRect(126, 34, W - 138, 30); }
      ctx.strokeStyle = '#aab2bd'; ctx.lineWidth = 2;
      ctx.strokeRect(126, 34, W - 138, 34);
      ctx.font = '13px serif'; ctx.textAlign = 'center';
      ctx.fillText('✈️', 150 + (zeit * 14) % (W - 190), 54);
      ctx.fillStyle = '#e8e4da'; ctx.fillRect(0, 118, W, H - 118);
      ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 42) { ctx.beginPath(); ctx.moveTo(x, 118); ctx.lineTo(x, H); ctx.stroke(); }

      // Dein Koffer als Vergleich (oben links)
      ctx.fillStyle = 'rgba(43,45,66,0.85)';
      ctx.beginPath(); ctx.roundRect(6, 6, 110, 94, 10); ctx.fill();
      gtaText(ctx, 'DEINER:', 61, 25, 12, '#ffd166');
      zeichneKoffer(61, 56, ziel, true);
      gtaText(ctx, '😅 ' + fehlgriffe, 61, 93, 11, fehlgriffe ? '#ff5b6a' : '#fff');

      // Ovales Band: Sockel, Lauffläche, Mittelinsel, wandernde Lamellen
      ctx.fillStyle = '#2c2f38';
      ctx.beginPath(); ctx.ellipse(CX, CY, RX + 26, RY + 22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4a4e59';
      ctx.beginPath(); ctx.ellipse(CX, CY, RX + 20, RY + 17, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#33363f';
      ctx.beginPath(); ctx.ellipse(CX, CY, RX - 20, RY - 16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8f939e';
      ctx.beginPath(); ctx.ellipse(CX, CY, RX - 24, RY - 19, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 2;
      for (let i = 0; i < 26; i++) {
        const th = i / 26 * Math.PI * 2 + zeit * 0.5;
        ctx.beginPath();
        ctx.moveTo(CX + Math.cos(th) * (RX - 18), CY + Math.sin(th) * (RY - 14));
        ctx.lineTo(CX + Math.cos(th) * (RX + 18), CY + Math.sin(th) * (RY + 15));
        ctx.stroke();
      }
      // Klappe & orange Warnleuchte (blinkt, blitzt bei jedem neuen Koffer)
      ctx.fillStyle = '#23252d';
      ctx.fillRect(CX - RX - 34, CY - 26, 30, 52);
      ctx.fillStyle = '#101116';
      ctx.fillRect(CX - RX - 30, CY - 18, 22, 36);
      const puls = Math.max(leuchte, 0.35 + 0.3 * Math.sin(zeit * 7));
      const glut = ctx.createRadialGradient(CX - RX - 19, CY - 40, 1, CX - RX - 19, CY - 40, 22);
      glut.addColorStop(0, 'rgba(255,160,60,' + (0.85 * puls).toFixed(2) + ')');
      glut.addColorStop(1, 'rgba(255,160,60,0)');
      ctx.fillStyle = glut;
      ctx.beginPath(); ctx.arc(CX - RX - 19, CY - 40, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,140,40,' + (0.4 + 0.6 * puls).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(CX - RX - 19, CY - 40, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3c3f4a';
      ctx.fillRect(CX - RX - 22, CY - 36, 6, 12);

      // Koffer (hintere zuerst, damit vordere sie verdecken)
      const sortiert = [...koffer].sort((a, b) => Math.sin(a.th) - Math.sin(b.th));
      for (const k of sortiert) {
        const p = posAuf(k.th);
        if (k.peinlich > 0) {
          ctx.save(); ctx.translate((Math.random() - 0.5) * 4, 0);
          zeichneKoffer(p.x, p.y, k, false);
          ctx.restore();
        } else zeichneKoffer(p.x, p.y, k, false);
      }

      // Wartende Mitreisende
      for (const m of menge) {
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.beginPath(); ctx.ellipse(m.x, m.y + 9, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.font = '20px serif'; ctx.textAlign = 'center';
        ctx.fillText(m.icon, m.x, m.y + 6 + Math.sin(zeit * 2 + m.x) * 1.2);
      }

      // Dein Männchen mit Reichweite-Ring und Zielmarke
      if (!gewonnen) {
        ctx.strokeStyle = 'rgba(42,157,143,0.4)'; ctx.lineWidth = 2;
        ctx.setLineDash([6, 7]);
        ctx.beginPath(); ctx.arc(du.x, du.y, 52, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        const huepf = Math.abs(Math.sin(du.schritt * 0.12)) * -3;
        ctx.save();
        ctx.translate(du.x, du.y + huepf);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath(); ctx.ellipse(0, 10 - huepf, 9, 3.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.scale(-du.blick, 1);
        ctx.font = '24px serif'; ctx.textAlign = 'center';
        ctx.fillText(laufZiel || tasten.l || tasten.r || tasten.o || tasten.u ? '🏃' : '🧍', 0, 8);
        ctx.restore();
        if (laufZiel) {
          ctx.strokeStyle = 'rgba(230,57,70,0.8)'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(laufZiel.x, laufZiel.y, 9 + Math.sin(zeit * 8) * 2, 0, Math.PI * 2); ctx.stroke();
        }
      } else {
        ctx.font = '24px serif'; ctx.textAlign = 'center';
        ctx.fillText('🙆', du.x, du.y + 8);
        gtaText(ctx, 'DEINER!', W / 2, H / 2 - 44, 34, '#3ddc97');
      }

      // Schwebende Kommentare
      for (let i = schweber.length - 1; i >= 0; i--) {
        const s = schweber[i];
        s.alter += dt;
        if (s.alter > 1) { schweber.splice(i, 1); continue; }
        ctx.globalAlpha = 1 - s.alter;
        gtaText(ctx, s.text, s.x, s.y - s.alter * 26, 13, '#ffd166');
        ctx.globalAlpha = 1;
      }

      if (blitz > 0) { blitz -= dt * 1000; ctx.fillStyle = 'rgba(230,57,70,0.2)'; ctx.fillRect(0, 0, W, H); }
      gtaText(ctx, '⏱ ' + Math.max(0, Math.ceil(40 - zeit)) + ' s', W - 10, 22, 12, '#fff', 'right');
      uhr.zeichnen();

      requestAnimationFrame(schleife);
    }
    requestAnimationFrame(schleife);
  }

  // ------------------------------- Minispiel: Straße überqueren (¡cuidado!)
  function starteStrassenSpiel(fertigCb) {
    const { canvas, ctx, W, H } = minispielFenster(
      '🚦 Erstmal über die Straße!',
      'Tippe (oder ↑), um einen Schritt zu gehen. Die Fahrweise hier ist … temperamentvoll. ¡Cuidado!', 420);

    const REIHEN = [372, 306, 246, 186, 126, 62];   // 0 = Start-Gehweg, 5 = Ziel
    const spuren = [
      { y: 306, richtung: 1, tempo: 105, autos: [], spawnIn: 400 },
      { y: 246, richtung: -1, tempo: 150, autos: [], spawnIn: 900 },
      { y: 186, richtung: 1, tempo: 195, autos: [], spawnIn: 200 },
      { y: 126, richtung: -1, tempo: 125, autos: [], spawnIn: 1200 },
    ];
    const FARBEN = ['#3a6ea5', '#d8d8d8', '#454754', '#c46a2b', '#7b5aa6', '#b03a2e'];
    let reihe = 0, schrecks = 0, blitz = 0, freundlich = false, vorbei = false, letzterSchritt = 0;
    let unverwundbar = 0;   // kurze Schonfrist nach einem Schreckmoment
    const uhr = minispielUhr(canvas, ctx, W, H,
      ['Tippe (oder ↑) für jeden Schritt', 'Weiche den Autos aus – ¡cuidado!']);

    function fertig(icon, text, effekte) {
      if (vorbei) return;
      vorbei = true; aufraeumen();
      minispielErgebnis(icon, text, effekte, null, fertigCb);
    }
    function schritt() {
      if (vorbei || performance.now() - letzterSchritt < 160) return;
      letzterSchritt = performance.now();
      reihe = Math.min(5, reihe + 1);
      piep(520, 50, 'square', 0.04);
      if (reihe === 5)
        fertig('🚶', schrecks === 0
          ? 'Rüber wie ein Einheimischer – im Rhythmus der Lücken, ohne eine Wimper zu zucken.'
          : 'Geschafft! Mit Herzklopfen, Hupkonzert und einem entschuldigenden Winken.',
          schrecks === 0 ? { stimmung: 4, erlebnis: 4, stress: -2 }
            : schrecks < 3 ? { stimmung: 2, stress: 2 } : { stimmung: 1, stress: 4 });
    }
    function tasteRunter(e) {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') { schritt(); e.preventDefault(); }
    }
    const zeigerRunter = e => { schritt(); e.preventDefault(); };
    document.addEventListener('keydown', tasteRunter);
    canvas.addEventListener('pointerdown', zeigerRunter);
    function aufraeumen() {
      uhr.aufraeumen();
      document.removeEventListener('keydown', tasteRunter);
      canvas.removeEventListener('pointerdown', zeigerRunter);
    }

    if (window.MINISPIEL_SCHNELL) setTimeout(() => fertig('🚶', 'Rüber!', { stimmung: 2 }), 700);

    function schleife(now) {
      if (vorbei) return;
      const t = uhr.tick(now);
      const dt = t.dt, zeit = t.zeit;

      for (const spur of spuren) {
        spur.spawnIn -= dt * 1000;
        if (spur.spawnIn <= 0 && !freundlich) {
          const moped = Math.random() < 0.22;
          spur.spawnIn = 700 + Math.random() * 1400;
          spur.autos.push({
            x: spur.richtung > 0 ? -60 : W + 60,
            tempo: (moped ? spur.tempo * 1.8 : spur.tempo * (0.85 + Math.random() * 0.4)),
            moped, farbe: FARBEN[Math.floor(Math.random() * FARBEN.length)],
          });
        }
        // Im Freundlich-Modus räumen die Autos zügig die Straße, statt einzufrieren
        for (const auto of spur.autos) auto.x += spur.richtung * auto.tempo * dt * (freundlich ? 3 : 1);
        spur.autos = spur.autos.filter(a => a.x > -90 && a.x < W + 90);
      }

      // Schreckmoment: Auto kreuzt deine Reihe (mit Schonfrist danach,
      // und die Autos in Fußgängernähe räumen die Kreuzungsspur)
      unverwundbar = Math.max(0, unverwundbar - dt);
      if (reihe >= 1 && reihe <= 4 && !freundlich && unverwundbar <= 0) {
        const spur = spuren[reihe - 1];
        for (const auto of spur.autos) {
          if (Math.abs(auto.x - W / 2) < 34) {
            schrecks++; blitz = 300; reihe = 0; unverwundbar = 1.4;
            brumm(70);
            for (const s2 of spuren)
              s2.autos = s2.autos.filter(a => Math.abs(a.x - W / 2) > 80);
            piep(300, 120, 'square', 0.12); setTimeout(() => piep(240, 200, 'square', 0.12), 110);
            if (schrecks >= 3) freundlich = true;
            break;
          }
        }
      }

      // Zeichnen (Promenaden-Foto als Kulisse hinter dem Café)
      ctx.fillStyle = '#e8e0cf'; ctx.fillRect(0, 0, W, H);          // Gehwege
      const fotoP = fotoLaden('promenade');
      if (fotoP) {
        fotoStreifen(ctx, fotoP, 0, 0, W, 92);
        ctx.fillStyle = 'rgba(245,240,230,0.3)'; ctx.fillRect(0, 0, W, 92);
      }
      ctx.fillStyle = '#54565e'; ctx.fillRect(0, 96, W, H - 96 - 78); // Fahrbahn
      ctx.strokeStyle = 'rgba(245,240,230,0.7)'; ctx.lineWidth = 2;
      ctx.setLineDash([14, 12]);
      for (const y of [156, 216, 276]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.setLineDash([]);
      // Zebrastreifen am Ziel? Nein – hier gibt es keinen. Deshalb das Spiel.
      for (const spur of spuren) {
        for (const auto of spur.autos) {
          if (auto.moped) {
            ctx.font = '22px serif'; ctx.textAlign = 'center';
            ctx.fillText(spur.richtung > 0 ? '🛵' : '🛵', auto.x, spur.y + 8);
          } else {
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath(); ctx.ellipse(auto.x, spur.y + 12, 26, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = auto.farbe;
            ctx.beginPath(); ctx.roundRect(auto.x - 26, spur.y - 10, 52, 22, 6); ctx.fill();
            ctx.fillStyle = 'rgba(210,230,240,0.9)';
            ctx.fillRect(auto.x - (spur.richtung > 0 ? 2 : 16), spur.y - 7, 18, 7);
            ctx.fillStyle = '#fff7cc';
            ctx.fillRect(spur.richtung > 0 ? auto.x + 22 : auto.x - 26, spur.y - 4, 4, 4);
          }
        }
      }
      if (freundlich)
        gtaText(ctx, '🙋 Ein Fahrer winkt dich rüber!', W / 2, 88, 14, '#3ddc97');
      ctx.font = '28px serif'; ctx.textAlign = 'center';
      if (unverwundbar <= 0 || Math.floor(zeit * 8) % 2 === 0)
        ctx.fillText('🚶', W / 2, REIHEN[reihe] + 10);
      gtaText(ctx, 'dein Café ☕', W / 2, 36, 13, '#ffd166');
      if (IST_TOUCH && reihe === 0 && zeit % 1.6 < 0.9)
        gtaText(ctx, '⬆ Tippen zum Loslaufen', W / 2, H - 14, 14, '#ffd166');
      if (blitz > 0) { blitz -= dt * 1000; ctx.fillStyle = 'rgba(230,57,70,0.22)'; ctx.fillRect(0, 0, W, H); }
      uhr.zeichnen();

      if (zeit > 45) { fertig('🚶', 'Irgendwann kam die eine große Lücke – rüber!', { stimmung: 1 }); return; }
      requestAnimationFrame(schleife);
    }
    requestAnimationFrame(schleife);
  }

  // -------------------------------- Minispiel: Saft balancieren (Zumo-Lauf)
  function starteSaftSpiel(fertigCb) {
    const { canvas, ctx, W, H } = minispielFenster(
      '🧃 Frischer Zumo – bring ihn heil zur Liege!',
      'Finger halten und ziehen: je weiter links/rechts, desto stärker hältst du dagegen (← → gehen auch). Barfuß auf heißen Fliesen – viel Erfolg.', 320);

    let theta = 0, omega = 0, input = 0, fortschritt = 0, inputZeiger = null;
    let boeIn = 600, vorbei = false;
    const uhr = minispielUhr(canvas, ctx, W, H,
      ['Halte links/rechts dagegen (← →)', 'Bring den Zumo heil zur Liege!']);

    function fertig(icon, text, effekte) {
      if (vorbei) return;
      vorbei = true; aufraeumen();
      minispielErgebnis(icon, text, effekte, null, fertigCb);
    }
    function tasteRunter(e) {
      if (e.key === 'ArrowLeft' || e.key === 'a') { input = -1; e.preventDefault(); }
      if (e.key === 'ArrowRight' || e.key === 'd') { input = 1; e.preventDefault(); }
    }
    function tasteHoch(e) { if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) input = 0; }
    // Neigungssensor: Handy kippen steuert das Glas (wo der Browser es erlaubt)
    let neigung = null, sensorGefragt = false;
    function orientierung(e) {
      if (e.gamma !== null && e.gamma !== undefined)
        neigung = Math.max(-1, Math.min(1, e.gamma / 20));
    }
    function sensorStarten() {
      if (sensorGefragt) return;
      sensorGefragt = true;
      try {
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
          DeviceOrientationEvent.requestPermission().then(erlaubt => {
            if (erlaubt === 'granted') window.addEventListener('deviceorientation', orientierung);
          }).catch(() => {});
        } else {
          window.addEventListener('deviceorientation', orientierung);
        }
      } catch (e) { /* kein Sensor – Finger reicht */ }
    }
    if (IST_TOUCH) sensorStarten();

    // Analoge Touch-Steuerung: Fingerposition = Gegenkraft (fein dosierbar)
    function analog(e) {
      const box = canvas.getBoundingClientRect();
      const x = (e.clientX - box.left) / box.width * W;
      input = Math.max(-1, Math.min(1, (x - W / 2) / (W * 0.3)));
    }
    function zeigerRunter(e) { sensorStarten(); analog(e); inputZeiger = e.pointerId; e.preventDefault(); }
    function zeigerZieh(e) {
      if (inputZeiger !== null && e.pointerId === inputZeiger) { analog(e); e.preventDefault(); }
    }
    const zeigerHoch = e => {
      if (inputZeiger === null || e.pointerId === inputZeiger) { input = 0; inputZeiger = null; }
    };
    document.addEventListener('keydown', tasteRunter);
    document.addEventListener('keyup', tasteHoch);
    canvas.addEventListener('pointerdown', zeigerRunter);
    canvas.addEventListener('pointermove', zeigerZieh);
    document.addEventListener('pointerup', zeigerHoch);
    function aufraeumen() {
      uhr.aufraeumen();
      document.removeEventListener('keydown', tasteRunter);
      document.removeEventListener('keyup', tasteHoch);
      canvas.removeEventListener('pointerdown', zeigerRunter);
      canvas.removeEventListener('pointermove', zeigerZieh);
      document.removeEventListener('pointerup', zeigerHoch);
      window.removeEventListener('deviceorientation', orientierung);
    }

    if (window.MINISPIEL_SCHNELL) setTimeout(() => fertig('🧃', 'Angekommen!', { stimmung: 2 }), 700);

    function schleife(now) {
      if (vorbei) return;
      const dt = uhr.tick(now).dt;

      // Instabiles Gleichgewicht plus Windböen und Gegensteuern
      boeIn -= dt * 1000;
      if (boeIn <= 0) {
        boeIn = 500 + Math.random() * 900;
        omega += (Math.random() - 0.5) * (2.2 + fortschritt * 2.2);
      }
      const steuerung = inputZeiger !== null || input !== 0 ? input : (neigung !== null ? neigung : 0);
      omega += theta * 2.4 * dt + steuerung * -3.4 * dt * -1;
      omega *= 1 - 0.6 * dt;
      theta += omega * dt;
      fortschritt = Math.min(1, fortschritt + dt / 9);

      if (Math.abs(theta) > 0.55) {
        brumm(60);
        fertig('💦', 'Platsch – der halbe Zumo ziert jetzt Fliesen und Badelatschen. Der Barmann grinst: „¡Otra vez!“',
          { stimmung: -1, stress: 1 });
        return;
      }
      if (fortschritt >= 1) {
        fertig('🧃', 'Kein Tropfen verschüttet! Du stellst das Glas ab wie ein Kellner mit dreißig Jahren Berufserfahrung.',
          { stimmung: 3, erholung: 2, stress: -2 });
        return;
      }

      // Zeichnen: Pool-Szene mit echter Foto-Kulisse
      const fotoZ = fotoLaden('playa-americas');
      if (fotoZ) {
        fotoStreifen(ctx, fotoZ, 0, 0, W, 140);
        ctx.fillStyle = 'rgba(225,244,255,0.15)'; ctx.fillRect(0, 0, W, 140);
      } else {
        const himmel = ctx.createLinearGradient(0, 0, 0, 140);
        himmel.addColorStop(0, '#4ea8de'); himmel.addColorStop(1, '#bde6f5');
        ctx.fillStyle = himmel; ctx.fillRect(0, 0, W, 140);
      }
      ctx.font = '30px serif'; ctx.textAlign = 'center';
      const scroll = fortschritt * 400;
      ctx.fillText('🌴', (620 - scroll) % (W + 80) - 40, 120);
      ctx.fillText('⛱️', (900 - scroll) % (W + 80) - 40, 126);
      ctx.fillStyle = '#7ecbe8'; ctx.fillRect(0, 140, W, 60);
      ctx.fillStyle = '#e8dbc0'; ctx.fillRect(0, 200, W, H - 200);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
      for (let x = -(scroll % 42); x < W; x += 42) {
        ctx.beginPath(); ctx.moveTo(x, 200); ctx.lineTo(x, H); ctx.stroke();
      }
      // Ziel-Liege rückt näher
      ctx.font = Math.round(22 + fortschritt * 26) + 'px serif';
      ctx.fillText('🛋️', W - 50 - fortschritt * 30, 232 + fortschritt * 20);

      // Fortschrittsbalken
      ctx.fillStyle = 'rgba(43,45,66,0.7)'; ctx.fillRect(0, 0, W, 22);
      ctx.fillStyle = '#f5f0e6'; ctx.fillRect(60, 8, W - 120, 6);
      ctx.fillStyle = '#f4a261'; ctx.fillRect(60, 8, (W - 120) * fortschritt, 6);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left'; ctx.fillText('🍹', 40, 16);
      ctx.textAlign = 'right'; ctx.fillText('🛋️', W - 40, 16);

      // Hand mit Glas
      ctx.save();
      ctx.translate(W / 2, 258);
      ctx.rotate(theta);
      ctx.fillStyle = '#e8b88a';
      ctx.beginPath(); ctx.ellipse(0, 26, 20, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(-22, -46); ctx.lineTo(22, -46); ctx.lineTo(16, 18); ctx.lineTo(-16, 18);
      ctx.closePath(); ctx.fill();
      // Saft mit schwappender Oberfläche
      const schwapp = Math.max(-14, Math.min(14, omega * 18));
      ctx.fillStyle = 'rgba(244,162,97,0.92)';
      ctx.beginPath();
      ctx.moveTo(-20, -26 + schwapp); ctx.lineTo(20, -26 - schwapp);
      ctx.lineTo(16, 18); ctx.lineTo(-16, 18);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-22, -46); ctx.lineTo(22, -46); ctx.lineTo(16, 18); ctx.lineTo(-16, 18);
      ctx.closePath(); ctx.stroke();
      ctx.font = '15px serif'; ctx.textAlign = 'center';
      ctx.fillText('🍓', 14, -44);
      ctx.restore();

      // Kipp-Anzeige
      ctx.fillStyle = Math.abs(theta) > 0.4 ? '#e63946' : '#2a9d8f';
      ctx.beginPath();
      ctx.arc(W / 2 + theta * 180, H - 64, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(43,45,66,0.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(W / 2 - 110, H - 64); ctx.lineTo(W / 2 + 110, H - 64); ctx.stroke();

      zeichneTouchPfeile(ctx, W, H, input);
      uhr.zeichnen();
      requestAnimationFrame(schleife);
    }
    requestAnimationFrame(schleife);
  }

  // --------------------------- Minispiel: Spontaner spanischer Tanzabend
  // Rhythmusspiel: Pfeile fallen im Takt der Band – triff sie an der Linie.
  function starteTanzSpiel(fertigCb) {
    const { canvas, ctx, W, H } = minispielFenster(
      '💃 ¡Fiesta! Spontaner Tanzabend auf der Plaza',
      'Eine Band spielt Rumba – die Runde zieht dich auf die Tanzfläche! Triff die Pfeile, wenn sie ' +
      'die Linie erreichen: Pfeiltasten oder Spalte antippen.', 420);

    const SPALTEN = [
      { key: 'ArrowLeft', alt: 'a', symbol: '←', x: W / 2 - 108, farbe: '#e63946' },
      { key: 'ArrowUp', alt: 'w', symbol: '↑', x: W / 2 - 36, farbe: '#f4a261' },
      { key: 'ArrowDown', alt: 's', symbol: '↓', x: W / 2 + 36, farbe: '#2a9d8f' },
      { key: 'ArrowRight', alt: 'd', symbol: '→', x: W / 2 + 108, farbe: '#7b5aa6' },
    ];
    const LINIE_Y = H - 86, TAKT = 560, FALLZEIT = 1900;
    const noten = [];
    {
      let beat = 5;
      for (let i = 0; i < 22; i++) {
        noten.push({ spalte: Math.floor(Math.random() * 4), zeit: beat * TAKT });
        beat += Math.random() < 0.3 ? 2 : 1;
      }
    }
    let perfekt = 0, gut = 0, daneben = 0, letzterBeat = -1;
    let feedback = null, vorbei = false;
    const uhr = minispielUhr(canvas, ctx, W, H,
      ['Triff die Pfeile, wenn sie', 'die Linie erreichen – im Takt!']);

    function fertig(icon, text, effekte, extra) {
      if (vorbei) return;
      vorbei = true; aufraeumen();
      minispielErgebnis(icon, text, effekte, extra, fertigCb);
    }
    function schlag(spalte) {
      if (vorbei) return;
      const jetzt = uhr.zeit * 1000;
      let beste = null, besteDiff = 1e9;
      for (const n of noten) {
        if (n.weg || n.spalte !== spalte) continue;
        const diff = Math.abs(n.zeit - jetzt);
        if (diff < besteDiff) { besteDiff = diff; beste = n; }
      }
      if (beste && besteDiff < 250) {
        beste.weg = true;
        if (besteDiff < 110) { perfekt++; feedback = { text: '¡Perfecto!', farbe: '#ffd166', alter: 0 }; piep(880, 90, 'triangle', 0.08); }
        else { gut++; feedback = { text: '¡Bien!', farbe: '#9fe3c0', alter: 0 }; piep(660, 80, 'triangle', 0.06); }
      } else {
        daneben++;
        feedback = { text: 'Uups …', farbe: '#f2a0a0', alter: 0 };
        piep(170, 130, 'sawtooth', 0.07);
      }
    }
    function tasteRunter(e) {
      const i = SPALTEN.findIndex(s => s.key === e.key || s.alt === e.key);
      if (i >= 0) { schlag(i); e.preventDefault(); }
    }
    function zeigerRunter(e) {
      const box = canvas.getBoundingClientRect();
      const x = (e.clientX - box.left) / box.width * W;
      schlag(Math.max(0, Math.min(3, Math.floor((x - W / 2 + 144) / 72))));
      e.preventDefault();
    }
    document.addEventListener('keydown', tasteRunter);
    canvas.addEventListener('pointerdown', zeigerRunter);
    function aufraeumen() {
      uhr.aufraeumen();
      document.removeEventListener('keydown', tasteRunter);
      canvas.removeEventListener('pointerdown', zeigerRunter);
    }

    if (window.MINISPIEL_SCHNELL)
      setTimeout(() => fertig('💃', 'Was für ein Abend!', { stimmung: 4, stress: -2 }), 700);

    function schleife(now) {
      if (vorbei) return;
      const t = uhr.tick(now);
      const dt = t.dt, jetzt = t.zeit * 1000;

      // Percussion im Takt (Klatschen + Bass)
      const beat = Math.floor(jetzt / TAKT);
      if (beat > letzterBeat) {
        letzterBeat = beat;
        piep(beat % 4 === 0 ? 200 : 150, 70, 'triangle', 0.05);
        if (beat % 2 === 1) piep(1200, 30, 'square', 0.02);
      }
      const puls = 1 + 0.06 * Math.max(0, 1 - (jetzt % TAKT) / 180);

      // Verpasste Noten
      for (const n of noten) {
        if (!n.weg && jetzt - n.zeit > 250) {
          n.weg = true; daneben++;
          feedback = { text: '¡Ay!', farbe: '#f2a0a0', alter: 0 };
        }
      }

      // ————— Abendliche Plaza —————
      const nacht = ctx.createLinearGradient(0, 0, 0, H);
      nacht.addColorStop(0, '#1c2541'); nacht.addColorStop(0.55, '#3a506b'); nacht.addColorStop(1, '#5b4a68');
      ctx.fillStyle = nacht; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f5f0e6';
      ctx.beginPath(); ctx.arc(W - 50, 46, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = nacht; ctx.beginPath(); ctx.arc(W - 56, 42, 11, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + (i * 37 % 10) / 18) + ')';
        ctx.fillRect((i * 61 + 17) % W, (i * 43 + 11) % 90, 1.6, 1.6);
      }
      // Lichterkette
      ctx.strokeStyle = 'rgba(255,220,150,0.35)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(0, 96);
      ctx.quadraticCurveTo(W / 2, 130, W, 96); ctx.stroke();
      for (let i = 1; i < 10; i++) {
        const t = i / 10, lx = t * W, ly = 96 + Math.sin(Math.PI * t) * 25;
        ctx.fillStyle = i % 2 ? '#ffd166' : '#f4a261';
        ctx.beginPath(); ctx.arc(lx, ly + 4, 2.6 * puls, 0, Math.PI * 2); ctx.fill();
      }
      // Tanzende Menge & Band
      ctx.font = Math.round(20 * puls) + 'px serif'; ctx.textAlign = 'center';
      ctx.fillText('💃', 30, 156); ctx.fillText('🕺', W - 28, 152);
      ctx.fillText('🕺', 56, 148); ctx.fillText('💃', W - 58, 158);
      ctx.font = '16px serif';
      ctx.fillText('🎸', 24, 118); ctx.fillText('🥁', W - 24, 118);

      // Tanzfläche mit Spalten
      ctx.fillStyle = 'rgba(43,45,66,0.4)';
      ctx.fillRect(W / 2 - 144, 130, 288, H - 150);
      for (const s of SPALTEN) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(s.x - 30, 130, 60, H - 150);
      }
      // Ziel-Linie & Kreise
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(W / 2 - 140, LINIE_Y); ctx.lineTo(W / 2 + 140, LINIE_Y); ctx.stroke();
      for (const s of SPALTEN) {
        ctx.strokeStyle = s.farbe; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(s.x, LINIE_Y, 22 * puls, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(s.symbol, s.x, LINIE_Y + 7);
      }
      // Fallende Noten
      for (const n of noten) {
        if (n.weg) continue;
        const y = LINIE_Y - (n.zeit - jetzt) / FALLZEIT * (LINIE_Y - 120);
        if (y < 120 || y > H - 30) continue;
        const s = SPALTEN[n.spalte];
        ctx.fillStyle = s.farbe;
        ctx.beginPath(); ctx.arc(s.x, y, 19, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif';
        ctx.fillText(s.symbol, s.x, y + 6);
      }
      // Feedback & Zähler
      if (feedback) {
        feedback.alter += dt;
        if (feedback.alter > 0.8) feedback = null;
        else {
          ctx.globalAlpha = 1 - feedback.alter / 0.8;
          gtaText(ctx, feedback.text, W / 2, 200 - feedback.alter * 40, 28, feedback.farbe);
          ctx.globalAlpha = 1;
        }
      }
      ctx.fillStyle = 'rgba(43,45,66,0.72)'; ctx.fillRect(0, 0, W, 24);
      gtaText(ctx, '✨ ' + perfekt + ' · 👍 ' + gut + ' · 😅 ' + daneben, 8, 17, 11, '#ffd166', 'left');
      gtaText(ctx, noten.filter(n => !n.weg).length + ' Schritte übrig', W - 8, 17, 11, '#fff', 'right');

      uhr.zeichnen();

      // Vorbei?
      const letzteNote = noten[noten.length - 1];
      if (jetzt > letzteNote.zeit + 900) {
        const quote = (perfekt + gut) / noten.length;
        if (quote >= 0.85)
          fertig('💃', 'Die Runde klatscht im Takt, jemand ruft „¡Olé!“ – du tanzt, als wärst du auf der Insel geboren. Ein Abend, den du nie vergisst.',
            { stimmung: 10, erlebnis: 12, stress: -6 }, ['✨ Perfekt: ' + perfekt]);
        else if (quote >= 0.5)
          fertig('🕺', 'Ein paar Drehungen sitzen, ein paar gehen daneben – aber die Band nickt dir anerkennend zu.',
            { stimmung: 6, erlebnis: 8, stress: -3 }, ['✨ Perfekt: ' + perfekt]);
        else
          fertig('😅', 'Deine Füße machen nicht alles mit, aber dein Grinsen stimmt. Die Señora neben dir tanzt einfach für euch beide.',
            { stimmung: 3, erlebnis: 5 });
        return;
      }
      requestAnimationFrame(schleife);
    }
    requestAnimationFrame(schleife);
  }

  // ------------------------------- Minispiel: Bar-Flirt (nur Single-Urlaub)
  // Der Moment muss stimmen: Stoße genau dann an, wenn das Herz am größten ist.
  function starteFlirtSpiel(fertigCb) {
    const { canvas, ctx, W, H } = minispielFenster(
      '💘 Ein Blick durch die Bar …',
      'Jemand am Tresen lächelt herüber! Tippe (oder Leertaste), wenn das Herz <strong>am größten</strong> ist – ' +
      'drei gute Momente, und der Abend gehört euch.', 380);
    const uhr = minispielUhr(canvas, ctx, W, H, ['Tippe genau dann,', 'wenn das Herz am GRÖSSTEN ist!']);
    let runde = 0, punkte = 0, feedback = null, vorbei = false, endeIn = -1, cooldown = 0;

    function fertig(icon, text, effekte, extra) {
      if (vorbei) return;
      vorbei = true; aufraeumen();
      minispielErgebnis(icon, text, effekte, extra, fertigCb);
    }
    const puls = () => (Math.sin(uhr.zeit * 2.7) + 1) / 2;
    function schlag() {
      if (vorbei || cooldown > 0 || endeIn > 0 || uhr.pausiert) return;
      const p = puls();
      cooldown = 0.7; runde++;
      if (p > 0.86) { punkte += 2; feedback = { text: '¡Perfecto!', farbe: '#3ddc97', alter: 0 }; piep(880, 130, 'triangle', 0.08); brumm(30); }
      else if (p > 0.6) { punkte += 1; feedback = { text: 'Charmant!', farbe: '#ffd166', alter: 0 }; piep(620, 100, 'triangle', 0.06); }
      else { feedback = { text: 'Zu hektisch!', farbe: '#ff5b6a', alter: 0 }; piep(200, 160, 'sawtooth', 0.07); brumm(40); }
      if (runde >= 3) endeIn = 1.0;
    }
    const zeigerRunter = e => { schlag(); e.preventDefault(); };
    function tasteRunter(e) { if (e.key === ' ' || e.key === 'Enter') { schlag(); e.preventDefault(); } }
    canvas.addEventListener('pointerdown', zeigerRunter);
    document.addEventListener('keydown', tasteRunter);
    function aufraeumen() {
      uhr.aufraeumen();
      canvas.removeEventListener('pointerdown', zeigerRunter);
      document.removeEventListener('keydown', tasteRunter);
    }
    if (window.MINISPIEL_SCHNELL) setTimeout(() => fertig('💘', 'Was für ein Abend!', { stimmung: 4 }), 700);

    function schleife(now) {
      if (vorbei) return;
      const t = uhr.tick(now);
      const dt = t.dt;
      cooldown = Math.max(0, cooldown - dt);
      if (endeIn > 0) {
        endeIn -= dt;
        if (endeIn <= 0) {
          if (punkte >= 5)
            fertig('💘', 'Ihr redet, bis die Bar die Stühle hochstellt – und tauscht Nummern. Der Urlaub hat gerade ein Kapitel dazubekommen.',
              { stimmung: 10, erlebnis: 10, stress: -5 }, ['💘 Voll verzaubert']);
          else if (punkte >= 3)
            fertig('🍹', 'Ein charmantes Gespräch, zwei Mojitos und ein Lächeln zum Abschied. Läuft.',
              { stimmung: 6, erlebnis: 6, stress: -3 });
          else
            fertig('😅', 'Der Funke springt heute nicht über – aber der Mojito war ausgezeichnet.',
              { stimmung: 2, erlebnis: 3 });
          return;
        }
      }

      // Bar-Szene bei Nacht
      const bar = ctx.createLinearGradient(0, 0, 0, H);
      bar.addColorStop(0, '#1c1030'); bar.addColorStop(1, '#3a1f47');
      ctx.fillStyle = bar; ctx.fillRect(0, 0, W, H);
      gtaText(ctx, '🍹 LA BARRACA', W / 2, 52, 20, '#ff7bd5');
      ctx.fillStyle = 'rgba(255,123,213,0.15)';
      ctx.beginPath(); ctx.ellipse(W / 2, 52, 110, 22, 0, 0, Math.PI * 2); ctx.fill();
      // Tresen
      ctx.fillStyle = '#5a3a28'; ctx.fillRect(30, 250, W - 60, 22);
      ctx.fillStyle = '#40291c'; ctx.fillRect(30, 272, W - 60, 60);
      ctx.font = '30px serif'; ctx.textAlign = 'center';
      ctx.fillText('🙂', 74, 246);
      ctx.fillText('😊', W - 74, 246);
      ctx.font = '16px serif';
      ctx.fillText('🍸', 116, 248); ctx.fillText('🍹', W - 116, 248);
      // Das pulsierende Herz mit Zielring
      const p = puls();
      const gr = 20 + p * 46;
      ctx.strokeStyle = 'rgba(61,220,151,0.65)'; ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 6]);
      ctx.beginPath(); ctx.arc(W / 2, 168, 66, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = Math.round(gr * 2) + 'px serif';
      ctx.fillText('❤️', W / 2, 168 + gr * 0.7);
      if (feedback) {
        feedback.alter += dt;
        if (feedback.alter > 0.8) feedback = null;
        else {
          ctx.globalAlpha = 1 - feedback.alter / 0.8;
          gtaText(ctx, feedback.text, W / 2, 110 - feedback.alter * 26, 24, feedback.farbe);
          ctx.globalAlpha = 1;
        }
      }
      ctx.fillStyle = 'rgba(43,45,66,0.72)'; ctx.fillRect(0, 0, W, 24);
      gtaText(ctx, 'Momente: ' + runde + '/3', 8, 17, 11, '#fff', 'left');
      gtaText(ctx, '♥ ' + punkte, W - 8, 17, 11, '#ff7bd5', 'right');
      uhr.zeichnen();
      requestAnimationFrame(schleife);
    }
    requestAnimationFrame(schleife);
  }

  // ----------------------------------- Minispiel: Farkle gegen Karl (Würfel)
  // Klassisches Würfelspiel: Einsen & Fünfen zählen, Drillinge bringen mehr.
  // Wer nach 3 Runden vorne liegt, gewinnt den Spieleabend.
  function starteFarkleSpiel(fertigCb) {
    const { canvas, ctx, W, H } = minispielFenster(
      '🎲 Spieleabend: Farkle gegen Karl',
      '<strong>1</strong> = 100 · <strong>5</strong> = 50 · Drilling = Augenzahl × 100 (drei Einsen: 1000). ' +
      'Wirfst du zu einem <strong>gesicherten Drilling dieselbe Zahl nach, verdoppelt</strong> sich sein Wert. ' +
      'Straße 1–6 = 2500 · drei Paare = 1500 · zwei Drillinge = 2500.<br>' +
      'Würfel antippen (oder Tasten 1–6) zum Behalten, dann weiterwürfeln oder sichern. ' +
      'Kein Treffer im Wurf = <strong>Farkle</strong>, Zugpunkte weg!', 340);

    const RUNDEN = 3;
    let runde = 1, duPunkte = 0, karlPunkte = 0;
    let feld = [], abgelegt = [], turnPunkte = 0;
    let phase = 'start';   // start | wahl | karl | ende
    let meldung = 'Dein Zug, Runde 1 – wirf die Würfel!';
    let vorbei = false;
    const timer = [];

    const buttons = $('#fahrt-buttons');
    const rollBtn = el('button', 'btn btn-primary', '🎲 Würfeln');
    const bankBtn = el('button', 'btn', '💰 Punkte sichern');
    buttons.appendChild(rollBtn); buttons.appendChild(bankBtn);

    function logZeile(icon, text) {
      $('#fahrt-log').appendChild(el('div', 'flug-zeile sichtbar',
        `<span class="flug-zeile-icon">${icon}</span><div>${esc(text)}</div>`));
    }
    function fertig(icon, text, effekte, extra) {
      if (vorbei) return;
      vorbei = true; aufraeumen();
      buttons.innerHTML = '';
      minispielErgebnis(icon, text, effekte, extra, fertigCb);
    }
    function aufraeumen() {
      timer.forEach(clearTimeout);
      canvas.removeEventListener('pointerdown', klick);
      document.removeEventListener('keydown', tasteRunter);
    }
    function wuerfelWaehlen(w) {
      const komboWurf = feld.length === 6 && abgelegt.length === 0;   // Straße/Paare möglich
      if (!w.gewaehlt && !istWaehlbar(w.wert) && !komboWurf) { piep(180, 90, 'sawtooth', 0.05); return; }
      w.gewaehlt = !w.gewaehlt;
      piep(w.gewaehlt ? 520 : 320, 50, 'triangle', 0.05);
      malen();
    }
    function tasteRunter(e) {
      const idx = ['1', '2', '3', '4', '5', '6'].indexOf(e.key);
      if (idx < 0 || vorbei || phase !== 'wahl' || !feld[idx]) return;
      wuerfelWaehlen(feld[idx]);
      e.preventDefault();
    }
    document.addEventListener('keydown', tasteRunter);

    // Auswahl bewerten: Einsen/Fünfen einzeln, Drillinge komplett
    function auswahlWertung() {
      const zaehl = {};
      for (const w of feld) if (w.gewaehlt) zaehl[w.wert] = (zaehl[w.wert] || 0) + 1;
      // Original-Kombos mit allen sechs Würfeln des ersten Wurfs
      const gewaehlt = feld.filter(w => w.gewaehlt);
      if (gewaehlt.length === 6 && abgelegt.length === 0) {
        const folge = gewaehlt.map(w => w.wert).sort().join('');
        const mengen = Object.values(zaehl).sort().join('');
        if (folge === '123456') return { punkte: 2500, gueltig: true };
        if (mengen === '33') return { punkte: 2500, gueltig: true };
        if (mengen === '222') return { punkte: 1500, gueltig: true };
      }
      let punkte = 0, gueltig = false;
      for (const [f, c] of Object.entries(zaehl)) {
        const wert = +f;
        const basis = wert === 1 ? 1000 : wert * 100;
        const schon = abgelegt.filter(v => v === wert).length;
        gueltig = true;
        if (schon >= 3) {
          // Nachwurf auf gesicherten Drilling: jede weitere gleiche Zahl VERDOPPELT
          punkte += basis * Math.pow(2, schon + c - 3) - basis * Math.pow(2, schon - 3);
        } else if (c >= 3) {
          // Drilling – jede weitere gleiche Zahl im selben Wurf verdoppelt ebenfalls
          punkte += basis * Math.pow(2, c - 3);
        } else if (wert === 1) punkte += c * 100;
        else if (wert === 5) punkte += c * 50;
        else return { punkte: 0, gueltig: false };
      }
      return { punkte, gueltig: gueltig && punkte > 0 };
    }
    function istWaehlbar(wert) {
      if (wert === 1 || wert === 5) return true;
      if (feld.filter(w => w.wert === wert).length >= 3) return true;
      return abgelegt.filter(v => v === wert).length >= 3;   // Nachwurf zählt!
    }
    function hatZug() {
      if (feld.length === 6) {
        const folge = feld.map(w => w.wert).sort().join('');
        const z = {};
        for (const w of feld) z[w.wert] = (z[w.wert] || 0) + 1;
        const mengen = Object.values(z).sort().join('');
        if (folge === '123456' || mengen === '33' || mengen === '222') return true;
      }
      return feld.some(w => istWaehlbar(w.wert));
    }

    function werfen(anzahl) {
      feld = Array.from({ length: anzahl }, () => ({ wert: 1 + Math.floor(Math.random() * 6), gewaehlt: false }));
      piep(320, 60, 'triangle', 0.06);
      setTimeout(() => piep(260, 50, 'triangle', 0.05), 80);
      if (!hatZug()) {
        // Farkle! Zugpunkte futsch – auch die abgelegten Würfel sind dahin
        turnPunkte = 0;
        abgelegt = [];
        phase = 'karl';
        meldung = '💥 Farkle! Kein Wurf zählt – deine Zugpunkte sind weg.';
        piep(140, 300, 'sawtooth', 0.1);
        malen();
        timer.push(setTimeout(karlZug, 1600));
        return;
      }
      phase = 'wahl';
      meldung = 'Tippe Würfel an, die du behalten willst.';
      malen();
    }

    rollBtn.addEventListener('click', () => {
      if (vorbei) return;
      if (phase === 'start') { abgelegt = []; werfen(6); return; }
      if (phase !== 'wahl') return;
      const a = auswahlWertung();
      if (!a.gueltig) return;
      turnPunkte += a.punkte;
      // Gewählte Würfel bleiben sichtbar liegen – sie sind für den Zug gesichert
      for (const w of feld) if (w.gewaehlt) abgelegt.push(w.wert);
      const rest = 6 - abgelegt.length;
      if (rest <= 0) abgelegt = [];             // „Hot Dice“: alle sechs neu!
      werfen(rest <= 0 ? 6 : rest);
    });
    bankBtn.addEventListener('click', () => {
      if (vorbei || phase !== 'wahl') return;
      const a = auswahlWertung();
      if (!a.gueltig) return;
      turnPunkte += a.punkte;
      duPunkte += turnPunkte;
      logZeile('🙂', `Du sicherst ${turnPunkte} Punkte (gesamt ${duPunkte}).`);
      piep(660, 140, 'triangle', 0.08);
      turnPunkte = 0; abgelegt = []; feld = [];
      phase = 'karl';
      meldung = 'Karl schüttelt den Würfelbecher …';
      malen();
      timer.push(setTimeout(karlZug, 1400));
    });

    function karlZug() {
      if (vorbei) return;
      // Karl spielt solide: sichern ab 300, weiterwürfeln nur mit ≥3 Würfeln
      let punkte = 0, frei = 6, farkle = false;
      for (let sicher = 0; sicher < 20; sicher++) {
        const zaehl = [0, 0, 0, 0, 0, 0, 0];
        for (let i = 0; i < frei; i++) zaehl[1 + Math.floor(Math.random() * 6)]++;
        let wurfPunkte = 0, genutzt = 0;
        for (let f = 1; f <= 6; f++) {
          if (zaehl[f] >= 3) {
            wurfPunkte += f === 1 ? 1000 : f * 100;
            genutzt += 3; zaehl[f] -= 3;
          }
        }
        wurfPunkte += zaehl[1] * 100 + zaehl[5] * 50;
        genutzt += zaehl[1] + zaehl[5];
        if (wurfPunkte === 0) { farkle = true; punkte = 0; break; }
        punkte += wurfPunkte; frei -= genutzt;
        if (frei <= 0) frei = 6;
        if (punkte >= 300 || frei <= 2) break;
      }
      karlPunkte += punkte;
      logZeile(farkle ? '💥' : '🧔', farkle
        ? 'Karl übertreibt es – Farkle! Null Punkte für ihn.'
        : `Karl sichert ${punkte} Punkte (gesamt ${karlPunkte}).`);
      if (runde >= RUNDEN) {
        phase = 'ende';
        malen();
        timer.push(setTimeout(() => {
          if (duPunkte > karlPunkte && duPunkte >= 800)
            fertig('🏆', `${duPunkte}:${karlPunkte} – Karl starrt fassungslos auf den Becher und gibt dir eine Runde Barraquitos aus. „Revanche. Morgen!“`,
              { stimmung: 8, erlebnis: 8, stress: -6 }, ['🎲 ' + duPunkte + ' Punkte']);
          else if (duPunkte > karlPunkte)
            fertig('🎲', `${duPunkte}:${karlPunkte} – knapper Sieg! Karl notiert das Ergebnis in einem kleinen Buch. Er führt Buch. Natürlich führt er Buch.`,
              { stimmung: 6, erlebnis: 6, stress: -4 }, ['🎲 ' + duPunkte + ' Punkte']);
          else if (duPunkte === karlPunkte)
            fertig('🤝', `${duPunkte}:${karlPunkte} – Unentschieden! Ihr einigt euch auf ein Rückspiel bei Sonnenuntergang.`,
              { stimmung: 4, erlebnis: 5, stress: -3 });
          else
            fertig('🧔', `${duPunkte}:${karlPunkte} – Karl gewinnt und poliert unsichtbare Pokale. Der Abend war trotzdem herrlich.`,
              { stimmung: 3, erlebnis: 4, stress: -2 });
        }, 1200));
        return;
      }
      runde++;
      phase = 'start';
      meldung = `Dein Zug, Runde ${runde} – wirf die Würfel!`;
      malen();
    }

    function klick(e) {
      if (vorbei || phase !== 'wahl') return;
      const box = canvas.getBoundingClientRect();
      const mx = (e.clientX - box.left) / box.width * W;
      const my = (e.clientY - box.top) / box.height * H;
      for (const w of feld) {
        if (Math.abs(mx - w.x) < 24 && Math.abs(my - w.y) < 24) { wuerfelWaehlen(w); return; }
      }
    }
    canvas.addEventListener('pointerdown', klick);

    function malWuerfel(x, y, gr, wert, gewaehlt, waehlbar) {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.roundRect(-gr / 2 + 2, -gr / 2 + 3, gr, gr, 8); ctx.fill();
      const flaeche = ctx.createLinearGradient(-gr / 2, -gr / 2, gr / 2, gr / 2);
      flaeche.addColorStop(0, gewaehlt ? '#fff6dd' : '#ffffff');
      flaeche.addColorStop(1, gewaehlt ? '#f5dfa8' : '#dfe3e8');
      ctx.fillStyle = flaeche;
      ctx.beginPath(); ctx.roundRect(-gr / 2, -gr / 2, gr, gr, 8); ctx.fill();
      ctx.strokeStyle = gewaehlt ? '#f4a261' : waehlbar ? 'rgba(42,157,143,0.8)' : 'rgba(43,45,66,0.25)';
      ctx.lineWidth = gewaehlt ? 3 : 2;
      ctx.beginPath(); ctx.roundRect(-gr / 2, -gr / 2, gr, gr, 8); ctx.stroke();
      ctx.fillStyle = '#2b2d42';
      const p = gr * 0.22;
      const punkt = (px2, py2) => { ctx.beginPath(); ctx.arc(px2, py2, gr * 0.09, 0, Math.PI * 2); ctx.fill(); };
      if (wert % 2 === 1) punkt(0, 0);
      if (wert >= 2) { punkt(-p, -p); punkt(p, p); }
      if (wert >= 4) { punkt(p, -p); punkt(-p, p); }
      if (wert === 6) { punkt(-p, 0); punkt(p, 0); }
      ctx.restore();
    }

    function malen() {
      // Hotelbar am Abend: warmes Licht, grüner Filz
      const bar = ctx.createLinearGradient(0, 0, 0, H);
      bar.addColorStop(0, '#4a3427'); bar.addColorStop(1, '#241a14');
      ctx.fillStyle = bar; ctx.fillRect(0, 0, W, H);
      const schein = ctx.createRadialGradient(W / 2, 60, 10, W / 2, 60, 200);
      schein.addColorStop(0, 'rgba(255,214,140,0.22)'); schein.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = schein; ctx.fillRect(0, 0, W, H);
      ctx.font = '15px serif'; ctx.textAlign = 'left';
      ctx.fillText('🍹', 10, 26); ctx.fillText('🕯️', W - 26, 26);
      ctx.fillStyle = '#1e4d36';
      ctx.beginPath(); ctx.roundRect(12, 78, W - 24, H - 130, 16); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(12, 78, W - 24, H - 130, 16); ctx.stroke();

      // Punktetafel
      ctx.fillStyle = 'rgba(43,45,66,0.75)'; ctx.fillRect(0, 40, W, 28);
      gtaText(ctx, 'Du: ' + duPunkte, 12, 61, 14, '#ffd166', 'left');
      gtaText(ctx, 'Karl: ' + karlPunkte, W - 12, 61, 14, '#59c2ff', 'right');
      gtaText(ctx, 'Runde ' + Math.min(runde, RUNDEN) + '/' + RUNDEN, W / 2, 61, 13, '#fff');

      // Würfel im Feld
      const gr = 44, abstand = 52;
      const startX = W / 2 - ((feld.length - 1) * abstand) / 2;
      feld.forEach((w, i) => {
        w.x = startX + i * abstand;
        w.y = w.gewaehlt ? 128 : 182;
        malWuerfel(w.x, w.y, gr, w.wert, w.gewaehlt, istWaehlbar(w.wert));
      });
      if (abgelegt.length) {
        // Gesicherte Würfel des Zugs bleiben sichtbar liegen (goldener Rand)
        gtaText(ctx, 'gesichert:', 24, 99, 10, '#ffd166', 'left');
        abgelegt.forEach((wert, i) => malWuerfel(96 + i * 30, 95, 24, wert, true, false));
      }

      // Zug-Punkte & Auswahl
      const a = phase === 'wahl' ? auswahlWertung() : { punkte: 0, gueltig: false };
      gtaText(ctx, 'Zug-Punkte: ' + turnPunkte + (a.punkte ? ' + ' + a.punkte : ''), W / 2, 238, 16,
        a.punkte ? '#3ddc97' : '#ffd166');
      gtaText(ctx, meldung, W / 2, 263, 12, meldung.includes('Farkle') ? '#ff5b6a' : '#fff');
      if (phase === 'wahl' && !a.gueltig) {
        ctx.fillStyle = 'rgba(245,240,230,0.65)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Wähle mindestens eine 1, 5 oder einen Drilling.', W / 2, 282);
      }

      rollBtn.disabled = !(phase === 'start' || (phase === 'wahl' && a.gueltig));
      bankBtn.disabled = !(phase === 'wahl' && a.gueltig);
      rollBtn.textContent = phase === 'start' ? '🎲 Würfeln' : '🎲 Weiterwürfeln';
      bankBtn.textContent = '💰 ' + (turnPunkte + a.punkte) + ' Punkte sichern';
    }

    if (window.MINISPIEL_SCHNELL)
      timer.push(setTimeout(() => fertig('🎲', 'Ein schneller Spieleabend!', { stimmung: 4, stress: -3 }), 700));

    malen();
  }

  // ----------------------------------- Minispiel: Parkplatzsuche in der Stadt
  // Der Wagen rollt automatisch durch die Gasse – tippe im richtigen Moment,
  // um in eine freie Lücke zu ziehen, bevor sie ein anderer schnappt.
  function starteParkplatzSpiel(fertigCb, rennen) {
    const { canvas, ctx, W, H } = minispielFenster(
      rennen ? '🛍️ Siam Mall: Wer ist schneller – du oder die Familie?'
             : '🅿️ Parkplatzsuche – wie immer ist alles voll',
      'Dein Wagen rollt von allein durch die Gasse. Tippe (oder Leertaste/↑), sobald du neben einer ' +
      'freien Lücke bist – aber Vorsicht, die Einheimischen sind schneller!', 420);

    const N = 34, RASTER = 64, AUTO_Y = H * 0.66;
    const FARBEN = ['#3a6ea5', '#d8d8d8', '#454754', '#c46a2b', '#7b5aa6', '#b03a2e', '#2a9d8f'];
    const reihen = [];
    for (let i = 0; i < N; i++) {
      reihen.push({
        links: Math.random() < 0.82 ? { farbe: FARBEN[Math.floor(Math.random() * FARBEN.length)] } : null,
        rechts: Math.random() < 0.82 ? { farbe: FARBEN[Math.floor(Math.random() * FARBEN.length)] } : null,
        palme: Math.random() < 0.25,
      });
    }
    let weltY = 0, tempo = 88, fehl = 0, blitz = 0, vorbei = false;
    let hinweis = null, geparkt = null;
    const familieDauer = rennen ? 19 + Math.random() * 9 : 0;
    let familieFertig = false;
    const uhr = minispielUhr(canvas, ctx, W, H,
      ['Tippe, sobald du neben einer', 'freien Lücke stehst!'],
      { pauseBox: { x: W / 2 - 18, y: 30, b: 36, h: 28 } });

    function fertig(icon, text, effekte, extra) {
      if (vorbei) return;
      vorbei = true; aufraeumen();
      minispielErgebnis(icon, text, effekte, extra, fertigCb);
    }
    function parken() {
      if (vorbei || geparkt) return;
      const basis = weltY / RASTER;
      let beste = null, besteAbstand = 1e9;
      for (let r = Math.floor(basis) - 1; r <= Math.ceil(basis) + 1; r++) {
        const reihe = reihen[((r % N) + N) % N];
        const screenY = AUTO_Y - (r * RASTER - weltY);
        if (Math.abs(screenY - AUTO_Y) > 30) continue;
        for (const seite of ['links', 'rechts']) {
          if (!reihe[seite] && Math.abs(screenY - AUTO_Y) < besteAbstand) {
            besteAbstand = Math.abs(screenY - AUTO_Y);
            beste = { reihe, seite, screenY };
          }
        }
      }
      if (beste) {
        beste.reihe[beste.seite] = { farbe: '#e63946', du: true };
        geparkt = { zeit: uhr.zeit };
        piep(660, 150, 'triangle', 0.08);
        setTimeout(() => {
          const z = geparkt.zeit;
          if (rennen) {
            if (z < familieDauer)
              fertig('🏁', 'Eingeparkt, Sonnenbrille auf, lässig an die Mall gelehnt – als die Familie mit den Tüten kommt, tust du, als hättest du nie gesucht. Sieg!',
                { stimmung: 6, erlebnis: 6, stress: -3 }, ['🏁 Schneller als die Familie!']);
            else
              fertig('🛍️', 'Die Familie wartet schon mit allen Tüten am Treffpunkt und winkt betont geduldig. „Na, endlich!“',
                { stimmung: 2, stress: 3 });
            return;
          }
          if (z < 14 && fehl === 0)
            fertig('🅿️', 'Erste Lücke, sauber eingeparkt, Applaus vom Café nebenan. Der Tag kann kommen!',
              { stimmung: 5, stress: -4, erlebnis: 3 });
          else if (z < 30)
            fertig('🅿️', 'Ein paar Runden, ein bisschen Hupkonzert – aber die Lücke gehört dir.',
              { stimmung: 3, stress: -1 });
          else
            fertig('🅿️', 'Irgendwann klappt es immer. Der Fußweg ist länger als geplant, aber hey: geparkt ist geparkt.',
              { stimmung: 2, stress: 2 });
        }, 900);
      } else {
        fehl++; blitz = 250;
        hinweis = { text: 'Hier ist keine Lücke!', alter: 0 };
        piep(180, 150, 'sawtooth', 0.08);
        brumm(50);
      }
    }
    function tasteRunter(e) {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'w') { parken(); e.preventDefault(); }
    }
    const zeigerRunter = e => { parken(); e.preventDefault(); };
    document.addEventListener('keydown', tasteRunter);
    canvas.addEventListener('pointerdown', zeigerRunter);
    function aufraeumen() {
      uhr.aufraeumen();
      document.removeEventListener('keydown', tasteRunter);
      canvas.removeEventListener('pointerdown', zeigerRunter);
    }

    if (window.MINISPIEL_SCHNELL) setTimeout(() => fertig('🅿️', 'Geparkt!', { stimmung: 2 }), 700);

    function autoZeichnen(x, y, farbe, quer) {
      ctx.save();
      ctx.translate(x, y);
      if (quer) ctx.rotate(Math.PI / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(1.5, 2, 13, 21, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = farbe;
      ctx.beginPath(); ctx.roundRect(-11, -20, 22, 40, 6); ctx.fill();
      ctx.fillStyle = 'rgba(210,230,240,0.9)';
      ctx.fillRect(-8, -12, 16, 8); ctx.fillRect(-8, 5, 16, 7);
      ctx.restore();
    }

    function schleife(now) {
      if (vorbei) return;
      const t = uhr.tick(now);
      const dt = t.dt, zeit = t.zeit;

      if (!geparkt) weltY += tempo * dt;

      if (rennen && !familieFertig && zeit >= familieDauer) {
        familieFertig = true;
        hinweis = { text: '👨‍👩‍👧 Die Familie ist fertig!', alter: 0 };
        piep(240, 200, 'square', 0.07);
      }

      // Rivalen schnappen Lücken vor dir weg
      if (!geparkt && Math.random() < dt * 0.22) {
        const basis = Math.floor(weltY / RASTER);
        const r = basis + 2 + Math.floor(Math.random() * 3);
        const reihe = reihen[((r % N) + N) % N];
        const seite = Math.random() < 0.5 ? 'links' : 'rechts';
        if (!reihe[seite]) {
          reihe[seite] = { farbe: FARBEN[Math.floor(Math.random() * FARBEN.length)], frisch: 1 };
          hinweis = { text: '😤 Weggeschnappt!', alter: 0 };
          piep(240, 120, 'square', 0.06);
        }
      }

      // ————— Zeichnen: Gasse mit Parkbuchten —————
      ctx.fillStyle = '#585a62'; ctx.fillRect(0, 0, W, H);
      // Parkbuchten-Streifen links & rechts
      ctx.fillStyle = '#4c4e56';
      ctx.fillRect(0, 0, 96, H); ctx.fillRect(W - 96, 0, 96, H);
      // Gehwege ganz außen
      ctx.fillStyle = '#e8e0cf';
      ctx.fillRect(0, 0, 22, H); ctx.fillRect(W - 22, 0, 22, H);
      // Mittellinie
      ctx.strokeStyle = 'rgba(245,240,230,0.5)'; ctx.lineWidth = 2;
      ctx.setLineDash([16, 14]); ctx.lineDashOffset = weltY % 30;
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
      ctx.setLineDash([]);

      const basis = Math.floor(weltY / RASTER);
      for (let r = basis - 4; r <= basis + 5; r++) {
        const reihe = reihen[((r % N) + N) % N];
        const y = AUTO_Y - (r * RASTER - weltY);
        if (y < -70 || y > H + 70) continue;
        // Markierungen der Buchten
        ctx.strokeStyle = 'rgba(245,240,230,0.55)'; ctx.lineWidth = 2;
        for (const x0 of [24, W - 96]) {
          ctx.strokeRect(x0, y - RASTER / 2 + 5, 72, RASTER - 10);
        }
        if (!reihe.links) {
          ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('P', 60, y + 8);
        } else autoZeichnen(60, y, reihe.links.farbe, true);
        if (!reihe.rechts) {
          ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('P', W - 60, y + 8);
        } else autoZeichnen(W - 60, y, reihe.rechts.farbe, true);
        if (reihe.palme) { ctx.font = '20px serif'; ctx.fillText('🌴', 11, y + 6); }
      }

      // Dein Auto (in der Fahrgasse, leicht links)
      if (!geparkt) autoZeichnen(W / 2 - 34, AUTO_Y, '#e63946', false);
      else {
        ctx.fillStyle = 'rgba(20,21,31,0.5)'; ctx.fillRect(0, 0, W, H);
        gtaText(ctx, '🅿️ GEPARKT!', W / 2, H / 2, 28, '#3ddc97');
      }

      if (hinweis) {
        hinweis.alter += dt;
        if (hinweis.alter > 1.2) hinweis = null;
        else {
          ctx.globalAlpha = 1 - hinweis.alter / 1.2;
          gtaText(ctx, hinweis.text, W / 2, 130, 18, '#ffd166');
          ctx.globalAlpha = 1;
        }
      }
      if (blitz > 0) { blitz -= dt * 1000; ctx.fillStyle = 'rgba(230,57,70,0.18)'; ctx.fillRect(0, 0, W, H); }

      // HUD
      ctx.fillStyle = 'rgba(43,45,66,0.72)'; ctx.fillRect(0, 0, W, 24);
      gtaText(ctx, '⏱ ' + zeit.toFixed(0) + ' s', 8, 17, 11, '#fff', 'left');
      gtaText(ctx, '📢 Fehlversuche: ' + fehl, W - 8, 17, 11, fehl > 0 ? '#ff5b6a' : '#fff', 'right');
      if (rennen) {
        const anteil = Math.min(1, zeit / familieDauer);
        ctx.fillStyle = 'rgba(43,45,66,0.75)';
        ctx.beginPath(); ctx.roundRect(W / 2 - 92, H - 44, 184, 34, 10); ctx.fill();
        ctx.fillStyle = '#f5f0e6'; ctx.fillRect(W / 2 - 80, H - 24, 160, 7);
        ctx.fillStyle = anteil > 0.8 ? '#ff5b6a' : '#f4a261';
        ctx.fillRect(W / 2 - 80, H - 24, 160 * anteil, 7);
        gtaText(ctx, '👨‍👩‍👧 Familie shoppt …', W / 2, H - 30, 11, '#fff');
      }
      if (IST_TOUCH && !geparkt && zeit % 1.6 < 0.9)
        gtaText(ctx, '👆 Tippen zum Einparken', W / 2, H - 12, 14, '#ffd166');
      uhr.zeichnen();

      if (!geparkt && zeit > 45) {
        fertig('🚶', 'Du gibst auf und parkst drei Straßen weiter am Ortsrand. Der Spaziergang ist … unfreiwillig.',
          { stress: 4, stimmung: -2 });
        return;
      }
      requestAnimationFrame(schleife);
    }
    requestAnimationFrame(schleife);
  }

  // ------------------------------- Minispiel: Haareflechten am Strandstand
  // Merkspiel: Die Flechterin zeigt eine Perlen-Reihenfolge – tippe sie nach.
  function starteFlechtenSpiel(fertigCb) {
    const { canvas, ctx, W, H } = minispielFenster(
      '💇 Haareflechten am Strandstand',
      'Rosalía flicht dir Strähnchen mit bunten Perlen. Merk dir die Reihenfolge, in der die Perlen ' +
      'aufleuchten – und tippe sie nach (oder Tasten 1–4)!', 400);

    const PERLEN = [
      { farbe: '#e63946', hell: '#f77f8b', x: W / 2 - 105 },
      { farbe: '#ffd166', hell: '#ffe8ad', x: W / 2 - 35 },
      { farbe: '#2a9d8f', hell: '#7fd4c9', x: W / 2 + 35 },
      { farbe: '#7b5aa6', hell: '#b39ad1', x: W / 2 + 105 },
    ];
    const PERLE_Y = H - 64;
    const RUNDEN = [3, 4, 5];
    let runde = 0, folge = [], zeigeIdx = -1, eingabeIdx = 0;
    let phase = 'intro';    // intro | zeigen | nachmachen | ende
    let fehler = 0, geflochten = [], leuchtet = -1, vorbei = false;
    let statusText = 'Rosalía sortiert die Perlen …';
    let gestartet = false, jetztZeit = 0;
    const timer = [];
    const uhr = minispielUhr(canvas, ctx, W, H,
      ['Merk dir die Reihenfolge', 'der leuchtenden Perlen!']);

    // Abläufe laufen über die Spieluhr statt über setTimeout –
    // so friert die Pause auch die Perlen-Vorführung sauber ein.
    const plan = [];
    const nach = (sek, fn) => plan.push({ bei: jetztZeit + sek, fn });

    function fertig(icon, text, effekte, extra) {
      if (vorbei) return;
      vorbei = true;
      timer.forEach(clearTimeout);
      plan.length = 0;
      aufraeumen();
      minispielErgebnis(icon, text, effekte, extra, fertigCb);
    }
    function folgeZeigen() {
      phase = 'zeigen';
      statusText = 'Gut aufpassen …';
      folge.forEach((p, i) => {
        nach(0.5 + i * 0.52, () => {
          leuchtet = p; zeigeIdx = i;
          piep(330 + p * 110, 160, 'triangle', 0.07);
          nach(0.33, () => { leuchtet = -1; });
        });
      });
      nach(0.5 + folge.length * 0.52 + 0.2, () => {
        phase = 'nachmachen'; eingabeIdx = 0;
        statusText = 'Jetzt du – in derselben Reihenfolge!';
      });
    }
    function rundeStarten() {
      folge = Array.from({ length: RUNDEN[runde] }, () => Math.floor(Math.random() * 4));
      folgeZeigen();
    }
    function eingabe(p) {
      if (vorbei || phase !== 'nachmachen') return;
      leuchtet = p;
      nach(0.2, () => { leuchtet = -1; });
      if (p === folge[eingabeIdx]) {
        piep(330 + p * 110, 120, 'triangle', 0.06);
        geflochten.push(p);
        eingabeIdx++;
        if (eingabeIdx >= folge.length) {
          runde++;
          if (runde >= RUNDEN.length) {
            phase = 'ende';
            statusText = '¡Qué guapa! Die Zöpfe sitzen.';
            nach(1.2, () => {
              if (fehler === 0)
                fertig('💇', 'Jede Perle sitzt beim ersten Versuch – Rosalía will dich glatt als Aushilfe anstellen. Im Spiegel: Urlaubsfrisur der Extraklasse!',
                  { stimmung: 7, erlebnis: 7, stress: -4 }, ['📿 Fehlerfrei!']);
              else
                fertig('💇', 'Ein Perlen-Patzer, aber das Ergebnis kann sich sehen lassen. Die Zöpfchen klackern bei jedem Schritt.',
                  { stimmung: 5, erlebnis: 5, stress: -2 });
            });
            return;
          }
          statusText = 'Sehr gut! Nächste Strähne …';
          nach(1.1, rundeStarten);
        }
      } else {
        fehler++;
        piep(160, 260, 'sawtooth', 0.09);
        if (fehler >= 2) {
          fertig('😵‍💫', 'Zu viele bunte Perlen, zu viel Sonne – Rosalía lacht und flicht einfach frei Schnauze weiter. Sieht trotzdem gut aus!',
            { stimmung: 3, erlebnis: 4 });
          return;
        }
        phase = 'zeigen';
        statusText = 'Huch, falsche Perle! Schau nochmal genau hin.';
        nach(0.9, folgeZeigen);
      }
    }
    function tasteRunter(e) {
      const i = ['1', '2', '3', '4'].indexOf(e.key);
      if (i >= 0) { eingabe(i); e.preventDefault(); }
    }
    function zeigerRunter(e) {
      const box = canvas.getBoundingClientRect();
      const mx = (e.clientX - box.left) / box.width * W;
      const my = (e.clientY - box.top) / box.height * H;
      if (Math.abs(my - PERLE_Y) < 34) {
        let beste = 0, dist = 1e9;
        PERLEN.forEach((p, i) => { if (Math.abs(mx - p.x) < dist) { dist = Math.abs(mx - p.x); beste = i; } });
        if (dist < 36) eingabe(beste);
      }
      e.preventDefault();
    }
    document.addEventListener('keydown', tasteRunter);
    canvas.addEventListener('pointerdown', zeigerRunter);
    function aufraeumen() {
      uhr.aufraeumen();
      document.removeEventListener('keydown', tasteRunter);
      canvas.removeEventListener('pointerdown', zeigerRunter);
    }

    if (window.MINISPIEL_SCHNELL)
      setTimeout(() => fertig('💇', 'Schicke Zöpfe!', { stimmung: 3 }), 700);

    function schleife(now) {
      if (vorbei) return;
      const t = uhr.tick(now);
      const zeit = jetztZeit = t.zeit;
      if (t.laeuft && !gestartet) { gestartet = true; nach(0.4, rundeStarten); }
      plan.sort((a, b) => a.bei - b.bei);
      while (plan.length && plan[0].bei <= zeit && !vorbei) plan.shift().fn();
      if (vorbei) return;

      // Strandkulisse (mit echtem Teresitas-Foto)
      const fotoF = fotoLaden('teresitas');
      if (fotoF) {
        fotoStreifen(ctx, fotoF, 0, 0, W, 196);
        ctx.fillStyle = 'rgba(230,245,255,0.14)'; ctx.fillRect(0, 0, W, 196);
      } else {
        const himmel = ctx.createLinearGradient(0, 0, 0, 150);
        himmel.addColorStop(0, '#4ea8de'); himmel.addColorStop(1, '#bde6f5');
        ctx.fillStyle = himmel; ctx.fillRect(0, 0, W, 150);
        ctx.fillStyle = '#7ecbe8'; ctx.fillRect(0, 150, W, 46);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(0, 152 + Math.sin(zeit * 2) * 2);
      ctx.quadraticCurveTo(W / 2, 158 + Math.sin(zeit * 2 + 1) * 3, W, 152);
      ctx.stroke();
      ctx.fillStyle = '#eeddb9'; ctx.fillRect(0, 196, W, H - 196);
      ctx.font = '26px serif'; ctx.textAlign = 'center';
      ctx.fillText('⛱️', 40, 190); ctx.fillText('🌴', W - 34, 186);
      // Stand mit Rosalía
      ctx.fillStyle = '#c96f4a';
      ctx.fillRect(W / 2 - 66, 108, 132, 10);
      for (const sx of [W / 2 - 60, W / 2 + 56]) ctx.fillRect(sx, 118, 5, 60);
      ctx.fillStyle = '#f2ede2';
      ctx.fillRect(W / 2 - 66, 96, 132, 12);
      ctx.font = '30px serif';
      ctx.fillText('👩🏽‍🦱', W / 2 - 30, 168);
      ctx.font = '26px serif';
      ctx.fillText('🙂', W / 2 + 26, 168);
      // Geflochtene Strähne wächst mit jeder richtigen Perle
      const basisX = W / 2 + 38, basisY = 178;
      geflochten.forEach((p, i) => {
        const gy = basisY + i * 13;
        ctx.strokeStyle = '#6b4f2f'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(basisX + Math.sin(i * 1.4) * 4, gy - 10);
        ctx.lineTo(basisX + Math.sin((i + 1) * 1.4) * 4, gy);
        ctx.stroke();
        ctx.fillStyle = PERLEN[p].farbe;
        ctx.beginPath(); ctx.arc(basisX + Math.sin((i + 1) * 1.4) * 4, gy, 5, 0, Math.PI * 2); ctx.fill();
      });
      // Status
      gtaText(ctx, statusText, W / 2, 238, 15, phase === 'nachmachen' ? '#3ddc97' : '#59c2ff');
      gtaText(ctx, 'Strähne ' + Math.min(runde + 1, RUNDEN.length) + ' von ' + RUNDEN.length +
        (fehler ? ' · 😅 ' + fehler + ' Patzer' : ''), W / 2, 260, 11, '#fff');

      // Die vier Perlen-Knöpfe
      PERLEN.forEach((p, i) => {
        const aktiv = leuchtet === i;
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath(); ctx.ellipse(p.x, PERLE_Y + 26, 24, 6, 0, 0, Math.PI * 2); ctx.fill();
        const kugel = ctx.createRadialGradient(p.x - 8, PERLE_Y - 10, 4, p.x, PERLE_Y, 30);
        kugel.addColorStop(0, aktiv ? '#ffffff' : p.hell);
        kugel.addColorStop(1, aktiv ? p.hell : p.farbe);
        ctx.fillStyle = kugel;
        ctx.beginPath(); ctx.arc(p.x, PERLE_Y, aktiv ? 30 : 25, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(43,45,66,0.35)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, PERLE_Y, aktiv ? 30 : 25, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 13px sans-serif';
        ctx.fillText(String(i + 1), p.x, PERLE_Y + 5);
      });
      uhr.zeichnen();

      requestAnimationFrame(schleife);
    }
    requestAnimationFrame(schleife);
  }

  // ----------------------------------- Minispiel: Wettlauf um die Poolliegen
  // Punkt neun öffnet der Pool: Du steuerst dein Männchen selbst über die
  // Terrasse – nur wenige Liegen sind frei, und die anderen Gäste rennen auch!
  function starteLiegenSpiel(fertigCb) {
    const { canvas, ctx, W, H } = minispielFenster(
      '🏖️ Der Wettlauf um die Poolliegen',
      'Nur <strong>3 Liegen sind frei</strong> – und alle wollen sie! Tippe aufs Spielfeld (oder zieh den Finger), ' +
      'dein Männchen läuft dorthin. Pfeiltasten/WASD gehen auch. Erobere eine Liege, bevor die anderen da sind!', 400);

    const REIHEN_Y = [148, 218, 288];
    const SPALTEN_X = [52, 132, 212, 292];
    const HANDTUECHER = ['#3a6ea5', '#2a9d8f', '#b03a2e', '#7b5aa6', '#c46a2b'];
    const liegen = [];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 4; c++)
        liegen.push({ r, c, x: SPALTEN_X[c], y: REIHEN_Y[r], belegt: true });
    // Nur 3 Liegen sind frei – der Rest ist längst „reserviert“
    let freiZahl = 0;
    while (freiZahl < 3) {
      const l = liegen[Math.floor(Math.random() * liegen.length)];
      if (l.belegt) { l.belegt = false; freiZahl++; }
    }

    // Dein Männchen startet am Eingang unten – Rivalen stürmen aus den Ecken
    const du = { x: W / 2, y: H - 26, schritt: 0, blick: 1, tempo: 104 };
    let ziel = null;
    const tasten = { l: 0, r: 0, o: 0, u: 0 };
    const rivalen = [];
    for (let i = 0; i < 5; i++) {
      const links = i % 2 === 0;
      rivalen.push({
        x: links ? -14 - i * 6 : W + 14 + i * 6,
        y: 122 + (i * 53) % (H - 170),
        tempo: 56 + Math.random() * 22 + i * 4,
        start: 0.2 + i * 0.5,
        icon: ['🧔', '👩', '🧓', '👦', '👱‍♀️'][i],
        ziel: null, weg: false,
      });
    }
    const staub = [];
    let meins = null, verloren = false, vorbei = false, endeIn = -1, goAlter = 0;
    const uhr = minispielUhr(canvas, ctx, W, H,
      ['Steuere dein Männchen 🏃', 'zu einer der 3 freien Liegen!']);

    function fertig(icon, text, effekte, extra) {
      if (vorbei) return;
      vorbei = true; aufraeumen();
      minispielErgebnis(icon, text, effekte, extra, fertigCb);
    }
    // Tippen/Ziehen: das Männchen läuft zum Finger – Pfeiltasten gehen auch
    function zielSetzen(e) {
      const box = canvas.getBoundingClientRect();
      ziel = {
        x: Math.max(12, Math.min(W - 12, (e.clientX - box.left) / box.width * W)),
        y: Math.max(114, Math.min(H - 16, (e.clientY - box.top) / box.height * H)),
      };
      e.preventDefault();
    }
    function zeigerRunter(e) { if (!vorbei && !meins && !verloren) zielSetzen(e); }
    function zeigerZieh(e) { if (!vorbei && !meins && !verloren && e.buttons) zielSetzen(e); }
    function tasteRunter(e) {
      const map = { ArrowLeft: 'l', a: 'l', ArrowRight: 'r', d: 'r', ArrowUp: 'o', w: 'o', ArrowDown: 'u', s: 'u' };
      if (map[e.key]) { tasten[map[e.key]] = 1; ziel = null; e.preventDefault(); }
    }
    function tasteHoch(e) {
      const map = { ArrowLeft: 'l', a: 'l', ArrowRight: 'r', d: 'r', ArrowUp: 'o', w: 'o', ArrowDown: 'u', s: 'u' };
      if (map[e.key]) tasten[map[e.key]] = 0;
    }
    canvas.addEventListener('pointerdown', zeigerRunter);
    canvas.addEventListener('pointermove', zeigerZieh);
    document.addEventListener('keydown', tasteRunter);
    document.addEventListener('keyup', tasteHoch);
    function aufraeumen() {
      uhr.aufraeumen();
      canvas.removeEventListener('pointerdown', zeigerRunter);
      canvas.removeEventListener('pointermove', zeigerZieh);
      document.removeEventListener('keydown', tasteRunter);
      document.removeEventListener('keyup', tasteHoch);
    }

    if (window.MINISPIEL_SCHNELL) setTimeout(() => fertig('🏖️', 'Liege erobert!', { erholung: 3, stimmung: 2 }), 700);

    function erobert(l) {
      l.belegt = true; l.du = true; meins = l; ziel = null;
      endeIn = 1.1;
      piep(720, 150, 'triangle', 0.09); setTimeout(() => piep(950, 200, 'triangle', 0.09), 140);
      brumm(40);
    }

    function schleife(now) {
      if (vorbei) return;
      const t = uhr.tick(now);
      const dt = t.dt, zeit = t.zeit;
      if (t.laeuft) goAlter += dt;

      // Dein Männchen läuft
      if (!meins && !verloren) {
        let vx = tasten.r - tasten.l, vy = tasten.u - tasten.o;
        if (vx || vy) {
          const n = Math.hypot(vx, vy);
          vx = vx / n * du.tempo; vy = vy / n * du.tempo;
        } else if (ziel) {
          const dx = ziel.x - du.x, dy = ziel.y - du.y, d = Math.hypot(dx, dy);
          if (d > 4) { vx = dx / d * du.tempo; vy = dy / d * du.tempo; }
          else ziel = null;
        }
        if (vx || vy) {
          du.x = Math.max(12, Math.min(W - 12, du.x + vx * dt));
          du.y = Math.max(114, Math.min(H - 12, du.y + vy * dt));
          du.schritt += Math.hypot(vx, vy) * dt;
          if (vx) du.blick = Math.sign(vx);
          if (Math.random() < dt * 9)
            staub.push({ x: du.x - du.blick * 7, y: du.y + 9, alter: 0 });
        }
        // Liege erreicht?
        for (const l of liegen) {
          if (!l.belegt && Math.hypot(l.x - du.x, l.y - du.y) < 24) { erobert(l); break; }
        }
      }

      // Rivalen rennen zur nächstgelegenen freien Liege
      for (const riv of rivalen) {
        if (riv.weg || zeit < riv.start) continue;
        if (!riv.ziel || riv.ziel.belegt) {
          const freie = liegen.filter(l => !l.belegt);
          if (!freie.length) { riv.weg = true; continue; }
          riv.ziel = freie.reduce((a, b) =>
            Math.hypot(a.x - riv.x, a.y - riv.y) < Math.hypot(b.x - riv.x, b.y - riv.y) ? a : b);
        }
        const dx = riv.ziel.x - riv.x, dy = riv.ziel.y - riv.y, d = Math.hypot(dx, dy);
        riv.x += dx / d * riv.tempo * dt;
        riv.y += dy / d * riv.tempo * dt;
        if (d < 12) {
          riv.ziel.belegt = true;
          riv.ziel.handtuch = HANDTUECHER[Math.floor(Math.random() * HANDTUECHER.length)];
          riv.weg = true;
          piep(300, 90, 'square', 0.05);
        }
      }

      // Alle Liegen weg?
      if (!meins && !verloren && !liegen.some(l => !l.belegt)) {
        verloren = true; endeIn = 1.1;
        piep(180, 300, 'sawtooth', 0.1);
        brumm(80);
      }
      if (endeIn > 0) {
        endeIn -= dt;
        if (endeIn <= 0) {
          if (meins) {
            const schnell = zeit < 6 ? ' Und das in Rekordzeit!' : '';
            if (meins.r === 0)
              fertig('🏖️', 'Erste Reihe, direkt am Beckenrand! Du wirfst dein Handtuch wie eine Siegesflagge.' + schnell,
                { erholung: 8, stimmung: 6, stress: -5 }, ['🥇 Beste Lage!']);
            else if (meins.r === 1)
              fertig('🏖️', 'Mittlere Reihe erkämpft – der Rentner neben dir nickt anerkennend. Sieg ist Sieg.' + schnell,
                { erholung: 5, stimmung: 4, stress: -3 });
            else
              fertig('🏖️', 'Hinten an der Hecke, aber deine! Du lässt dich fallen wie nach einem Marathon.' + schnell,
                { erholung: 3, stimmung: 3, stress: -1 });
          } else {
            fertig('😤', 'Alle Liegen weg – die Handtuch-Profis waren schneller. Bleibt nur der Platz auf den warmen Fliesen.',
              { stress: 4, stimmung: -2 });
          }
          return;
        }
      }
      if (!meins && !verloren && zeit > 30) {
        fertig('🤷', 'Du kreist zu lange – am Ende teilst du dir den Schatten mit einem gelangweilten Hotelkater.',
          { stimmung: 0, stress: 2 });
        return;
      }

      // ————— Pool-Szene (mit echtem Ortsfoto als Kulisse) —————
      const fotoL = fotoLaden('pool');
      if (fotoL) {
        fotoStreifen(ctx, fotoL, 0, 0, W, 96);
        ctx.fillStyle = 'rgba(225,244,255,0.16)'; ctx.fillRect(0, 0, W, 96);
      } else {
        const himmel = ctx.createLinearGradient(0, 0, 0, 96);
        himmel.addColorStop(0, '#4ea8de'); himmel.addColorStop(1, '#bde6f5');
        ctx.fillStyle = himmel; ctx.fillRect(0, 0, W, 96);
      }
      // Pool mit Glitzern
      ctx.fillStyle = '#37a3d6';
      ctx.beginPath(); ctx.roundRect(20, 42, W - 40, 62, 18); ctx.fill();
      ctx.fillStyle = '#61bfe4';
      ctx.beginPath(); ctx.roundRect(26, 48, W - 52, 50, 14); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.4;
      for (let i = 0; i < 5; i++) {
        const wx = 40 + (i * 67 + zeit * 26) % (W - 80);
        ctx.beginPath(); ctx.moveTo(wx, 58 + (i % 3) * 12);
        ctx.quadraticCurveTo(wx + 9, 55 + (i % 3) * 12, wx + 18, 58 + (i % 3) * 12);
        ctx.stroke();
      }
      ctx.font = '17px serif'; ctx.textAlign = 'center';
      ctx.fillText('🏊', 90 + Math.sin(zeit * 0.8) * 40, 80);
      // Terrasse
      ctx.fillStyle = '#e8dbc0'; ctx.fillRect(0, 104, W, H - 104);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 42) { ctx.beginPath(); ctx.moveTo(x, 104); ctx.lineTo(x, H); ctx.stroke(); }
      // Hecke hinten
      ctx.fillStyle = '#7fae6d'; ctx.fillRect(0, H - 52, W, 18);

      // Liegen
      for (const l of liegen) {
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath(); ctx.ellipse(l.x + 2, l.y + 16, 30, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f5f0e6';
        ctx.beginPath(); ctx.roundRect(l.x - 28, l.y - 14, 56, 30, 6); ctx.fill();
        ctx.fillStyle = 'rgba(43,45,66,0.15)';
        ctx.fillRect(l.x - 28, l.y - 14, 56, 7);
        if (l.du) {
          ctx.fillStyle = '#e63946';
          ctx.beginPath(); ctx.roundRect(l.x - 24, l.y - 10, 48, 22, 4); ctx.fill();
          ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.fillText('😎', l.x, l.y + 8);
        } else if (l.belegt) {
          ctx.fillStyle = l.handtuch || ['#3a6ea5', '#2a9d8f', '#b03a2e', '#7b5aa6'][(l.r * 4 + l.c) % 4];
          ctx.beginPath(); ctx.roundRect(l.x - 24, l.y - 10, 48, 22, 4); ctx.fill();
          ctx.font = '15px serif'; ctx.textAlign = 'center'; ctx.fillText('🧴', l.x + 14, l.y + 8);
        } else {
          // Freie Liege: pulsierender grüner Rahmen + Pfeil
          const puls = 0.6 + 0.4 * Math.sin(zeit * 5);
          ctx.strokeStyle = 'rgba(42,157,143,' + puls.toFixed(2) + ')'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.roundRect(l.x - 31, l.y - 17, 62, 36, 8); ctx.stroke();
          gtaText(ctx, 'FREI', l.x, l.y - 22 - Math.sin(zeit * 5) * 3, 12, '#3ddc97');
        }
      }
      // Sonnenschirme zwischen den Reihen
      ctx.font = '22px serif'; ctx.textAlign = 'center';
      ctx.fillText('⛱️', 12, 140); ctx.fillText('⛱️', W - 12, 210);

      // Staubwolken der rennenden Füße
      for (let i = staub.length - 1; i >= 0; i--) {
        const s = staub[i];
        s.alter += dt;
        if (s.alter > 0.5) { staub.splice(i, 1); continue; }
        ctx.fillStyle = 'rgba(160,150,130,' + (0.4 * (1 - s.alter / 0.5)).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(s.x, s.y, 2 + s.alter * 7, 0, Math.PI * 2); ctx.fill();
      }

      // Rivalen (rennen sichtbar hektisch)
      for (const riv of rivalen) {
        if (riv.weg || zeit < riv.start) continue;
        ctx.save();
        ctx.translate(riv.x, riv.y + Math.abs(Math.sin(zeit * 12 + riv.start * 9)) * -2.5);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath(); ctx.ellipse(0, 9, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.font = '20px serif'; ctx.textAlign = 'center';
        ctx.fillText(riv.icon, 0, 7);
        ctx.restore();
      }

      // Dein Männchen (blickt in Laufrichtung, federt beim Rennen)
      if (!meins) {
        const huepf = Math.abs(Math.sin(du.schritt * 0.12)) * -3;
        ctx.save();
        ctx.translate(du.x, du.y + huepf);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath(); ctx.ellipse(0, 10 - huepf, 9, 3.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.scale(-du.blick, 1);
        ctx.font = '24px serif'; ctx.textAlign = 'center';
        ctx.fillText('🏃', 0, 8);
        ctx.restore();
        // Zielmarke, zu der das Männchen läuft
        if (ziel) {
          const puls = 4 + Math.sin(zeit * 8) * 2;
          ctx.strokeStyle = 'rgba(230,57,70,0.8)'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(ziel.x, ziel.y, 8 + puls, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = 'rgba(230,57,70,0.7)';
          ctx.beginPath(); ctx.arc(ziel.x, ziel.y, 3, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Startsignal & Endbanner
      if (goAlter > 0 && goAlter < 0.8) {
        ctx.globalAlpha = 1 - goAlter / 0.8;
        gtaText(ctx, '¡GO!', W / 2, H / 2 - 20, 54, '#3ddc97');
        ctx.globalAlpha = 1;
      }
      if (meins) {
        ctx.fillStyle = 'rgba(20,21,31,0.35)'; ctx.fillRect(0, 0, W, H);
        gtaText(ctx, 'LIEGE EROBERT!', W / 2, H / 2 - 6, 30, '#ffd166');
        gtaText(ctx, meins.r === 0 ? 'Beste Lage am Pool!' : meins.r === 1 ? 'Mittlere Reihe – solide!' : 'Hinten, aber deine!',
          W / 2, H / 2 + 24, 15, '#fff');
      } else if (verloren) {
        ctx.fillStyle = 'rgba(20,21,31,0.4)'; ctx.fillRect(0, 0, W, H);
        gtaText(ctx, 'ALLE WEG!', W / 2, H / 2, 34, '#ff5b6a');
      }

      // HUD
      ctx.fillStyle = 'rgba(43,45,66,0.72)'; ctx.fillRect(0, 0, W, 24);
      gtaText(ctx, '🕘 Pool öffnet – lauf!', 8, 17, 11, '#ffd166', 'left');
      gtaText(ctx, 'frei: ' + liegen.filter(l => !l.belegt).length, W - 8, 17, 11, '#3ddc97', 'right');
      uhr.zeichnen();

      requestAnimationFrame(schleife);
    }
    requestAnimationFrame(schleife);
  }

  // -------------------------------------------------- Bonuslevel: Kart-Rennen
  // Rundkurs in Draufsicht: 2 Runden gegen die Uhr, Rivalen überholen.
  function starteKartRennen(fertigCb) {
    const overlay = $('#fahrt-overlay');
    overlay.classList.remove('versteckt');
    $('#fahrt-titel').textContent = '🏁 Bonuslevel: Kart-Rennen!';
    $('#fahrspiel-hilfe').innerHTML = 'Lenken: ← → · Gas: ↑ · Item einsetzen: Leertaste oder Item-Box antippen · Pause: P oder ⏸<br>' +
      'Fahr durch die ?-Boxen: 🍄 Turbo, 🍌 Banane legen, ⚡ Gegner schocken. Wer wird Erster?';
    $('#fahrt-inselkarte').classList.add('versteckt');
    $('#fahrspiel-wrap').classList.remove('versteckt');
    $('#fahrt-log').innerHTML = '';
    $('#fahrt-buttons').innerHTML = '';

    const canvas = $('#fahrspiel-canvas');
    const ctx = canvas.getContext('2d');
    const W = 340, H = 420;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = 'min(340px, 100%)';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const COUNTDOWN = 2000;
    const RUNDEN_ZIEL = window.FAHRSPIEL_DAUER ? 1 : 2;
    const ZEITLIMIT = window.FAHRSPIEL_DAUER ? window.FAHRSPIEL_DAUER / 1000 + 2 : 75;
    const HALB = 4.6;

    // Pause (Taste P / ⏸) – links unter der Platzierungsbox
    const uhr = minispielUhr(canvas, ctx, W, H, null,
      { ohneCountdown: true, pauseBox: { x: 6, y: 78, b: 36, h: 30 } });

    // Geschlossener Kurs: verbeulte Ellipse
    const N = 160;
    const samples = [];
    for (let i = 0; i < N; i++) {
      const t = i / N * Math.PI * 2;
      const r = 1 + 0.16 * Math.sin(2 * t) + 0.1 * Math.sin(3 * t + 1);
      samples.push({ x: Math.sin(t) * 46 * r, z: Math.cos(t) * 30 * r });
    }
    for (let i = 0; i < N; i++) {
      const a = samples[i], b = samples[(i + 1) % N];
      a.richtung = Math.atan2(b.x - a.x, b.z - a.z);
    }

    // Rivalen-Karts (mit Rundenzählung fürs Klassement)
    const rivalen = [1, 2, 3].map(n => ({
      idx: n * 12, total: n * 12, v: 9.5 + n * 1.1,
      farbe: ['#3a6ea5', '#2a9d8f', '#f4a261'][n - 1],
      name: ['Blau', 'Verde', 'Naranja'][n - 1],
      hitCd: 0, prevVor: false, slow: 0,
    }));

    // Mario-Kart-Zutaten: ?-Boxen, Items, Bananen und Boost-Pfeile
    const itemBoxen = [0.14, 0.38, 0.62, 0.86].map(f => {
      const p = samples[Math.floor(f * N)];
      return { x: p.x, z: p.z, cd: 0 };
    });
    const boostPads = [0.25, 0.75].map(f => {
      const i = Math.floor(f * N);
      return { x: samples[i].x, z: samples[i].z, richtung: samples[i].richtung };
    });
    const bananen = [];
    const ITEMS = ['pilz', 'banane', 'blitz'];
    const ITEM_ICON = { pilz: '🍄', banane: '🍌', blitz: '⚡' };
    let item = null, turbo = 0, blitzZeit = 0, schleuder = 0;

    let px = samples[0].x, pz = samples[0].z, heading = samples[0].richtung;
    let speed = 0, lenk = 0, lenkIst = 0, gas = 0, lenkZeiger = null;
    let roadIdx = 0, gesamtIdx = 0, runden = 0, treffer = 0, stil = 0;
    let blitz = 0, offZeit = 0, vorbei = false, countdownPiep = 3;

    function itemBenutzen() {
      if (!item || vorbei) return;
      if (item === 'pilz') { turbo = 1.3; piep(520, 200, 'square', 0.1); }
      if (item === 'banane') {
        bananen.push({ x: px - Math.sin(heading) * 3, z: pz - Math.cos(heading) * 3 });
        piep(300, 120, 'triangle', 0.08);
      }
      if (item === 'blitz') {
        blitzZeit = 2.5;
        schweber.push({ text: '⚡ Alle Gegner geschockt!', alter: 0 });
        piep(140, 300, 'sawtooth', 0.12);
      }
      item = null;
    }
    const schweber = [];
    const start = performance.now();
    let letztes = start;

    function tasteRunter(e) {
      if (e.key === 'ArrowLeft' || e.key === 'a') { lenk = -1; e.preventDefault(); }
      if (e.key === 'ArrowRight' || e.key === 'd') { lenk = 1; e.preventDefault(); }
      if (e.key === 'ArrowUp' || e.key === 'w') { gas = 1; e.preventDefault(); }
      if (e.key === 'ArrowDown' || e.key === 's') { gas = -1; e.preventDefault(); }
      if (e.key === ' ') { itemBenutzen(); e.preventDefault(); }
    }
    function tasteHoch(e) {
      if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) lenk = 0;
      if (['ArrowUp', 'ArrowDown', 'w', 's'].includes(e.key)) gas = 0;
    }
    function zeigerRunter(e) {
      const box = canvas.getBoundingClientRect();
      const x = (e.clientX - box.left) / box.width * W;
      const y = (e.clientY - box.top) / box.height * H;
      if (x > W - 60 && y > 30 && y < 72) { itemBenutzen(); e.preventDefault(); return; }
      lenk = x < W / 2 ? -1 : 1;
      lenkZeiger = e.pointerId;
      e.preventDefault();
    }
    const zeigerHoch = e => {
      if (lenkZeiger === null || e.pointerId === lenkZeiger) { lenk = 0; lenkZeiger = null; }
    };
    document.addEventListener('keydown', tasteRunter);
    document.addEventListener('keyup', tasteHoch);
    canvas.addEventListener('pointerdown', zeigerRunter);
    document.addEventListener('pointerup', zeigerHoch);
    function aufraeumen() {
      uhr.aufraeumen();
      document.removeEventListener('keydown', tasteRunter);
      document.removeEventListener('keyup', tasteHoch);
      canvas.removeEventListener('pointerdown', zeigerRunter);
      document.removeEventListener('pointerup', zeigerHoch);
    }

    function schleife(now) {
      if (vorbei) return;
      const dt = uhr.tick(now).dt;
      const seitStart = now - start - uhr.pausenMs;
      const fahrZeit = Math.max(0, seitStart - COUNTDOWN) / 1000;

      if (seitStart < COUNTDOWN) {
        const rest = Math.ceil((COUNTDOWN - seitStart) / (COUNTDOWN / 3));
        if (rest < countdownPiep) { countdownPiep = rest; piep(440, 120, 'square'); }
      } else if (countdownPiep > 0) { countdownPiep = 0; piep(880, 220, 'square'); }

      // Kurs-Fortschritt inkl. Rundenzählung (mit Umlauf)
      const d2 = i => {
        const p = samples[((i % N) + N) % N];
        return (p.x - px) * (p.x - px) + (p.z - pz) * (p.z - pz);
      };
      for (let n = 0; n < 8 && d2(roadIdx + 1) < d2(roadIdx); n++) { roadIdx++; gesamtIdx++; }
      while (d2(roadIdx - 1) < d2(roadIdx)) { roadIdx--; gesamtIdx--; }
      const neueRunden = Math.floor(gesamtIdx / N);
      if (neueRunden > runden) {
        runden = neueRunden;
        schweber.push({ text: '🏁 Runde ' + Math.min(RUNDEN_ZIEL, runden + 1), alter: 0 });
        piep(760, 150, 'triangle', 0.08);
      }
      const seitAbstand = Math.sqrt(d2(roadIdx));

      // Physik (inkl. Turbo & Bananen-Schleuder)
      if (seitStart >= COUNTDOWN) {
        turbo = Math.max(0, turbo - dt);
        schleuder = Math.max(0, schleuder - dt);
        blitzZeit = Math.max(0, blitzZeit - dt);
        let ziel = turbo > 0 ? 27 : gas > 0 ? 20 : gas < 0 ? 4 : 15;
        if (seitAbstand > HALB + 0.8) ziel *= 0.45;
        if (schleuder > 0) ziel *= 0.4;
        speed += (ziel - speed) * dt * (gas < 0 ? 2.8 : turbo > 0 ? 2.4 : 1.2);
        lenkIst += (lenk - lenkIst) * Math.min(1, dt * 8);
        if (schleuder > 0) heading += 9 * dt;
        else heading += lenkIst * 2.3 * dt * Math.min(1, speed / 7);
        px += Math.sin(heading) * speed * dt;
        pz += Math.cos(heading) * speed * dt;
      }

      // ?-Boxen, Boost-Pfeile & Bananen
      for (const box of itemBoxen) {
        box.cd = Math.max(0, box.cd - dt);
        if (box.cd <= 0 && !item && Math.hypot(box.x - px, box.z - pz) < 2.6) {
          box.cd = 4;
          item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
          schweber.push({ text: ITEM_ICON[item] + ' Item!', alter: 0 });
          piep(660, 120, 'triangle', 0.08);
        }
      }
      for (const pad of boostPads) {
        if (Math.hypot(pad.x - px, pad.z - pz) < 2.6 && turbo < 0.5) {
          turbo = 0.9;
          schweber.push({ text: '💨 Boost!', alter: 0 });
          piep(540, 100, 'square', 0.08);
        }
      }
      for (let i = bananen.length - 1; i >= 0; i--) {
        const b = bananen[i];
        if (Math.hypot(b.x - px, b.z - pz) < 1.9 && schleuder <= 0) {
          bananen.splice(i, 1);
          schleuder = 0.8; blitz = 250;
          piep(220, 260, 'sawtooth', 0.12);
          continue;
        }
        for (const r of rivalen) {
          if (r.slow <= 0 && Math.hypot(b.x - r.x, b.z - r.z) < 1.9) {
            bananen.splice(i, 1);
            r.slow = 2;
            schweber.push({ text: '🍌 ' + r.name + ' rutscht!', alter: 0 });
            stil += 8;
            break;
          }
        }
      }
      if (seitAbstand > HALB + 0.8 && speed > 5) {
        offZeit += dt;
        if (offZeit > 1) { treffer++; blitz = 300; offZeit = 0; piep(120, 200, 'sawtooth', 0.12); }
      } else offZeit = 0;

      // Rivalen: Gummiband-KI wie im Vorbild – wer hinten liegt, holt auf
      for (const r of rivalen) {
        r.slow = Math.max(0, (r.slow || 0) - dt);
        let vEff = r.v;
        if (r.total < gesamtIdx - 18) vEff *= 1.2;
        else if (r.total > gesamtIdx + 22) vEff *= 0.86;
        if (blitzZeit > 0) vEff *= 0.55;
        if (r.slow > 0) vEff *= 0.45;
        const schritt = vEff * dt / (Math.PI * 2 * 38 / N);
        r.idx = (r.idx + schritt) % N;
        r.total += schritt;
        const p = samples[Math.floor(r.idx)];
        r.x = p.x; r.z = p.z; r.richtung = p.richtung;
        r.hitCd = Math.max(0, r.hitCd - dt);
        const abstand = Math.hypot(r.x - px, r.z - pz);
        if (abstand < 2 && r.hitCd <= 0 && speed > 4) {
          treffer++; blitz = 300; r.hitCd = 2; speed *= 0.5;
          piep(110, 260, 'sawtooth', 0.14);
          brumm(60);
        }
        const vor = ((Math.floor(r.idx) - roadIdx % N) + N) % N < N / 2;
        if (r.prevVor && !vor && abstand > 2 && abstand < 15) {
          stil += 10;
          schweber.push({ text: 'Überholt! +10', alter: 0 });
          piep(760, 90, 'triangle', 0.06);
        }
        r.prevVor = vor;
      }

      // ————— Draufsicht zeichnen —————
      const skala = 3.1;
      const sinH = Math.sin(heading), cosH = Math.cos(heading);
      const topP = (x, z) => {
        const dx = x - px, dz = z - pz;
        return {
          sx: W / 2 + (dx * cosH - dz * sinH) * skala,
          sy: H * 0.6 - (dx * sinH + dz * cosH) * skala,
        };
      };
      ctx.fillStyle = '#9fb86e';
      ctx.fillRect(0, 0, W, H);

      const pfad = new Path2D();
      for (let i = 0; i <= N; i++) {
        const p = topP(samples[i % N].x, samples[i % N].z);
        if (i === 0) pfad.moveTo(p.sx, p.sy); else pfad.lineTo(p.sx, p.sy);
      }
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = '#e63946'; ctx.lineWidth = (HALB * 2 + 1.4) * skala; ctx.stroke(pfad);
      ctx.strokeStyle = '#5c5e66'; ctx.lineWidth = HALB * 2 * skala; ctx.stroke(pfad);
      ctx.strokeStyle = 'rgba(245,240,230,0.8)'; ctx.lineWidth = 1.6;
      ctx.setLineDash([10, 12]); ctx.stroke(pfad); ctx.setLineDash([]);

      // Rot-weiße Randsteine (Kerbs) in den Kurven
      for (let i = 0; i < N; i += 2) {
        let dk = samples[(i + 6) % N].richtung - samples[i].richtung;
        dk = Math.atan2(Math.sin(dk), Math.cos(dk));
        if (Math.abs(dk) < 0.16) continue;
        const pk = samples[i];
        const rk = { x: Math.cos(pk.richtung), z: -Math.sin(pk.richtung) };
        for (const seiteK of [-1, 1]) {
          const kp = topP(pk.x + rk.x * seiteK * (HALB + 0.5), pk.z + rk.z * seiteK * (HALB + 0.5));
          ctx.fillStyle = i % 4 ? '#f5f0e6' : '#e63946';
          ctx.fillRect(kp.sx - 3, kp.sy - 3, 6, 6);
        }
      }

      // Boost-Pfeile auf der Bahn
      for (const pad of boostPads) {
        const p = topP(pad.x, pad.z);
        ctx.save();
        ctx.translate(p.sx, p.sy);
        ctx.rotate(pad.richtung - heading);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.moveTo(0, -9); ctx.lineTo(7, 2); ctx.lineTo(2.5, 2); ctx.lineTo(2.5, 9);
        ctx.lineTo(-2.5, 9); ctx.lineTo(-2.5, 2); ctx.lineTo(-7, 2);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      // ?-Boxen & Bananen
      ctx.textAlign = 'center';
      for (const box of itemBoxen) {
        if (box.cd > 0) continue;
        const p = topP(box.x, box.z);
        ctx.save();
        ctx.translate(p.sx, p.sy);
        ctx.rotate((seitStart / 600) % (Math.PI * 2));
        const grad = ctx.createLinearGradient(-8, -8, 8, 8);
        grad.addColorStop(0, '#f4a261'); grad.addColorStop(0.5, '#e9c46a'); grad.addColorStop(1, '#2a9d8f');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.roundRect(-8, -8, 16, 16, 4); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif';
        ctx.rotate(-(seitStart / 600) % (Math.PI * 2));
        ctx.fillText('?', 0, 4);
        ctx.restore();
      }
      for (const b of bananen) {
        const p = topP(b.x, b.z);
        ctx.font = '16px serif';
        ctx.fillText('🍌', p.sx, p.sy + 5);
      }

      // Start-/Ziellinie
      const sl = topP(samples[0].x, samples[0].z);
      ctx.save();
      ctx.translate(sl.sx, sl.sy);
      ctx.rotate(samples[0].richtung - heading);
      ctx.fillStyle = '#fff';
      for (let i = -4; i < 4; i++)
        if (i % 2 === 0) ctx.fillRect(i * HALB * skala / 4, -1.6, HALB * skala / 4, 3.2);
      ctx.fillStyle = '#111';
      for (let i = -4; i < 4; i++)
        if (i % 2 !== 0) ctx.fillRect(i * HALB * skala / 4, -1.6, HALB * skala / 4, 3.2);
      ctx.restore();

      // Karts
      const kart = (x, z, richt, farbe) => {
        const p = topP(x, z);
        ctx.save();
        ctx.translate(p.sx, p.sy);
        ctx.rotate(richt - heading);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.ellipse(1, 1.5, 5.5, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1d1f2a';
        ctx.fillRect(-6, -6, 3, 4); ctx.fillRect(3, -6, 3, 4);
        ctx.fillRect(-6, 3, 3, 4); ctx.fillRect(3, 3, 3, 4);
        ctx.fillStyle = farbe;
        ctx.beginPath(); ctx.roundRect(-4, -8, 8, 15, 3); ctx.fill();
        ctx.fillStyle = '#ffe8a3';
        ctx.beginPath(); ctx.arc(0, -1, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      };
      for (const r of rivalen) kart(r.x, r.z, r.richtung, r.farbe);
      kart(px, pz, heading, '#e63946');

      if (blitz > 0) {
        blitz -= dt * 1000;
        ctx.fillStyle = 'rgba(230,57,70,0.28)'; ctx.fillRect(0, 0, W, H);
      }
      for (const sch of schweber) {
        sch.alter += dt;
        ctx.globalAlpha = Math.max(0, 1 - sch.alter / 1.1);
        gtaText(ctx, sch.text, W / 2, H - 120 - sch.alter * 55, 18,
          sch.text.includes('Überholt') ? '#3ddc97' : '#ffd166');
      }
      ctx.globalAlpha = 1;
      while (schweber.length && schweber[0].alter > 1.1) schweber.shift();

      // HUD: Platzierung, Runde, Item-Box
      const platz = 1 + rivalen.filter(r => r.total > gesamtIdx).length;
      ctx.fillStyle = 'rgba(43,45,66,0.72)'; ctx.fillRect(0, 0, W, 26);
      gtaText(ctx, '💥 ' + treffer, 6, 19, 12, treffer > 0 ? '#ff5b6a' : '#fff', 'left');
      gtaText(ctx, '🏎️ ' + stil, 50, 19, 12, '#ffd166', 'left');
      gtaText(ctx, 'Runde ' + Math.min(RUNDEN_ZIEL, runden + 1) + '/' + RUNDEN_ZIEL, W / 2, 19, 12, '#fff');
      gtaText(ctx, fahrZeit.toFixed(1) + ' s', W - 6, 19, 12, '#fff', 'right');

      // Film-Vignette (90er-Arcade-Look)
      const vigK = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.8);
      vigK.addColorStop(0, 'rgba(0,0,0,0)'); vigK.addColorStop(1, 'rgba(10,12,20,0.3)');
      ctx.fillStyle = vigK; ctx.fillRect(0, 0, W, H);

      // Platzierung groß links, Item-Box rechts (antippen = benutzen)
      ctx.fillStyle = 'rgba(43,45,66,0.6)';
      ctx.beginPath(); ctx.roundRect(6, 32, 58, 40, 10); ctx.fill();
      gtaText(ctx, 'P' + platz, 35, 62, 25, platz === 1 ? '#ffd166' : '#fff');
      ctx.fillStyle = 'rgba(43,45,66,0.6)';
      ctx.beginPath(); ctx.roundRect(W - 60, 32, 54, 40, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(W - 60, 32, 54, 40, 10); ctx.stroke();
      ctx.font = '22px serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(item ? ITEM_ICON[item] : '·', W - 33, 61);
      zeichneTouchPfeile(ctx, W, H, lenk);

      if (seitStart < COUNTDOWN) {
        ctx.fillStyle = 'rgba(20,21,31,0.55)'; ctx.fillRect(0, 0, W, H);
        const nr = Math.ceil((COUNTDOWN - seitStart) / (COUNTDOWN / 3));
        gtaText(ctx, String(nr), W / 2, H / 2 - 26, 72, ['#3ddc97', '#ffd166', '#ff5b6a'][nr - 1] || '#ffd166');
        gtaText(ctx, 'BONUSLEVEL!', W / 2, H / 2 + 18, 22, '#59c2ff');
        gtaText(ctx, '2 Runden · ?-Boxen sammeln', W / 2, H / 2 + 46, 14, '#fff');
        gtaText(ctx, 'Item: Leertaste · Pause: P', W / 2, H / 2 + 70, 14, '#fff');
      }

      // Rennen vorbei?
      if (runden >= RUNDEN_ZIEL || fahrZeit > ZEITLIMIT) {
        vorbei = true;
        aufraeumen();
        ctx.fillStyle = 'rgba(20,21,31,0.55)'; ctx.fillRect(0, 0, W, H);
        gtaText(ctx, '🏁 ZIELFLAGGE!', W / 2, H / 2, 30, '#ffd166');
        piep(660, 150, 'square'); setTimeout(() => piep(880, 250, 'square'), 160);

        const geschafft = runden >= RUNDEN_ZIEL;
        const endPlatz = 1 + rivalen.filter(r => r.total > gesamtIdx).length;
        let icon, text, effekte;
        if (!geschafft) {
          icon = '⏱️'; text = 'Die Zeit ist um – aber Spaß gemacht hat es trotzdem.';
          effekte = { erlebnis: 4, stimmung: 2 };
        } else if (endPlatz === 1) {
          icon = '🥇'; text = 'PLATZ 1! Du überquerst die Linie als Erster – die Bahn tobt, die Rivalen schmollen.';
          effekte = { erlebnis: 14 + Math.min(8, stil / 12 | 0), stimmung: 10, stress: -4 };
        } else if (endPlatz === 2) {
          icon = '🥈'; text = 'Platz 2 – so knapp! Beim nächsten Mal hilft vielleicht eine gut getimte Banane.';
          effekte = { erlebnis: 10 + Math.min(6, stil / 14 | 0), stimmung: 6 };
        } else if (endPlatz === 3) {
          icon = '🥉'; text = 'Platz 3 und ein Podium! Das Siegerfoto gibt es trotzdem.';
          effekte = { erlebnis: 7, stimmung: 4 };
        } else {
          icon = '🏁'; text = 'Letzter Platz – aber die Rundenzeiten werden besser. Revanche?';
          effekte = { erlebnis: 4, stimmung: 2 };
        }
        const chips = Game.bonusAnwenden(effekte);
        if (stil > 0) chips.unshift('🏎️ Fahrstil: ' + stil);
        $('#fahrt-log').appendChild(el('div', 'flug-zeile sichtbar',
          `<span class="flug-zeile-icon">${icon}</span><div>${esc(text)}` +
          (chips.length ? '<div class="flug-chips">' + chips.map(c => `<span class="chip">${esc(c)}</span>`).join('') + '</div>' : '') +
          '</div>'));
        const weiter = el('button', 'btn btn-primary', 'Weiter');
        weiter.addEventListener('click', () => { overlay.classList.add('versteckt'); fertigCb(); });
        $('#fahrt-buttons').appendChild(weiter);
        renderStats();
        return;
      }
      uhr.zeichnen();
      requestAnimationFrame(schleife);
    }
    requestAnimationFrame(schleife);
  }

  // ------------------------------------------------------------ Kino-Moment
  // Vollbild-Moment mit echtem Foto – und wenn Wikimedia Commons ein passendes
  // freies Video hat, wird es direkt im Spiel abgespielt (kein YouTube).
  const wartezeit = ms => new Promise(r => setTimeout(() => r(null), ms));

  function kinoSchliessen() {
    const video = $('#kino-video');
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.classList.add('versteckt');
    $('#kino-bild').classList.remove('versteckt');
    $('#kino-overlay').classList.add('versteckt');
  }

  function zeigeKino(motiv, titel, untertitel, weiterCb, fotoNeu, buttonsDef) {
    const videoP = BILDER.videoHole(motiv);   // parallel zur Bildsuche starten
    Promise.race([BILDER.hole(motiv), wartezeit(1800)]).then(bild => {
      if (!bild) {
        // Kein Bild? Vielleicht gibt es wenigstens ein Video.
        Promise.race([videoP, wartezeit(2200)]).then(video => {
          if (video) kinoOeffnen(motiv, null, video, titel, untertitel, weiterCb, fotoNeu, buttonsDef);
          else weiterCb();
        });
        return;
      }
      kinoOeffnen(motiv, bild, null, titel, untertitel, weiterCb, fotoNeu, buttonsDef);
      // Video nachladen und einblenden, sobald es bereit ist
      Promise.race([videoP, wartezeit(8000)]).then(video => {
        const overlay = $('#kino-overlay');
        if (video && !overlay.classList.contains('versteckt') && overlay.dataset.motiv === motiv)
          kinoVideoStarten(video);
      });
    });
  }

  // Foto-Auslöser: Der Fokus wandert – wer im richtigen Moment auslöst,
  // bekommt das perfekte Foto samt Bonus. Danach erscheinen die Knöpfe.
  function kinoFokusStarten(buttons) {
    const alt = document.querySelector('.kino-fokus');
    if (alt) alt.remove();
    const fokus = el('div', 'kino-fokus',
      '<div class="fokus-hinweis">Fang den Moment ein – löse im grünen Bereich aus!</div>' +
      '<div class="fokus-balken"><div class="fokus-ziel"></div><div class="fokus-marke"></div></div>');
    const ausloeser = el('button', 'btn btn-primary', '📸 Auslösen!');
    ausloeser.id = 'kino-ausloeser';
    fokus.appendChild(ausloeser);
    buttons.parentNode.insertBefore(fokus, buttons);
    buttons.classList.add('versteckt');

    const marke = fokus.querySelector('.fokus-marke');
    const startzeit = performance.now();
    let aktiv = true;
    (function pendel(now) {
      if (!aktiv || !marke.isConnected) return;
      const pos = (Math.sin((now - startzeit) / 240) + 1) / 2 * 100;
      marke.style.left = pos + '%';
      requestAnimationFrame(pendel);
    })(startzeit);

    const aufloesen = getroffen => {
      if (!aktiv) return;
      aktiv = false;
      if (getroffen) {
        Game.fotoPerfekt();
        fokus.innerHTML = '<div class="fokus-ergebnis">✨ Perfekter Schnappschuss! <span class="chip">⭐ +5</span> <span class="chip">😊 +2</span></div>';
      } else {
        fokus.innerHTML = '<div class="fokus-ergebnis">📷 Im Kasten – beim nächsten Mal triffst du den Moment!</div>';
      }
      buttons.classList.remove('versteckt');
      setTimeout(() => fokus.remove(), 2600);
      if (Game.run) renderStats();
    };

    ausloeser.addEventListener('click', () => {
      const pos = parseFloat(marke.style.left) || 0;
      aufloesen(Math.abs(pos - 50) <= 13);
    });
    // Wer nicht reagiert, bekommt das Foto trotzdem (ohne Bonus)
    setTimeout(() => { if (aktiv) aufloesen(false); }, 7000);
  }

  function kinoOeffnen(motiv, bild, video, titel, untertitel, weiterCb, fotoNeu, buttonsDef) {
    const overlay = $('#kino-overlay');
    overlay.dataset.motiv = motiv;
    const img = $('#kino-bild');
    img.classList.remove('kino-anim');
    if (bild) {
      img.src = bild.url;
      img.dataset.quelle = bild.artikelUrl;
      img.classList.remove('versteckt');
      requestAnimationFrame(() => img.classList.add('kino-anim'));
    } else {
      img.classList.add('versteckt');
    }
    $('#kino-titel').textContent = titel;
    $('#kino-untertitel').textContent = untertitel;

    const buttons = $('#kino-buttons');
    buttons.innerHTML = '';
    if (buttonsDef && buttonsDef.length) {
      buttonsDef.forEach((b, i) => {
        const btn = el('button', 'btn' + (i === 0 ? ' btn-primary' : ''), b.text);
        btn.addEventListener('click', b.cb);
        buttons.appendChild(btn);
      });
    } else {
      const weiter = el('button', 'btn btn-primary', '▶ Weiter');
      weiter.addEventListener('click', () => { kinoSchliessen(); weiterCb(); });
      buttons.appendChild(weiter);
    }
    if (bild) {
      const quelle = el('button', 'btn btn-klein', '📷 Quelle');
      quelle.id = 'kino-quelle';
      quelle.dataset.url = bild.artikelUrl;
      quelle.addEventListener('click', () => zeigeQuelle(quelle.dataset.url));
      buttons.appendChild(quelle);
    }
    overlay.classList.remove('versteckt');
    if (fotoNeu) kinoFokusStarten(buttons);
    if (video) kinoVideoStarten(video);
  }

  function kinoVideoStarten(video) {
    const vid = $('#kino-video');
    vid.src = video.url;
    vid.muted = true;
    vid.addEventListener('canplay', function einblenden() {
      vid.removeEventListener('canplay', einblenden);
      if ($('#kino-overlay').classList.contains('versteckt')) return;
      vid.classList.remove('versteckt');
      $('#kino-bild').classList.add('versteckt');
      // Ton-Schalter & Quellenlink fürs Video
      const buttons = $('#kino-buttons');
      if (!$('#kino-ton')) {
        const ton = el('button', 'btn btn-klein', '🔊 Ton an');
        ton.id = 'kino-ton';
        ton.addEventListener('click', () => {
          vid.muted = !vid.muted;
          ton.textContent = vid.muted ? '🔊 Ton an' : '🔇 Ton aus';
        });
        buttons.appendChild(ton);
      }
      const quelle = $('#kino-quelle');
      if (quelle) { quelle.dataset.url = video.quelle; quelle.textContent = '🎥 Quelle'; }
      else {
        const neu = el('button', 'btn btn-klein', '🎥 Quelle');
        neu.id = 'kino-quelle';
        neu.dataset.url = video.quelle;
        neu.addEventListener('click', () => zeigeQuelle(neu.dataset.url));
        buttons.appendChild(neu);
      }
    });
    vid.play().catch(() => { /* Autoplay verweigert → Bild bleibt */ });
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
  const cfg = { dauer: 7, region: 'sued', hotel: 'komfort', transport: 'mietwagen', auto: 'kompakt', gruppe: 'single', items: [] };

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

    inhalt.appendChild(optionsGruppe('🧑‍🤝‍🧑 Wer reist mit?', null, [
      { id: 'single', icon: '🧑', name: 'Single-Urlaub',
        desc: 'Volle Freiheit – und abends vielleicht ein Flirt an der Bar …' },
      { id: 'familie', icon: '👨‍👩‍👧', name: 'Familienurlaub',
        desc: 'Gemeinsam unterwegs – inklusive Shopping-Wettrennen in der Siam Mall.' },
    ], cfg.gruppe, id => { cfg.gruppe = id; }));

    inhalt.appendChild(optionsGruppe('📍 Wo wohnst du?',
      'Der Süden ist sonnensicher, der Norden authentischer – und näher an Teide, Anaga & La Laguna.',
      Object.entries(DATA.REGIONEN).map(([id, r]) =>
        ({ id, icon: r.icon, name: r.name, desc: r.desc })),
      cfg.region, id => { cfg.region = id; }));

    inhalt.appendChild(optionsGruppe('🏨 Wie residierst du?',
      'Echte Häuser deiner Region: Dein Reisestil bestimmt das Gesamtbudget – und wie gut du dich nachts erholst.',
      Object.entries(DATA.HOTELS[cfg.region]).map(([id, h]) =>
        ({ id, icon: id === 'spar' ? '🛏️' : id === 'komfort' ? '🏨' : '🏰',
           name: `${h.name} ${h.sterne}`, detail: `Budget: ${h.budgetProTag} €/Tag`, desc: h.desc })),
      cfg.hotel, id => { cfg.hotel = id; }));

    inhalt.appendChild(optionsGruppe('🚗 Wie kommst du herum?', null,
      Object.entries(DATA.TRANSPORT).map(([id, t]) =>
        ({ id, icon: t.icon, name: t.name,
           detail: t.kostenProTag ? 'ab 22 €/Tag' : 'ab 1,50 € pro Fahrt', desc: t.desc })),
      cfg.transport, id => { cfg.transport = id; }));

    // Mietwagen-Auswahl: gute und schlechte Autos mit eigenem Charakter
    if (cfg.transport === 'mietwagen') {
      inhalt.appendChild(optionsGruppe('🔑 Welchen Wagen nimmst du?',
        'Tempo, Fahrverhalten, Gelände-Talent und Look – du spürst den Unterschied später am Steuer.',
        Object.entries(DATA.AUTOS).map(([id, a]) =>
          ({ id, icon: a.icon, name: a.name, detail: a.preisProTag + ' €/Tag', desc: a.desc })),
        cfg.auto, id => { cfg.auto = id; }));
    }

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
    const hotel = DATA.HOTELS[cfg.region][cfg.hotel];
    let budget = hotel.budgetProTag * cfg.dauer;
    const posten = [`Reisekasse: ${budget} €`];
    if (cfg.transport === 'mietwagen') {
      const mw = DATA.AUTOS[cfg.auto].preisProTag * cfg.dauer;
      budget -= mw; posten.push(`${DATA.AUTOS[cfg.auto].name.split('„')[0].trim()}: −${mw} €`);
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
    const hotel = D.HOTELS[run.region][run.hotel];
    const zimmerInfo = run.flags.zimmerSchoen ? ' · 🌅 Zimmer mit Meerblick'
      : run.flags.zimmerLaut ? ' · 🔊 Zimmer zum Parkplatz' : '';
    $('#spiel-kopf').innerHTML = `
      <div class="kopf-links">
        <div class="kopf-tag">☀️ Tag ${run.tag} von ${run.dauer} · <strong>${slotName}</strong></div>
        <div class="kopf-ort">${D.REGIONEN[run.region].icon} ${esc(hotel.name)} ${hotel.sterne}, ${esc(D.REGIONEN[run.region].name)}${zimmerInfo}</div>
        <div class="kopf-kapitel">📖 Kapitel ${run.tag}: „${esc(kapitelTitel(run.tag, run.dauer))}“</div>
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
    html += balken('Stress', '😰', run.stress, run.stress >= 70 ? 'rot' : 'orange');
    if (run.stress >= 70)
      html += '<p class="hint warn-hint">⚠️ Zu gestresst, um richtig abzuschalten – gönn dir Ruhe!</p>';
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
      strandTage: run.strandTage, stress: run.stress,
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
    if (run.kofferWeg) {
      panel.innerHTML = '<h4>🧳 Gepäck</h4>' +
        `<p class="hint warn-hint">😱 Dein Koffer ist noch unterwegs – Nachlieferung voraussichtlich an Tag ${run.kofferTag}. Bis dahin ist deine Ausrüstung nicht nutzbar!</p>` +
        (run.items.length ? '<div class="inventar-reihe koffer-weg">' +
          run.items.map(id => `<span class="inventar-item" title="${esc(DATA.ITEMS[id].name)} (im verlorenen Koffer)">${DATA.ITEMS[id].icon}</span>`).join('') + '</div>' : '');
      return;
    }
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
      const energie = act.energieMitSchuhen !== undefined && Game.hatItem('wanderschuhe')
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

      const motiv = motivFuerAct(act);
      karte.innerHTML = `
        ${motiv ? `<div class="akt-foto"><img data-motiv="${esc(motiv)}" alt="" loading="lazy"></div>` : ''}
        <div class="akt-kopf"><span class="akt-icon">${act.icon}</span>
          <div><div class="akt-name">${esc(act.name)}</div>
          <div class="akt-ort">${zone.icon} ${esc(zone.name)} · ${w.icon} ${esc(w.name)}</div></div>
        </div>
        <p class="akt-desc">${esc(act.desc)}</p>
        <div class="akt-chips">${chips.join('')}</div>
        ${e.gesperrt ? `<div class="akt-sperre">🚫 ${esc(e.gesperrt)}</div>` : ''}`;

      const img = karte.querySelector('img[data-motiv]');
      if (img) BILDER.anzeigen(img, motiv, true);

      // Größere Ausflüge lassen sich vorab im Kino ansehen – und direkt buchen
      if (!e.gesperrt && act.kosten >= 25 && motiv && BILDER.VIDEO_SUCHE[motiv]) {
        const vorschau = el('span', 'chip chip-vorschau', '▶ Vorschau');
        vorschau.setAttribute('role', 'button');
        vorschau.title = 'Video/Foto ansehen und danach entscheiden';
        vorschau.addEventListener('click', ev => { ev.stopPropagation(); zeigeVorschau(act); });
        karte.querySelector('.akt-chips').appendChild(vorschau);
      }

      if (!e.gesperrt) karte.addEventListener('click', () => aktivitaetWaehlen(act.id));
      else karte.disabled = true;
      raster.appendChild(karte);
    }
  }

  // Ausflug-Vorschau: erst das Video/Foto im Kino ansehen, dann entscheiden
  function zeigeVorschau(act) {
    const motiv = motivFuerAct(act);
    if (!motiv) return;
    zeigeKino(motiv, act.name,
      'Vorschau · ' + (DATA.ZONEN[act.zone] ? DATA.ZONEN[act.zone].name : 'Teneriffa'),
      () => toast('🎬 Gerade keine Vorschau verfügbar – buch einfach direkt!'),
      false, [
        { text: '✅ Jetzt buchen', cb: () => { kinoSchliessen(); aktivitaetWaehlen(act.id); } },
        { text: '↩ Zurück', cb: () => kinoSchliessen() },
      ]);
  }

  // ------------------------------------------------------------ Aktivitätsfluss
  function aktivitaetWaehlen(id) {
    const res = Game.aktivitaetAusfuehren(id);
    if (!res) return;
    if (res.fahrt) zeigeFahrt(res, () => ergebnisZeigen(res));
    else ergebnisZeigen(res);
  }

  function ergebnisZeigen(res) {
    // Beim ersten Besuch gibt es den Kino-Moment mit echtem Foto/Video –
    // auch für Strand- und Pooltage, nicht nur für die großen Highlights.
    const erstesMal = Game.run && Game.run.aktZaehler[res.act.id] === 1;
    const aktMotiv = motivFuerAct(res.act);
    const kinoMotiv = res.fotoNeu && BILDER.ARTIKEL[res.fotoNeu] ? res.fotoNeu
      : (erstesMal && aktMotiv &&
         (DATA.HIGHLIGHTS.includes(res.act.id) || BILDER.VIDEO_SUCHE[aktMotiv]) ? aktMotiv : null);

    const modalZeigen = () => {
      let html = '';
      const motiv = motivFuerAct(res.act);
      if (motiv) html += `<div class="modal-foto"><img data-motiv="${esc(motiv)}" alt=""></div>`;
      html += effekteHtml(res.effekte);
      if (res.fotoNeu) html += fotoBanner(res.fotoNeu);
      if (res.warnung) html += `<div class="warn-banner">🥵 ${esc(res.warnung)}</div>`;

      zeigeModal({
        icon: res.act.icon, titel: res.act.name, html,
        buttons: [{ text: 'Weiter', cb: () => {
          if (res.ereignis) zeigeEreignis(res.ereignis);
          else weiter();
        } }],
      });
      const img = $('#modal-box img[data-motiv]');
      if (img) BILDER.anzeigen(img, img.dataset.motiv, false);
    };

    const kinoOderModal = () => {
      if (kinoMotiv) {
        const titel = res.fotoNeu ? DATA.FOTOS[res.fotoNeu].name : res.act.name;
        zeigeKino(kinoMotiv, titel, `Teneriffa · Tag ${Game.run.tag}`, modalZeigen, !!res.fotoNeu);
      } else modalZeigen();
    };

    // Minispiele: Kartbahn = Rennen, Spieleabend = Farkle. Unterwegs warten
    // Verkehr, Parkplatzsuche, Tanzabend, Flechtstand, Liegen-Wettlauf & Zumo –
    // jedes einmal pro Urlaub, passend zu Ort und Tageszeit.
    if (res.act.id === 'karting') { starteKartRennen(kinoOderModal); return; }
    if (res.act.id === 'spieleabend') { starteFarkleSpiel(kinoOderModal); return; }
    if (res.act.id === 'siammall' && Game.run && Game.run.transport === 'mietwagen') {
      starteParkplatzSpiel(kinoOderModal, true);
      return;
    }
    let vorspiel = null;
    if (Game.run) {
      const r = Game.run, tags = res.act.tags, abends = r.slot === 2;
      // Minispiele kommen an späteren Tagen wieder – nur nicht zweimal am selben Tag
      const chance = flag => {
        const wert = r.flags[flag];
        if (wert === undefined || wert === false) return 1;
        if (wert === true || wert === r.tag) return 0;
        return 0.5;
      };
      const kandidaten = [];
      if (res.act.zone !== 'hotel' && (tags.includes('bummeln') || tags.includes('kultur')) &&
          Math.random() < 0.55 * chance('strasseGespielt'))
        kandidaten.push(['strasseGespielt', starteStrassenSpiel]);
      if (r.transport === 'mietwagen' && res.fahrt &&
          (tags.includes('bummeln') || tags.includes('kultur') || tags.includes('restaurant')) &&
          Math.random() < 0.5 * chance('parkplatzGespielt'))
        kandidaten.push(['parkplatzGespielt', starteParkplatzSpiel]);
      if ((r.gruppe || 'single') === 'single' && abends && tags.includes('party') &&
          Math.random() < 0.6 * chance('flirtbarGespielt'))
        kandidaten.push(['flirtbarGespielt', starteFlirtSpiel]);
      if (abends && res.act.zone !== 'hotel' &&
          (tags.includes('party') || tags.includes('bummeln') || tags.includes('restaurant')) &&
          Math.random() < 0.5 * chance('tanzGespielt'))
        kandidaten.push(['tanzGespielt', starteTanzSpiel]);
      if (tags.includes('strand') && res.act.zone !== 'hotel' &&
          Math.random() < 0.4 * chance('zoepfeGespielt'))
        kandidaten.push(['zoepfeGespielt', starteFlechtenSpiel]);
      if (res.act.id === 'pool' && Math.random() < 0.55 * chance('liegenGespielt'))
        kandidaten.push(['liegenGespielt', starteLiegenSpiel]);
      if ((res.act.id === 'pool' || tags.includes('strand')) &&
          Math.random() < 0.5 * chance('saftGespielt'))
        kandidaten.push(['saftGespielt', starteSaftSpiel]);
      if (kandidaten.length) {
        const [flagId, spiel] = kandidaten[Math.floor(Math.random() * kandidaten.length)];
        r.flags[flagId] = r.tag;
        vorspiel = spiel;
      }
    }
    if (vorspiel) vorspiel(kinoOderModal);
    else kinoOderModal();
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
    html += `<p class="story-zeile">📖 Morgen wartet Kapitel ${r.neuerTag}: „${esc(kapitelTitel(r.neuerTag, Game.run ? Game.run.dauer : r.neuerTag))}“</p>`;
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
    hiscoreSenden(r.score);
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
      <div class="panel"><h3>📖 Deine Urlaubsgeschichte</h3><p>${(() => {
        const ziele = r.quests.filter(q => q.geschafft).length;
        return `Es begann mit dem Kapitel <em>„Ankommen im Paradies“</em> – und wurde ` +
          (r.fotosRun.length >= 5 ? 'eine Reise mit einem Album voller Motive' :
           r.fotosRun.length ? 'eine Reise mit ein paar unvergesslichen Schnappschüssen' :
           'eine Reise, deren Bilder nur in deinem Kopf hängen') +
          `. ${ziele === 3 ? 'Alle drei' : ziele === 0 ? 'Keines der' : ziele + ' der drei'} Urlaubsziele ` +
          `hast du erreicht${r.erfolgeNeu.length ? ', neue Erfolge inklusive' : ''} – und am Ende steht deine Geschichte unter der Überschrift: `;
      })()}<strong>${esc(r.bewertung.titel)}</strong>.</p></div>
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
      const mitBild = hat && BILDER.ARTIKEL[id];
      html += `<div class="album-foto ${hat ? '' : 'gesperrt'}">
        ${mitBild ? `<div class="album-echtfoto"><img data-motiv="${esc(id)}" alt="" loading="lazy"></div>` : ''}
        <span class="album-icon">${hat ? f.icon : '❔'}</span>
        <span class="album-name">${hat ? esc(f.name) : '???'}</span>
        <span class="album-hinweis">${esc(f.hinweis)}</span></div>`;
    }
    html += '</div><p class="hint">📷 Echte Fotos: Wikipedia/Wikimedia Commons – Klick auf ein Foto öffnet die Quellseite mit Lizenzangaben.</p></div>';

    html += `<div class="panel"><h3>🏅 Erfolge (${m.erfolge.length}/${DATA.ERFOLGE.length})</h3><div class="erfolge-raster">`;
    for (const e of DATA.ERFOLGE) {
      const hat = m.erfolge.includes(e.id);
      html += `<div class="erfolg-karte ${hat ? '' : 'gesperrt'}">
        <span class="erfolg-icon">${hat ? e.icon : '🔒'}</span>
        <div><strong>${esc(e.name)}</strong><br><small>${esc(e.desc)}</small></div></div>`;
    }
    html += '</div></div>';
    $('#album-inhalt').innerHTML = html;
    document.querySelectorAll('#album-inhalt img[data-motiv]').forEach(img =>
      BILDER.anzeigen(img, img.dataset.motiv, true));
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
      <tr><th></th><th>Punkte</th><th>Reise</th><th>Fotos</th><th>Datum</th></tr>${zeilen}</table></div>` +
      weltPanelHtml();
    weltPanelFuellen();
  }

  // 🌍 Welt-Bestenliste: gemeinsamer Online-Highscore aller Spieler
  function weltPanelHtml() {
    const name = localStorage.getItem('tus_name_v1') || '';
    return `<div class="panel"><h3>🌍 Welt-Bestenliste</h3>
      <p class="besten-name">Dein Highscore-Name:
        <input id="hs-name" maxlength="14" placeholder="Gast" value="${esc(name)}"></p>
      <div id="welt-liste"><p class="hint">${hiscoreUrl()
        ? 'Lade Welt-Bestenliste …'
        : 'Noch nicht eingerichtet – ein Klick genügt:'}</p></div>
      ${hiscoreUrl() ? '' : '<button class="btn btn-primary" id="btn-hiscore-setup">🌍 Welt-Bestenliste jetzt einrichten</button>'}</div>`;
  }
  function weltPanelFuellen() {
    const eingabe = $('#hs-name');
    if (eingabe) eingabe.addEventListener('change', () =>
      localStorage.setItem('tus_name_v1', eingabe.value.trim().slice(0, 14)));
    const setup = $('#btn-hiscore-setup');
    if (setup) setup.addEventListener('click', () => {
      // kvdb.io verlangt beim Anlegen eine Kontakt-E-Mail (nur für den Speicher)
      const mail = (prompt('Für den kostenlosen Online-Speicher (kvdb.io) wird eine ' +
        'E-Mail-Adresse benötigt – sie wird nur an kvdb.io übermittelt:', '') || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(mail)) {
        toast('❌ Bitte eine gültige E-Mail-Adresse eingeben.');
        return;
      }
      setup.disabled = true; setup.textContent = 'Richte ein …';
      fetch('https://kvdb.io', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'email=' + encodeURIComponent(mail),
      })
        .then(r => r.text())
        .then(id => {
          const url = 'https://kvdb.io/' + id.trim() + '/';
          if (!HISCORE_MUSTER.test(url)) throw new Error(id.trim().slice(0, 120));
          localStorage.setItem('tus_hiscore_url', url);
          zeigeModal({ icon: '🌍', titel: 'Welt-Bestenliste eingerichtet!',
            html: `<p>Dein Speicher läuft. Damit <strong>alle Spieler</strong> dieselbe Liste sehen, trage diese Adresse als <code>HISCORE_FEST</code> in js/ui.js ein (oder nenn sie Claude):</p><p><strong>${esc(url)}</strong></p>`,
            buttons: [{ text: 'Alles klar!', cb: renderBesten }] });
        })
        .catch(err => {
          setup.disabled = false; setup.textContent = '🌍 Nochmal versuchen';
          toast('❌ Einrichtung fehlgeschlagen: ' + esc(String(err && err.message || err).slice(0, 90)));
        });
    });
    if (!hiscoreUrl()) return;
    hiscoreLaden().then(liste => {
      const ziel = $('#welt-liste');
      if (!ziel) return;
      if (!liste || !liste.length) {
        ziel.innerHTML = '<p class="hint">Noch keine Einträge – sei die/der Erste! 🏆</p>';
        return;
      }
      ziel.innerHTML = '<table class="besten-tabelle">' +
        liste.map((e, i) => `<tr><td>${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.'}</td>
          <td class="punkte">${e.score}</td><td>${esc(e.name)}</td><td class="detail">${esc(e.datum)}</td></tr>`).join('') +
        '</table>';
    });
  }

  // ------------------------------------------------------------------- Flug
  // Spielt die Anreise als Echtzeit-Sequenz ab: Flugzeug wandert über die
  // Strecke, die Borduhr tickt (4:20 h komprimiert), Ereignisse trudeln ein.
  const flug = { timer: [], laeuft: false };

  function flugAufraeumen() {
    flug.timer.forEach(clearTimeout);
    flug.timer = [];
    flug.laeuft = false;
  }

  function flugZeile(zeile) {
    const div = el('div', 'flug-zeile',
      `<span class="flug-zeile-icon">${zeile.icon}</span><div>${esc(zeile.text)}` +
      (zeile.chips && zeile.chips.length
        ? '<div class="flug-chips">' + zeile.chips.map(c => `<span class="chip">${esc(c)}</span>`).join('') + '</div>'
        : '') + '</div>');
    $('#flug-log').appendChild(div);
    requestAnimationFrame(() => div.classList.add('sichtbar'));
    $('#flug-log').scrollTop = $('#flug-log').scrollHeight;
  }

  function zeigeFlug() {
    const run = Game.run;
    if (!run || !run.flug) { fortsetzen(); return; }
    zeigeScreen('flug');
    flugAufraeumen();
    flug.laeuft = true;
    $('#flug-log').innerHTML = '';
    $('#btn-flug-weiter').classList.add('versteckt');
    $('#btn-flug-skip').classList.remove('versteckt');

    const zeilen = run.flug.zeilen;
    const DAUER = 20000;                       // 20 s Realzeit …
    const FLUGMINUTEN = 260;                   // … stehen für 4:20 h Flugzeit
    const start = Date.now();

    const uhr = setInterval(() => {
      const anteil = Math.min(1, (Date.now() - start) / DAUER);
      const min = Math.round(anteil * FLUGMINUTEN);
      $('#flug-uhr').textContent = `Flugzeit ${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')} h`;
      $('#flug-fortschritt').style.width = (anteil * 100) + '%';
      $('#flug-flugzeug').style.left = `calc(${anteil * 100}% - 14px)`;
      if (anteil >= 1) clearInterval(uhr);
    }, 120);
    flug.timer.push(uhr);

    zeilen.forEach((zeile, i) => {
      const t = setTimeout(() => {
        flugZeile(zeile);
        if (i === zeilen.length - 1) flugFertig();
      }, Math.round(((i + 1) / zeilen.length) * DAUER));
      flug.timer.push(t);
    });

    $('#btn-flug-skip').onclick = () => {
      flugAufraeumen();
      clearInterval(uhr);
      $('#flug-log').innerHTML = '';
      zeilen.forEach(flugZeile);
      $('#flug-uhr').textContent = 'Flugzeit 4:20 h';
      $('#flug-fortschritt').style.width = '100%';
      $('#flug-flugzeug').style.left = 'calc(100% - 14px)';
      flugFertig();
    };
  }

  function flugFertig() {
    $('#btn-flug-skip').classList.add('versteckt');
    const run = Game.run;
    const weiterZeigen = () => {
      $('#btn-flug-weiter').classList.remove('versteckt');
      $('#btn-flug-weiter').onclick = () => {
        flugAufraeumen();
        Game.flugBestaetigen();
        renderSpiel();
        zeigeScreen('spiel');
        toast('🌴 Willkommen auf Teneriffa – dein Urlaub beginnt jetzt!');
      };
    };
    // Gepäckband-Minispiel – außer der Koffer ist ohnehin in Madrid …
    if (run && !run.kofferVerloren && !run.flags.kofferSpielGespielt) {
      const koffer = el('button', 'btn btn-primary btn-gross', '🧳 Zum Gepäckband');
      koffer.id = 'btn-flug-koffer';
      $('#btn-flug-weiter').parentNode.insertBefore(koffer, $('#btn-flug-weiter'));
      koffer.addEventListener('click', () => {
        koffer.remove();
        Game.bonusAnwenden({ flag: 'kofferSpielGespielt' });
        starteKofferSpiel(weiterZeigen);
      });
    } else weiterZeigen();
  }

  // ------------------------------------------------------- Urlaub fortsetzen
  function fortsetzen() {
    const run = Game.run;
    if (run && run.flug && !run.flug.gesehen) { zeigeFlug(); return; }
    renderSpiel();
    zeigeScreen('spiel');
    if (!run || !run.pending) return;
    // Der Spielstand wurde mitten in einer Auflösung gespeichert – sauber weiterspielen
    if (run.pending.typ === 'ereignis') {
      const e = DATA.EREIGNISSE.find(x => x.id === run.pending.id);
      if (e) {
        zeigeEreignis({ id: e.id, icon: e.icon, text: run.pending.text || e.text,
                        wahl: e.wahl ? e.wahl.map(w => w.text) : null });
        return;
      }
      run.pending.typ = 'weiter';
    }
    weiter();
  }

  // ------------------------------------------------------------------- Init
  function init() {
    renderStart();

    // Klick auf ein echtes Foto (außerhalb der Aktivitätskarten) öffnet die
    // Wikipedia-Quellseite mit Autor- und Lizenzangaben.
    document.addEventListener('click', ev => {
      const img = ev.target.closest ? ev.target.closest('img[data-quelle]') : null;
      if (img && !img.closest('.akt-karte')) {
        zeigeQuelle(img.dataset.quelle);   // im Spiel bleiben!
        ev.stopPropagation();
      }
    }, true);

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
      zeigeFlug();
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
