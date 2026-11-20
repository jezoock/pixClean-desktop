# PixelClean Studio Desktop

Application standalone **Electron** pour **PixelClean Studio**, construite au-dessus de la librairie [`pixclean`](https://github.com/jezoock/pixClean) et des Web Components [`dot-stash`](https://github.com/jezoock/dot-stash).

## Fonctionnalités Desktop

- **Zéro duplication de code métier** : consomme directement `pixclean` (`createPixelCleanEditor`) et `dot-stash` via leurs archives de releases GitHub.
- **Intégration système native** :
  - Menu natif multiplateforme (*Fichier → Ouvrir*, *Enregistrer*, *Enregistrer sous…*, *Aperçu & Export PNG…*).
  - Raccourcis clavier natifs (`Ctrl/Cmd+O`, `Ctrl/Cmd+S`, `Ctrl/Cmd+Shift+S`, `Ctrl/Cmd+E`).
  - Boîtes de dialogue système natives d'ouverture (PNG, JPEG, WebP) et d'enregistrement direct sur disque (`Appliquer` ou `Ctrl/Cmd+S`).
  - Support « Ouvrir avec » / argument CLI / glisser-déposer / presse-papiers (`Ctrl/Cmd+V`).
- **Sécurité Electron stricte** : `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, pont IPC typé minimal via `contextBridge`.

## Installation & Développement

Le fichier `.npmrc` configure `allow-remote=root` pour autoriser l'installation directe des tarballs GitHub `dot-stash` et `pixclean`.

```bash
npm install
npm run dev
```

### Développer contre un clone local de `pixClean`

```bash
cd ../pixClean && npm run build:lib
cd ../pixClean-desktop && npm install ../pixClean
npm run dev
```

## Commandes

- `npm run dev` : lance Vite (HMR) + Electron en parallèle
- `npm run typecheck` : vérifie le renderer (`src/`) et les processus Electron (`electron/`)
- `npm run build` : compile le renderer (`dist/`) et Electron (`dist-electron/`)
- `npm start` : compile puis lance l'application Electron en mode production
- `npm run dist` : génère les installeurs natifs via `electron-builder` (`AppImage`/`deb`, `nsis`/`portable`, `dmg`/`zip`) dans `release/`

## Architecture

```text
electron/
  ipc-types.ts      Contrat IPC partagé entre main, preload et renderer
  main.ts           Fenêtre Electron, menu natif, dialogues fichiers et lock single-instance
  preload.ts        Pont sécurisé contextBridge -> window.pixCleanDesktop
src/
  main.ts           Monte createPixelCleanEditor (pixclean) et connecte les actions OS natives
scripts/
  write-electron-pkg.mjs  Génère dist-electron/package.json (CommonJS requis par preload sandboxé)
```
