// js/login-register.js

// Importaciones de Firebase Auth
import {
    getAuth,
    GoogleAuthProvider, // Mantener si quieres Google Sign-In con Web SDK
    signInWithPopup,    // Mantener si quieres Google Sign-In con Web SDK
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Importaciones de Firebase Realtime Database
import {
    ref,
    set,
    get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Importaciones de tus módulos auxiliares
import { showNotification, showLoadingModal, hideLoadingModal } from './ui-feedback.js';
import { authInstance, dbInstance } from './app.js'; // Importa authInstance y dbInstance


// Referencias para los campos de correo y contraseña y los botones
let emailLoginInput, passwordLoginInput;
let loginButton;
let emailRegisterInput, passwordRegisterInput, confirmPasswordRegisterInput;
let registerButton;

let googleSignInBtn;
let googleSignInBtnRegister;
let goToRegisterBtn;
let goToLoginBtn;
let loginForm;
let registerForm;
let authMessage;
let registerMessage;

let termsAndConditionsLink;
let termsAndConditionsLink2;
let privacyPolicyLink;

const TERMS_URL = 'https://sites.google.com/view/condiciones-win-con-miner/inicio';
const PRIVACY_POLICY_URL = 'https://sites.google.com/view/win-coin-miner/inicio';

// *** Función para inicializar listeners ***
function setupLoginRegisterListeners() {
    console.log("Configurando listeners de Login/Register...");

    googleSignInBtn = document.getElementById('googleSignInBtn');
    googleSignInBtnRegister = document.getElementById('googleSignInBtnRegister');
    goToRegisterBtn = document.getElementById('goToRegisterBtn');
    goToLoginBtn = document.getElementById('goToLoginBtn');
    loginForm = document.getElementById('loginForm');
    registerForm = document.getElementById('registerForm');
    authMessage = document.getElementById('authMessage');
    registerMessage = document.getElementById('registerMessage');

    emailLoginInput = document.getElementById('emailLogin');
    passwordLoginInput = document.getElementById('passwordLogin');
    loginButton = document.getElementById('loginButton');

    emailRegisterInput = document.getElementById('emailRegister');
    passwordRegisterInput = document.getElementById('passwordRegister');
    confirmPasswordRegisterInput = document.getElementById('confirmPasswordRegister');
    registerButton = document.getElementById('registerButton');

    termsAndConditionsLink = document.getElementById('termsAndConditionsLink');
    privacyPolicyLink = document.getElementById('privacyPolicyLink');


    if (googleSignInBtn) {
        googleSignInBtn.removeEventListener('click', handleGoogleSignInWeb);
        googleSignInBtn.addEventListener('click', handleGoogleSignInWeb);
    }
    if (googleSignInBtnRegister) {
        googleSignInBtnRegister.removeEventListener('click', handleGoogleSignInWeb);
        googleSignInBtnRegister.addEventListener('click', handleGoogleSignInWeb);
    }
    if (goToRegisterBtn) {
        goToRegisterBtn.removeEventListener('click', showRegisterForm);
        goToRegisterBtn.addEventListener('click', showRegisterForm);
    }
    if (goToLoginBtn) {
        goToLoginBtn.removeEventListener('click', showLoginForm);
        goToLoginBtn.addEventListener('click', showLoginForm);
    }

    if (loginButton) {
        loginButton.removeEventListener('click', handleEmailLogin);
        loginButton.addEventListener('click', handleEmailLogin);
    }
    if (registerButton) {
        registerButton.removeEventListener('click', handleEmailRegister);
        registerButton.addEventListener('click', handleEmailRegister);
    }

    if (termsAndConditionsLink) {
        termsAndConditionsLink.addEventListener('click', function(event) {
            event.preventDefault(); // Evita que el navegador siga el href="#"
            console.log("[JS] Enlace de Términos y Condiciones clickeado.");
            if (window.AndroidBridge && window.AndroidBridge.openUrlInBrowser) {
                window.AndroidBridge.openUrlInBrowser(TERMS_URL);
            } else {
                console.warn("[JS] AndroidBridge.openUrlInBrowser no disponible, abriendo en ventana JS.");
                window.open(TERMS_URL, '_blank');
            }
        });
    }

    if (privacyPolicyLink) {
        privacyPolicyLink.addEventListener('click', function(event) {
            event.preventDefault(); // Evita que el navegador siga el href="#"
            console.log("[JS] Enlace de Política de Privacidad clickeado.");
            if (window.AndroidBridge && window.AndroidBridge.openUrlInBrowser) {
                window.AndroidBridge.openUrlInBrowser(PRIVACY_POLICY_URL);
            } else {
                console.warn("[JS] AndroidBridge.openUrlInBrowser no disponible, abriendo en ventana JS.");
                window.open(PRIVACY_POLICY_URL, '_blank');
            }
        });
    }


    // Llama a la función para mostrar el formulario de login por defecto al inicio
    showLoginForm();
}

/**
 * Inicializa la pantalla de login/registro.
 */
export function initializeLoginRegisterScreen() {
    console.log("Inicializando Login/Register Screen...");
    setupLoginRegisterListeners();
}


// --- FUNCIONES PARA CAMBIAR ENTRE FORMULARIOS Y MOSTRAR MENSAJES ---

/**
 * Muestra el formulario de inicio de sesión y oculta el de registro.
 */
function showLoginForm() {
    if (loginForm && registerForm) {
        loginForm.classList.remove('hidden', 'opacity-0', 'scale-95');
        loginForm.classList.add('opacity-100', 'scale-100');

        registerForm.classList.add('hidden', 'opacity-0', 'scale-95');
        registerForm.classList.remove('opacity-100', 'scale-100');
    }
    hideAuthMessages();
}

/**
 * Muestra el formulario de registro y oculta el de inicio de sesión.
 */
function showRegisterForm() {
    if (loginForm && registerForm) {
        registerForm.classList.remove('hidden', 'opacity-0', 'scale-95');
        registerForm.classList.add('opacity-100', 'scale-100');

        loginForm.classList.add('hidden', 'opacity-0', 'scale-95');
        loginForm.classList.remove('opacity-100', 'scale-100');
    }
    hideAuthMessages();
}

/**
 * Muestra un mensaje de autenticación.
 * @param {string} message El mensaje a mostrar.
 * @param {string} type Tipo de mensaje ('success', 'error', 'info').
 * @param {string} targetId ID del elemento P donde mostrar el mensaje (authMessage o registerMessage).
 */
function showAuthMessage(message, type, targetId = 'authMessage') {
    let messageElement;
    if (targetId === 'authMessage') {
        messageElement = authMessage;
    } else if (targetId === 'registerMessage') {
        messageElement = registerMessage;
    } else {
        console.warn("ID de elemento de mensaje no reconocido:", targetId);
        return;
    }

    if (messageElement) {
        messageElement.textContent = message;
        messageElement.classList.remove('hidden', 'text-green-500', 'text-red-500', 'text-blue-500', 'text-ltc-error', 'text-ltc-success', 'text-ltc-info');

        // Adapta esto a tus clases de Tailwind o CSS existentes
        if (type === 'success') {
            messageElement.classList.add('text-ltc-success'); // O 'text-green-500'
        } else if (type === 'error') {
            messageElement.classList.add('text-ltc-error');   // O 'text-red-500'
        } else if (type === 'info') {
            messageElement.classList.add('text-ltc-info');     // O 'text-blue-500'
        }
        messageElement.classList.remove('hidden');
    }
}


/**
 * Oculta todos los mensajes de autenticación.
 */
function hideAuthMessages() {
    if (authMessage) authMessage.classList.add('hidden');
    if (registerMessage) registerMessage.classList.add('hidden');
}


// --- FUNCIONES DE MANEJO DE AUTENTICACIÓN ---

/**
 * Maneja el inicio de sesión con Google (SOLO WEB SDK).
 */
async function handleGoogleSignInWeb() {
    showLoadingModal("Autenticando con Google...");
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(authInstance, provider);
        const user = result.user;
        console.log("Usuario autenticado con Google (Web SDK):", user.uid);
        await handleNewUserGoogle(user);
        showNotification("¡Inicio de sesión con Google exitoso!", "success");
    } catch (error) {
        console.error("Error al autenticar con Google (Web SDK):", error);
        let errorMessage = "Error al autenticar con Google.";
        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = "Autenticación de Google cancelada.";
        } else if (error.code === 'auth/cancelled-popup-request') {
            errorMessage = "Ya hay una ventana emergente de Google en curso.";
        } else if (error.code === 'auth/operation-not-allowed') {
            errorMessage = "La autenticación con Google no está habilitada. Contacta al soporte.";
        } else {
            errorMessage = `Error de Google Sign-In: ${error.message}`;
        }
        showAuthMessage(errorMessage, "error");
    } finally {
        hideLoadingModal();
    }
}

