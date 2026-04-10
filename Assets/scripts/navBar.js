// navbar.js
async function initNavbar() {
    try {
        // 1. Fetch the navbar content
        const response = await fetch('/navbar.html');
        if (!response.ok) throw new Error('Failed to load navbar');
        const navHtml = await response.text();

        // 2. Insert it into the placeholder
        const placeholder = document.getElementById('nav-placeholder');
        if (placeholder) {
            placeholder.innerHTML = navHtml;
        }
        const event = new Event('navbarLoaded');
        document.dispatchEvent(event);
        // 3. Re-initialize Lucide Icons (Essential!)
        if (window.lucide) {
            lucide.createIcons();
        }

        // 4. Set up Mobile Menu Toggle
        const menuBtn = document.getElementById('mobile-menu-button');
        const mobileMenu = document.getElementById('mobile-menu');
        
        if (menuBtn && mobileMenu) {
            menuBtn.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
            });
        }

        // 5. Highlight the active link based on current URL
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        const navLinks = document.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
            if (link.getAttribute('href') === currentPath) {
                link.classList.add('text-white', 'bg-slate-700/50', 'md:bg-transparent');
                link.classList.remove('text-slate-400', 'text-slate-300');
            }
        });
            // At the very end of your initNavbar function in navBar.js:
        const navEvent = new CustomEvent('navbarLoaded');
        document.dispatchEvent(navEvent);
    } catch (error) {
        console.error('Error loading navbar:', error);
    }
}

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', initNavbar);