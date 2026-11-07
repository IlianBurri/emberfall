# Upgrade three: 0.170.0 → 0.187.0

## Checks
- (keine)

## Was der Agent gemacht hat
### Runde 1
Ich habe eine Stelle angepasst. Getestet habe ich nichts, denn es gibt keine automatischen Checks, und ich habe das Spiel nicht gestartet. Die Suche war ein Grep nach den bekannten Änderungen. Die Release Notes waren wegen des 403 unvollständig, und den Migration Guide habe ich nicht gelesen.

**Änderung**
- `client/js/main.js` (Zeile 46): `THREE.PCFSoftShadowMap` ist in three 0.187.0 entfernt. Die Bibliothek warnt und fällt auf `PCFShadowMap` zurück. Ich habe die Zeile direkt auf `THREE.PCFShadowMap` gesetzt. Vorher wählte `quality.aa` zwischen weichen und normalen Schatten, jetzt gibt es nur noch eine Schattenart.

**Geprüft, keine Änderung nötig**
- Es gibt keine Verwendung von `Clock`, `getDelta`, veralteten Encoding-Optionen, `*BufferGeometry`-Klassen, `uv2` oder `useLegacyLights`.
- Die Addon-Importe (`GLTFLoader`, `SkeletonUtils`, `mergeGeometries`, `RoundedBoxGeometry`) sind vorhanden.
- Der Server liefert `three.module.js` und `three.core.js` aus `node_modules` aus. Das passt zum neuen Build.

**Von Hand testen**
- Die Schattenqualität prüfen, vor allem bei hoher Qualität mit `quality.aa`. Sie kann härter wirken als vorher.
- Das Spiel im Browser starten und in der Konsole nach three-Warnungen schauen.
- Charaktere (GLTF-Laden), abgerundete Boxen, Instanzen, Nebel und die Sonnenscheibe ansehen.

---
Kosten: ca. $0.08 · erstellt von Relvo
