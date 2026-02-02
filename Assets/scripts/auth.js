// --- Firebase Auth State UI Sync for Home Page ---
import { auth, db } from "./firebase.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { 
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
// Authentication functionality

export function requireLogin(callback) {
    if (auth.currentUser) {
        callback(auth.currentUser);
    } else {
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            showModal(loginModal);
        }
    }
}

function updateAuthUI(user) {
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const profileBtn = document.getElementById('profileBtn');
  const importBtn = document.getElementById('importBtn');
  const mobileImportNav = document.getElementById('mobile-import-nav');
  const logoutBtn = document.getElementById('logoutBtn');

  if (!loginBtn || !registerBtn || !profileBtn) return;
  if (user) {
    profileBtn.style.display = '';
    if (importBtn) importBtn.style.display = 'inline-block';
    if (mobileImportNav) mobileImportNav.style.display = 'block';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    loginBtn.style.display = 'none';
    registerBtn.style.display = 'none';
  } else {
    profileBtn.style.display = 'none';
    if (importBtn) importBtn.style.display = 'none';
    if (mobileImportNav) mobileImportNav.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    loginBtn.style.display = '';
    registerBtn.style.display = '';
  }
}

function initAuth() {
    // Initialize modal functionality
    initModals();
    
    // Initialize form submissions
    initAuthForms();
    
    // Initialize auth button listeners
    initAuthButtons();
    
    // Set up auth state listener
    onAuthStateChanged(auth, updateAuthUI);

    // Check if user is already logged in
    checkAuthState();
}

// Modal functionality
function initModals() {
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const closeBtns = document.querySelectorAll('.close');
    
    // Close modal when clicking the X button
    closeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const modalId = this.dataset.modal;
            const modal = document.getElementById(modalId);
            if (modal) {
                hideModal(modal);
            }
        });
    });
    
    // Close modal when clicking outside of it
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            hideModal(e.target);
        }
    });
    
    // Switch between login and register modals
    const switchToRegister = document.getElementById('switchToRegister');
    const switchToLogin = document.getElementById('switchToLogin');
    
    if (switchToRegister) {
        switchToRegister.addEventListener('click', function(e) {
            e.preventDefault();
            hideModal(loginModal);
            showModal(registerModal);
        });
    }
    
    if (switchToLogin) {
        switchToLogin.addEventListener('click', function(e) {
            e.preventDefault();
            hideModal(registerModal);
            showModal(loginModal);
        });
    }
}

// Auth button listeners
function initAuthButtons() {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const importBtn = document.getElementById('importBtn');
    const profileBtn = document.getElementById('profileBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (loginBtn) {
        loginBtn.addEventListener('click', function() {
            showModal(document.getElementById('loginModal'));
        });
    }

    if (registerBtn) {
        registerBtn.addEventListener('click', function() {
            showModal(document.getElementById('registerModal'));
        });
    }

    if (importBtn) {
        importBtn.addEventListener('click', function() {
            showModal(document.getElementById('importModal'));
        });
    }

    if (profileBtn) {
        profileBtn.addEventListener('click', function() {
            window.location.href = 'Assets/profile/userprofile.html';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

// Form submissions
function initAuthForms() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const importForm = document.getElementById('importForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    if (importForm) {
        importForm.addEventListener('submit', handleImport);
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    // Basic validation
    if (!email || !password) {
        showFormError(form, 'Please fill in all fields');
        return;
    }

    setButtonLoading(submitBtn, true);

    try {
        // Use Firebase Auth for login
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const userData = {
            email: user.email,
            username: user.email.split('@')[0],
            loginTime: new Date().toISOString()
        };
        localStorage.setItem('userData', JSON.stringify(userData));
        updateAuthUI(userData);
        hideModal(document.getElementById('loginModal'));
        showNotification('Login successful!', 'success');
    } catch (error) {
        showFormError(form, error.message || 'Login failed. Please try again.');
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

// Handle registration
async function handleRegister(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const username = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const genres = document.getElementById('regGenres').value;
    const avatarUrl = document.getElementById('regAvatarUrl').value;
    const bio = document.getElementById('regBio').value;

    // Basic validation
    if (!username || !email || !password) {
        showFormError(form, 'Please fill in all required fields');
        return;
    }
    
    setButtonLoading(submitBtn, true);

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Create user profile in Realtime Database
        await set(ref(db, 'reviewers/' + user.uid), {
            name: username,
            email: email,
            avatar: avatarUrl || "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png",
            bio: bio || "New member",
            genres: genres || "General",
            createdAt: new Date().toISOString()
        });

        updateAuthUI({ username, email: user.email });
        hideModal(document.getElementById('registrationModal'));
        showNotification('Registration successful!', 'success');
    } catch (error) {
        showFormError(form, error.message);
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

// Check authentication state
function checkAuthState() {
    const userData = localStorage.getItem('userData');
    if (userData) {
        try {
            const user = JSON.parse(userData);
            updateAuthUI(user);
        } catch (error) {
            localStorage.removeItem('userData');
        }
    }
}

// Handle CSV Import
async function handleImport(e) {
    e.preventDefault();
    const fileInput = document.getElementById('importFile');
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(event) {
        try {
            const text = event.target.result;
            const reviews = parseCSV(text);
            console.log('Imported reviews:', reviews);
            
            // TODO: Add logic here to save 'reviews' to your Firebase database
            
            hideModal(document.getElementById('importModal'));
            showNotification(`Successfully imported ${reviews.length} items!`, 'success');
            fileInput.value = ''; // Reset input
        } catch (err) {
            console.error(err);
            showNotification('Failed to parse CSV file.', 'error');
        }
    };
    reader.readAsText(file);
}

function parseCSV(text) {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).filter(l => l.trim()).map(line => {
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        return headers.reduce((obj, header, i) => {
            obj[header] = values[i] ? values[i].trim().replace(/^"|"$/g, '') : '';
            return obj;
        }, {});
    });
}

// Handle logout
function handleLogout() {
    localStorage.removeItem('userData');
    signOut(auth).then(() => {
        // Reset auth UI
        updateAuthUI(null);
        showNotification('Logged out successfully', 'info');
    }).catch((error) => {
        console.error('Sign out error', error);
    });
}

document.addEventListener('DOMContentLoaded', initAuth);

// Utility functions
function showModal(modal) {
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
    }
}

function hideModal(modal) {
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = 'auto';
        
        // Clear form errors
        const errorMessages = modal.querySelectorAll('.form-error');
        errorMessages.forEach(error => error.style.display = 'none');
    }
}

function setButtonLoading(button, loading) {
    if (loading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

function showFormError(form, message) {
    let errorElement = form.querySelector('.form-error');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'form-error';
        form.appendChild(errorElement);
    }
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Simulate API call for demo
function simulateApiCall() {
    return new Promise((resolve) => {
        setTimeout(resolve, 1000);
    });
}