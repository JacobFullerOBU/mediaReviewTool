document.addEventListener('DOMContentLoaded', () => {
    const exploreNav = document.getElementById('explore-feed-nav');
    const browseNav = document.getElementById('browse-nav');
    const feedNav = document.getElementById('feed-nav');

    const mobileExploreNav = document.getElementById('mobile-explore-feed-nav');
    const mobileBrowseNav = document.getElementById('mobile-browse-nav');
    const mobileFeedNav = document.getElementById('mobile-feed-nav');

    const browsePage = document.getElementById('browse-page');
    const exploreFeedPage = document.getElementById('explore-feed-page');
    const feedPage = document.getElementById('feed-page');

    const mainSections = [browsePage, exploreFeedPage, feedPage];
    const navLinks = [exploreNav, browseNav, feedNav, mobileExploreNav, mobileBrowseNav, mobileFeedNav];

    function showPage(pageToShow) {
        mainSections.forEach(page => {
            if (page) {
                page.classList.add('hidden');
            }
        });
        if (pageToShow) {
            pageToShow.classList.remove('hidden');
        }
    }

    function setActiveLink(activeLink) {
        navLinks.forEach(link => {
            if (link) {
                link.classList.remove('text-white', 'bg-slate-700');
                link.classList.add('text-slate-400');
            }
        });
        if (activeLink) {
            activeLink.classList.add('text-white');
            activeLink.classList.remove('text-slate-400');
            // For mobile
            if (activeLink.id.startsWith('mobile-')) {
                activeLink.classList.add('bg-slate-700');
            }
        }
    }

    // Default to browse page
    showPage(browsePage);
    setActiveLink(browseNav);
    setActiveLink(mobileBrowseNav);


    if (browseNav && mobileBrowseNav) {
        browseNav.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(browsePage);
            setActiveLink(browseNav);
            setActiveLink(mobileBrowseNav);
        });
        mobileBrowseNav.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(browsePage);
            setActiveLink(browseNav);
            setActiveLink(mobileBrowseNav);
            document.getElementById('mobile-menu').classList.add('hidden');
        });
    }

    if (exploreNav && mobileExploreNav) {
        exploreNav.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(exploreFeedPage);
            setActiveLink(exploreNav);
            setActiveLink(mobileExploreNav);
        });
        mobileExploreNav.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(exploreFeedPage);
            setActiveLink(exploreNav);
            setActiveLink(mobileExploreNav);
            document.getElementById('mobile-menu').classList.add('hidden');
        });
    }

    if (feedNav && mobileFeedNav) {
        feedNav.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(feedPage);
            setActiveLink(feedNav);
            setActiveLink(mobileFeedNav);
        });
        mobileFeedNav.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(feedPage);
            setActiveLink(feedNav);
            setActiveLink(mobileFeedNav);
            document.getElementById('mobile-menu').classList.add('hidden');
        });
    }
    
    const exploreButton = document.getElementById('explore-button');
    if(exploreButton) {
        exploreButton.addEventListener('click', () => {
            showPage(browsePage);
            setActiveLink(browseNav);
            setActiveLink(mobileBrowseNav);
        });
    }
});