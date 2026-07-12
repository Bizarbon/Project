(function setupLegalPages() {
    const header = document.querySelector('.storefront-header');
    if (header) {
        const updateHeaderHeight = () => document.documentElement.style.setProperty('--storefront-header-height', `${header.offsetHeight}px`);
        updateHeaderHeight();
        if ('ResizeObserver' in window) new ResizeObserver(updateHeaderHeight).observe(header);
    }

    const cookieForm = document.getElementById('cookiePreferences');
    if (!cookieForm) return;

    let saved = {};
    try {
        saved = JSON.parse(localStorage.getItem('cookiePreferences') || '{}');
    } catch (error) {
        saved = {};
    }
    cookieForm.querySelectorAll('input[type="checkbox"]').forEach(input => {
        if (input.name !== 'necessary') input.checked = Boolean(saved[input.name]);
    });

    cookieForm.addEventListener('submit', event => {
        event.preventDefault();
        const preferences = { necessary: true };
        cookieForm.querySelectorAll('input[type="checkbox"]').forEach(input => {
            preferences[input.name] = input.checked;
        });
        localStorage.setItem('cookiePreferences', JSON.stringify(preferences));
        document.getElementById('cookieSaveStatus').textContent = 'Đã lưu lựa chọn trên trình duyệt này.';
    });
})();
