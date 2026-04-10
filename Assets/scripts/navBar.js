async function initNavbar() {
    const container = document.getElementById('navbar-container');
    
    // If the container doesn't exist yet, wait 10ms and try once more
    if (!container) {
        console.warn("Navbar container not found, retrying...");
        setTimeout(initNavbar, 50); 
        return;
    }

    // Using a relative path is usually safest for root files
    const navbarPath = './navbar.html'; 

    try {
        const response = await fetch(navbarPath);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.text();
        container.innerHTML = data;

        // Initialize icons if you use them in the navbar
        if (window.lucide) {
            window.lucide.createIcons();
        }
    } catch (error) {
        console.error("Error loading navbar:", error);
    }
}

// Start the process
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavbar);
} else {
    initNavbar();
}