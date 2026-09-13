document.addEventListener("DOMContentLoaded", () => {
    const reveals = document.querySelectorAll('.reveal');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !('IntersectionObserver' in window)) {
        reveals.forEach(element => element.classList.add('active'));
    } else {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            });
        }, { rootMargin: '0px 0px -80px', threshold: 0.01 });
        reveals.forEach(element => observer.observe(element));
    }

    const logos = document.querySelectorAll('.nav-logo');
    logos.forEach(logo => {
        logo.style.cursor = 'pointer';
        logo.addEventListener('click', () => {
            const root = typeof window.getAppBasePath === 'function' ? window.getAppBasePath() : '';
            window.location.href = `${root}index.html`;
        });
    });
});
