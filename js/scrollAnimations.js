/**
 * Narrative Cinematic Scroll Animations using Lenis and GSAP ScrollTrigger
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Initialize Lenis Smooth Scrolling
    const lenis = new Lenis({
        duration: 1.5, // slightly slower for cinematic storytelling
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        direction: 'vertical',
        gestureDirection: 'vertical',
        smooth: true,
        mouseMultiplier: 1,
        smoothTouch: false,
        touchMultiplier: 2,
        infinite: false,
    });

    // Integrated Lenis with GSAP ScrollTrigger
    gsap.registerPlugin(ScrollTrigger);
    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);

    // 2. Setup Simple Upward Reveals
    const revealUpElements = document.querySelectorAll(".reveal-up");
    revealUpElements.forEach((elem) => {
        gsap.to(elem, {
            scrollTrigger: {
                trigger: elem,
                start: "top 85%",
                toggleActions: "play none none reverse"
            },
            y: 0,
            opacity: 1,
            duration: 1.2,
            ease: "power3.out"
        });
    });

    // 3. Setup Left Slider Reveals (Problem Section)
    const revealLeftElements = document.querySelectorAll(".reveal-left");
    revealLeftElements.forEach((elem) => {
        gsap.to(elem, {
            scrollTrigger: {
                trigger: elem,
                start: "top 85%",
                toggleActions: "play none none reverse"
            },
            x: 0,
            opacity: 1,
            duration: 1.5,
            ease: "power4.out"
        });
    });

    // 4. Staggered Grid items (Features, Cards)
    const staggerContainers = document.querySelectorAll(".stagger-grid");
    staggerContainers.forEach((container) => {
        const items = container.querySelectorAll(".stagger-item");
        if (items.length > 0) {
            gsap.to(items, {
                scrollTrigger: {
                    trigger: container,
                    start: "top 80%",
                    toggleActions: "play none none reverse"
                },
                y: 0,
                opacity: 1,
                duration: 1,
                stagger: 0.2, // sequential cascade
                ease: "power3.out"
            });
        }
    });

    // 5. Narrative Parallax - sections move at different speeds
    const parallaxLayers = document.querySelectorAll(".parallax-layer");
    parallaxLayers.forEach((layer) => {
        const speed = layer.getAttribute('data-speed') || 0.2;

        gsap.to(layer, {
            y: () => -(layer.offsetHeight * speed),
            ease: "none",
            scrollTrigger: {
                trigger: layer,
                start: "top bottom",
                end: "bottom top",
                scrub: true
            }
        });
    });

    // 6. Huge Typography Text Reveal Layering
    const textReveals = document.querySelectorAll(".reveal-text-line");
    textReveals.forEach((text) => {
        const lines = text.querySelectorAll(".line");
        if (lines.length > 0) {
            gsap.to(lines, {
                scrollTrigger: {
                    trigger: text,
                    start: "top 95%",
                },
                y: "0%",
                opacity: 1,
                duration: 1.5,
                stagger: 0.15,
                ease: "power4.out"
            });
        }
    });

    // Handle Navbar Scrolled State
    const nav = document.querySelector('nav');
    if (nav) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                nav.classList.add('scrolled');
            } else {
                nav.classList.remove('scrolled');
            }
        });
    }
});
