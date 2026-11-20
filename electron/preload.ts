import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  MenuCommand,
  OpenedFilePayload,
  PixCleanDesktopBridge,
  SavePngRequest,
  SavePngResult,
} from './ipc-types';

const bridge: PixCleanDesktopBridge = {
  openFileDialog: () => ipcRenderer.invoke('pixclean:open-file-dialog') as Promise<OpenedFilePayload | null>,

  savePng: (request: SavePngRequest) =>
    ipcRenderer.invoke('pixclean:save-png', request) as Promise<SavePngResult>,

  setWindowTitle: (title: string) => {
    ipcRenderer.send('pixclean:set-title', title);
  },

  requestPendingFile: () =>
    ipcRenderer.invoke('pixclean:get-pending-file') as Promise<OpenedFilePayload | null>,

  onMenuCommand: (listener: (command: MenuCommand) => void) => {
    const handler = (_event: IpcRendererEvent, command: MenuCommand) => listener(command);
    ipcRenderer.on('pixclean:menu-command', handler);
    return () => ipcRenderer.removeListener('pixclean:menu-command', handler);
  },

  onOpenFile: (listener: (payload: OpenedFilePayload) => void) => {
    const handler = (_event: IpcRendererEvent, payload: OpenedFilePayload) => listener(payload);
    ipcRenderer.on('pixclean:open-file', handler);
    return () => ipcRenderer.removeListener('pixclean:open-file', handler);
  },
};

contextBridge.exposeInMainWorld('pixCleanDesktop', bridge);
