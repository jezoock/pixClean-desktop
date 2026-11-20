export type MenuCommand = 'open' | 'save' | 'save-as' | 'export-modal';

export interface OpenedFilePayload {
  filePath: string;
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface SavePngRequest {
  bytes: Uint8Array;
  defaultName: string;
  targetPath?: string;
}

export interface SavePngResult {
  saved: boolean;
  filePath?: string;
}

export interface PixCleanDesktopBridge {
  openFileDialog(): Promise<OpenedFilePayload | null>;
  savePng(request: SavePngRequest): Promise<SavePngResult>;
  setWindowTitle(title: string): void;
  onMenuCommand(listener: (command: MenuCommand) => void): () => void;
  onOpenFile(listener: (payload: OpenedFilePayload) => void): () => void;
  requestPendingFile(): Promise<OpenedFilePayload | null>;
}

declare global {
  interface Window {
    pixCleanDesktop?: PixCleanDesktopBridge;
  }
}
