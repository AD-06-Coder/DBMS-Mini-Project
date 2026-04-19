/**
 * Main application logic
 */

// Simple Toast Notification System
window.showToast = function (message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = message;
  container.appendChild(toast);

  // Animate in
  gsap.fromTo(toast, 
    { y: -50, opacity: 0, scale: 0.9 },
    { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.5)" }
  );

  // Animate out after 3s
  setTimeout(() => {
    gsap.to(toast, {
      y: -50,
      opacity: 0,
      scale: 0.9,
      duration: 0.4,
      ease: "power2.in",
      onComplete: () => toast.remove()
    });
  }, 3500);
}

// Global Logout Helper
window.logoutUser = function (type) {
  if (type === 'admin') {
    localStorage.removeItem('adminAuth');
    showToast('Logged out successfully', 'success');
    setTimeout(() => window.location.href = 'auth-admin.html', 800);
  } else {
    localStorage.removeItem('studentAuth');
    showToast('Logged out successfully', 'info');
    setTimeout(() => window.location.href = 'auth-student.html', 800);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Highlight active link based on current path
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  // --- Authentication Guards ---
  const protectedStudentPages = ['dashboard.html', 'drives.html', 'eligibility.html'];
  if (protectedStudentPages.includes(currentPath)) {
    if (!localStorage.getItem('studentAuth')) {
      window.location.href = 'auth-student.html';
      return;
    }
  }

  if (currentPath === 'admin.html') {
    if (!localStorage.getItem('adminAuth')) {
      window.location.href = 'auth-admin.html';
      return;
    }
  }
  // -----------------------------

  const navLinks = document.querySelectorAll('.nav-links a');

  navLinks.forEach(link => {
    if (link.getAttribute('href') === currentPath ||
      (currentPath === '' && link.getAttribute('href') === 'index.html')) {
      link.classList.add('active');
    }
  });

  // Navbar scroll style change
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

  // Page entry stagger animation for non-scroll elements
  if (typeof gsap !== 'undefined') {
    gsap.fromTo('.fade-in-load', {
      y: 30,
      opacity: 0
    }, {
      y: 0,
      opacity: 1,
      duration: 1.2,
      stagger: 0.1,
      ease: "power3.out",
      delay: 0.1
    });
  }
});
