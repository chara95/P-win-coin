// js/screenHandler.js

// Importa las instancias de auth y db de tu app.js
import { authInstance, dbInstance } from './app.js';
import { toggleSidebar } from './sidebar.js'; // Importa toggleSidebar desde sidebar.js
import { showNotification, hideLoadingModal } from './ui-feedback.js';

// Importa todas las funciones de inicialización de tus pantallas
import { initializeLoginRegisterScreen } from './login-register.js';
import { initializeHomeScreen } from './home-screen.js';
import { initializeFaucetScreen } from './faucetScreen.js';
import { initializeWithdrawalScreen } from './withdrawalScreen.js';
import { initializeReferralsScreen } from './referralScreen.js';
import { initializeGameScreen, startGame } from './game.js';
import { initializeHelpScreen } from './helpScreen.js';
import { initializeActivityScreen } from './activityScreen.js';

// Mapeo de data-target a elementos del DOM y sus funciones de inicialización
// Se inicializará con los elementos DOM reales dentro de DOMContentLoaded
const screens = {};
let currentActiveScreen = null;

// Un Set para mantener un registro de los botones que ya tienen un listener para evitar duplicados
const registeredNavigationButtons = new Set();

/**
 * Función para inicializar las referencias del DOM y el objeto 'screens'.
 * Se llama una vez que el DOM está completamente cargado.
 */
function initializeScreenReferences() {
    // Asigna los elementos del DOM después de que estén disponibles
    screens.authScreen = { element: document.getElementById('authScreen'), initializer: initializeLoginRegisterScreen };
    screens.homeScreen = { element: document.getElementById('homeScreen'), initializer: initializeHomeScreen };
    screens.gameScreen = { element: document.getElementById('gameScreen'), initializer: initializeGameScreen, onActive: startGame };
    screens.activityScreen = { element: document.getElementById('activityScreen'), initializer: initializeActivityScreen };
    screens.referralsScreen = { element: document.getElementById('referralsScreen'), initializer: initializeReferralsScreen };
    screens.withdrawalScreen = { element: document.getElementById('withdrawalScreen'), initializer: initializeWithdrawalScreen };
    screens.termsScreen = { element: document.getElementById('termsScreen'), initializer: null }; // No necesita inicializador específico
    screens.clickerFaucet = { element: document.getElementById('clickerFaucet'), initializer: initializeFaucetScreen };
    screens.advancedClickerScreen = { element: document.getElementById('advancedClickerScreen'), initializer: null }; // No necesita inicializador específico
    screens.helpScreen = { element: document.getElementById('helpScreen'), initializer: initializeHelpScreen };

    // Aquí se asegura de pasar authInstance y dbInstance a los inicializadores si los necesitan
    // Nota: Las funciones initialize... deben aceptar estos parámetros si los usan.
    // Ejemplo: initializeActivityScreen(auth, db)
    // No todos los inicializadores necesitan ambos, pero es seguro pasarlos.
    for (const screenId in screens) {
        if (screens[screenId].initializer && typeof screens[screenId].initializer === 'function') {
            const originalInitializer = screens[screenId].initializer;
            // Envuelve el inicializador para pasar authInstance y dbInstance automáticamente
            screens[screenId].initializer = () => originalInitializer(authInstance, dbInstance);
        }
    }
}


/**
 * Muestra una pantalla específica y oculta las demás.
 * Llama a la función de inicialización de la pantalla si está definida.
 * @param {string} targetScreenId El ID de la pantalla a mostrar (ej. 'homeScreen').
 */
export function showScreen(targetScreenId) {
    console.log(`Intentando mostrar pantalla: ${targetScreenId}`);

    hideLoadingModal(); // Asegura que cualquier modal de carga se oculte al cambiar de pantalla

    // Si el usuario no está autenticado y no es la pantalla de autenticación, redirige
    // Asegúrate de que authInstance.currentUser esté correctamente configurado por Firebase
    if (!authInstance.currentUser && targetScreenId !== 'authScreen') {
        showNotification("Debes iniciar sesión para acceder a esta sección.", "warning", 3000);
        showScreen('authScreen'); // Redirige a la pantalla de autenticación
        return;
    }

    const screenInfo = screens[targetScreenId];

    if (!screenInfo || !screenInfo.element) {
        console.warn(`No se encontró el elemento DOM o la configuración para la pantalla: ${targetScreenId}. Fallback a Home.`);
        showNotification(`La pantalla '${targetScreenId}' no está disponible.`, "error");
        // Si la pantalla no existe, intenta ir a la pantalla de inicio o autenticación
        if (authInstance.currentUser) {
            showScreen('homeScreen');
        } else {
            showScreen('authScreen');
        }
        return; // Salir después de la redirección o advertencia
    }

    // Oculta todas las pantallas
    // Se asegura de que SOLO el screenInfo.element se oculte si es el que estaba activo
    Object.values(screens).forEach(info => {
        if (info.element && info.element.id !== targetScreenId) {
            info.element.classList.add('hidden-completely');
            // Remueve las propiedades de display para asegurar que 'hidden-completely' haga su trabajo
            info.element.classList.remove('flex', 'block', 'grid');
        }
    });

    // Muestra la pantalla objetivo
    screenInfo.element.classList.remove('hidden-completely');

    currentActiveScreen = targetScreenId;
    console.log(`Mostrando pantalla: ${targetScreenId}`);

    // Llama a la función de inicialización de la pantalla
    if (screenInfo.initializer) {
        console.log(`Inicializando ${targetScreenId}...`);
        screenInfo.initializer(); // Los parámetros authInstance y dbInstance ya se inyectan al configurar 'screens'
    }

    // Llama a la función 'onActive' si está definida (ej. para iniciar un juego)
    if (screenInfo.onActive && typeof screenInfo.onActive === 'function') {
        console.log(`Ejecutando onActive para ${targetScreenId}...`);
        screenInfo.onActive();
    }

    // Cierra el sidebar después de la navegación
    toggleSidebar(false); // Necesita que sidebar.js exporte toggleSidebar
}

/**
 * Maneja la navegación de pantalla desde botones con `data-target-screen`.
 */
function handleScreenNavigation(event) {
    const targetScreenId = event.currentTarget.dataset.targetScreen;
    if (targetScreenId) {
        showScreen(targetScreenId);
    }
}

// Inicializa los elementos del DOM y registra los listeners al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    initializeScreenReferences(); // Primero, asigna todos los elementos DOM al objeto 'screens'

    // Ahora que 'screens' está lleno, podemos adjuntar los listeners
    document.querySelectorAll('[data-target-screen]').forEach(button => {
        // Solo añade el listener si no ha sido registrado previamente
        if (!registeredNavigationButtons.has(button)) {
            button.addEventListener('click', handleScreenNavigation);
            registeredNavigationButtons.add(button); // Añade el botón al Set de registrados
        }
    });
});

// Exporta showScreen para que app.js u otros módulos puedan usarlo
// (Ya está exportado al inicio del archivo)