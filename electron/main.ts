import { app, BrowserWindow, dialog, ipcMain, Menu, type MenuItemConstructorOptions } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { MenuCommand, OpenedFilePayload, SavePngRequest, SavePngResult } from './ipc-types';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

let mainWindow: BrowserWindow | null = null;
let pendingFilePath: string | null = null;

function mimeTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}

function extractImageArg(argv: string[]): string | null {
  for (const arg of argv.slice(1)) {
    if (arg.startsWith('-')) continue;
    const ext = path.extname(arg).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) {
      return path.resolve(arg);
    }
  }
  return null;
}

async function readImageFile(filePath: string): Promise<OpenedFilePayload> {
  const buf = await readFile(filePath);
  return {
    filePath,
    name: path.basename(filePath),
    mimeType: mimeTypeFromPath(filePath),
    bytes: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
  };
}

function sendMenuCommand(command: MenuCommand): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('pixclean:menu-command', command);
}

async function dispatchOpenFile(filePath: string): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingFilePath = filePath;
    return;
  }
  try {
    const payload = await readImageFile(filePath);
    mainWindow.webContents.send('pixclean:open-file', payload);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } catch {
    // Ignore unreadable CLI/OS path
  }
}

function buildAppMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Ouvrir une image…',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenuCommand('open'),
        },
        { type: 'separator' },
        {
          label: 'Enregistrer',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendMenuCommand('save'),
        },
        {
          label: 'Enregistrer sous…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendMenuCommand('save-as'),
        },
        {
          label: 'Aperçu & Export PNG…',
          accelerator: 'CmdOrCtrl+E',
          click: () => sendMenuCommand('export-modal'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: 'Quitter' },
      ],
    },
    {
      label: 'Édition',
      submenu: [
        { role: 'undo', label: 'Annuler' },
        { role: 'redo', label: 'Rétablir' },
        { type: 'separator' },
        { role: 'cut', label: 'Couper' },
        { role: 'copy', label: 'Copier' },
        { role: 'paste', label: 'Coller' },
        { role: 'selectAll', label: 'Tout sélectionner' },
      ],
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: 'Recharger' },
        { role: 'toggleDevTools', label: 'Outils de développement' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom par défaut' },
        { role: 'zoomIn', label: 'Zoom avant' },
        { role: 'zoomOut', label: 'Zoom arrière' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein écran' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#11131a',
    title: 'PixelClean Studio Desktop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    void mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle('pixclean:open-file-dialog', async (): Promise<OpenedFilePayload | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Ouvrir une image pixel art',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return readImageFile(result.filePaths[0]);
  });

  ipcMain.handle(
    'pixclean:save-png',
    async (_event, request: SavePngRequest): Promise<SavePngResult> => {
      let destination = request.targetPath;

      if (!destination) {
        const result = await dialog.showSaveDialog({
          title: 'Enregistrer le PNG nettoyé',
          defaultPath: request.defaultName,
          filters: [{ name: 'Image PNG', extensions: ['png'] }],
        });
        if (result.canceled || !result.filePath) {
          return { saved: false };
        }
        destination = result.filePath;
      }

      const data = Buffer.from(request.bytes);
      await writeFile(destination, data);
      return { saved: true, filePath: destination };
    },
  );

  ipcMain.handle('pixclean:get-pending-file', async (): Promise<OpenedFilePayload | null> => {
    if (!pendingFilePath) return null;
    const target = pendingFilePath;
    pendingFilePath = null;
    try {
      return await readImageFile(target);
    } catch {
      return null;
    }
  });

  ipcMain.on('pixclean:set-title', (_event, title: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle(title);
    }
  });
}

pendingFilePath = extractImageArg(process.argv);

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const filePath = extractImageArg(argv);
    if (filePath) {
      void dispatchOpenFile(filePath);
    } else if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    void dispatchOpenFile(filePath);
  });

  void app.whenReady().then(() => {
    buildAppMenu();
    registerIpcHandlers();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
