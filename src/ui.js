import { escapeHtml, setCurrentDate } from './utils.js';
import { STORAGE_KEY, getHistory, getFavorites, loadHistory, persistHistory, toggleFavoriteInStorage, setHistory } from './storage.js';
import { generateAffirmation } from './affirmations.js';
import { sessionStack, stackIndex, pushToStack, resetStack, setStackIndex } from './stack.js';
import { renderShareModal, closeShareModal, copyToClipboard, handleSmsShare, handleEmailShare, getShareText } from './share.js';
import { initTheme, toggleTheme } from './theme.js';
import { startAmbient } from './ambient.js';
import { hasFirebaseConfig, getCurrentUser, signInWithGoogle, signOutUser, onAuthStateChange } from './auth.js';
import { setupCloudListener, syncAllLocalToCloud } from './sync.js';
import { showToast } from './toast.js';

let currentAffirmation = null;
let activeCloudUnsubscribe = null;

export function getCurrentAffirmation() {
    return currentAffirmation;
}

export function updateAuthUI(user = null) {
    const statusEl = document.getElementById('auth-status');
    const actionBtn = document.getElementById('auth-action-btn');
    if (!statusEl || !actionBtn) return;

    if (!hasFirebaseConfig()) {
        statusEl.textContent = 'Signed out (Offline mode)';
        actionBtn.style.display = 'inline-block';
        actionBtn.textContent = 'Sign In';
        actionBtn.disabled = true;
        actionBtn.title = 'Cloud sync disabled (no Firebase config)';
        actionBtn.className = 'px-2.5 py-1 rounded-lg border border-subtle-theme text-muted-theme opacity-50 cursor-not-allowed text-xs font-medium';
        return;
    }

    actionBtn.disabled = false;
    actionBtn.className = 'px-2.5 py-1 rounded-lg border border-subtle-theme text-main-theme hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors font-medium text-xs';

    if (!user) {
        statusEl.textContent = 'Signed out';
        actionBtn.style.display = 'inline-block';
        actionBtn.textContent = 'Sign in with Google';
        actionBtn.title = 'Sign in with Google';
    } else {
        statusEl.textContent = user.displayName || user.email || 'Signed in';
        actionBtn.style.display = 'inline-block';
        actionBtn.textContent = 'Sign Out';
        actionBtn.title = 'Sign Out';
    }
}

export function initAuthListener() {
    return onAuthStateChange(async (user) => {
        updateAuthUI(user);

        if (user) {
            if (activeCloudUnsubscribe) {
                activeCloudUnsubscribe();
            }

            activeCloudUnsubscribe = setupCloudListener(user, (merged) => {
                const contentArea = document.getElementById('content-area');
                const currentView = contentArea ? contentArea.dataset.view : null;
                if (currentView === 'history' || currentView === 'favorites') {
                    renderHistory(currentView);
                }
            });

            await syncAllLocalToCloud(user, getHistory());
        } else {
            if (activeCloudUnsubscribe) {
                activeCloudUnsubscribe();
                activeCloudUnsubscribe = null;
            }
        }
    });
}

export function renderMoodSelector() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;
    contentArea.dataset.view = 'selector';
    const moods = ['Anxious', 'Excited', 'Tired', 'Confident', 'Overwhelmed', 'Neutral'];
    
    contentArea.innerHTML = `
        <h2 class="text-xl md:text-2xl font-bold text-main-theme text-center mb-6">How are you feeling right now?</h2>
        <div class="grid grid-cols-2 gap-3 sm:gap-4">
            ${moods.map(mood => `
                <button data-action="select-mood" data-mood="${escapeHtml(mood)}" 
                        class="mood-chip p-3.5 sm:p-5 rounded-2xl shadow-md text-sm sm:text-base font-semibold transition-all duration-200 
                               hover:shadow-lg active:scale-[.98] focus:outline-none focus:ring-2 focus:ring-blue-500 break-words hyphens-auto">
                    ${escapeHtml(mood)}
                </button>
            `).join('')}
        </div>
    `;
    resetStack();
    currentAffirmation = null;
}

