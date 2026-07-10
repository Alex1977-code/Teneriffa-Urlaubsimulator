# 🌴 Teneriffa Urlaubssimulator

Ein Browserspiel, das einen Urlaub auf Teneriffa simuliert – realistisch, mit echten Orten
und Mikroklimata, strategischer Tiefe und langfristigem Sammel-Suchtfaktor.
Komplett in HTML, CSS und JavaScript, ohne Abhängigkeiten, ohne Build-Schritt.

## ▶️ Direkt online spielen

**https://alex1977-code.github.io/Teneriffa-Urlaubsimulator/**

(Wird bei jedem Push automatisch über GitHub Actions auf GitHub Pages veröffentlicht.)

Oder lokal: einfach `index.html` im Browser öffnen. Alternativ servieren mit:

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

Der Spielstand (Level, Fotoalbum, Erfolge, Bestenliste) wird lokal im Browser gespeichert.

## 🎮 Das Spiel

Du buchst einen Urlaub (7, 10 oder 14 Tage), wählst Unterkunft im Süden oder Norden,
Mietwagen oder TITSA-Bus – und packst deinen Koffer. Dann gilt es, jeden Tag in drei
Zeitfenstern (Vormittag, Nachmittag, Abend) das Beste aus der Insel zu machen:

- **Die Anreise als Echtzeit-Flug** – Boarding, Getränkeservice (mit Eiswürfeln, obwohl du
  „ohne“ gesagt hast …), mit Glück der Teide aus dem Fenster – mit Pech Verspätung, ein
  verlorener Koffer, der erst an Tag 3 nachgeliefert wird, oder das laute Zimmer zum Parkplatz.
- **37 Aktivitäten an echten Orten** – von der Masca-Schlucht über die Teide-Seilbahn,
  den Siam Park, Brunelli’s Steakhouse über der Brandung von Punta Brava, La Orotava,
  den Barranco del Infierno und die Cueva del Viento bis zur Guachinche, die dir erst
  ein Einheimischer verraten muss.
- **Realistisches Wetter** – der Süden ist sonnenverwöhnt, der Norden wechselhaft
  (Passatwolken!), am Teide herrscht Höhenwetter. Und manchmal kommt Calima.
- **Ressourcen-Management** – Budget, Energie, Stimmung, Erholung, **Stress** und
  Sonnenbrand wollen ausbalanciert werden. Reservierte Poolliegen, Staus und
  Flugverspätungen treiben den Stress hoch – ab 70 kannst du kaum noch abschalten.
  Spa, Siesta und schöne Abende bringen dich wieder runter.
- **Zufallsereignisse mit Entscheidungen** – Delfine am Bug, die Splash-Zone der
  Orca-Show (klatschnass!), die Kiss-Cam im Loro Parque, fliegende Händler,
  Hotel-Upgrades und der Barraquito, den du nie vergisst.
- **Anreise & Abreise zählen** – am Ankunftstag bist du erst mittags im Hotel, am
  Abreisetag bleibt nur der Vormittag.
- **Unterwegs auf der Insel** – Ausflüge in andere Regionen laufen als Reise-Sequenz mit
  animierter Route auf der Inselkarte ab: Staus, Ziegenherden, Miradore, Barraquito-Stopps.
  Mit dem Mietwagen kannst du **selbst ans Steuer** – eine Pseudo-3D-Fahrt mit Lenkung,
  Gas und Bremse, Hügelkuppen, Kurven-Warnschildern, Gegenverkehr und Ortsschild am Ziel.
  Die Landschaft passt zur echten Route (Lavaland Richtung Teide, grüner Norden), und bei
  Regen wird die Straße rutschig. Fehlerfreie Fahrten entspannen, Rempler kosten Nerven.
- **Echte Fotos & Videos – direkt im Spiel** – die Aktivitäten zeigen fotorealistische
  Bilder der echten Orte, Highlights laufen als Vollbild-Kino-Moment. Gibt es ein passendes
  freies Video, spielt es direkt im Spiel ab (optional mit Ton). Fotos und Videos kommen
  live von Wikipedia/Wikimedia Commons; Quelle-Links führen zu Autor- und Lizenzangaben.
- **Urlaubsflirt** – eine kleine Geschichte in drei Akten: Kennenlernen am Strand,
  Wiedersehen, Sonnenuntergangs-Date. Wer sich traut, wird mit Erinnerungen belohnt.

## 🔁 Suchtfaktor

- **Urlaubsscore** aus Erholung, Erlebnissen, Stimmung, Fotos, Souvenirs und Urlaubszielen,
  abzüglich deines Stresslevels bei der Abreise – wiederholte Aktivitäten verlieren an
  Neuigkeitswert, Abwechslung wird belohnt.
- **3 zufällige Urlaubsziele** pro Durchgang (à 40 Bonuspunkte) machen jeden Urlaub anders.
- **Fotoalbum mit 28 Motiven** und **19 Erfolge**, die über alle Urlaube hinweg erhalten bleiben.
- **10 Inselkenner-Level** mit Titeln vom „Neuankömmling“ bis zum „Geist der Guanchen“ –
  ab Level 2/3/4 schaltest du Geheimstrand, Tauchausflug und Paragliding frei.
- **Lokale Bestenliste** – und die Messlatte für „Traumurlaub“ wächst mit der Urlaubsdauer.

## 🗂️ Projektstruktur

```
index.html          Bildschirm-Gerüst
css/style.css       Design (Atlantikblau, Vulkansand, Kanarensonne)
js/data.js          Spieldaten: Orte, Wetter, Ereignisse, Fotos, Erfolge, Levels
js/game.js          Spiel-Engine (reine Logik, ohne DOM – in Node testbar)
js/ui.js            Rendering & Bedienung
js/main.js          Einstiegspunkt
test/simulation.js  Headless-Test: spielt 300 Urlaube durch und prüft Invarianten
```

## ✅ Tests

```bash
node test/simulation.js
```

Simuliert 300 komplette Urlaube mit Zufallsspielern und prüft, dass alle Spielwerte in
ihren Grenzen bleiben, jeder Urlaub regulär endet und die Punkteabrechnung konsistent ist.
