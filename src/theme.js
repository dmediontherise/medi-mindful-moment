export const THEME_STORAGE_KEY = 'medi_mindful_theme';

/**
 * Gets the current theme ('light' or 'dark').
 * Checks LocalStorage override first, then system preference.
 */
export function getTheme() {
    try {
        const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (storedTheme === 'dark' || storedTheme === 'light') {
            return storedTheme;
        }
    } catch (e) {
        console.error("Failed to read theme from LocalStorage", e);
    }
    
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

/**
 * Sets the active theme and persists to LocalStorage.
 * @param {string} theme - 'light' or 'dark'
 */
export function setTheme(theme) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {
        console.error("Failed to save theme to LocalStorage", e);
    }
    applyTheme(theme);
}

/**
 * Applies theme class to document element and updates toggle button state.
 * @param {string} theme 
 */
export function applyTheme(theme) {
    if (typeof document === 'undefined') return;
    const isDark = theme === 'dark';
    
    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
        themeBtn.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
        themeBtn.title = isDark ? 'Switch to light theme' : 'Switch to dark theme';
        themeBtn.innerHTML = isDark ? `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m0 13.5V21m8.966-8.966h-2.25m-13.5 0H3m15.364-6.364l-1.591 1.591M6.758 17.242l-1.591 1.591m12.728 0l-1.591-1.591M6.758 6.758L5.167 5.167M12 8.25a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z" />
            </svg>
        ` : `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
        `;
    }
}

/**
 * Initializes theme listener and applies current theme.
 */
export function initTheme() {
    const currentTheme = getTheme();
    applyTheme(currentTheme);

    if (typeof window !== 'undefined' && window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e) => {
            try {
                // Only auto-update if no explicit localStorage override exists
                if (!localStorage.getItem(THEME_STORAGE_KEY)) {
                    applyTheme(e.matches ? 'dark' : 'light');
                }
            } catch (err) {
                applyTheme(e.matches ? 'dark' : 'light');
            }
        };

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleChange);
        } else if (mediaQuery.addListener) {
            mediaQuery.addListener(handleChange);
        }
    }
}

/**
 * Toggles theme between light and dark.
 */
export function toggleTheme() {
    const current = getTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
}
