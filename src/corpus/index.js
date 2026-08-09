import { anxiousCorpus } from './anxious.js';
import { excitedCorpus } from './excited.js';
import { tiredCorpus } from './tired.js';
import { confidentCorpus } from './confident.js';
import { overwhelmedCorpus } from './overwhelmed.js';
import { neutralCorpus } from './neutral.js';

export const CORPUS_BY_MOOD = {
    'Anxious': anxiousCorpus,
    'Excited': excitedCorpus,
    'Tired': tiredCorpus,
    'Confident': confidentCorpus,
    'Overwhelmed': overwhelmedCorpus,
    'Neutral': neutralCorpus
};

const CATEGORIES = ['Grounding', 'Resilience', 'Self-Kindness', 'Reflection', 'Motivation', 'Gratitude', 'Calm', 'Empowerment'];

/**
 * Deterministic string hash (djb2) to produce stable IDs based on text.
 */
export function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    return (hash >>> 0).toString(16);
}

/**
 * Generates all combinatorial affirmation objects for a mood lazily.
 * @param {string} mood 
 * @returns {Array<object>}
 */
export function buildAffirmationsForMood(mood) {
    const corpus = CORPUS_BY_MOOD[mood];
    if (!corpus) return [];

    const result = [];

    // 1. Curated originals (5 items)
    for (const item of corpus.curated) {
        result.push({
            id: item.id,
            mood: item.mood,
            text: item.text,
            category: item.category,
            is_favorite: false
        });
    }

    const moodLower = mood.toLowerCase();

    // 2. Template Group 1: 16 x 16 x 16 = 4,096 combinations
    const tg1 = corpus.templateGroup1;
    let tg1Index = 0;
    for (let i = 0; i < tg1.open.length; i++) {
        for (let j = 0; j < tg1.act.length; j++) {
            for (let k = 0; k < tg1.out.length; k++) {
                const text = `${tg1.open[i]} ${tg1.act[j]} ${tg1.out[k]}`;
                const category = CATEGORIES[(i + j + k) % CATEGORIES.length];
                const id = `g_${moodLower}_${hashString(text)}`;
                result.push({
                    id,
                    mood,
                    text,
                    category,
                    is_favorite: false
                });
                tg1Index++;
            }
        }
    }

    // 3. Template Group 2: 10 x 10 = 100 combinations
    const tg2 = corpus.templateGroup2;
    for (let i = 0; i < tg2.stat.length; i++) {
        for (let j = 0; j < tg2.reason.length; j++) {
            const text = `${tg2.stat[i]} ${tg2.reason[j]}`;
            const category = CATEGORIES[(i + j) % CATEGORIES.length];
            const id = `g_${moodLower}_${hashString(text)}`;
            result.push({
                id,
                mood,
                text,
                category,
                is_favorite: false
            });
        }
    }

    // 4. Template Group 3: 10 x 10 = 100 combinations
    const tg3 = corpus.templateGroup3;
    for (let i = 0; i < tg3.rem.length; i++) {
        for (let j = 0; j < tg3.call.length; j++) {
            const text = `${tg3.rem[i]} ${tg3.call[j]}`;
            const category = CATEGORIES[(i + j + 3) % CATEGORIES.length];
            const id = `g_${moodLower}_${hashString(text)}`;
            result.push({
                id,
                mood,
                text,
                category,
                is_favorite: false
            });
        }
    }

    return result;
}
