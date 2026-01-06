// --- Firebase Auth State UI Sync for Home Page ---
import { auth } from "./firebase.js";
// Authentication functionality

function updateAuthUI(user) {
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const profileBtn = document.getElementById('profileBtn');
  if (!loginBtn || !registerBtn || !profileBtn) return;
  if (user) {
    profileBtn.style.display = '';
    loginBtn.style.display = 'none';
    registerBtn.style.display = 'none';
  } else {
    profileBtn.style.display = 'none';
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
    const profileBtn = document.getElementById('profileBtn');

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

    if (profileBtn) {
        profileBtn.addEventListener('click', function() {
            window.location.href = 'profile/index.html';
        });
    }
}

// Form submissions
function initAuthForms() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
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
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Validation
    if (!username || !email || !password || !confirmPassword) {
        showFormError(form, 'Please fill in all fields');
        return;
    }
    if (password !== confirmPassword) {
        showFormError(form, 'Passwords do not match');
        return;
    }
    if (password.length < 6) {
        showFormError(form, 'Password must be at least 6 characters');
        return;
    }

    setButtonLoading(submitBtn, true);

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        updateAuthUI({ username, email: user.email });
        hideModal(document.getElementById('registerModal'));
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


// Handle logout
function handleLogout() {
    localStorage.removeItem('userData');
    
    // Reset auth UI
    const authButtons = document.querySelector('.auth-buttons');
    if (authButtons) {
        authButtons.innerHTML = `
            <button class="btn btn-login" id="loginBtn">Login</button>
            <button class="btn btn-register" id="registerBtn">Register</button>
        `;
        
        // Re-initialize auth buttons
        initAuthButtons();
    }
    
    showNotification('Logged out successfully', 'info');
}

// Utility functions
function showModal(modal) {
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

function hideModal(modal) {
    if (modal) {
        modal.classList.remove('show');
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