/**
 * Maneja el inicio de sesión con Correo y Contraseña.
 */
async function handleEmailLogin(event) {
    if (event) event.preventDefault();
    showLoadingModal("Iniciando sesión...");

    const email = emailLoginInput.value;
    const password = passwordLoginInput.value;

    if (!email || !password) {
        showAuthMessage("Por favor, ingresa correo y contraseña.", "error");
        hideLoadingModal();
        return;
    }

    try {
        const userCredential = await signInWithEmailAndPassword(authInstance, email, password);
        const user = userCredential.user;
        console.log("Usuario autenticado con Correo/Contraseña:", user.uid);
        showNotification("¡Inicio de sesión exitoso!", "success");
    } catch (error) {
        console.error("Error al iniciar sesión con correo/contraseña:", error);
        let errorMessage = "Error al iniciar sesión.";
        switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                errorMessage = "Correo o contraseña incorrectos.";
                break;
            case 'auth/invalid-email':
                errorMessage = "Formato de correo inválido.";
                break;
            case 'auth/too-many-requests':
                errorMessage = "Demasiados intentos fallidos. Intenta más tarde.";
                break;
            default:
                errorMessage = `Error: ${error.message}`;
        }
        showAuthMessage(errorMessage, "error");
    } finally {
        hideLoadingModal();
    }
}

