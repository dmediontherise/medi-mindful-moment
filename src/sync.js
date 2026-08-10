import { getDb } from './auth.js';
import { doc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { getHistory, setHistory, persistHistory } from './storage.js';
import { showToast } from './toast.js';

/**
 * Merges local and cloud history using union rule.
 * Deduplicated by docId (or seed_id).
 * A favorite set on either side remains a favorite.
 * Latest timestamp wins for metadata.
 * 
 * @param {Array} localItems 
 * @param {Array} cloudItems 
 * @returns {Array} Merged history sorted descending by timestamp
 */
export function mergeHistory(localItems = [], cloudItems = []) {
    const map = new Map();

    // Insert local items first
    for (const item of localItems) {
        if (!item) continue;
        const key = item.docId || item.seed_id;
        if (!key) continue;
        map.set(key, { ...item, is_favorite: Boolean(item.is_favorite) });
    }

    // Merge cloud items
    for (const item of cloudItems) {
        if (!item) continue;
        const key = item.docId || item.seed_id;
        if (!key) continue;

        if (!map.has(key)) {
            map.set(key, { ...item, is_favorite: Boolean(item.is_favorite) });
        } else {
            const existing = map.get(key);

            const isFav = Boolean(existing.is_favorite || item.is_favorite);

            const existingTime = existing.timestamp ? new Date(existing.timestamp).getTime() : 0;
            const itemTime = item.timestamp ? new Date(item.timestamp).getTime() : 0;

            const base = itemTime > existingTime ? item : existing;

            map.set(key, {
                ...base,
                is_favorite: isFav
            });
        }
    }

    const merged = Array.from(map.values());
    merged.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
    });

    return merged;
}

/**
 * Replicates a single document write to Firestore.
 * Failures surface as non-blocking toasts and do not drop local writes.
 */
export async function syncDocToCloud(user, item, dbOverride = null) {
    const db = dbOverride || getDb();
    if (!db || !user || !user.uid || !item || !item.docId) {
        return;
    }

    try {
        const docRef = doc(db, 'users', user.uid, 'history', item.docId);
        await setDoc(docRef, item, { merge: true });
    } catch (err) {
        console.warn("Cloud sync error:", err);
        showToast("Cloud sync failed. Working offline.", "info");
    }
}

/**
 * Synchronizes all local items to cloud.
 */
export async function syncAllLocalToCloud(user, localItems, dbOverride = null) {
    if (!localItems || localItems.length === 0) return;
    const db = dbOverride || getDb();
    for (const item of localItems) {
        await syncDocToCloud(user, item, db);
    }
}

/**
 * Sets up a realtime Firestore snapshot listener for the user's history collection.
 * Merges incoming cloud updates with local storage and notifies callback.
 * 
 * @param {Object} user 
 * @param {Function} onCloudUpdate 
 * @param {Object} dbOverride
 * @returns {Function} Unsubscribe function
 */
export function setupCloudListener(user, onCloudUpdate, dbOverride = null) {
    const db = dbOverride || getDb();
    if (!db || !user || !user.uid) {
        return () => {};
    }

    try {
        const colRef = collection(db, 'users', user.uid, 'history');
        const unsubscribe = onSnapshot(
            colRef,
            (snapshot) => {
                const cloudItems = snapshot.docs.map(d => d.data());
                const currentLocal = getHistory();
                const merged = mergeHistory(currentLocal, cloudItems);
                
                setHistory(merged);
                persistHistory();
                
                if (typeof onCloudUpdate === 'function') {
                    onCloudUpdate(merged);
                }
            },
            (error) => {
                console.warn("Firestore snapshot listener error:", error);
                showToast("Realtime sync unavailable. Working offline.", "info");
            }
        );
        return unsubscribe;
    } catch (err) {
        console.warn("Error subscribing to Firestore listener:", err);
        return () => {};
    }
}
