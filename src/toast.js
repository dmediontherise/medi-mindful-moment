export function showToast(message, type = 'success') {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;

    toast.textContent = message;
    
    // WCAG AA compliant background colors (>= 4.5:1 contrast ratio against white text #ffffff)
    if (type === 'error') {
        toast.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 p-3 bg-red-700 text-white rounded-xl shadow-xl z-50 text-sm font-medium transition-all';
    } else if (type === 'info') {
        toast.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 p-3 bg-blue-700 text-white rounded-xl shadow-xl z-50 text-sm font-medium transition-all';
    } else {
        toast.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 p-3 bg-green-700 text-white rounded-xl shadow-xl z-50 text-sm font-medium transition-all';
    }
    
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300);
    }, 3000);
}