export function handleGenerateNext(mood) {
    const newAff = generateAffirmation(mood);
    if (newAff) {
        pushToStack(newAff);
        renderAffirmationCard(mood, false);
    } else {
        const contentArea = document.getElementById('content-area');
        if (contentArea) {
            contentArea.innerHTML = `
                <div class="text-center p-6 rounded-xl bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                    <p class="font-bold mb-2">Content Exhausted</p>
                    <p>We've run out of unique affirmations for your mood. Please try again tomorrow!</p>
                    <button data-action="go-back-selector" class="mt-4 text-red-600 dark:text-red-400 font-medium hover:underline">Go Back</button>
                </div>
            `;
        }
    }
}

export function navigateStack(delta) {
    const newIndex = stackIndex + delta;
    if (newIndex >= 0 && newIndex < sessionStack.length) {
        setStackIndex(newIndex);
        const aff = sessionStack[newIndex];
        renderAffirmationCard(aff.mood, false);
    } else if (delta > 0 && newIndex === sessionStack.length) {
        handleGenerateNext(sessionStack[stackIndex].mood);
    }
}

export function renderAffirmationCard(mood, generateNew = true) {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;
    contentArea.dataset.view = 'card';
    
    if (generateNew) {
        handleGenerateNext(mood);
        return;
    }

    const history = getHistory();
    if (sessionStack.length > 0 && stackIndex >= 0) {
        currentAffirmation = sessionStack[stackIndex];
    } else if (history.length > 0) {
        currentAffirmation = history[0];
    } else {
        currentAffirmation = null; 
        renderMoodSelector();
        return;
    }

    const aff = currentAffirmation;
    const favorites = getFavorites();
    const isFav = favorites.includes(aff.seed_id);
    
    const existingEntry = history.find(h => h.seed_id === aff.seed_id);
    if (existingEntry) aff.docId = existingEntry.docId;

    const canGoBack = stackIndex > 0;

    contentArea.innerHTML = `
        <div class="text-center">
            <h3 class="text-muted-theme mb-6 text-xs sm:text-sm uppercase tracking-widest font-semibold">Affirmation for feeling ${escapeHtml(aff.mood)}</h3>
            <div class="mood-card-${escapeHtml(aff.mood)} p-6 sm:p-8 rounded-3xl shadow-xl transition-all duration-500 min-h-[180px] flex items-center justify-center">
                <p class="text-xl sm:text-3xl font-light leading-relaxed italic break-words">
                    "${escapeHtml(aff.text)}"
                </p>
            </div>
            <div class="flex items-center justify-center space-x-3 sm:space-x-4 mt-8">
                <button data-action="stack-back" aria-label="Previous affirmation" ${!canGoBack ? 'disabled' : ''}
                        class="p-3 rounded-full transition-colors shadow-md active:scale-[.95] ${canGoBack ? 'bg-gray-200 dark:bg-slate-700 text-main-theme hover:bg-gray-300 dark:hover:bg-slate-600' : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-600 cursor-not-allowed'}">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
                        <path fill-rule="evenodd" d="M7.72 12.53a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5Z" clip-rule="evenodd" />
                    </svg>
                </button>
                <div class="flex space-x-4 sm:space-x-6">
                    <button id="save-btn" data-action="save-card" data-mood="${escapeHtml(mood)}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}"
                            class="p-3.5 sm:p-4 rounded-full transition-colors shadow-lg active:scale-[.95] ${isFav ? 'bg-yellow-400 text-white hover:bg-yellow-500 shadow-yellow-300/50' : 'bg-[#104E9E] dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-500'}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 sm:w-7 sm:h-7">
                            <path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clip-rule="evenodd" />
                        </svg>
                    </button>
                    <button data-action="share-card" data-mood="${escapeHtml(aff.mood)}" aria-label="Share affirmation"
                            class="p-3.5 sm:p-4 rounded-full bg-gray-200 dark:bg-slate-700 text-main-theme hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors shadow-md active:scale-[.95]">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 sm:w-7 sm:h-7">
                            <path fill-rule="evenodd" d="M15.75 4.5a3 3 0 1 1 .823 5.429L11.54 13.5H9.75a2.25 2.25 0 0 0-2.25 2.25v2.25a2.25 2.25 0 0 0 2.25 2.25H16.5a2.25 2.25 0 0 0 2.25-2.25v-2.25a2.25 2.25 0 0 0-2.25-2.25H14.26l4.986-3.693A3 3 0 0 1 15.75 4.5Z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>
                <button data-action="stack-next" data-mood="${escapeHtml(mood)}" aria-label="Next affirmation"
                        class="p-3 rounded-full transition-colors shadow-md active:scale-[.95] bg-gray-200 dark:bg-slate-700 text-main-theme hover:bg-gray-300 dark:hover:bg-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
                        <path fill-rule="evenodd" d="M16.28 12.53a.75.75 0 0 0 0-1.06l-7.5-7.5a.75.75 0 0 0-1.06 1.06L14.69 12l-6.97 6.97a.75.75 0 1 0 1.06 1.06l7.5-7.5Z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        </div>
    `;
}