/**
 * Maneja el registro de usuario con Correo y Contraseña.
 */
async function handleEmailRegister(event) {
    if (event) event.preventDefault();
    showLoadingModal("Registrando usuario...");

    const email = emailRegisterInput.value;
    const password = passwordRegisterInput.value;
    const confirmPassword = confirmPasswordRegisterInput.value;

    if (!email || !password || !confirmPassword) {
        showAuthMessage("Por favor, completa todos los campos.", "error", 'registerMessage');
        hideLoadingModal();
        return;
    }

    if (password.length < 6) {
        showAuthMessage("La contraseña debe tener al menos 6 caracteres.", "error", 'registerMessage');
        hideLoadingModal();
        return;
    }

    if (password !== confirmPassword) {
        showAuthMessage("Las contraseñas no coinciden.", "error", 'registerMessage');
        hideLoadingModal();
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(authInstance, email, password);
        const user = userCredential.user;
        console.log("Usuario registrado con Correo/Contraseña:", user.uid);

        const userRef = ref(dbInstance, `users/${user.uid}`);
        const referralCode = generateRandomString(6).toUpperCase();

        await set(userRef, {
            email: user.email,
            displayName: user.email.split('@')[0],
            photoURL: null,
            createdAt: Date.now(),
            balance: 0,
            referralCode: referralCode,
            referredBy: null,
            hasAppliedReferral: false,
            // Agrega cualquier otro campo inicial que necesites para un nuevo usuario
            faucetPayEmail: '',
            lastDailyRewardClaim: 0,
            lastFaucetClaim: 0,
            totalReferrals: 0,
            referralEarnings: 0
        });

        showNotification("¡Registro exitoso! Bienvenido a Win Coin.", "success");
    } catch (error) {
        console.error("Error al registrar con correo/contraseña:", error);
        let errorMessage = "Error al registrar usuario.";
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = "Este correo ya está registrado.";
                break;
            case 'auth/invalid-email':
                errorMessage = "Formato de correo inválido.";
                break;
            case 'auth/weak-password':
                errorMessage = "La contraseña es demasiado débil.";
                break;
            default:
                errorMessage = `Error: ${error.message}`;
        }
        showAuthMessage(errorMessage, "error", 'registerMessage');
    } finally {
        hideLoadingModal();
    }
}

/**
 * Maneja la creación de la entrada del usuario en la base de datos
 * después de un inicio de sesión exitoso con Google.
 * Es crucial para que onAuthStateChanged no intente crear el usuario nuevamente.
 */
async function handleNewUserGoogle(user) {
    if (!user) {
        console.error("handleNewUserGoogle: Usuario nulo.");
        return;
    }
    const userRef = ref(dbInstance, `users/${user.uid}`);
    try {
        const snapshot = await get(userRef);
        if (!snapshot.exists()) {
            // El usuario no existe en la base de datos, lo creamos
            const referralCode = user.uid.substring(0, 8).toUpperCase(); // Genera un código simple
            await set(userRef, {
                balance: 0,
                email: user.email,
                displayName: user.displayName || user.email,
                photoURL: user.photoURL || null,
                createdAt: Date.now(),
                lastLogin: Date.now(),
                referralCode: referralCode,
                faucetPayEmail: '', // Inicializa campos necesarios
                lastDailyRewardClaim: 0,
                lastFaucetClaim: 0,
                totalReferrals: 0,
                referralEarnings: 0
            });
            console.log("Nuevo usuario de Google creado en DB:", user.uid);
            showNotification("Bienvenido! Hemos creado tu cuenta.", "info");
        } else {
            console.log("Usuario existente, iniciando sesión...");
            // Opcional: Actualizar lastLogin o otros datos aquí
            await set(ref(dbInstance, `users/${user.uid}/lastLogin`), Date.now());
        }
    } catch (error) {
        console.error("Error al manejar nuevo/existente usuario Google en DB:", error);
        showNotification(`Error al procesar datos del usuario: ${error.message}`, "error");
    }
}

/**
 * Genera una cadena aleatoria de longitud especificada.
 * @param {number} length Longitud de la cadena a generar.
 * @returns {string} Cadena aleatoria.
 */
function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

// Asegúrate de que las importaciones estén en la parte superior del archivo.

