import { showToast } from './toast.js';

let currentShareText = "";
let modalTriggerElement = null;
let modalKeydownHandler = null;

export function getShareText() {
    return currentShareText;
}

export function copyToClipboard(textToCopy) {
    try {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);

        showToast('Affirmation copied to clipboard!');
        closeShareModal(); 
    } catch (err) {
        console.error('Could not copy text: ', err);
        showToast('Copy failed. Please select text manually.', 'error');
    }
}

export function handleSmsShare(fullText) {
    window.location.href = `sms:?body=${encodeURIComponent(fullText)}`;
    closeShareModal();
}

export function handleEmailShare(fullText) {
    const subject = encodeURIComponent('A Medi Mindful Moment for You');
    const body = encodeURIComponent(fullText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    closeShareModal();
}

export function renderShareModal(affirmationText) {
    const appTag = " - Medi Mindful Moment App";
    const fullText = `"${affirmationText}"${appTag}`;
    currentShareText = fullText;

    if (typeof document !== 'undefined') {
        modalTriggerElement = document.activeElement;
    }

    const modal = document.getElementById('share-modal');
    const content = document.getElementById('share-content-text');
    const buttonsContainer = document.getElementById('share-buttons-container');
    const modalContent = document.getElementById('modal-content');

    if (!modal || !content || !buttonsContainer || !modalContent) return;

    content.textContent = fullText;
    buttonsContainer.innerHTML = `
        <button data-action="copy-share" 
                class="w-full py-3 rounded-xl bg-[#104E9E] dark:bg-blue-600 text-white font-semibold shadow-md hover:bg-blue-600 dark:hover:bg-blue-500 transition-colors active:scale-[.98]">
            Copy to Clipboard
        </button>
        <button data-action="sms-share"
                class="native-share-btn w-full flex items-center justify-center py-3 rounded-xl bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200 font-semibold shadow-md hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors">
            Share via Text (SMS)
        </button>
        <button data-action="email-share"
                class="native-share-btn w-full flex items-center justify-center py-3 rounded-xl bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200 font-semibold shadow-md hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors">
            Share via Email
        </button>
    `;

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');

    // Attach focus trap & Escape key listener
    if (modalKeydownHandler) {
        document.removeEventListener('keydown', modalKeydownHandler);
    }

    modalKeydownHandler = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeShareModal();
            return;
        }

        if (e.key === 'Tab') {
            const focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }
    };

    document.addEventListener('keydown', modalKeydownHandler);

    setTimeout(() => {
        modal.classList.add('opacity-100');
        modalContent.classList.replace('scale-90', 'scale-100');
        const firstBtn = modal.querySelector('button');
        if (firstBtn) firstBtn.focus();
    }, 10);
}

export function closeShareModal() {
    const modal = document.getElementById('share-modal');
    const modalContent = document.getElementById('modal-content');
    if (!modal || !modalContent) return;

    if (modalKeydownHandler) {
        document.removeEventListener('keydown', modalKeydownHandler);
        modalKeydownHandler = null;
    }

    modal.classList.remove('opacity-100');
    modal.setAttribute('aria-hidden', 'true');
    modalContent.classList.replace('scale-100', 'scale-90');
    
    setTimeout(() => {
        modal.style.display = 'none';
        if (modalTriggerElement && typeof modalTriggerElement.focus === 'function') {
            modalTriggerElement.focus();
            modalTriggerElement = null;
        }
    }, 300);
}
