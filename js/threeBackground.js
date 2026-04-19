/**
 *  Three.js Cinematic Particle Background
 */

document.addEventListener("DOMContentLoaded", () => {
    if (typeof THREE === 'undefined') {
        console.warn("Three.js not loaded. Simple CSS background applied.");
        return;
    }

    const container = document.getElementById('three-bg-container');
    if (!container) return;

    // Scene setup
    const scene = new THREE.Scene();

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 30;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Particle Geometry
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 800;

    const posArray = new Float32Array(particlesCount * 3);
    const colorsArray = new Float32Array(particlesCount * 3);

    // Check for explicit JS overrides (e.g. for Auth-Admin page)
    const primHex = window.OVERRIDE_THREE_COLORS ? window.OVERRIDE_THREE_COLORS.primary : null;
    const accHex = window.OVERRIDE_THREE_COLORS ? window.OVERRIDE_THREE_COLORS.accent : null;

    // Use CSS vars if no override, but Three.js needs computed styles to parse CSS variable colors accurately
    // Since we just want the boy theme globally, we hardcode the fallback to the Boy theme if no override exists
    const primaryColor = new THREE.Color(primHex || '#832526');
    const accentColor = new THREE.Color(accHex || '#e5b3b3');

    for (let i = 0; i < particlesCount * 3; i += 3) {
        // x, y, z spread
        posArray[i] = (Math.random() - 0.5) * 100;
        posArray[i + 1] = (Math.random() - 0.5) * 100;
        posArray[i + 2] = (Math.random() - 0.5) * 100;

        // Mix colors
        const mixedColor = primaryColor.clone().lerp(accentColor, Math.random());
        colorsArray[i] = mixedColor.r;
        colorsArray[i + 1] = mixedColor.g;
        colorsArray[i + 2] = mixedColor.b;
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));

    // Particle Material
    // Use an additive blending to create a soft glow effect
    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.15,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
    });

    // Mesh
    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);

    // Mouse movement interaction
    let mouseX = 0;
    let mouseY = 0;

    document.addEventListener('mousemove', (event) => {
        mouseX = (event.clientX / window.innerWidth) - 0.5;
        mouseY = (event.clientY / window.innerHeight) - 0.5;
    });

    // Resize handling
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Animation loop
    const clock = new THREE.Clock();

    const animate = () => {
        const elapsedTime = clock.getElapsedTime();

        // Slow cinematic rotation
        particlesMesh.rotation.y = elapsedTime * 0.05;
        particlesMesh.rotation.x = elapsedTime * 0.03;

        // Subtle parallax effect tracking mouse
        particlesMesh.position.x += (mouseX * 5 - particlesMesh.position.x) * 0.05;
        particlesMesh.position.y += (-mouseY * 5 - particlesMesh.position.y) * 0.05;

        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }

    animate();
});
