import { generateAffirmation } from './affirmations.js';

let ambientIntervalId = null;
let activeAmbientMood = 'All';
let currentAffirmationObj = null;
let fadeTimeoutId = null;

export function isAmbientActive() {
    return !!document.getElementById('ambient-view');
}

export function getActiveAmbientTimer() {
    return ambientIntervalId;
}

/**
 * @param {string} mood        Mood to rotate within, or 'All'.
 * @param {number} intervalMs  Rotation interval.
 * @param {object|null} initialAffirmation
 *        Affirmation to show first. Passed when entering fullscreen from the
 *        card view so the view expands what is already on screen instead of
 *        replacing it. Omitted for the standalone `?ambient=1` entry point
 *        (the desktop screensaver), which has nothing to carry over and
 *        generates its own.
 */
export function startAmbient(mood = 'All', intervalMs = 30000, initialAffirmation = null) {
    stopAmbient(); // Clean up existing ambient session to prevent timer accumulation

    activeAmbientMood = mood;

    const ambientEl = document.createElement('div');
    ambientEl.id = 'ambient-view';
    ambientEl.setAttribute('role', 'dialog');
    ambientEl.setAttribute('aria-modal', 'true');
    ambientEl.setAttribute('aria-label', 'Ambient Fullscreen Affirmations');
    ambientEl.tabIndex = -1;

    const moodLower = mood !== 'All' ? mood.toLowerCase() : 'neutral';
    ambientEl.className = `fixed inset-0 z-50 flex flex-col items-center justify-center p-6 md:p-12 transition-colors duration-700 mood-bg-${moodLower} bg-app-theme text-main-theme`;

    ambientEl.innerHTML = `
        <div id="ambient-card" class="max-w-3xl text-center px-6 transition-opacity duration-700 opacity-100">
            <p id="ambient-mood-tag" class="text-sm md:text-base font-semibold tracking-widest uppercase mb-6 opacity-75"></p>
            <h2 id="ambient-text" class="text-3xl md:text-5xl font-light leading-relaxed italic mb-8"></h2>
        </div>
        <div class="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs opacity-50 font-medium tracking-wider select-none">
            Press any key or click anywhere to exit
        </div>
    `;

    document.body.appendChild(ambientEl);
    ambientEl.focus();

    // Show the caller's affirmation if given; only generate when there is
    // nothing to carry over.
    if (initialAffirmation) {
        renderAmbientAffirmation(initialAffirmation);
    } else {
        rotateAmbientAffirmation();
    }

    // Auto-rotation interval
    ambientIntervalId = setInterval(() => {
        if (typeof document !== 'undefined' && !document.hidden) {
            rotateAmbientAffirmation();
        }
    }, intervalMs);

    const modifierKeys = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab']);

    function handleKeyDown(e) {
        // Dismiss on any keypress except bare modifier keypresses
        if (!modifierKeys.has(e.key)) {
            e.preventDefault();
            stopAmbient();
        }
    }

    function handleClick() {
        stopAmbient();
    }

    function handleVisibilityChange() {
        // Pauses auto-rotation while document is hidden
    }

    ambientEl.addEventListener('click', handleClick);
    if (typeof document !== 'undefined') {
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    ambientEl._cleanup = () => {
        ambientEl.removeEventListener('click', handleClick);
        if (typeof document !== 'undefined') {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
    };
}

export function stopAmbient() {
    if (ambientIntervalId !== null) {
        clearInterval(ambientIntervalId);
        ambientIntervalId = null;
    }

    if (fadeTimeoutId !== null) {
        clearTimeout(fadeTimeoutId);
        fadeTimeoutId = null;
    }

    if (typeof document !== 'undefined') {
        const ambientEl = document.getElementById('ambient-view');
        if (ambientEl) {
            if (ambientEl._cleanup) ambientEl._cleanup();
            ambientEl.remove();
        }
        
        const appEl = document.getElementById('app');
        if (appEl && appEl.style.display !== 'none') {
            appEl.focus();
        }
    }
}

export function rotateAmbientAffirmation() {
    if (typeof document === 'undefined') return;
    const ambientEl = document.getElementById('ambient-view');
    if (!ambientEl) return;

    let targetMood = activeAmbientMood;
    if (targetMood === 'All') {
        const moods = ['Anxious', 'Excited', 'Tired', 'Confident', 'Overwhelmed', 'Neutral'];
        targetMood = moods[Math.floor(Math.random() * moods.length)];
    }

    const aff = generateAffirmation(targetMood);
    if (!aff) return;

    renderAmbientAffirmation(aff);
}

/**
 * Paints an already-chosen affirmation into the ambient view.
 *
 * Split out from rotateAmbientAffirmation so entering fullscreen can show the
 * affirmation the user is already looking at. Generating one on entry both
 * replaced what was on screen and wrote a spurious 'Generated' record to
 * history (which then synced to Firestore) every time the button was pressed.
 */
export function renderAmbientAffirmation(aff) {
    if (typeof document === 'undefined' || !aff) return;
    const ambientEl = document.getElementById('ambient-view');
    if (!ambientEl) return;

    const targetMood = aff.mood || 'Neutral';

    currentAffirmationObj = aff;

    const ambientCard = document.getElementById('ambient-card');
    const moodTag = document.getElementById('ambient-mood-tag');
    const textEl = document.getElementById('ambient-text');

    if (!ambientCard || !moodTag || !textEl) return;

    const isReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isReducedMotion) {
        ambientEl.className = `fixed inset-0 z-50 flex flex-col items-center justify-center p-6 md:p-12 mood-bg-${targetMood.toLowerCase()} bg-app-theme text-main-theme`;
        moodTag.textContent = `Affirmation for feeling ${aff.mood}`;
        textEl.textContent = `"${aff.text}"`;
    } else {
        // Cross-fade rotation
        if (textEl.textContent) {
            ambientCard.classList.replace('opacity-100', 'opacity-0');
            fadeTimeoutId = setTimeout(() => {
                ambientEl.className = `fixed inset-0 z-50 flex flex-col items-center justify-center p-6 md:p-12 transition-colors duration-700 mood-bg-${targetMood.toLowerCase()} bg-app-theme text-main-theme`;
                moodTag.textContent = `Affirmation for feeling ${aff.mood}`;
                textEl.textContent = `"${aff.text}"`;
                ambientCard.classList.replace('opacity-0', 'opacity-100');
            }, 300);
        } else {
            // First render: fill immediately without initial delay
            ambientEl.className = `fixed inset-0 z-50 flex flex-col items-center justify-center p-6 md:p-12 mood-bg-${targetMood.toLowerCase()} bg-app-theme text-main-theme`;
            moodTag.textContent = `Affirmation for feeling ${aff.mood}`;
            textEl.textContent = `"${aff.text}"`;
        }
    }
}