export function renderHistory(view) {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;
    contentArea.dataset.view = view;
    const isHistoryView = view === 'history';
    const title = isHistoryView ? 'Your Affirmation History' : 'Your Favorites';
    
    const history = getHistory();
    let listData = isHistoryView ? history : history.filter(h => h.is_favorite);

    if (!isHistoryView) {
        const uniqueFavoritesMap = new Map();
        listData.forEach(item => {
            if (item.is_favorite) {
                uniqueFavoritesMap.set(item.seed_id, item);
            }
        });
        listData = Array.from(uniqueFavoritesMap.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    const contentHtml = `
        <div class="mb-6">
            <div class="flex p-1 bg-gray-100 dark:bg-slate-800 rounded-xl shadow-inner border border-subtle-theme">
                <button data-action="switch-view" data-view="history" class="flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isHistoryView ? 'bg-card-theme shadow-md text-[#104E9E] dark:text-blue-400' : 'text-muted-theme hover:text-main-theme'}">History</button>
                <button data-action="switch-view" data-view="favorites" class="flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isHistoryView ? 'bg-card-theme shadow-md text-[#104E9E] dark:text-blue-400' : 'text-muted-theme hover:text-main-theme'}">Favorites</button>
            </div>
        </div>
        <h2 class="text-xl sm:text-2xl font-bold text-main-theme mb-4">${title}</h2>
        <div class="space-y-3 max-h-80 sm:max-h-96 overflow-y-auto pr-2 custom-scroll">
            ${listData.length > 0 ? listData.map(item => {
                const isFav = item.is_favorite;
                const date = item.timestamp ? new Date(item.timestamp).toLocaleDateString() : 'N/A';
                const textVal = item.text || '';
                return `
                    <div class="p-3.5 sm:p-4 bg-card-theme border border-subtle-theme rounded-xl shadow-sm flex items-center space-x-3 hover:border-gray-300 dark:hover:border-slate-600 transition-colors">
                        <button data-action="toggle-fav" data-doc-id="${escapeHtml(item.docId)}" data-fav-state="${!isFav}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}"
                                class="p-2 flex-shrink-0 rounded-full transition-colors ${isFav ? 'bg-yellow-400 text-white hover:bg-yellow-500' : 'bg-gray-200 dark:bg-slate-700 text-muted-theme hover:bg-gray-300 dark:hover:bg-slate-600'}">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
                                <path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clip-rule="evenodd" />
                            </svg>
                        </button>
                        <div class="flex-grow min-w-0">
                            <p class="text-sm sm:text-base font-medium text-main-theme italic break-words">"${escapeHtml(textVal)}"</p>
                            <div class="flex items-center space-x-2 mt-1 text-xs text-muted-theme flex-wrap">
                                <span class="mood-chip px-2 py-0.5 rounded-full font-semibold" data-mood="${escapeHtml(item.mood || '')}">${escapeHtml(item.mood || '')}</span>
                                <span>•</span>
                                <span>${escapeHtml(date)}</span>
                            </div>
                        </div>
                        <button data-action="share-history-item" data-doc-id="${escapeHtml(item.docId)}" aria-label="Share affirmation from history"
                                class="p-2 flex-shrink-0 rounded-full transition-colors bg-gray-200 dark:bg-slate-700 text-muted-theme hover:bg-gray-300 dark:hover:bg-slate-600 hover:text-main-theme">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
                                <path fill-rule="evenodd" d="M15.75 4.5a3 3 0 1 1 .823 5.429L11.54 13.5H9.75a2.25 2.25 0 0 0-2.25 2.25v2.25a2.25 2.25 0 0 0 2.25 2.25H16.5a2.25 2.25 0 0 0 2.25-2.25v-2.25a2.25 2.25 0 0 0-2.25-2.25H14.26l4.986-3.693A3 3 0 0 1 15.75 4.5Z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>
                `;
            }).join('') : `
                <div class="text-center text-muted-theme p-8 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-subtle-theme">
                    <p class="mb-2">${isHistoryView ? 'No affirmations recorded yet.' : 'Your favorites list is empty!'}</p>
                    <button data-action="go-back-selector" class="text-blue-600 dark:text-blue-400 font-bold hover:underline">Start now</button>
                </div>
            `}
        </div>
    `;
    contentArea.innerHTML = contentHtml;
}

export function handleAction(action, mood) {
    const aff = currentAffirmation;
    if (!aff) return;

    switch (action) {
        case 'Save': {
            const history = getHistory();
            const existingEntry = history.find(h => h.docId === aff.docId);
            const newFavState = existingEntry ? !existingEntry.is_favorite : true;
            
            if (existingEntry) {
                existingEntry.is_favorite = newFavState;
                persistHistory(existingEntry);
            } else {
                aff.is_favorite = newFavState;
                persistHistory(aff);
            }
            
            renderAffirmationCard(mood, false);
            break;
        }
        case 'Share':
            renderShareModal(aff.text);
            break;
    }
}

export function setupEventDelegation() {
    const contentArea = document.getElementById('content-area');
    if (contentArea) {
        contentArea.addEventListener('click', (e) => {
            const targetBtn = e.target.closest('button[data-action]');
            if (!targetBtn) return;
            const action = targetBtn.dataset.action;

            if (action === 'select-mood') {
                const mood = targetBtn.dataset.mood;
                handleGenerateNext(mood);
            } else if (action === 'stack-back') {
                navigateStack(-1);
            } else if (action === 'stack-next') {
                const canGoForward = stackIndex < sessionStack.length - 1;
                if (canGoForward) {
                    navigateStack(1);
                } else {
                    const mood = targetBtn.dataset.mood;
                    handleGenerateNext(mood);
                }
            } else if (action === 'save-card') {
                const mood = targetBtn.dataset.mood;
                handleAction('Save', mood);
            } else if (action === 'share-card') {
                const mood = targetBtn.dataset.mood;
                handleAction('Share', mood);
            } else if (action === 'switch-view') {
                const view = targetBtn.dataset.view;
                renderHistory(view);
            } else if (action === 'toggle-fav') {
                const docId = targetBtn.dataset.docId;
                const newFavState = targetBtn.dataset.favState === 'true';
                toggleFavoriteInStorage(docId, newFavState);
                const currentView = contentArea.dataset.view;
                if (currentView === 'history' || currentView === 'favorites') {
                    renderHistory(currentView);
                }
            } else if (action === 'share-history-item') {
                const docId = targetBtn.dataset.docId;
                const history = getHistory();
                const item = history.find(h => h.docId === docId);
                if (item) {
                    renderShareModal(item.text);
                }
            } else if (action === 'go-back-selector') {
                renderMoodSelector();
            }
        });
    }

    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => toggleTheme());
    }

    const authActionBtn = document.getElementById('auth-action-btn');
    if (authActionBtn) {
        authActionBtn.addEventListener('click', async () => {
            if (!hasFirebaseConfig()) {
                showToast("Cloud sync disabled. No Firebase config.", "info");
                return;
            }

            const user = getCurrentUser();
            if (!user) {
                try {
                    await signInWithGoogle();
                } catch (err) {
                    console.error("Sign in failed:", err);
                    if (err.code !== 'auth/popup-closed-by-user') {
                        showToast("Sign in failed: " + err.message, "error");
                    }
                }
            } else {
                try {
                    await signOutUser();
                    // Clear session data on sign out per Decision Rule
                    localStorage.removeItem(STORAGE_KEY);
                    setHistory([]);
                    loadHistory();
                    renderMoodSelector();
                    showToast("Signed out", "info");
                } catch (err) {
                    console.error("Sign out failed:", err);
                    showToast("Sign out failed: " + err.message, "error");
                }
            }
        });
    }

    const ambientBtn = document.getElementById('ambient-btn');
    if (ambientBtn) {
        ambientBtn.addEventListener('click', () => {
            const currentView = contentArea ? contentArea.dataset.view : 'selector';
            let mood = 'All';
            let initial = null;
            if (currentView === 'card' && currentAffirmation) {
                // Expand what is on screen rather than generating a replacement.
                mood = currentAffirmation.mood;
                initial = currentAffirmation;
            }
            startAmbient(mood, 30000, initial);
        });
    }

    const navNew = document.getElementById('nav-new-affirmation');
    if (navNew) {
        navNew.addEventListener('click', () => renderMoodSelector());
    }
    const navHist = document.getElementById('nav-history');
    if (navHist) {
        navHist.addEventListener('click', () => renderHistory('history'));
    }
    const navFav = document.getElementById('nav-favorites');
    if (navFav) {
        navFav.addEventListener('click', () => renderHistory('favorites'));
    }

    const closeBtn = document.getElementById('close-modal-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => closeShareModal());
    }

    const shareContainer = document.getElementById('share-buttons-container');
    if (shareContainer) {
        shareContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const text = getShareText();
            if (action === 'copy-share') {
                copyToClipboard(text);
            } else if (action === 'sms-share') {
                handleSmsShare(text);
            } else if (action === 'email-share') {
                handleEmailShare(text);
            }
        });
    }
}

