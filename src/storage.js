import { getCurrentUser } from './auth.js';
import { syncDocToCloud } from './sync.js';

export const STORAGE_KEY = 'medi_mindful_history';
export const SEED_STORAGE_KEY = 'medi_mindful_install_seed';

let historyState = [];
let favoritesState = [];
let installSeedState = null;

export function getInstallSeed() {
    if (installSeedState !== null && Number.isFinite(installSeedState)) {
        return installSeedState;
    }
    try {
        const storedSeed = localStorage.getItem(SEED_STORAGE_KEY);
        const parsed = storedSeed ? parseInt(storedSeed, 10) : NaN;
        if (Number.isFinite(parsed)) {
            installSeedState = parsed;
        } else {
            installSeedState = Math.floor(Math.random() * 2147483647);
            localStorage.setItem(SEED_STORAGE_KEY, String(installSeedState));
        }
    } catch (e) {
        installSeedState = 123456789;
    }
    return installSeedState;
}

export function setInstallSeed(seed) {
    const num = Number(seed);
    if (Number.isFinite(num)) {
        installSeedState = num;
        try {
            localStorage.setItem(SEED_STORAGE_KEY, String(num));
        } catch (e) {
            console.error("Failed to save seed to LocalStorage", e);
        }
    } else {
        installSeedState = null;
        getInstallSeed();
    }
}

export function getHistory() {
    return historyState;
}

export function setHistory(newHistory) {
    historyState = newHistory;
}

export function getFavorites() {
    return favoritesState;
}

export function resetStorageState() {
    historyState = [];
    favoritesState = [];
    installSeedState = null;
}

export function loadHistory() {
    try {
        const storedData = localStorage.getItem(STORAGE_KEY);
        if (storedData) {
            historyState = JSON.parse(storedData);
        } else {
            historyState = [];
        }

        // Rebuild favorites list
        favoritesState = historyState
            .filter(item => item && item.is_favorite)
            .map(item => item.seed_id);

        // Sort by timestamp descending (newest first)
        historyState.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (e) {
        console.error("Failed to load history from LocalStorage", e);
        historyState = [];
        favoritesState = [];
    }
    
    // Also sync install seed
    getInstallSeed();
    
    return historyState;
}

export function persistHistory(modifiedItem = null) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(historyState));
        loadHistory();

        // If signed in, replicate write to Firestore non-blockingly
        const user = getCurrentUser();
        if (user) {
            if (modifiedItem) {
                syncDocToCloud(user, modifiedItem);
            } else {
                for (const item of historyState) {
                    syncDocToCloud(user, item);
                }
            }
        }
    } catch (e) {
        console.error("Failed to save to LocalStorage", e);
    }
}

export function toggleFavoriteInStorage(docId, newFavState) {
    const entry = historyState.find(h => h.docId === docId);
    if (entry) {
        entry.is_favorite = newFavState;
        persistHistory(entry);
    }
}
