// Scroll Reveal Animation Logic
function reveal() {
    const reveals = document.querySelectorAll(".reveal");
    for (let i = 0; i < reveals.length; i++) {
        const windowHeight = window.innerHeight;
        const elementTop = reveals[i].getBoundingClientRect().top;
        const elementVisible = 150;
        if (elementTop < windowHeight - elementVisible) {
            reveals[i].classList.add("active");
        }
    }
}

// Initial reveal on load
document.addEventListener("DOMContentLoaded", () => {
    // Add scroll event listener
    window.addEventListener("scroll", reveal);
    
    // Trigger once to show elements already in view
    reveal();

    // Global Logo Click Handler (if needed via class)
    const logos = document.querySelectorAll('.nav-logo');
    logos.forEach(logo => {
        logo.style.cursor = 'pointer';
        logo.addEventListener('click', () => {
            const root = typeof window.getAppBasePath === 'function' ? window.getAppBasePath() : '';
            window.location.href = `${root}index.html`;
        });
    });
});
