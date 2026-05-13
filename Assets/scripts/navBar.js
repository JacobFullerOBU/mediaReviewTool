// Capture script's own absolute URL synchronously — document.currentScript is null inside any callback.
// For type="module" scripts document.currentScript is also null; those are always at the root level
// so they fall back to the data-root attribute (or './').
const _navbarScriptSrc = document.currentScript ? document.currentScript.src : null;

async function initNavbar() {
    const container = document.getElementById('navbar-container');

    if (!container) {
        console.warn("Navbar container not found, retrying...");
        setTimeout(initNavbar, 50);
        return;
    }

    // root is used to rewrite internal links inside the injected navbar HTML.
    // Subdirectory pages (e.g. Assets/profile/) set data-root="../../" on the container.
    const root = container.dataset.root || './';

    // Resolve navbar.html using the script's own absolute URL so the fetch always succeeds
    // no matter which page loaded this script.  navBar.js lives at Assets/scripts/navBar.js,
    // so navbar.html is exactly two directories up from the script.
    // Fall back to root-relative path for module-script callers (index.html, movie.html).
    const navbarUrl = _navbarScriptSrc
        ? new URL('../../navbar.html', _navbarScriptSrc).href
        : root + 'navbar.html';

    try {
        const response = await fetch(navbarUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        let data = await response.text();

        // Rewrite root-level links so they resolve correctly from subdirectory pages
        if (root !== './') {
            data = data
                .replace(/href="index\.html"/g, `href="${root}index.html"`)
                .replace(/href="browse\.html"/g, `href="${root}browse.html"`)
                .replace(/href="community\.html"/g, `href="${root}community.html"`)
                .replace(/window\.location\.href='index\.html'/g, `window.location.href='${root}index.html'`);
        }

        container.innerHTML = data;

        if (window.lucide) {
            window.lucide.createIcons();
        }

        // Wire up mobile hamburger toggle — done here so it works on every page
        const menuButton = document.getElementById('mobile-menu-button');
        const mobileMenu = document.getElementById('mobile-menu');
        if (menuButton && mobileMenu) {
            menuButton.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
            document.querySelectorAll('#mobile-menu a').forEach(link => {
                link.addEventListener('click', () => mobileMenu.classList.add('hidden'));
            });
            document.addEventListener('click', (e) => {
                if (!menuButton.contains(e.target) && !mobileMenu.contains(e.target)) {
                    mobileMenu.classList.add('hidden');
                }
            });
        }

        document.dispatchEvent(new Event('navbarLoaded'));
    } catch (error) {
        console.error("Error loading navbar:", error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavbar);
} else {
    initNavbar();
}
