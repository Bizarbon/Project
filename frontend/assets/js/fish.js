/**
 * Fish Animation Script
 * Spawns and animates digital fish in the background
 */

class FishAnimation {
    constructor() {
        this.container = document.querySelector('.bg-visuals');
        if (!this.container) return;
        
        this.fishCount = 5;
        this.fishes = [];
        this.init();
    }

    init() {
        for (let i = 0; i < this.fishCount; i++) {
            this.createFish();
        }
        this.animate();
    }

    createFish() {
        const fish = document.createElement('div');
        fish.className = 'fish';
        
        // Randomize fish properties
        const size = Math.random() * 40 + 30;
        const color = Math.random() > 0.5 ? 'rgba(99, 102, 241, 0.4)' : 'rgba(6, 182, 212, 0.4)';
        const blur = Math.random() * 4;
        const duration = Math.random() * 15 + 15;
        const delay = Math.random() * 10;
        const top = Math.random() * 90;
        
        fish.innerHTML = `
            <svg width="${size}" height="${size/2}" viewBox="0 0 100 50">
                <path d="M10,25 C10,10 40,5 60,15 C80,25 90,25 100,10 L100,40 C90,25 80,25 60,35 C40,45 10,40 10,25 Z" 
                      fill="${color}" style="filter: blur(${blur}px)" />
                <circle cx="25" cy="22" r="2" fill="rgba(255,255,255,0.6)" />
            </svg>
        `;

        fish.style.cssText = `
            position: absolute;
            top: ${top}%;
            left: -100px;
            animation: swim ${duration}s linear ${delay}s infinite;
            z-index: -1;
            transform: scaleX(1);
        `;

        this.container.appendChild(fish);
    }

    animate() {
        // We use CSS keyframes for performance, so no extra logic needed here
    }
}

// Add CSS keyframes dynamically
const style = document.createElement('style');
style.innerHTML = `
    @keyframes swim {
        0% { transform: translateX(-100px) scaleX(1); opacity: 0; }
        10% { opacity: 0.5; }
        90% { opacity: 0.5; }
        100% { transform: translateX(calc(100vw + 200px)) scaleX(1); opacity: 0; }
    }
    .fish {
        pointer-events: none;
    }
`;
document.head.appendChild(style);

window.addEventListener('DOMContentLoaded', () => {
    new FishAnimation();
});
