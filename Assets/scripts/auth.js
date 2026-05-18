// --- Firebase Auth & Database Imports ---
import { auth, db } from "./firebase.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// --- 1. Initialization Logic ---
function initAuth() {
    // Modals, forms, and buttons all live inside the dynamically-loaded navbar,
    // so everything is initialized after navbarLoaded fires.
    document.addEventListener('navbarLoaded', () => {
        initModals();
        initAuthForms();
        initAuthButtons();
        onAuthStateChanged(auth, updateAuthUI);
    });

    // Check localStorage for a faster "perceived" login
    checkAuthState();
}
// --- Required for Community and Protected Actions ---
export function requireLogin(callback) {
    if (auth.currentUser) {
        callback(auth.currentUser);
    } else {
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            showModal(loginModal);
            showNotification('Please log in to continue', 'info');
        } else {
            console.error("Login modal not found. Make sure navbar is loaded.");
        }
    }
}
// --- 2. UI Syncing Logic ---
function updateAuthUI(user) {
    const elements = {
        loginBtn: document.getElementById('loginBtn'),
        registerBtn: document.getElementById('registerBtn'),
        profileBtn: document.getElementById('profileBtn'),
        importBtn: document.getElementById('importBtn'),
        mobileLogin: document.getElementById('mobile-loginBtn'),
        mobileRegister: document.getElementById('mobile-registerBtn'),
        mobileProfile: document.getElementById('mobile-profileBtn'),
        mobileImport: document.getElementById('mobile-importBtn'),
        mobileImportNav: document.getElementById('mobile-import-nav'),
        logoutBtn: document.getElementById('logoutBtn')
    };

    // Exit if navbar isn't ready
    if (!elements.loginBtn) return;

    if (user) {
        // User is Logged In
        if (elements.profileBtn) elements.profileBtn.style.display = 'inline-block';
        if (elements.mobileProfile) elements.mobileProfile.style.display = 'block';
        if (elements.importBtn) elements.importBtn.style.display = 'inline-block';
        if (elements.mobileImport) elements.mobileImport.style.display = 'block';
        if (elements.mobileImportNav) elements.mobileImportNav.style.display = 'block';
        if (elements.logoutBtn) elements.logoutBtn.style.display = 'inline-block';
        
        if (elements.loginBtn) elements.loginBtn.style.display = 'none';
        if (elements.registerBtn) elements.registerBtn.style.display = 'none';
        if (elements.mobileLogin) elements.mobileLogin.style.display = 'none';
        if (elements.mobileRegister) elements.mobileRegister.style.display = 'none';
    } else {
        // User is Logged Out
        if (elements.profileBtn) elements.profileBtn.style.display = 'none';
        if (elements.mobileProfile) elements.mobileProfile.style.display = 'none';
        if (elements.importBtn) elements.importBtn.style.display = 'none';
        if (elements.mobileImport) elements.mobileImport.style.display = 'none';
        if (elements.mobileImportNav) elements.mobileImportNav.style.display = 'none';
        if (elements.logoutBtn) elements.logoutBtn.style.display = 'none';
        
        if (elements.loginBtn) elements.loginBtn.style.display = 'inline-block';
        if (elements.registerBtn) elements.registerBtn.style.display = 'inline-block';
        if (elements.mobileLogin) elements.mobileLogin.style.display = 'block';
        if (elements.mobileRegister) elements.mobileRegister.style.display = 'block';
    }
}

// --- 3. Interaction Listeners ---
function initAuthButtons() {
    const modalMappings = [
        { id: 'loginBtn', modal: 'loginModal' },
        { id: 'mobile-loginBtn', modal: 'loginModal' },
        { id: 'registerBtn', modal: 'registerModal' },
        { id: 'mobile-registerBtn', modal: 'registerModal' },
        { id: 'importBtn', modal: 'importModal' },
        { id: 'mobile-importBtn', modal: 'importModal' }
    ];

    modalMappings.forEach(item => {
        const btn = document.getElementById(item.id);
        if (btn) {
            btn.onclick = () => showModal(document.getElementById(item.modal));
        }
    });

    const root = document.getElementById('navbar-container')?.dataset.root || './';
    const profileBtns = ['profileBtn', 'mobile-profileBtn'];
    profileBtns.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.onclick = () => window.location.href = root + 'Assets/profile/userprofile.html';
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.onclick = handleLogout;
}

function initModals() {
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    
    // Close logic
    document.querySelectorAll('.close').forEach(btn => {
        btn.onclick = function() {
            hideModal(document.getElementById(this.dataset.modal));
        };
    });
    
    window.onclick = (e) => {
        if (e.target.classList.contains('modal')) hideModal(e.target);
    };
    
    // Switches
    document.getElementById('switchToRegister')?.addEventListener('click', (e) => {
        e.preventDefault(); hideModal(loginModal); showModal(registerModal);
    });
    document.getElementById('switchToLogin')?.addEventListener('click', (e) => {
        e.preventDefault(); hideModal(registerModal); showModal(loginModal);
    });
}