export function initializeApp() {
    try {
        initTheme();
        
        // Standalone Ambient Mode check via URL parameters (e.g. ?ambient=1 or ?ambient=1&mood=Anxious)
        if (typeof window !== 'undefined' && window.location && window.location.search) {
            const params = new URLSearchParams(window.location.search);
            if (params.get('ambient') === '1' || params.get('ambient') === 'true') {
                const appEl = document.getElementById('app');
                if (appEl) appEl.style.display = 'none';
                const moodParam = params.get('mood') || 'All';
                startAmbient(moodParam);
                return;
            }
        }
        
        setCurrentDate();
        loadHistory();
        
        const navBar = document.getElementById('nav-bar');
        if (navBar) {
            navBar.style.display = 'flex';
        }
        
        setupEventDelegation();
        renderMoodSelector();
        updateAuthUI(null);
        initAuthListener();
    } catch (error) {
        console.error("Error during initialization:", error);
        const contentArea = document.getElementById('content-area');
        if (contentArea) {
            contentArea.innerHTML = `
                <div class="text-center text-red-600 dark:text-red-400 p-4 bg-red-100 dark:bg-red-950/50 rounded-xl">
                    <p class="font-bold">Error Initializing App</p>
                    <p class="text-sm">${escapeHtml(error.message)}</p>
                </div>
            `;
        }
    }
}
