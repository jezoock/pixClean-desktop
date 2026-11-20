import 'dot-stash/dist/css/default.css';
import 'pixclean/style.css';
import {
  createPixelCleanEditor,
  definePixelCleanElements,
  type PixelCleanApplyPayload,
} from 'pixclean';
import type { OpenedFilePayload } from '../electron/ipc-types';

definePixelCleanElements(window);

const desktop = window.pixCleanDesktop;
const container = document.querySelector<HTMLElement>('#app');

if (container) {
  let currentSavedPath: string | undefined;
  let currentFileName = '';

  const updateTitle = (name?: string) => {
    const label = name ? `${name} — PixelClean Studio Desktop` : 'PixelClean Studio Desktop';
    document.title = label;
    desktop?.setWindowTitle(label);
  };

  async function saveBlobToDisk(
    blob: Blob,
    defaultName: string,
    targetPath?: string,
  ): Promise<void> {
    if (!desktop) {
      // Fallback when opened directly in a browser during dev
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = defaultName;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const arrayBuffer = await blob.arrayBuffer();
    const res = await desktop.savePng({
      bytes: new Uint8Array(arrayBuffer),
      defaultName,
      targetPath,
    });
    if (res.saved && res.filePath) {
      currentSavedPath = res.filePath;
      const parts = res.filePath.split(/[\\/]/);
      currentFileName = parts[parts.length - 1] || defaultName;
      updateTitle(currentFileName);
    }
  }

  const editor = createPixelCleanEditor(container, {
    exportScale: 4,
    showHeader: true,
    showImportButton: true,
    showSampleButton: true,
    onApply: async (payload: PixelCleanApplyPayload) => {
      await saveBlobToDisk(payload.blob, payload.filename, currentSavedPath);
    },
  });

  async function loadOpenedFile(payload: OpenedFilePayload): Promise<void> {
    const blob = new Blob([new Uint8Array(payload.bytes)], { type: payload.mimeType });
    currentSavedPath = undefined;
    currentFileName = payload.name;
    updateTitle(payload.name);
    await editor.loadAsset(blob, {
      assetName: payload.name,
      autoDetect: true,
      announce: true,
    });
  }

  async function saveCurrent(forceSaveAs: boolean): Promise<void> {
    const result = editor.getResult();
    if (!result) return;
    const { blob } = await editor.exportBlob();
    const baseName = currentFileName
      ? currentFileName.replace(/\.[^.]+$/, '')
      : `pixelclean-${result.gridWidth}x${result.gridHeight}`;
    const defaultName = `${baseName}-clean.png`;
    await saveBlobToDisk(blob, defaultName, forceSaveAs ? undefined : currentSavedPath);
  }

  if (desktop) {
    desktop.onOpenFile((payload) => {
      void loadOpenedFile(payload);
    });

    desktop.onMenuCommand((command) => {
      if (command === 'open') {
        void desktop.openFileDialog().then((opened) => {
          if (opened) void loadOpenedFile(opened);
        });
      } else if (command === 'save') {
        void saveCurrent(false);
      } else if (command === 'save-as') {
        void saveCurrent(true);
      } else if (command === 'export-modal') {
        editor.openExportModal();
      }
    });

    void desktop.requestPendingFile().then((pending) => {
      if (pending) void loadOpenedFile(pending);
    });
  }
}
