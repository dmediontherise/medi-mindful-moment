import { app, BrowserWindow, ipcMain, powerMonitor, screen, Tray, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadSettings, saveSettings, getSettings } from './settings.js';
import { IdleManager } from './idleLogic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let ambientWindow = null;
let tray = null;
let idleManager = null;
let checkIdleIntervalId = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function getAppUrl(queryParams = '') {
    if (isDev) {
        return `http://localhost:5173${queryParams}`;
    }
    const htmlPath = path.join(__dirname, '../dist/index.html');
    return `file://${htmlPath}${queryParams}`;
}

function createMainWindow() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        return;
    }

    mainWindow = new BrowserWindow({
        width: 1100,
        height: 800,
        minWidth: 400,
        minHeight: 500,
        title: 'Medi Mindful Moment',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadURL(getAppUrl());

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function openAmbientWindow() {
    if (ambientWindow && !ambientWindow.isDestroyed()) {
        ambientWindow.focus();
        return;
    }

    const settings = getSettings();
    const primaryDisplay = screen.getPrimaryDisplay();
    const { x, y, width, height } = primaryDisplay.bounds;

    const moodParam = settings.mood ? encodeURIComponent(settings.mood) : 'All';
    const query = `?ambient=1&mood=${moodParam}`;
    const url = getAppUrl(query);

    ambientWindow = new BrowserWindow({
        x,
        y,
        width,
        height,
        fullscreen: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    ambientWindow.loadURL(url);

    // Dismiss screensaver on key or mouse input via IPC or window events
    const closeAmbient = () => {
        if (ambientWindow && !ambientWindow.isDestroyed()) {
            ambientWindow.close();
            ambientWindow = null;
        }
        const currentIdle = powerMonitor ? powerMonitor.getSystemIdleTime() : 0;
        idleManager.recordDismissal(currentIdle);
    };

    ambientWindow.webContents.on('before-input-event', (event, input) => {
        closeAmbient();
    });

    ambientWindow.on('closed', () => {
        ambientWindow = null;
    });
}

function closeAmbientWindow() {
    if (ambientWindow && !ambientWindow.isDestroyed()) {
        ambientWindow.close();
    }
    ambientWindow = null;
    const currentIdle = powerMonitor ? powerMonitor.getSystemIdleTime() : 0;
    idleManager.recordDismissal(currentIdle);
}

function setupIdleManager() {
    const settings = getSettings();

    idleManager = new IdleManager({
        thresholdMinutes: settings.idleThresholdMinutes || 5,
        onTrigger: () => {
            openAmbientWindow();
        },
        onDismiss: () => {
            // Handled in recordDismissal
        }
    });

    if (checkIdleIntervalId) {
        clearInterval(checkIdleIntervalId);
    }

    checkIdleIntervalId = setInterval(() => {
        if (powerMonitor && typeof powerMonitor.getSystemIdleTime === 'function') {
            const idleSeconds = powerMonitor.getSystemIdleTime();
            idleManager.evaluateIdleTime(idleSeconds);
        }
    }, 1000);
}

function setupTray() {
    try {
        const iconPath = path.join(__dirname, 'icon.png');
        tray = new Tray(iconPath);
    } catch (e) {
        // Fallback if icon missing
    }

    updateTrayMenu();
}

function updateTrayMenu() {
    if (!tray) return;

    const settings = getSettings();
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open App',
            click: () => createMainWindow()
        },
        {
            label: 'Start Screensaver Now',
            click: () => openAmbientWindow()
        },
        { type: 'separator' },
        {
            label: `Idle Threshold: ${settings.idleThresholdMinutes} min`,
            enabled: false
        },
        {
            label: `Screensaver Mood: ${settings.mood}`,
            enabled: false
        },
        { type: 'separator' },
        {
            label: 'Launch at Login',
            type: 'checkbox',
            checked: Boolean(settings.openAtLogin),
            click: (item) => {
                const updated = saveSettings(app.getPath('userData'), { openAtLogin: item.checked });
                app.setLoginItemSettings({ openAtLogin: item.checked });
                updateTrayMenu();
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Medi Mindful Moment');
    tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
    const userDataPath = app.getPath('userData');
    const settings = loadSettings(userDataPath);

    // Apply login item settings
    app.setLoginItemSettings({ openAtLogin: Boolean(settings.openAtLogin) });

    setupIdleManager();
    createMainWindow();
    setupTray();

    // IPC Handlers
    ipcMain.handle('get-settings', () => {
        return getSettings();
    });

    ipcMain.handle('save-settings', (event, newSettings) => {
        const updated = saveSettings(app.getPath('userData'), newSettings);
        if (idleManager && newSettings.idleThresholdMinutes) {
            idleManager.setThresholdMinutes(newSettings.idleThresholdMinutes);
        }
        updateTrayMenu();
        return updated;
    });

    ipcMain.on('dismiss-ambient', () => {
        closeAmbientWindow();
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    if (checkIdleIntervalId) {
        clearInterval(checkIdleIntervalId);
    }
});