function initAuthForms() {
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
    document.getElementById('importForm')?.addEventListener('submit', handleImport);
    document.getElementById('googleLoginBtn')?.addEventListener('click', handleGoogleSignIn);
    document.getElementById('googleRegisterBtn')?.addEventListener('click', handleGoogleSignIn);
    initForgotPassword();
}

function initForgotPassword() {
    const link = document.getElementById('forgotPasswordLink');
    const section = document.getElementById('forgotPasswordSection');
    const cancelBtn = document.getElementById('cancelResetBtn');
    const sendBtn = document.getElementById('sendResetBtn');

    link?.addEventListener('click', (e) => {
        e.preventDefault();
        section.classList.remove('hidden');
        document.getElementById('resetEmail').value = document.getElementById('loginEmail').value;
        document.getElementById('resetEmail').focus();
    });

    cancelBtn?.addEventListener('click', () => {
        section.classList.add('hidden');
    });

    sendBtn?.addEventListener('click', async () => {
        const email = document.getElementById('resetEmail').value.trim();
        if (!email) return;
        sendBtn.textContent = 'Sending...';
        sendBtn.disabled = true;
        try {
            await sendPasswordResetEmail(auth, email);
            section.classList.add('hidden');
            showNotification('Password reset email sent!', 'success');
        } catch (error) {
            showNotification(getAuthErrorMessage(error), 'error');
        } finally {
            sendBtn.textContent = 'Send Reset Email';
            sendBtn.disabled = false;
        }
    });
}

// --- 4. Auth Handlers ---
async function handleLogin(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) return showFormError(e.target, 'Please fill in all fields');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showFormError(e.target, 'Please enter a valid email address.');

    setButtonLoading(submitBtn, true);
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        localStorage.setItem('userData', JSON.stringify({ email: userCredential.user.email }));
        hideModal(document.getElementById('loginModal'));
        showNotification('Login successful!', 'success');
    } catch (error) {
        showFormError(e.target, getAuthErrorMessage(error));
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) return showFormError(e.target, 'Passwords do not match');

    setButtonLoading(submitBtn, true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await set(ref(db, 'reviewers/' + userCredential.user.uid), {
            name: username,
            email: email,
            createdAt: new Date().toISOString()
        });
        hideModal(document.getElementById('registerModal'));
        showNotification('Registration successful!', 'success');
    } catch (error) {
        showFormError(e.target, getAuthErrorMessage(error));
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

async function handleGoogleSignIn() {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        // Create profile if it doesn't exist yet (update won't overwrite existing fields)
        await import("https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js").then(({ ref: dbRef, update }) =>
            update(dbRef(db, 'reviewers/' + user.uid), {
                name: user.displayName || user.email.split('@')[0],
                email: user.email,
                photoURL: user.photoURL || null,
            })
        );
        localStorage.setItem('userData', JSON.stringify({ email: user.email }));
        hideModal(document.getElementById('loginModal'));
        hideModal(document.getElementById('registerModal'));
        showNotification('Signed in with Google!', 'success');
    } catch (error) {
        if (error.code !== 'auth/popup-closed-by-user') {
            showNotification(getAuthErrorMessage(error), 'error');
        }
    }
}

function handleLogout() {
    localStorage.removeItem('userData');
    signOut(auth).then(() => showNotification('Logged out', 'info'));
}

function checkAuthState() {
    const userData = localStorage.getItem('userData');
    if (userData) updateAuthUI(JSON.parse(userData));
}

// --- 5. Utility Functions ---
function showModal(modal) {
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function hideModal(modal) {
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = 'auto';
}

function setButtonLoading(button, loading) {
    if (loading) {
        button.dataset.originalText = button.textContent;
        button.textContent = 'Processing...';
        button.disabled = true;
    } else {
        button.textContent = button.dataset.originalText || button.textContent;
        button.disabled = false;
    }
}

function getAuthErrorMessage(error) {
    const code = error.code || '';
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
        return 'Incorrect email or password.';
    }
    if (code.includes('invalid-email')) return 'Please enter a valid email address.';
    if (code.includes('too-many-requests')) return 'Too many attempts. Please try again later.';
    if (code.includes('email-already-in-use')) return 'An account with this email already exists.';
    if (code.includes('weak-password')) return 'Password must be at least 6 characters.';
    if (code.includes('network-request-failed')) return 'Network error. Please check your connection.';
    return error.message || 'An error occurred. Please try again.';
}

function showFormError(form, message) {
    let err = form.querySelector('.form-error') || document.createElement('div');
    err.className = 'form-error text-red-500 text-xs mt-2';
    err.textContent = message;
    if (!form.querySelector('.form-error')) form.appendChild(err);
}

function showNotification(message, type) {
    const toast = document.createElement('div');
    toast.className = `fixed top-5 right-5 p-4 rounded shadow-lg text-white z-[100] ${type === 'success' ? 'bg-green-600' : 'bg-blue-600'}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Module scripts run after HTML is parsed, so the DOM is ready — no need to wait for DOMContentLoaded
initAuth();