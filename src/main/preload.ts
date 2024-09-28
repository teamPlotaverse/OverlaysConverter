// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, OpenDialogOptions } from 'electron';

export type Channels = 'ipc-example';

const electronHandler: {
  openFile: (options: OpenDialogOptions) => Promise<string[]>;
  convertVideo: (
    inputPath: string,
  ) => Promise<{ outputPath: string; previewPath: string }>;
  onConversionProgress: (
    callback: (
      event: any,
      { inputPath, progress }: { inputPath: string; progress: number },
    ) => void,
  ) => void;
} = {
  openFile: (options) => ipcRenderer.invoke('open-file', options),
  convertVideo: (inputPath) =>
    ipcRenderer.invoke('convert-video', { inputPath }),
  onConversionProgress: (callback) =>
    ipcRenderer.on('conversion-progress', callback),

  // ipcRenderer: {
  //   sendMessage(channel: Channels, ...args: unknown[]) {
  //     ipcRenderer.send(channel, ...args);
  //   },
  //   on(channel: Channels, func: (...args: unknown[]) => void) {
  //     const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
  //       func(...args);
  //     ipcRenderer.on(channel, subscription);

  //     return () => {
  //       ipcRenderer.removeListener(channel, subscription);
  //     };
  //   },
  //   once(channel: Channels, func: (...args: unknown[]) => void) {
  //     ipcRenderer.once(channel, (_event, ...args) => func(...args));
  //   },
  // },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
