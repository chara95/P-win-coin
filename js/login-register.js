// js/login-register.js

// Importaciones de Firebase Auth (mantener para el caso de navegador web)
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

// *** NUEVA FUNCIÓN PARA INICIALIZAR DESPUÉS DE QUE EL DOM Y LOS BRIDGES ESTÉN LISTOS ***
function setupLoginRegisterListeners() {
    console.log("Configurando listeners de Login/Register...");

    // Asocia los elementos del DOM con sus IDs
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

    // *** INICIALIZAR CALLBACKS DE ANDROID BRIDGE (Asegurarse de que window.AndroidBridge exista) ***
    window.AndroidBridge = window.AndroidBridge || {}; // Asegura que el objeto exista

    window.AndroidBridge.onGoogleSignInSuccess = async function(uid) {
        console.log('AndroidBridge Callback: Google Sign-In exitoso. UID:', uid);
        hideLoadingModal();
        showNotification("¡Inicio de sesión exitoso con Google!", "success");

        // IMPORTANTE: Después de un inicio de sesión nativo exitoso,
        // el usuario ya está autenticado en Firebase. Ahora, debemos
        // asegurarnos de que la lógica de registro/login de tu base de datos
        // (verificación de nuevo usuario, etc.) se ejecute.
        try {
            // El usuario ya debería estar autenticado en authInstance (getAuth())
            const currentUser = authInstance.currentUser; // O getAuth().currentUser
            if (currentUser && currentUser.uid === uid) {
                await handleNewUserGoogle(currentUser); // Reutiliza tu lógica existente
            } else {
                console.error("UID del usuario de Android Bridge no coincide con el usuario de Firebase Web SDK.");
                showAuthMessage("Error de sincronización de usuario. Por favor, intenta de nuevo.", "error");
            }
        } catch (error) {
            console.error("Error al procesar el usuario después de Google Sign-In nativo:", error);
            showAuthMessage("Error interno al finalizar el inicio de sesión.", "error");
        }
    };

    window.AndroidBridge.onGoogleSignInFailure = function(errorMessage) {
        console.error('AndroidBridge Callback: Google Sign-In fallido. Mensaje:', errorMessage);
        hideLoadingModal();
        showAuthMessage('Error al iniciar sesión con Google: ' + errorMessage, "error");
    };

    // DEBUGGING DEL PUENTE:
    console.log('--- Depuración AndroidBridge (después de setup) ---');
    console.log('typeof AndroidBridge:', typeof window.AndroidBridge); // Usa window.AndroidBridge explícitamente
    if (typeof window.AndroidBridge !== 'undefined') {
        console.log('AndroidBridge existe. Métodos:', Object.keys(window.AndroidBridge));
        if (window.AndroidBridge.startGoogleSignIn) {
            console.log('AndroidBridge.startGoogleSignIn existe y es una función.');
        } else {
            console.log('AndroidBridge.startGoogleSignIn NO existe o no es una función.');
        }
    }
    console.log('----------------------------------------------------');
}


/**
 * Inicializa la pantalla de login/registro y sus event listeners.
 * Esta función ahora solo exporta `setupLoginRegisterListeners`.
 */
export function initializeLoginRegisterScreen() {
    console.log("Inicializando Login/Register Screen (exportada)...");
    // Llama a la función de configuración después de un pequeño retraso
    // para dar tiempo al WebView para inyectar el JavascriptInterface.
    // Una alternativa es usar un MutationObserver o un listener específico si es posible.
    // Sin embargo, para los interfaces de Javascript, un setTimeout suele ser efectivo.
    // También puedes intentar llamar a setupLoginRegisterListeners() directamente
    // si el problema no es de timing sino de dónde se define.
    // Por ahora, vamos con el setTimeout para la máxima compatibilidad.
    setTimeout(setupLoginRegisterListeners, 500); // Retraso de 500ms
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
 * *** MODIFICADO PARA COMPATIBILIDAD CON ANDROID NATIVO ***
 */
async function handleGoogleSignIn() {
    showLoadingModal("Autenticando con Google...");

    // *** Detectar si estamos en la aplicación Android y usar el puente ***
    // Usa window.AndroidBridge explícitamente para asegurar el scope global.
    if (typeof window.AndroidBridge !== 'undefined' && typeof window.AndroidBridge.startGoogleSignIn === 'function') {
        console.log('Detectada aplicación Android. Iniciando Google Sign-In nativo...');
        window.AndroidBridge.startGoogleSignIn(); // Llama al método Java
        // El resto de la lógica de éxito/fracaso será manejada por los callbacks AndroidBridge.onGoogleSignInSuccess/Failure
        return; // Salimos de la función, el flujo continúa en Android y sus callbacks JS.
    }

    // *** Si no estamos en Android (ej. navegador web), usamos el flujo Firebase Web SDK normal ***
    console.log('No detectada aplicación Android. Usando Firebase Web SDK para Google Sign-In...');
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(authInstance, provider);
        const user = result.user;
        console.log("Usuario autenticado con Google (Web SDK):", user.uid);

        // Lógica para nuevos usuarios (igual que antes)
        await handleNewUserGoogle(user);

    } catch (error) {
        console.error("Error al autenticar con Google (Web SDK):", error);
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

/**
 * Lógica para verificar si es un usuario nuevo de Google y guardar sus datos iniciales.
 * Extraída de handleGoogleSignIn para reutilización.
 * @param {Object} user El objeto de usuario de Firebase.
 */
async function handleNewUserGoogle(user) {
    const userRef = ref(dbInstance, `users/${user.uid}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
        console.log("Nuevo usuario Google, guardando datos iniciales...");
        const referralCode = generateRandomString(6).toUpperCase();

        await set(userRef, {
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            photoURL: user.photoURL,
            createdAt: Date.now(),
            balance: 0,
            referralCode: referralCode,
            referredBy: null,
            hasAppliedReferral: false,
        });
        showNotification("¡Registro exitoso con Google! Bienvenido a Win Coin.", "success");
    } else {
        console.log("Usuario existente, iniciando sesión...");
        showNotification("¡Bienvenido de nuevo!", "success");
    }
    // El onAuthStateChanged en app.js detectará el cambio de estado y redirigirá.
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