async function initNavbar() {
    const container = document.getElementById('navbar-container');

    if (!container) {
        console.warn("Navbar container not found, retrying...");
        setTimeout(initNavbar, 50);
        return;
    }

    // data-root lets subdirectory pages specify the path back to the project root
    const root = container.dataset.root || './';
    const navbarPath = root + 'navbar.html';

    try {
        const response = await fetch(navbarPath);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        let data = await response.text();

        // Fix all root-relative links when loaded from a subdirectory page
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
