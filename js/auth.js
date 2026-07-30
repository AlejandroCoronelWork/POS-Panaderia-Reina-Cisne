import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// Enforce Session Persistence
setPersistence(auth, browserSessionPersistence).catch((error) => {
    console.error("Error setting persistence:", error);
});
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// DOM Elements
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const navLogout = document.getElementById('nav-logout');
const btnForgotPassword = document.getElementById('btn-forgot-password');

/**
 * Logs a security event to the 'security_logs' collection in Firestore.
 * This satisfies the requirement for an unalterable audit log entry.
 */
async function logSecurityEvent(email, action) {
    try {
        await addDoc(collection(db, 'security_logs'), {
            email: email,
            action: action,
            timestamp: serverTimestamp()
        });
        console.log("Audit log saved successfully.");
    } catch (error) {
        console.error("Error writing audit log: ", error);
    }
}

// Handle Login Form Submission
if (loginForm) {
    const errorMsg = document.getElementById('login-error-msg');

    // Helper to hide error on input
    const hideError = () => {
        if (errorMsg && !errorMsg.classList.contains('d-none')) {
            errorMsg.classList.add('d-none');
        }
    };
    
    // Crucial UI fix: hide error when user starts typing again
    emailInput.addEventListener('input', hideError);
    passwordInput.addEventListener('input', hideError);

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        // Hide previous error on new submit attempt
        hideError();

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Ingresando...';

            // Attempt to sign in
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Log the success event to Firestore
            await logSecurityEvent(user.email, 'LOGIN_SUCCESS');
            
            // Clear form
            loginForm.reset();
            
            // Note: View toggling is handled in app.js via onAuthStateChanged
        } catch (error) {
            console.error("Login failed:", error.message);
            if (errorMsg) {
                let friendlyMessage = "Error al iniciar sesión. Inténtalo de nuevo.";
                if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    friendlyMessage = "Correo o contraseña incorrectos. Verifica tus credenciales.";
                } else if (error.code === 'auth/invalid-email') {
                    friendlyMessage = "El formato del correo es inválido.";
                } else if (error.code === 'auth/too-many-requests') {
                    friendlyMessage = "Demasiados intentos fallidos. Intenta más tarde.";
                }
                
                errorMsg.textContent = friendlyMessage;
                errorMsg.classList.remove('alert-success');
                errorMsg.classList.add('alert-danger');
                errorMsg.classList.remove('d-none');
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Ingresar';
        }
    });
}

// Handle Forgot Password
if (btnForgotPassword) {
    btnForgotPassword.addEventListener('click', async (e) => {
        e.preventDefault();
        const errorMsg = document.getElementById('login-error-msg');
        
        const email = emailInput.value.trim();
        if (!email) {
            if (errorMsg) {
                errorMsg.textContent = "Por favor, ingresa tu correo electrónico primero para restablecer la contraseña.";
                errorMsg.classList.remove('alert-success');
                errorMsg.classList.add('alert-danger');
                errorMsg.classList.remove('d-none');
            }
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            if (errorMsg) {
                errorMsg.textContent = "Correo de recuperación enviado. Revisa tu bandeja de entrada.";
                errorMsg.classList.remove('alert-danger');
                errorMsg.classList.add('alert-success');
                errorMsg.classList.remove('d-none');
            }
        } catch (error) {
            console.error("Password reset failed:", error);
            if (errorMsg) {
                let friendlyMessage = "Error al enviar el correo. Inténtalo de nuevo.";
                if (error.code === 'auth/invalid-email') {
                    friendlyMessage = "El formato del correo es inválido.";
                } else if (error.code === 'auth/user-not-found') {
                    friendlyMessage = "No existe un usuario con este correo.";
                }
                errorMsg.textContent = friendlyMessage;
                errorMsg.classList.remove('alert-success');
                errorMsg.classList.add('alert-danger');
                errorMsg.classList.remove('d-none');
            }
        }
    });
}

// Handle Logout
if (navLogout) {
    navLogout.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await signOut(auth);
            console.log("Logged out successfully.");
        } catch (error) {
            console.error("Logout failed:", error.message);
        }
    });
}
