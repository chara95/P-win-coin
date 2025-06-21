// js/sidebar.js

import { showScreen } from './screenHandler.js'; // Necesario para cambiar de pantalla
import { authInstance, dbInstance } from './app.js'; // Necesario para el logout y para pasar a init functions (aunque showScreen ya lo hace)

// No es necesario importar las funciones de inicialización aquí.
// showScreen en screenHandler.js ya se encarga de llamarlas.
// ELIMINADAS:
// import { initializeHomeScreen } from './home-screen.js';
// import { initializeWithdrawalScreen } from './withdrawalScreen.js';
// import { initializeFaucetScreen } from './faucetScreen.js';
// import { initializeReferralsScreen } from './referralScreen.js';
// import { initializeActivityScreen } from './activityScreen.js';
// import { initializeGameScreen } from './game.js'; // Si la usabas

/**
 * Inicializa la funcionalidad del sidebar.
 * Asume que los IDs 'hamburgerBtn', 'sidebar', y 'sidebarOverlay' existen en el HTML.
 */
export function initializeSidebar() { // Ya no necesitas pasar authInstance, dbInstance aquí, app.js lo hará directamente
                                     // cuando llama a initializeSidebar si es necesario, o showScreen ya lo usa.
                                     // showScreen ya usa authInstance y dbInstance importados de app.js
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const logoutBtn = document.getElementById('logoutBtn'); // Mueve la declaración aquí

    if (!hamburgerBtn || !sidebar || !sidebarOverlay) {
        console.error("Error: No se encontraron todos los elementos HTML para inicializar el sidebar. Asegúrate de que 'hamburgerBtn', 'sidebar', y 'sidebarOverlay' existan.");
        return;
    }

    // Toggle del sidebar al hacer clic en el botón de hamburguesa
    hamburgerBtn.addEventListener('click', () => {
        toggleSidebar(true); // Abre el sidebar
        console.log("Sidebar toggled. Open state:", sidebar.classList.contains('open'));
    });

    // Cierre del sidebar al hacer clic en el overlay
    sidebarOverlay.addEventListener('click', () => {
        toggleSidebar(false); // Cierra el sidebar
    });

    // Manejo de los enlaces de navegación del sidebar
    document.querySelectorAll('.sidebar-link').forEach(link => {
        // Importante: Elimina el listener previo para evitar duplicados si initializeSidebar se llama más de una vez
        link.removeEventListener('click', handleSidebarLinkClick);
        link.addEventListener('click', handleSidebarLinkClick);
    });

    // Lógica para el botón de salir
    if (logoutBtn) {
        logoutBtn.removeEventListener('click', handleLogoutClick); // Evita duplicados
        logoutBtn.addEventListener('click', handleLogoutClick);
        console.log("Logout button listener added.");
    } else {
        console.warn("Elemento #logoutBtn no encontrado en el DOM para el sidebar.");
    }
}

/**
 * Alterna el estado de apertura/cierre del sidebar.
 * @param {boolean} open - Si es true, abre el sidebar; si es false, lo cierra.
 */
export function toggleSidebar(open) {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if (open) {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('visible');
    } else {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('visible');
    }
}

/**
 * Manejador de clic para los enlaces de navegación del sidebar.
 * Se encarga de cambiar la pantalla y cerrar el sidebar.
 * @param {Event} event - El evento de clic.
 */
function handleSidebarLinkClick(event) {
    event.preventDefault(); // Previene el comportamiento por defecto del enlace

    // ESTO ES LO CRÍTICO: Usa data-target-screen, no data-target
    const targetScreenId = event.currentTarget.dataset.targetScreen; 

    if (targetScreenId) {
        // Lógica para gestionar las clases 'active' del sidebar
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        event.currentTarget.classList.add('active'); // Activa el enlace clickeado

        // Muestra la pantalla correspondiente usando la función centralizada de screenHandler.js
        showScreen(targetScreenId);
        console.log(`Navegando a la pantalla: ${targetScreenId}`);

        // Cierra el sidebar después de navegar
        toggleSidebar(false);
    } else {
        console.warn("Enlace de sidebar sin atributo data-target-screen válido:", event.currentTarget);
    }
}

/**
 * Manejador de clic para el botón de cerrar sesión.
 * @param {Event} event - El evento de clic.
 */
async function handleLogoutClick(event) {
    event.preventDefault();
    console.log("Botón de cerrar sesión clickeado en sidebar.");
    toggleSidebar(false); // Cierra el sidebar antes de cerrar sesión
    // Llama a la función de cierre de sesión de Firebase
    try {
        await authInstance.signOut();
        console.log("Sesión cerrada exitosamente.");
        // onAuthStateChanged en app.js se encargará de redirigir a la pantalla de autenticación
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
    }
}