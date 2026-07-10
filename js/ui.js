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

  // Passendes Bildmotiv für eine Aktivität finden
  function motivFuerAct(act) {
    if (BILDER.ARTIKEL[act.id]) return act.id;
    if (act.foto && BILDER.ARTIKEL[act.foto]) return act.foto;
    return null;
  }

  // ------------------------------------------------------------- Inselkarte
  // Stilisierte Teneriffa-Silhouette mit Zonenpunkten und animierter Route.
  const KARTE_PUNKTE = {
    sued: [100, 188], west: [48, 118], teide: [142, 122],
    nord: [182, 62], anaga: [283, 58],
  };

  function inselSvg(von, nach, transport) {
    const a = KARTE_PUNKTE[von] || KARTE_PUNKTE.sued;
    const b = KARTE_PUNKTE[nach] || KARTE_PUNKTE.sued;
    // Kontrollpunkt Richtung Inselmitte gezogen → geschwungene „Straße“
    const cx = (a[0] + b[0]) / 2 + (160 - (a[0] + b[0]) / 2) * 0.45;
    const cy = (a[1] + b[1]) / 2 + (120 - (a[1] + b[1]) / 2) * 0.45;
    const punkte = Object.entries(KARTE_PUNKTE).map(([zone, [x, y]]) =>
      `<circle cx="${x}" cy="${y}" r="4" class="karte-punkt"/>` +
      `<text x="${x}" y="${y - 8}" class="karte-label" text-anchor="middle">${esc(DATA.ZONEN[zone].name.split(' ')[0].replace('Nordosten', 'Anaga'))}</text>`
    ).join('');
    return `
      <svg viewBox="0 0 320 240" id="karte-svg" role="img" aria-label="Route über Teneriffa">
        <path class="karte-insel" d="M300,45 Q285,38 245,52 Q210,55 185,58 Q150,63 120,72
          Q60,84 28,98 Q22,110 38,128 Q50,152 60,170 Q80,198 110,215 Q135,214 170,190
          Q205,165 235,128 Q258,105 272,88 Q292,66 300,45 Z"/>
        <text x="142" y="130" class="karte-teide" text-anchor="middle">🌋</text>
        ${punkte}
        <path id="karte-route" class="karte-route"
          d="M${a[0]},${a[1]} Q${cx.toFixed(0)},${cy.toFixed(0)} ${b[0]},${b[1]}"/>
        <text id="karte-fahrzeug" class="karte-fahrzeug" x="${a[0]}" y="${a[1]}"
          text-anchor="middle">${transport === 'bus' ? '🚌' : '🚗'}</text>
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
    $('#fahrt-titel').textContent =
      `${fahrt.transport === 'bus' ? '🚌' : '🚗'} Fahrt: ${DATA.ZONEN[fahrt.von].name} → ${DATA.ZONEN[fahrt.nach].name}`;
    $('#fahrt-inselkarte').innerHTML = inselSvg(fahrt.von, fahrt.nach, fahrt.transport);
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

  function starteFahrspiel(fahrt, fertigCb) {
    $('#fahrt-inselkarte').classList.add('versteckt');
    $('#fahrspiel-wrap').classList.remove('versteckt');
    $('#fahrt-buttons').innerHTML = '';

    const canvas = $('#fahrspiel-canvas');
    const ctx = canvas.getContext('2d');
    const W = 340, H = 420;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = 'min(340px, 100%)';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ————— GTA-Stil: echte 3D-Welt mit Verfolgerkamera —————
    // Eigene Mini-3D-Engine: Punkte werden perspektivisch projiziert, die
    // Kamera hängt mit Verzögerung hinter dem Auto, das wirklich lenkt.
    const HORIZONT = 116;
    const F = 235;                  // Brennweite (Pixel)
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
      sued:  { boden: '#e0cfa2', deko: ['🌵', '🌴', '🌵'], himmel: ['#4ea8de', '#bde6f5'] },
      west:  { boden: '#d5c08c', deko: ['🌵', '🌴', '🪨'], himmel: ['#4ea8de', '#bde6f5'] },
      teide: { boden: '#93775e', deko: ['🌲', '🪨', '🌲'], himmel: ['#3d7fb8', '#a9d2e8'] },
      nord:  { boden: '#a2bd77', deko: ['🌴', '🌳', '🍌'], himmel: ['#5aa5cf', '#c9e6f0'] },
      anaga: { boden: '#88ad68', deko: ['🌳', '🌿', '🌲'], himmel: ['#5aa5cf', '#c9e6f0'] },
    };
    const thema = THEMEN[zielZone] || THEMEN.sued;
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
        icon: gegen ? (Math.random() < 0.5 ? '🚌' : '🚗') : ['🚗', '🚙', '🚕'][Math.floor(Math.random() * 3)],
        prevRel: 1, hitCd: 0,
      });
    }

    // Spielzustand
    let px = samples[0].x, pz = samples[0].z, heading = samples[0].richtung;
    let camYaw = heading, speed = 0, lenk = 0, lenkIst = 0, gas = 0;
    let roadIdx = 0, treffer = 0, stil = 0, blitz = 0, offroadZeit = 0;
    let boostRest = 3, boostZeit = 0, vorbei = false, countdownPiep = 3;
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
      lenk = x < W / 2 ? -1 : 1;
      e.preventDefault();
    }
    const zeigerHoch = () => { lenk = 0; };

    document.addEventListener('keydown', tasteRunter);
    document.addEventListener('keyup', tasteHoch);
    canvas.addEventListener('pointerdown', zeigerRunter);
    document.addEventListener('pointerup', zeigerHoch);

    function aufraeumen() {
      motorStopp();
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

    function zeichneAuto(x, y, neigung) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(neigung * 0.06);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(0, 16, 30, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1d1f2a';
      ctx.fillRect(-26, 4, 10, 12); ctx.fillRect(16, 4, 10, 12);
      ctx.fillStyle = '#e63946';
      ctx.beginPath(); ctx.roundRect(-24, -6, 48, 20, 6); ctx.fill();
      ctx.fillStyle = '#f77f8b';
      ctx.beginPath(); ctx.roundRect(-24, -6, 48, 7, [6, 6, 0, 0]); ctx.fill();
      ctx.fillStyle = '#2b3a55';
      ctx.beginPath(); ctx.roundRect(-15, -16, 30, 12, 4); ctx.fill();
      ctx.fillStyle = '#e63946';
      ctx.fillRect(-17, -19, 34, 5);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-22, 2, 6, 4); ctx.fillRect(16, 2, 6, 4);
      ctx.restore();
    }

    function schleife(now) {
      if (vorbei) return;
      const dt = Math.min(50, now - letztes) / 1000;
      letztes = now;
      const seitStart = now - start;
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
        let zielTempo = boostZeit > 0 ? 38 : gas > 0 ? 26 : gas < 0 ? 4 : 18;
        if (abseits) zielTempo *= 0.55;
        speed += (zielTempo - speed) * dt * (gas < 0 ? 2.6 : boostZeit > 0 ? 2.0 : 0.9);
        lenkIst += (lenk - lenkIst) * Math.min(1, dt * 7);
        const griff = regnet ? 0.82 : 1;
        heading += lenkIst * 1.4 * dt * Math.min(1, speed / 10) * griff;
        if (regnet && speed > 14) heading += (Math.random() - 0.5) * 0.5 * dt;
        px += Math.sin(heading) * speed * dt;
        pz += Math.cos(heading) * speed * dt;
      }
      if (motor) { try { motor.osc.frequency.value = 45 + (speed / 38) * 85; } catch (e) { /* egal */ } }

      // Abseits: Gerumpel & Zeitstrafe
      if (abseits && speed > 6) {
        offroadZeit += dt;
        if (offroadZeit > 1.0) { treffer++; blitz = 300; offroadZeit = 0; piep(120, 200, 'sawtooth', 0.12); }
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
          treffer++; blitz = 300; auto.hitCd = 2; speed *= 0.55;
          piep(110, 260, 'sawtooth', 0.14);
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
          h.erledigt = true; treffer++; blitz = 300; piep(110, 260, 'sawtooth', 0.14);
        } else if (abstand < 3.6 && speed > 15 && Math.abs(winkelNorm(Math.atan2(h.x - px, h.z - pz) - heading)) > 1.7) {
          h.erledigt = true; stil += 5;
          schweber.push({ text: 'Riskant! +5', alter: 0 });
        }
      }

      // Kamera folgt mit Verzögerung (Chase-Cam)
      camYaw += winkelNorm(heading - camYaw) * Math.min(1, dt * 4);
      const sinY = Math.sin(camYaw), cosY = Math.cos(camYaw);
      const kamX = px - sinY * KAM_ABSTAND, kamZ = pz - cosY * KAM_ABSTAND;
      const projiziere = (x, z) => {
        const dx = x - kamX, dz = z - kamZ;
        return { rz: dx * sinY + dz * cosY, rx: dx * cosY - dz * sinY };
      };

      // ————— Zeichnen —————
      // Himmel, Sonne & Teide (dreht mit der Blickrichtung)
      const himmel = ctx.createLinearGradient(0, 0, 0, HORIZONT);
      himmel.addColorStop(0, himmelFarben[0]); himmel.addColorStop(1, himmelFarben[1]);
      ctx.fillStyle = himmel; ctx.fillRect(0, 0, W, HORIZONT);
      const teideRel = winkelNorm(0.6 - camYaw);
      if (Math.abs(teideRel) < 1.15) {
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
      if (!regnet && !truebe) {
        const sonneRel = winkelNorm(-1.8 - camYaw);
        if (Math.abs(sonneRel) < 1.2) {
          ctx.fillStyle = calima ? '#f0d9a0' : '#ffe8a3';
          ctx.beginPath(); ctx.arc(W / 2 + Math.tan(sonneRel) * F, 40, 16, 0, Math.PI * 2); ctx.fill();
        }
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
      for (const h of hindernisse) if (!h.erledigt || h.icon !== '🐐') sammle(h, 'deko');
      for (const auto of verkehr) sammle(auto, 'deko');
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
        } else {
          ctx.font = Math.min(96, Math.max(5, (s.o.gr || 3) * F / s.rz)) + 'px serif';
          ctx.fillText(s.o.icon, s.sx, s.sy);
        }
      }

      // Auto: hängt in Kurven sichtbar seitlich in der Kamera (Chase-Cam-Gefühl)
      const versatz = Math.max(-46, Math.min(46, Math.sin(winkelNorm(heading - camYaw)) * 150));
      const ruettel = abseits && speed > 6 ? (Math.random() - 0.5) * 4 : 0;
      zeichneAuto(W / 2 + versatz + ruettel, H - 58 + ruettel * 0.5, lenkIst + winkelNorm(heading - camYaw) * 2);

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
      ctx.textAlign = 'center';
      for (const s of schweber) {
        s.alter += dt;
        ctx.globalAlpha = Math.max(0, 1 - s.alter / 1.1);
        ctx.fillStyle = '#ffd166';
        ctx.strokeStyle = 'rgba(43,45,66,0.8)'; ctx.lineWidth = 3;
        ctx.font = 'bold 17px sans-serif';
        const sy = H - 130 - s.alter * 55;
        ctx.strokeText(s.text, W / 2, sy);
        ctx.fillText(s.text, W / 2, sy);
      }
      ctx.globalAlpha = 1;
      while (schweber.length && schweber[0].alter > 1.1) schweber.shift();

      // Zu weit weg von der Straße?
      if (seitAbstand > 22 && seitStart > COUNTDOWN) {
        ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(43,45,66,0.8)'; ctx.lineWidth = 4;
        ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
        ctx.strokeText('↩ Zurück zur Straße!', W / 2, 60);
        ctx.fillText('↩ Zurück zur Straße!', W / 2, 60);
      }

      // Minimap (unten links)
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
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('💥 ' + treffer, 6, 18);
      ctx.fillStyle = '#ffd166';
      ctx.fillText('🏎️ ' + stil, 42, 18);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'right';
      ctx.fillText('🏁 ' + Math.max(0, Math.ceil(GESAMT_KM * (1 - fortschritt))) + ' km · ' +
        Math.round(speed * 3.6) + ' km/h', W - 6, 18);

      // Countdown-Overlay
      if (seitStart < COUNTDOWN) {
        ctx.fillStyle = 'rgba(43,45,66,0.45)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.font = 'bold 64px sans-serif';
        ctx.fillText(String(Math.ceil((COUNTDOWN - seitStart) / (COUNTDOWN / 3))), W / 2, H / 2);
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText('Fahrt nach ' + zielName + ' – bereit machen …', W / 2, H / 2 + 34);
      }

      // Angekommen? (oder Zeitlimit: irgendwann ist jeder mal da)
      if (roadS >= S_END - 6 || fahrZeit > ZEITLIMIT) {
        vorbei = true;
        aufraeumen();
        ctx.fillStyle = 'rgba(43,45,66,0.55)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.font = 'bold 30px sans-serif';
        ctx.fillText('🏁 ' + zielName + ' erreicht!', W / 2, H / 2);
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

  function zeigeKino(motiv, titel, untertitel, weiterCb, fotoNeu) {
    const videoP = BILDER.videoHole(motiv);   // parallel zur Bildsuche starten
    Promise.race([BILDER.hole(motiv), wartezeit(1800)]).then(bild => {
      if (!bild) {
        // Kein Bild? Vielleicht gibt es wenigstens ein Video.
        Promise.race([videoP, wartezeit(2200)]).then(video => {
          if (video) kinoOeffnen(motiv, null, video, titel, untertitel, weiterCb, fotoNeu);
          else weiterCb();
        });
        return;
      }
      kinoOeffnen(motiv, bild, null, titel, untertitel, weiterCb, fotoNeu);
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

  function kinoOeffnen(motiv, bild, video, titel, untertitel, weiterCb, fotoNeu) {
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
    const weiter = el('button', 'btn btn-primary', '▶ Weiter');
    weiter.addEventListener('click', () => { kinoSchliessen(); weiterCb(); });
    buttons.appendChild(weiter);
    if (bild) {
      const quelle = el('a', 'btn btn-klein', '📷 Quelle');
      quelle.href = bild.artikelUrl; quelle.target = '_blank'; quelle.rel = 'noopener';
      quelle.id = 'kino-quelle';
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
      if (quelle) { quelle.href = video.quelle; quelle.textContent = '🎥 Quelle'; }
      else {
        const neu = el('a', 'btn btn-klein', '🎥 Quelle');
        neu.href = video.quelle; neu.target = '_blank'; neu.rel = 'noopener';
        neu.id = 'kino-quelle';
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
      'Echte Häuser deiner Region: Dein Reisestil bestimmt das Gesamtbudget – und wie gut du dich nachts erholst.',
      Object.entries(DATA.HOTELS[cfg.region]).map(([id, h]) =>
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
    const hotel = DATA.HOTELS[cfg.region][cfg.hotel];
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
    const hotel = D.HOTELS[run.region][run.hotel];
    const zimmerInfo = run.flags.zimmerSchoen ? ' · 🌅 Zimmer mit Meerblick'
      : run.flags.zimmerLaut ? ' · 🔊 Zimmer zum Parkplatz' : '';
    $('#spiel-kopf').innerHTML = `
      <div class="kopf-links">
        <div class="kopf-tag">☀️ Tag ${run.tag} von ${run.dauer} · <strong>${slotName}</strong></div>
        <div class="kopf-ort">${D.REGIONEN[run.region].icon} ${esc(hotel.name)} ${hotel.sterne}, ${esc(D.REGIONEN[run.region].name)}${zimmerInfo}</div>
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

      if (!e.gesperrt) karte.addEventListener('click', () => aktivitaetWaehlen(act.id));
      else karte.disabled = true;
      raster.appendChild(karte);
    }
  }

  // ------------------------------------------------------------ Aktivitätsfluss
  function aktivitaetWaehlen(id) {
    const res = Game.aktivitaetAusfuehren(id);
    if (!res) return;
    if (res.fahrt) zeigeFahrt(res, () => ergebnisZeigen(res));
    else ergebnisZeigen(res);
  }

  function ergebnisZeigen(res) {
    // Highlights & neue Fotos bekommen zuerst ihren Kino-Moment
    const erstesMal = Game.run && Game.run.aktZaehler[res.act.id] === 1;
    const kinoMotiv = res.fotoNeu && BILDER.ARTIKEL[res.fotoNeu] ? res.fotoNeu
      : (DATA.HIGHLIGHTS.includes(res.act.id) && erstesMal ? motivFuerAct(res.act) : null);

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

    if (kinoMotiv) {
      const titel = res.fotoNeu ? DATA.FOTOS[res.fotoNeu].name : res.act.name;
      zeigeKino(kinoMotiv, titel, `Teneriffa · Tag ${Game.run.tag}`, modalZeigen, !!res.fotoNeu);
    } else modalZeigen();
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
      <tr><th></th><th>Punkte</th><th>Reise</th><th>Fotos</th><th>Datum</th></tr>${zeilen}</table></div>`;
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
    $('#btn-flug-weiter').classList.remove('versteckt');
    $('#btn-flug-weiter').onclick = () => {
      flugAufraeumen();
      Game.flugBestaetigen();
      renderSpiel();
      zeigeScreen('spiel');
      toast('🌴 Willkommen auf Teneriffa – dein Urlaub beginnt jetzt!');
    };
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
        // Über einen echten Link öffnen → neuer Tab, kein Popup-Blocker
        const a = el('a');
        a.href = img.dataset.quelle; a.target = '_blank'; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
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
