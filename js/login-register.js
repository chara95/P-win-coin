// js/login-register.js

// Importaciones de Firebase Auth
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Importaciones de Firebase Realtime Database
import {
    ref,
    set,
    get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Importaciones de tus módulos auxiliares
import { showNotification, showLoadingModal, hideLoadingModal } from './ui-feedback.js';
import { authInstance, dbInstance } from './app.js'; // Tus instancias globales

// Referencias a elementos del DOM
let googleSignInBtn; // Botón de Google en la sección de Login
let googleSignInBtnRegister; // Botón de Google en la sección de Registro
let goToRegisterBtn; // Enlace para ir a Registro
let goToLoginBtn;    // Enlace para ir a Login
let loginForm;       // Contenedor del formulario de Login
let registerForm;    // Contenedor del formulario de Registro
let authMessage;     // Mensaje general de autenticación
let registerMessage; // Mensaje específico de registro (aunque con Google, puede no usarse mucho)

/**
 * Inicializa la pantalla de login/registro y sus event listeners.
 */
export function initializeLoginRegisterScreen() {
    console.log("Inicializando Login/Register Screen (con Google Sign-In)...");

    // Asocia los elementos del DOM con sus IDs (¡CONFIRMA QUE ESTOS IDS SON CORRECTOS EN TU HTML!)
    googleSignInBtn = document.getElementById('googleSignInBtn');
    googleSignInBtnRegister = document.getElementById('googleSignInBtnRegister');
    goToRegisterBtn = document.getElementById('goToRegisterBtn');
    goToLoginBtn = document.getElementById('goToLoginBtn');
    loginForm = document.getElementById('loginForm');
    registerForm = document.getElementById('registerForm');
    authMessage = document.getElementById('authMessage');
    registerMessage = document.getElementById('registerMessage');

    // Consola para depuración: verifica si los elementos se encontraron
    console.log("Elementos DOM Auth (Google):", {
        googleSignInBtn,
        googleSignInBtnRegister,
        goToRegisterBtn,
        goToLoginBtn,
        loginForm,
        registerForm,
        authMessage,
        registerMessage
    });

    // Añade event listeners (elimina previos para evitar duplicados)
    if (googleSignInBtn) {
        googleSignInBtn.removeEventListener('click', handleGoogleSignIn);
        googleSignInBtn.addEventListener('click', handleGoogleSignIn);
    }
    if (googleSignInBtnRegister) {
        googleSignInBtnRegister.removeEventListener('click', handleGoogleSignIn);
        googleSignInBtnRegister.addEventListener('click', handleGoogleSignIn);
    }
    if (goToRegisterBtn) {
        goToRegisterBtn.removeEventListener('click', showRegisterForm);
        goToRegisterBtn.addEventListener('click', showRegisterForm);
    }
    if (goToLoginBtn) {
        goToLoginBtn.removeEventListener('click', showLoginForm);
        goToLoginBtn.addEventListener('click', showLoginForm);
    }

    // Asegura que uno de los formularios esté visible al inicializar
    showLoginForm(); // Por defecto, muestra el formulario de login al iniciar
}

/**
 * Muestra el formulario de login y oculta el de registro.
 */
function showLoginForm(event) {
    if (event) event.preventDefault(); // Prevenir navegación si es un enlace
    if (loginForm && registerForm) {
        loginForm.classList.remove('hidden', 'opacity-0', 'scale-95'); // Mostrar y animar
        loginForm.classList.add('opacity-100', 'scale-100');
        registerForm.classList.add('hidden', 'opacity-0', 'scale-95'); // Ocultar y animar
        registerForm.classList.remove('opacity-100', 'scale-100');
        console.log("Mostrando formulario de Login.");
        hideAuthMessages();
    }
}

/**
 * Muestra el formulario de registro y oculta el de login.
 */
function showRegisterForm(event) {
    if (event) event.preventDefault(); // Prevenir navegación si es un enlace
    if (loginForm && registerForm) {
        registerForm.classList.remove('hidden', 'opacity-0', 'scale-95'); // Mostrar y animar
        registerForm.classList.add('opacity-100', 'scale-100');
        loginForm.classList.add('hidden', 'opacity-0', 'scale-95'); // Ocultar y animar
        loginForm.classList.remove('opacity-100', 'scale-100');
        console.log("Mostrando formulario de Registro.");
        hideAuthMessages();
    }
}

/**
 * Muestra un mensaje en la pantalla de autenticación.
 * @param {string} message El mensaje a mostrar.
 * @param {string} type El tipo de mensaje ('error', 'info', 'success', 'warning').
 * @param {string} targetMessageId El ID del elemento P donde mostrar el mensaje ('authMessage' o 'registerMessage').
 */
function showAuthMessage(message, type, targetMessageId = 'authMessage') {
    const targetElement = document.getElementById(targetMessageId);
    if (targetElement) {
        targetElement.textContent = message;
        targetElement.classList.remove('hidden', 'text-ltc-error', 'text-ltc-info', 'text-ltc-success', 'text-ltc-warning');
        if (type === 'error') {
            targetElement.classList.add('text-ltc-error');
        } else if (type === 'info') {
            targetElement.classList.add('text-ltc-info');
        } else if (type === 'success') {
            targetElement.classList.add('text-ltc-green-neon'); // Usando tu color neon para éxito
        } else if (type === 'warning') {
            targetElement.classList.add('text-ltc-warning');
        }
        targetElement.classList.remove('hidden');
    }
}

/**
 * Oculta todos los mensajes de autenticación.
 */
function hideAuthMessages() {
    if (authMessage) authMessage.classList.add('hidden');
    if (registerMessage) registerMessage.classList.add('hidden');
}


/**
 * Maneja el inicio de sesión/registro con Google.
 */
async function handleGoogleSignIn() {
    showLoadingModal("Autenticando con Google...");

    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(authInstance, provider);
        const user = result.user;
        console.log("Usuario autenticado con Google:", user.uid);

        // Verificar si es un usuario nuevo y guardar sus datos iniciales en la DB
        const userRef = ref(dbInstance, `users/${user.uid}`);
        const snapshot = await get(userRef);

        if (!snapshot.exists()) {
            console.log("Nuevo usuario Google, guardando datos iniciales...");
            // Generar un código de referido único (ejemplo: 6 caracteres aleatorios)
            const referralCode = generateRandomString(6).toUpperCase();

            await set(userRef, {
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                photoURL: user.photoURL,
                createdAt: Date.now(),
                balance: 0, // Saldo inicial
                referralCode: referralCode, // Código de referido único
                referredBy: null, // Inicialmente no referido por nadie
                hasAppliedReferral: false, // Bandera para saber si ya aplicó un código
            });
            showNotification("¡Registro exitoso con Google! Bienvenido a Win Coin.", "success");
        } else {
            console.log("Usuario existente, iniciando sesión...");
            showNotification("¡Bienvenido de nuevo!", "success");
        }

        // No es necesario llamar a showScreen('homeScreen') aquí directamente.
        // El onAuthStateChanged en app.js detectará el cambio de estado y lo hará.

    } catch (error) {
        console.error("Error al autenticar con Google:", error);
        let errorMessage = "Error al autenticar con Google.";
        switch (error.code) {
            case 'auth/popup-closed-by-user':
                errorMessage = "La ventana de Google fue cerrada. Intenta de nuevo.";
                break;
            case 'auth/cancelled-popup-request':
                errorMessage = "Solicitud de ventana emergente cancelada.";
                break;
            case 'auth/account-exists-with-different-credential':
                errorMessage = "Ya existe una cuenta con el mismo email pero diferentes credenciales (ej. email/contraseña).";
                break;
            default:
                errorMessage = `Error: ${error.message}`;
        }
        showAuthMessage(errorMessage, "error");
    } finally {
        hideLoadingModal();
    }
}

// Función auxiliar para generar códigos de referido (simple, para ejemplo)
function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}