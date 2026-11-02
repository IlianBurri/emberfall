# EMBERFALL

Ein eigener, stilisierter Low-Poly-Ego-Shooter für den Browser: Story-Kampagne, Koop-Missionen und LAN-PvP.
Alle Namen, Waffen, Maps und die Story sind frei erfunden. Belohnungen gibt es nur als Ingame-Währung (◆ Splitter), kein Echtgeld.

## Starten (ein Befehl)

Voraussetzung: Node.js (ab 18). Im Projektordner:

```
npm start
```

oder Doppelklick auf **start.bat**. Beim ersten Mal werden `three` und `ws` installiert. Danach öffnet sich der Browser
mit `http://localhost:3000`. Anderer Port: `npm start -- --port 3001`.

## Mit Freunden im LAN spielen

1. Einer startet den Server (`npm start`). Im Fenster stehen Adressen wie `http://192.168.1.23:3000`.
   Nimm die Adresse deines WLAN-/Ethernet-Adapters (im Zweifel `ipconfig` → „IPv4-Adresse“).
2. Windows fragt beim ersten Start, ob Node.js im Netzwerk kommunizieren darf → **Private Netzwerke erlauben**.
3. Freunde öffnen diese Adresse im Browser (Chrome/Edge/Firefox) – nichts installieren nötig.
4. Alle gehen auf **Koop & LAN-PvP**. Einer erstellt einen Raum (PvP mit Map-Wahl oder Koop mit Mission), die anderen klicken **Beitreten**, der Host klickt **Runde starten**.

- **LAN-PvP:** Jeder gegen jeden, 20 Kills oder 5 Minuten. Der Server führt die Lebenspunkte.
- **Battle Royale:** Fallschirmsprung über der Map, Waffen/Munition/Medikits/Westen mit **E** aufsammeln,
  die blaue Zone schrumpft (außerhalb gibt es Schaden), kein Wiedereinstieg – der Letzte gewinnt. Ausgeschiedene schauen zu (Klick wechselt).
- **Koop:** Story-Missionen zu zweit bis zu acht. Der Host berechnet die Gegner; verlässt er die Runde, übernimmt automatisch ein anderer.

## Online stellen (Render.com, kostenlos)

Damit Freunde auch von zu Hause mitspielen können, ohne im selben WLAN zu sein:

1. **GitHub:** Auf github.com einloggen → **New repository** → Name `emberfall` → **Create repository**.
   Dann im Projektordner (Terminal):
   ```
   git remote add origin https://github.com/IlianBurri/emberfall.git
   git push -u origin main
   ```
2. **Render:** Auf render.com mit GitHub anmelden → **New +** → **Blueprint** → das Repository `emberfall` wählen → **Apply**.
   Render liest `render.yaml` und richtet alles selbst ein (Gratis-Tarif, Start mit `npm run server`).
3. Nach ein paar Minuten läuft das Spiel unter `https://emberfall.onrender.com` (oder ähnlich – steht im Render-Dashboard).
   Diese Adresse an Freunde schicken. Lobby, Koop, PvP und Battle Royale laufen genau wie im LAN.

Hinweise: Im Gratis-Tarif schläft der Server nach ca. 15 Minuten ohne Besucher ein – der erste Aufruf dauert dann ~30 Sekunden.
Neue Versionen: Änderungen committen und `git push` – Render baut automatisch neu.
Fortschritt (Splitter, Skins, Outfits) wird im Browser pro Webadresse gespeichert, online startet also jeder neu.

## Steuerung

WASD laufen · Maus zielen · Linksklick schießen · Rechtsklick zielen/zoomen · R nachladen · 1/2/Q/Mausrad Waffe wechseln ·
G Granate · Shift sprinten · C ducken · Leertaste springen · Tab Punktestand · Esc Pause

## Inhalt

