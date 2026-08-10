import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import http from 'http';
import fs from 'fs';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection } from 'firebase/firestore';
import { setDbForTesting } from './auth.js';
import { mergeHistory, syncAllLocalToCloud } from './sync.js';
import { getHistory, setHistory } from './storage.js';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8080;
const DEMO_PROJECT_ID = 'demo-medi-test';

async function checkEmulatorRunning(maxRetries = 5, delayMs = 150) {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
        return true;
    }
    for (let i = 0; i < maxRetries; i++) {
        const isUp = await new Promise((resolve) => {
            const req = http.get(`http://${EMULATOR_HOST}:${EMULATOR_PORT}/`, () => resolve(true));
            req.on('error', () => resolve(false));
            req.setTimeout(300, () => {
                req.destroy();
                resolve(false);
            });
        });
        if (isUp) return true;
        await new Promise(r => setTimeout(r, delayMs));
    }
    return false;
}

const emulatorAvailable = await checkEmulatorRunning();
if (!emulatorAvailable) {
    console.log(`[SKIP] Firestore emulator is not running on ${EMULATOR_HOST}:${EMULATOR_PORT}. Skipping Firestore integration tests.`);
}

let testEnv = null;

beforeAll(async () => {
    if (!emulatorAvailable) return;
    const rulesContent = fs.readFileSync('firestore.rules', 'utf8');
    testEnv = await initializeTestEnvironment({
        projectId: DEMO_PROJECT_ID,
        firestore: {
            rules: rulesContent,
            host: EMULATOR_HOST,
            port: EMULATOR_PORT
        }
    });
});

afterAll(async () => {
    if (testEnv) {
        await testEnv.cleanup();
    }
    setDbForTesting(null);
});

