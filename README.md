# 🌴 Teneriffa Urlaubssimulator

Ein Browserspiel, das einen Urlaub auf Teneriffa simuliert – realistisch, mit echten Orten
und Mikroklimata, strategischer Tiefe und langfristigem Sammel-Suchtfaktor.
Komplett in HTML, CSS und JavaScript, ohne Abhängigkeiten, ohne Build-Schritt.

## ▶️ Spielen

Einfach `index.html` im Browser öffnen – fertig. Alternativ lokal servieren:

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

Der Spielstand (Level, Fotoalbum, Erfolge, Bestenliste) wird lokal im Browser gespeichert.

## 🎮 Das Spiel

Du buchst einen Urlaub (7, 10 oder 14 Tage), wählst Unterkunft im Süden oder Norden,
Mietwagen oder TITSA-Bus – und packst deinen Koffer. Dann gilt es, jeden Tag in drei
Zeitfenstern (Vormittag, Nachmittag, Abend) das Beste aus der Insel zu machen:

- **31 Aktivitäten an echten Orten** – von der Masca-Schlucht über die Teide-Seilbahn und
  den Siam Park bis zur Guachinche, die dir erst ein Einheimischer verraten muss.
- **Realistisches Wetter** – der Süden ist sonnenverwöhnt, der Norden wechselhaft
  (Passatwolken!), am Teide herrscht Höhenwetter. Und manchmal kommt Calima.
- **Ressourcen-Management** – Budget, Energie, Stimmung, Erholung und Sonnenbrand wollen
  ausbalanciert werden. Wer erschöpft in die Schlucht steigt, hat nur halb so viel davon.
- **Zufallsereignisse mit Entscheidungen** – Delfine am Bug, Stau auf der TF-1,
  fliegende Händler, Hotel-Upgrades und der Barraquito, den du nie vergisst.
- **Anreise & Abreise zählen** – am Ankunftstag bist du erst mittags im Hotel, am
  Abreisetag bleibt nur der Vormittag.

## 🔁 Suchtfaktor

- **Urlaubsscore** aus Erholung, Erlebnissen, Stimmung, Fotos, Souvenirs und Urlaubszielen –
  wiederholte Aktivitäten verlieren an Neuigkeitswert, Abwechslung wird belohnt.
- **3 zufällige Urlaubsziele** pro Durchgang (à 40 Bonuspunkte) machen jeden Urlaub anders.
- **Fotoalbum mit 21 Motiven** und **14 Erfolge**, die über alle Urlaube hinweg erhalten bleiben.
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
