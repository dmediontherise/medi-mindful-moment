import { getHistory, persistHistory, getInstallSeed } from './storage.js';
import { CORPUS_BY_MOOD, buildAffirmationsForMood } from './corpus/index.js';

// Cache generated mood pools in memory lazily when requested
const moodPoolCache = new Map();

/**
 * Gets all affirmations for a specific mood (lazily generated and cached).
 * Serves the 30 original curated items first, followed by generated items.
 * @param {string} mood 
 * @returns {Array<object>}
 */
export function getAllForMood(mood) {
    if (moodPoolCache.has(mood)) {
        return moodPoolCache.get(mood);
    }
    const pool = buildAffirmationsForMood(mood);
    moodPoolCache.set(mood, pool);
    return pool;
}

// 30 Curated originals for backward compatibility / reference
export const SEED_AFFIRMATIONS = Object.values(CORPUS_BY_MOOD).flatMap(c => c.curated);

/**
 * Small deterministic Mulberry32 PRNG.
 * @param {number} a - 32-bit integer seed
 * @returns {function(): number} PRNG function returning float in [0, 1)
 */
export function mulberry32(a) {
    return function() {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function stringToSeed(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    return hash >>> 0;
}

/**
 * Gets the first 4 words of a string in lowercase.
 * @param {string} t 
 * @returns {string}
 */
const getOpening = t => t.split(/\s+/).slice(0, 4).join(' ').toLowerCase();

/**
 * Selects an affirmation for a mood using seeded PRNG and first-4-words variety rules.
 * Uses an O(1) Set lookup for seen IDs.
 * @param {string} mood 
 * @returns {object|null}
 */
export function generateAffirmation(mood) {
    const history = getHistory();
    // Fast O(1) lookup set for used seed_ids
    const usedSeedIds = new Set(history.map(h => h.seed_id));
    const pool = getAllForMood(mood);
    
    let selectedCandidate = null;

    // 1. Curated originals check (first 5 items for this mood)
    // Served in order before any generated content
    const curatedOriginals = pool.slice(0, 5);
    const unusedCurated = curatedOriginals.find(item => !usedSeedIds.has(item.id));

    if (unusedCurated) {
        selectedCandidate = unusedCurated;
    } else {
        // 2. Filter pool for all unseen items
        const unseenCandidates = pool.filter(item => !usedSeedIds.has(item.id));

        if (unseenCandidates.length > 0) {
            let candidatePool = unseenCandidates;

            // 3. Favorite Category Weighting:
            // Prefer candidates whose category matches a category favorited by the user
            const favCategories = new Set(history.filter(h => h.is_favorite).map(h => h.category));
            if (favCategories.size > 0) {
                const preferredCandidates = unseenCandidates.filter(c => favCategories.has(c.category));
                if (preferredCandidates.length > 0) {
                    candidatePool = preferredCandidates;
                }
            }

            // 4. Consecutive Variety (No back-to-back same first 4 words):
            // Check the last affirmation shown for this mood in history
            const lastItemForMood = history.find(h => h.mood === mood);
            if (lastItemForMood && lastItemForMood.text) {
                const lastOpening = getOpening(lastItemForMood.text);
                const varietyCandidates = candidatePool.filter(c => getOpening(c.text) !== lastOpening);
                if (varietyCandidates.length > 0) {
                    candidatePool = varietyCandidates;
                }
            }

            // 5. Seeded PRNG selection:
            const installSeed = getInstallSeed();
            const seedValue = (installSeed ^ stringToSeed(mood) ^ (usedSeedIds.size * 2654435761)) >>> 0;
            const prng = mulberry32(seedValue);
            const rndIndex = Math.floor(prng() * candidatePool.length);
            selectedCandidate = candidatePool[rndIndex];
        } else {
            // 6. Exhaustion Fallback (when all pool items consumed)
            console.warn("All unique affirmations for this mood have been used. Showing a previous one as fallback.");
            const fallbackHistory = history.filter(h => h.mood === mood);
            if (fallbackHistory.length > 0) {
                const installSeed = getInstallSeed();
                const seedValue = (installSeed ^ stringToSeed(mood) ^ (history.length * 10007)) >>> 0;
                const prng = mulberry32(seedValue);
                const fallbackIdx = Math.floor(prng() * fallbackHistory.length);
                selectedCandidate = fallbackHistory[fallbackIdx];
            } else {
                return null;
            }
        }
    }

    const newAffirmation = {
        seed_id: selectedCandidate.seed_id ?? selectedCandidate.id,
        mood: selectedCandidate.mood,
        text: selectedCandidate.text,
        category: selectedCandidate.category,
        is_favorite: false,
        docId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString()
    };

    logAffirmation(newAffirmation, 'Generated');

    return newAffirmation;
}

export function logAffirmation(aff, action) {
    const history = getHistory();
    if (action === 'Generated') {
        const exists = history.find(h => h.docId === aff.docId);
        if (!exists) {
            history.unshift(aff);
            persistHistory();
        }
    }
}