describe.skipIf(!emulatorAvailable)('Firestore Integration Tests - Real SDK & Authenticated Emulator Sync', () => {
    const userId1 = 'integration-user-1';

    beforeEach(async () => {
        if (testEnv) {
            await testEnv.clearFirestore();
        }
        setHistory([]);
    });

    it('1. local-only history, cloud empty -> all local records end up in the cloud', async () => {
        const userDb = testEnv.authenticatedContext(userId1).firestore();
        setDbForTesting(userDb);

        const localItems = [
            { docId: 'local-1', seed_id: 'a01', mood: 'Anxious', text: 'Local 1', timestamp: '2026-08-01T10:00:00Z', is_favorite: false },
            { docId: 'local-2', seed_id: 'a02', mood: 'Anxious', text: 'Local 2', timestamp: '2026-08-01T11:00:00Z', is_favorite: true }
        ];

        setHistory(localItems);
        await syncAllLocalToCloud({ uid: userId1 }, localItems);

        const colRef = collection(userDb, 'users', userId1, 'history');
        const snapshot = await getDocs(colRef);
        const cloudDocs = snapshot.docs.map(d => d.data());
        const cloudDocIds = new Set(cloudDocs.map(d => d.docId));

        expect(cloudDocs.length).toBe(2);
        expect(cloudDocIds).toEqual(new Set(['local-1', 'local-2']));
    });

    it('2. cloud-only history, local empty -> all cloud records appear locally', async () => {
        const userDb = testEnv.authenticatedContext(userId1).firestore();
        setDbForTesting(userDb);

        const cloudItems = [
            { docId: 'cloud-1', seed_id: 'c01', mood: 'Excited', text: 'Cloud 1', timestamp: '2026-08-02T10:00:00Z', is_favorite: true },
            { docId: 'cloud-2', seed_id: 'c02', mood: 'Excited', text: 'Cloud 2', timestamp: '2026-08-02T11:00:00Z', is_favorite: false }
        ];

        for (const item of cloudItems) {
            const docRef = doc(userDb, 'users', userId1, 'history', item.docId);
            await setDoc(docRef, item);
        }

        const snapshot = await getDocs(collection(userDb, 'users', userId1, 'history'));
        const docsFromCloud = snapshot.docs.map(d => d.data());

        const merged = mergeHistory([], docsFromCloud);
        setHistory(merged);

        const localDocIds = new Set(getHistory().map(h => h.docId));
        expect(getHistory().length).toBe(2);
        expect(localDocIds).toEqual(new Set(['cloud-1', 'cloud-2']));
    });

    it('3. both sides non-empty with disjoint docIds -> union, nothing dropped', async () => {
        const userDb = testEnv.authenticatedContext(userId1).firestore();
        setDbForTesting(userDb);

        const localItems = [
            { docId: 'disjoint-loc-1', seed_id: 'l01', mood: 'Tired', text: 'Local Disjoint', timestamp: '2026-08-03T10:00:00Z' }
        ];
        const cloudItems = [
            { docId: 'disjoint-cld-1', seed_id: 'c01', mood: 'Tired', text: 'Cloud Disjoint', timestamp: '2026-08-03T11:00:00Z' }
        ];

        for (const item of cloudItems) {
            await setDoc(doc(userDb, 'users', userId1, 'history', item.docId), item);
        }

        const merged = mergeHistory(localItems, cloudItems);
        expect(merged.length).toBe(2);

        const mergedIds = new Set(merged.map(m => m.docId));
        expect(mergedIds).toEqual(new Set(['disjoint-loc-1', 'disjoint-cld-1']));
    });

    it('4. same docId favourited on one side only -> merged record is favourited, both directions', async () => {
        const userDb = testEnv.authenticatedContext(userId1).firestore();
        setDbForTesting(userDb);

        const localItems = [
            { docId: 'shared-fav-1', seed_id: 'f01', mood: 'Confident', text: 'Fav Test 1', timestamp: '2026-08-04T10:00:00Z', is_favorite: true },
            { docId: 'shared-fav-2', seed_id: 'f02', mood: 'Confident', text: 'Fav Test 2', timestamp: '2026-08-04T10:00:00Z', is_favorite: false }
        ];
        const cloudItems = [
            { docId: 'shared-fav-1', seed_id: 'f01', mood: 'Confident', text: 'Fav Test 1', timestamp: '2026-08-04T10:00:00Z', is_favorite: false },
            { docId: 'shared-fav-2', seed_id: 'f02', mood: 'Confident', text: 'Fav Test 2', timestamp: '2026-08-04T10:00:00Z', is_favorite: true }
        ];

        for (const item of cloudItems) {
            await setDoc(doc(userDb, 'users', userId1, 'history', item.docId), item);
        }

        const merged = mergeHistory(localItems, cloudItems);
        expect(merged.length).toBe(2);

        const record1 = merged.find(r => r.docId === 'shared-fav-1');
        const record2 = merged.find(r => r.docId === 'shared-fav-2');

        expect(record1.is_favorite).toBe(true);
        expect(record2.is_favorite).toBe(true);

        await syncAllLocalToCloud({ uid: userId1 }, merged);

        const snapshot = await getDocs(collection(userDb, 'users', userId1, 'history'));
        const updatedCloud = snapshot.docs.map(d => d.data());

        const cloudRec1 = updatedCloud.find(r => r.docId === 'shared-fav-1');
        const cloudRec2 = updatedCloud.find(r => r.docId === 'shared-fav-2');

        expect(cloudRec1.is_favorite).toBe(true);
        expect(cloudRec2.is_favorite).toBe(true);
    });

    it('5. same docId present on both sides -> exactly one record afterwards, no duplicate', async () => {
        const userDb = testEnv.authenticatedContext(userId1).firestore();
        setDbForTesting(userDb);

        const localItems = [
            { docId: 'dup-1', seed_id: 'd01', mood: 'Neutral', text: 'Duplicate Local', timestamp: '2026-08-05T10:00:00Z' }
        ];
        const cloudItems = [
            { docId: 'dup-1', seed_id: 'd01', mood: 'Neutral', text: 'Duplicate Cloud Latest', timestamp: '2026-08-05T12:00:00Z' }
        ];

        for (const item of cloudItems) {
            await setDoc(doc(userDb, 'users', userId1, 'history', item.docId), item);
        }

        const merged = mergeHistory(localItems, cloudItems);
        expect(merged.length).toBe(1);
        expect(merged[0].docId).toBe('dup-1');
        expect(merged[0].text).toBe('Duplicate Cloud Latest');
    });

    it('6. a second device signing in sees the first device history', async () => {
        const sharedUserId = 'shared-account-user';
        const device1Db = testEnv.authenticatedContext(sharedUserId).firestore();
        setDbForTesting(device1Db);

        const device1Items = [
            { docId: 'dev1-rec-1', seed_id: 's01', mood: 'Overwhelmed', text: 'Device 1 Item 1', timestamp: '2026-08-06T10:00:00Z' },
            { docId: 'dev1-rec-2', seed_id: 's02', mood: 'Overwhelmed', text: 'Device 1 Item 2', timestamp: '2026-08-06T11:00:00Z' }
        ];

        await syncAllLocalToCloud({ uid: sharedUserId }, device1Items);

        const device2Db = testEnv.authenticatedContext(sharedUserId).firestore();
        const snapshotDevice2 = await getDocs(collection(device2Db, 'users', sharedUserId, 'history'));
        const device2FetchedDocs = snapshotDevice2.docs.map(d => d.data());
        const device2DocIds = new Set(device2FetchedDocs.map(d => d.docId));

        expect(device2FetchedDocs.length).toBe(2);
        expect(device2DocIds).toEqual(new Set(['dev1-rec-1', 'dev1-rec-2']));
    });

    it('7. security rules: user A cannot read or write user B subtree', async () => {
        const dbUserA = testEnv.authenticatedContext('user-A').firestore();
        const targetDocRef = doc(dbUserA, 'users', 'user-B', 'history', 'private-doc-1');

        await assertFails(setDoc(targetDocRef, { docId: 'private-doc-1', text: 'Unauthorized Write' }));
        await assertFails(getDoc(targetDocRef));
    });
});
