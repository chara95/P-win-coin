// js/app.js

import { authInstance, dbInstance } from './firebase-config.js'; // Importa ambos desde firebase-config
export { authInstance, dbInstance }; // Exporta ambos para que otros módulos los puedan importar de app.js

import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { ref, get, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js"; // Necesario para crear el usuario en DB si no existe

import { showScreen } from './screenHandler.js';
import { updateBalanceDisplay, showNotification } from './ui-feedback.js'; // Importa de ui-feedback.js
import { showLoadingScreen, hideLoadingScreen } from './loading.js'; // Para la pantalla de carga inicial

// Importa las funciones de inicialización de tus pantallas
import { initializeLoginRegisterScreen } from './login-register.js';
import { initializeHomeScreen } from './home-screen.js';
import { initializeFaucetScreen } from './faucetScreen.js'; // ¡CORREGIDO EL NOMBRE AQUÍ!
import { initializeWithdrawalScreen } from './withdrawalScreen.js';
import { initializeReferralsScreen } from './referralScreen.js';
import { initializeGameScreen } from './game.js';
import { initializeSidebar } from './sidebar.js';
// Si tienes initializeActivityScreen, asegúrate de importarlo aquí también
// import { initializeActivityScreen } from './activityScreen.js';
const TERMS_URL = 'https://sites.google.com/view/condiciones-win-con-miner/inicio';
const faucetpayUrl = "https://faucetpay.io/?r=2543351";

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM completamente cargado. Iniciando app.js...");
    showLoadingScreen(); // Muestra la pantalla de carga al inicio

    // --- Lógica del botón de Salir (DEBE ESTAR AQUÍ) ---
    const logoutButton = document.getElementById('logoutBtn');
    const termsAndConditionsLink2 = document.getElementById('termsAndConditionsLink2');
    const faucetpayUrlBtn = document.getElementById('faucetpayUrlBtn');
    if (logoutButton) {
        logoutButton.addEventListener('click', async (e) => {
            e.preventDefault(); // Previene el comportamiento por defecto del enlace
            try {
                await signOut(authInstance); // Usa la función signOut de Firebase Auth
                console.log("Sesión cerrada exitosamente.");
                showNotification("Sesión cerrada.", "info"); // Notificación al usuario
                // onAuthStateChanged se encargará de mostrar la pantalla de login
            } catch (error) {
                console.error("Error al cerrar sesión:", error);
                showNotification(`Error al cerrar sesión: ${error.message}`, "error");
            }
        });
        console.log("Listener para el botón de Salir añadido.");
    } else {
        console.warn("Elemento #logoutBtn no encontrado en el DOM. El botón de Salir no funcionará.");
    }

    if (termsAndConditionsLink2) {
        termsAndConditionsLink2.addEventListener('click', function (event) {
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


    if (faucetpayUrlBtn) {
        faucetpayUrlBtn.addEventListener('click', function (event) {
            event.preventDefault(); // Evita que el navegador siga el href="#"
            console.log("[JS] Enlace de FaucetPay clickeado.");
            if (window.AndroidBridge && window.AndroidBridge.openUrlInBrowser) {
                window.AndroidBridge.openUrlInBrowser(faucetpayUrl);
            } else {
                console.warn("[JS] AndroidBridge.openUrlInBrowser no disponible, abriendo en ventana JS.");
                window.open(faucetpayUrl, '_blank');
            }
        });
    }
    // --- Fin Lógica del botón de Salir ---

    // onAuthStateChanged es el punto central para manejar el estado de autenticación
    onAuthStateChanged(authInstance, async (user) => {
        if (user) {
            console.log("Usuario autenticado:", user.uid);
            try {
                const userRef = ref(dbInstance, `users/${user.uid}`);
                const snapshot = await get(userRef);
                let userBalanceLitoshis = 0;
                if (snapshot.exists()) {
                    const userData = snapshot.val();
                    userBalanceLitoshis = userData.balance || 0;
                    // También puedes actualizar otros datos del usuario aquí si es necesario
                } else {
                    // Si el usuario es nuevo (se autenticó, pero no tiene entrada en DB)
                    // Esto es un fallback, la lógica de creación ya está en login-register.js
                    // pero es bueno tener un seguro aquí.
                    const referralCode = user.uid.substring(0, 8).toUpperCase(); // Ejemplo simple
                    await set(userRef, {
                        balance: 0,
                        email: user.email,
                        displayName: user.displayName || user.email,
                        photoURL: user.photoURL || null,
                        createdAt: Date.now(),
                        lastLogin: Date.now(),
                        referralCode: referralCode,
                        faucetPayEmail: '',
                        lastDailyRewardClaim: 0,
                        lastFaucetClaim: 0
                    });
                    console.log("Nuevo usuario creado en DB (desde onAuthStateChanged):", user.uid);
                }
                updateBalanceDisplay(userBalanceLitoshis); // Actualizar UI con el balance real
                console.log(`Balance inicial del usuario ${user.uid} cargado: ${userBalanceLitoshis} Litoshis`);

            } catch (error) {
                console.error("Error al cargar o inicializar balance de usuario en app.js:", error);
                updateBalanceDisplay(0); // Mostrar 0 en caso de error
            }

            hideLoadingScreen(); // Oculta la pantalla de carga
            showScreen('homeScreen'); // Muestra la pantalla de inicio
            // Las inicializaciones de las pantallas ahora se manejan en screenHandler.js
            // cuando showScreen es llamado. No es necesario llamarlas aquí directamente.
            initializeSidebar(authInstance, dbInstance);

        } else {
            console.log("No hay usuario autenticado.");
            updateBalanceDisplay(0); // Limpia el balance en la UI
            hideLoadingScreen(); // Oculta la pantalla de carga
            showScreen('authScreen'); // Muestra la pantalla de autenticación
        }
    });
});