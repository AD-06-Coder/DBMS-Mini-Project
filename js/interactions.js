/**
 * Advanced Interaction Module
 * Handles: Magnetic buttons, Tilt cards, Modals
 */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof gsap === 'undefined') return;

    // 1. Magnetic Buttons
    const magneticBtns = document.querySelectorAll('.magnetic-btn');
    magneticBtns.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            gsap.to(btn, {
                x: x * 0.3,
                y: y * 0.3,
                duration: 0.3,
                ease: "power2.out"
            });
        });

        btn.addEventListener('mouseleave', () => {
            gsap.to(btn, {
                x: 0,
                y: 0,
                duration: 0.5,
                ease: "elastic.out(1, 0.3)"
            });
        });
    });

    // 2. Tilt Cards
    const tiltCards = document.querySelectorAll('.tilt-card');
    tiltCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;

            gsap.to(card, {
                rotateY: x * 10,
                rotateX: y * -10,
                transformPerspective: 500,
                duration: 0.4,
                ease: "power2.out"
            });
        });

        card.addEventListener('mouseleave', () => {
            gsap.to(card, {
                rotateY: 0,
                rotateX: 0,
                duration: 0.6,
                ease: "power2.out"
            });
        });
    });

    // 3. Modal Open/Close
    const modalTriggers = document.querySelectorAll('[data-modal-target]');
    modalTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.querySelector(trigger.getAttribute('data-modal-target'));
            if (target) {
                target.style.pointerEvents = "auto";
                gsap.to(target, { opacity: 1, duration: 0.3 });
                gsap.to(target.querySelector('.modal-content'), { y: 0, scale: 1, duration: 0.4, ease: "back.out(1.5)" });
            }
        });
    });

    const modalClosers = document.querySelectorAll('.modal-close');
    modalClosers.forEach(closer => {
        closer.addEventListener('click', (e) => {
            const target = e.target.closest('.modal-overlay');
            if (target) {
                target.style.pointerEvents = "none";
                gsap.to(target, { opacity: 0, duration: 0.3 });
                gsap.to(target.querySelector('.modal-content'), { y: 30, scale: 0.95, duration: 0.3 });
            }
        });
    });

});