- **Story:** 8 Missionen mit durchgehender Handlung (Major Vogt, Funkerin Echo, Kommandant Rostzahn) und Zielen wie Eliminieren, Datenkerne sammeln, Störsender zerstören, Zone/Uplink halten, Geisel befreien und eskortieren, Bomben unter Zeitdruck entschärfen und Bosskampf. Vor und nach jeder Mission läuft eine **Zwischensequenz** (Kamerafahrt, Kinobalken, Titelkarte mit Ort/Uhrzeit, Untertitel, optionale Sprachausgabe; Leertaste überspringt). 3 Schwierigkeitsgrade.
- **Quests:** feste Aufträge + 3 tägliche Aufträge mit Splitter-Belohnung.
- **Waffen:** Sturmgewehr, MP, DMR, Schrotflinte, LMG, Scharfschützengewehr, Pistole, Reihenfeuerpistole, Revolver – mit Rückstoß, Streuung, Nachladen und Schadensabfall.
- **Aufsätze:** Visiere (inkl. 4x-Zielfernrohr), Schalldämpfer, Kompensator, Mündungsbremse, Magazine, Griffe, Schäfte.
- **Skins:** 22 Kisten-Skins in 4 Seltenheitsstufen, 3 Waffenkisten, plus eigener Skin-Editor (Farben, Muster, Größe, Leuchten).
- **Charakter:** Im Hauptmenü steht dein Soldat. Uniform, Hose, Weste, Kopfbedeckung, Maske, Brille und Hautton anpassen.
  Teile gibt es im Shop, in der Ausrüstungskiste oder als Belohnung für Story-Missionen. Mitspieler sehen dein Outfit.
- **Shop:** Waffen, Aufsätze, Ausrüstung und ein Reiter **Codes** – der richtige Code schaltet das Cheat-Menü frei
  (Wallhack, ESP, Aimbot, Speed, Jump, Max-Leben, Godmode, unendlich Munition, kein Rückstoß, Feuerrate; auch im Pause-Menü).
- **Fortschritt:** wird im Browser (localStorage) gespeichert – jeder Spieler auf seinem eigenen Gerät.

- **Maps:** Stadt mit Stadtmauer und Toren, drumherum ein Umland mit Hügeln, Feldwegen, Wäldern, Felsen und Orten
  (Bauernhof, Funkhügel, Tankstelle, Tanklager, Depot, Weiler). Berge am Rand bilden die natürliche Grenze, bei Hafen-Maps das Meer.

## Technik

- `server/server.js` – HTTP-Server für den Client + WebSocket-Lobby (Räume, PvP-Lebenspunkte, Weiterleitung für Koop).
- `client/` – Three.js, kein Build-Schritt, keine externen 3D-Dateien: alle Modelle sind prozedural (abgerundete Quader,
  Kapseln, extrudierte Profile) und werden pro Teil zu wenigen Geometrien zusammengebacken.
  - `geom.js` – abgerundete Quader, Kapseln, Zusammenbacken, Himmels-Spiegelungen (PBR-Umgebung)
  - `weapon.js` – Waffen (PBR: Polymer, eloxiertes Metall, Stahl, Gummi, Glas), Hände in der Ego-Ansicht
  - `characters.js` – animierte 3D-Figur „SWAT“ (Quaternius, CC0, siehe `client/assets/models/LICENSE.txt`): Skelett-Animationen, Einfärbung je Outfit/Fraktion, alle Teile zu 1 Mesh verschmolzen
  - `actors.js` – Gegner-KI; eigene prozedurale Soldaten als Rückfall, falls das Modell nicht lädt
  - `cinematic.js` – Zwischensequenzen
  - `vehicles.js` – Autos (Limousine, Kompakt, Pickup, Transporter); alle Autos einer Map = 4 Draw Calls
  - `terrain.js` / `outskirts.js` – Höhenkarte, Straßennetz, Orte, Vegetation im Umland
  - Statische Stadt = eine InstancedMesh, Partikel/Leuchtspuren/Hülsen je ein Draw Call. Grafikstufe „Niedrig“ schaltet Schatten ab.
