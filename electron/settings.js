import fs from 'fs';
import path from 'path';

export const DEFAULT_SETTINGS = {
    idleThresholdMinutes: 5,
    mood: 'All',
    rotationIntervalSeconds: 30,
    openAtLogin: false
};

let currentSettings = { ...DEFAULT_SETTINGS };

export function loadSettings(userDataPath) {
    if (!userDataPath) return currentSettings;
    const settingsPath = path.join(userDataPath, 'settings.json');
    try {
        if (fs.existsSync(settingsPath)) {
            const raw = fs.readFileSync(settingsPath, 'utf8');
            const parsed = JSON.parse(raw);
            currentSettings = { ...DEFAULT_SETTINGS, ...parsed };
        } else {
            currentSettings = { ...DEFAULT_SETTINGS };
        }
    } catch (e) {
        console.warn("Failed to load settings.json, using defaults:", e);
        currentSettings = { ...DEFAULT_SETTINGS };
    }
    return currentSettings;
}

export function saveSettings(userDataPath, newSettings) {
    currentSettings = { ...currentSettings, ...newSettings };
    if (!userDataPath) return currentSettings;
    const settingsPath = path.join(userDataPath, 'settings.json');
    try {
        const dir = path.dirname(settingsPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 2), 'utf8');
    } catch (e) {
        console.warn("Failed to save settings.json:", e);
    }
    return currentSettings;
}

export function getSettings() {
    return currentSettings;
}

export function resetSettings() {
    currentSettings = { ...DEFAULT_SETTINGS };
    return currentSettings;
}
