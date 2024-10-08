/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';
import ffmpegStatic from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

const fs = require('fs').promises;

if (ffmpegStatic)
  ffmpeg.setFfmpegPath(ffmpegStatic.replace('app.asar', 'app.asar.unpacked'));

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  log.info(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

ipcMain.handle('open-file', async (event, options) => {
  const result = await dialog.showOpenDialog(options);
  return result.filePaths;
});

async function getUniqueFilePath(filePath: string) {
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);
  const dir = path.dirname(filePath);
  let newPath = filePath;
  let counter = 1;

  while (
    await fs
      .access(newPath)
      .then(() => true)
      .catch(() => false)
  ) {
    newPath = path.join(dir, `${baseName} (${++counter})${ext}`);
  }

  return newPath;
}

ipcMain.handle('convert-video', async (event, { inputPath }) => {
  const outputPath = await getUniqueFilePath(
    inputPath.replace(/\.[^/.]+$/, '.mp4'),
  );
  // const previewPath = await getUniqueFilePath(
  //   inputPath.replace(/\.[^/.]+$/, '.jpg'),
  // );

  return new Promise((resolve, reject) => {
    // Generate preview image
    // ffmpeg(inputPath)
    //   .outputOptions(
    //     '-ss',
    //     '3',
    //     '-vframes',
    //     '1',

    //     '-vf',
    //     "scale=600:600,format=rgba,format=rgb24,alphaextract,format=gray,geq='if(gt(val,0),255,0)'",
    //   )
    //   .on('error', (err) => reject(err))
    //   .on('end', () => {
    //     event.sender.send('conversion-progress', {
    //       inputPath,
    //       progress: 100,
    //     });
    //     resolve({ outputPath, previewPath });
    //   })
    //   .save(previewPath);

    // https://stackoverflow.com/a/70899710/384349
    let totalTime: number | undefined;

    ffmpeg(inputPath)
      .outputOptions([
        '-vf',
        '[in] split [main][alpha];' +
          '[alpha] colorchannelmixer=rr=0:ra=1:gg=0:ga=1:bb=0:ba=1 [alpha_out];' +
          '[alpha_out][main] vstack, scale=720:-1',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-profile:v',
        'main',
        '-r',
        '30',
        '-crf',
        '15',
        '-g',
        '1',
      ])
      .on('codecData', (data: any) => {
        if ('duration' in data) {
          totalTime = parseInt(data.duration.replace(/:/g, ''), 10);
        }
      })
      .on('progress', (progress) => {
        const time = parseInt(progress.timemark.replace(/:/g, ''), 10);
        const percent = Math.max(
          0,
          progress.percent ?? (time / (totalTime ?? 1)) * 100,
        );

        event.sender.send('conversion-progress', {
          inputPath,
          progress: percent,
        });
      })
      .on('end', () => {
        event.sender.send('conversion-progress', {
          inputPath,
          progress: 100,
        });
        resolve({ outputPath });
      })
      .on('error', (err) => {
        log.error('Error during conversion:', err);
        reject(err);
      })
      .save(outputPath);
  });
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(log.info);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(log.info);
