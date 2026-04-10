async function initNavbar() {
    // We use a relative path from the root. 
    // On some servers, './navbar.html' is safer than '/navbar.html'
    const navbarPath = '/navbar.html'; 

    try {
        console.log(`Attempting to fetch navbar from: ${window.location.origin}${navbarPath}`);
        
        const response = await fetch(navbarPath);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} at ${navbarPath}`);
        }
        
        const data = await response.text();
        const container = document.getElementById('navbar-container');
        
        if (container) {
            container.innerHTML = data;
            // Re-run any scripts that need to target navbar elements here
            if (window.lucide) lucide.createIcons();
        } else {
            console.error("Target container #navbar-container not found in HTML.");
        }
    } catch (error) {
        console.error("Error loading navbar:", error);
    }
}

document.addEventListener('DOMContentLoaded', initNavbar);