// js/faucetScreen.js

import { showNotification, showLoadingModal, hideLoadingModal, updateBalanceDisplay, formatLTC } from './ui-feedback.js';
import { logUserActivity } from './utils/activityLogger.js';
import { ref, get, set, update, serverTimestamp, query, orderByChild, equalTo, increment, push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


const FAUCET_REWARD = 200; // Litoshis
const FAUCET_COOLDOWN_SECONDS = 60 * 60; // 1 hora
const FAUCET_CLAIM_ACTIVITY_DESCRIPTION = 'Reclamo de Faucet';

let authInstance;   // La instancia de Auth se pasará en la inicialización
let dbInstance;     // La instancia de DB se pasará en la inicialización

let claimButton;
let faucetMessage;
let faucetTimerElement;     // Renombrado de faucetTimer para claridad
let faucetCountdownElement; // Renombrado de faucetCountdown
let faucetInterval;         // Para el clearInterval

// --- NUEVA BANDERA GLOBAL PARA EL CONTEXTO DEL ANUNCIO RECOMPENSADO ---
// Esta bandera indica que un anuncio se está viendo específicamente para el Faucet.
window.isWatchingFaucetAd = false;
// Asegúrate de que window.isWatchingDailyRewardAd también esté definida en algún lugar
// si la usas para otras recompensas (ej. en app.js o main.js), para evitar conflictos.


/**
 * Inicializa la lógica para la pantalla del Faucet.
 * @param {object} firebaseAuth La instancia de Firebase Auth.
 * @param {object} firebaseDb La instancia de Firebase Database.
 */
export function initializeFaucetScreen(firebaseAuth, firebaseDb) {
    authInstance = firebaseAuth;
    dbInstance = firebaseDb;
    console.log("Faucet screen initialized.");

    // Obtener referencias a los elementos del DOM (solo si no se han obtenido antes)
    if (!claimButton) {
        claimButton = document.getElementById('claimFaucetButton');
        faucetMessage = document.getElementById('faucetMessage');
        faucetTimerElement = document.getElementById('faucetTimer');
        faucetCountdownElement = document.getElementById('faucetCooldownDisplay');

        if (!claimButton) {
            console.error("Elemento #claimFaucetButton no encontrado en faucetScreen.js");
            return;
        }
        claimButton.addEventListener('click', handleFaucetClaim);
        console.log("Listener para claimFaucetButton añadido.");
    }

    checkFaucetStatus();
}


// --- NUEVA FUNCIÓN PARA OTORGAR LA RECOMPENSA DEL FAUCET DESPUÉS DEL ANUNCIO ---
// Esta función se llamará *solo* cuando el anuncio recompensado se haya visto completamente.
async function grantFaucetRewardAfterAd() {
    console.log("[JS] Anuncio de Faucet completado. Otorgando recompensa...");
    hideLoadingModal(); // Oculta el modal de carga que se mostró antes de que apareciera el anuncio.

    const user = authInstance.currentUser;
    if (!user) {
        showNotification("No hay usuario autenticado. No se pudo otorgar la recompensa del Faucet.", "error");
        if (claimButton) claimButton.disabled = false; // Re-habilitar botón si no hay usuario
        return;
    }

    try {
        const userRef = ref(dbInstance, `users/${user.uid}`);
        const snapshot = await get(userRef);
        if (!snapshot.exists()) {
            showNotification("Datos de usuario no encontrados. No se pudo otorgar la recompensa del Faucet.", "error");
            if (claimButton) claimButton.disabled = false;
            return;
        }

        const userData = snapshot.val();
        const currentBalance = userData.balance || 0;
        const newBalance = currentBalance + FAUCET_REWARD;
        const currentTime = Date.now(); // Usar el tiempo actual para el timestamp de reclamo final

        // Actualizar balance y el último timestamp de reclamo en la DB
        await update(userRef, {
            balance: newBalance,
            lastFaucetClaim: currentTime
        });

        // Registrar la actividad del Faucet
        const activityRef = ref(dbInstance, `users/${user.uid}/activities`);
        const newActivityRef = await push(activityRef); // Genera una nueva clave única
        await set(newActivityRef, {
            type: 'faucet_claim',
            description: FAUCET_CLAIM_ACTIVITY_DESCRIPTION,
            amount: FAUCET_REWARD,
            timestamp: currentTime
        });

        showNotification(`¡Has reclamado ${formatLTC(FAUCET_REWARD)} del Faucet!`, "success");
        updateBalanceDisplay(newBalance); // Actualiza el balance visible en la UI
        await logUserActivity(user.uid, 'faucet_claim', FAUCET_REWARD, `Reclamo de Faucet`);
        startFaucetCooldownTimer(); // Inicia el temporizador de cooldown en la UI
        
        if (faucetMessage) faucetMessage.classList.add('hidden'); // Ocultar mensaje de "listo para reclamar"
        if (faucetTimerElement) faucetTimerElement.classList.remove('hidden'); // Mostrar el temporizador del cooldown

    } catch (error) {
        console.error("Error al otorgar la recompensa del Faucet después del anuncio:", error);
        showNotification("Error al procesar tu recompensa del Faucet. Inténtalo de nuevo.", "error");
    } finally {
        // Asegúrate de que el botón se habilite si no hay cooldown activo después de la recompensa.
        // `faucetInterval` es una buena forma de saber si el cooldown está corriendo.
        if (claimButton && !faucetInterval) {
            claimButton.disabled = false;
        }
        // ¡Importante! Resetea la bandera después de procesar la recompensa
        window.isWatchingFaucetAd = false;
    }
}


/**
 * Maneja el reclamo del Faucet. Ahora, antes de dar la recompensa, muestra un anuncio.
 */
async function handleFaucetClaim() {
    showLoadingModal("Procesando reclamo del Faucet...");
    if (claimButton) claimButton.disabled = true; // Deshabilita el botón inmediatamente

    const user = authInstance.currentUser;
    if (!user) {
        hideLoadingModal();
        showNotification("Debes iniciar sesión para usar el faucet.", "error");
        if (claimButton) claimButton.disabled = false;
        return;
    }

    try {
        const userRef = ref(dbInstance, `users/${user.uid}`);
        const snapshot = await get(userRef);

        if (!snapshot.exists()) {
            hideLoadingModal();
            showNotification("No se encontraron tus datos de usuario.", "error");
            if (claimButton) claimButton.disabled = false;
            return;
        }

        const userData = snapshot.val();
        const lastClaimTimestamp = userData.lastFaucetClaim || 0;
        const currentTime = Date.now();
        const timeElapsed = (currentTime - lastClaimTimestamp) / 1000; // en segundos

        // Comprueba si el Faucet está en cooldown
        if (timeElapsed < FAUCET_COOLDOWN_SECONDS) {
            const timeLeft = FAUCET_COOLDOWN_SECONDS - timeElapsed;
            showNotification(`El Faucet está en cooldown. Espera ${formatTime(timeLeft)}.`, "warning");
            updateFaucetCountdown(timeLeft); // Actualiza la UI del temporizador
            if (faucetTimerElement) faucetTimerElement.classList.remove('hidden');
            if (faucetMessage) faucetMessage.classList.add('hidden');
            if (claimButton) claimButton.disabled = true; // Asegúrate de que el botón siga deshabilitado
            hideLoadingModal(); // Oculta el modal de carga si hay cooldown
            return;
        }

        // --- Lógica para mostrar el anuncio recompensado ---
        console.log("Cooldown del Faucet pasado. Intentando mostrar anuncio recompensado.");
        // Verifica si el puente de Android para Unity Ads está disponible
        if (typeof UnityAdsBridge !== 'undefined' && UnityAdsBridge.showRewardedAd) {
            // Establece la bandera específica para la recompensa del Faucet
            window.isWatchingFaucetAd = true;
            // Asegúrate de que otras banderas de recompensa estén en false para evitar conflictos.
            // Si tienes una bandera para la recompensa diaria, desactívala aquí:
            if (window.isWatchingDailyRewardAd !== undefined) {
                window.isWatchingDailyRewardAd = false;
            }

            showLoadingModal("Mostrando anuncio para reclamar del Faucet...", "info"); // Mensaje relevante para el usuario
            UnityAdsBridge.showRewardedAd(); // Llama al método de Android para mostrar el anuncio

            // IMPORTANTE: Después de llamar a UnityAdsBridge.showRewardedAd(), esta función
            // `handleFaucetClaim()` no debe otorgar la recompensa directamente.
            // La recompensa se otorgará en `grantFaucetRewardAfterAd()`
            // una vez que el anuncio se haya completado exitosamente a través del callback de Android.
            // El botón permanecerá deshabilitado hasta que el ad termine/falle,
            // o el temporizador de cooldown se active y tome el control.

        } else {
            console.warn("[JS] UnityAdsBridge.showRewardedAd no está disponible. No se puede mostrar el anuncio para el Faucet.");
            showNotification("Error: El servicio de anuncios no está disponible. Inténtalo de nuevo más tarde.", "error");
            hideLoadingModal(); // Oculta el modal si no se pudo mostrar el ad
            if (claimButton) claimButton.disabled = false; // Re-habilitar botón si no se pudo mostrar el ad
        }

    } catch (error) {
        console.error("Error general en handleFaucetClaim (antes de mostrar el ad):", error);
        showNotification("Error al procesar tu reclamo del Faucet. Inténtalo de nuevo.", "error");
        hideLoadingModal(); // Oculta el modal en caso de error
        if (claimButton) claimButton.disabled = false; // Re-habilitar botón en caso de error
    }
    // El bloque `finally` de tu función original ha sido reestructurado
    // para que la gestión del `hideLoadingModal()` y la habilitación/deshabilitación del botón
    // se maneje en los puntos específicos de éxito o fallo (ya sea antes de mostrar el ad,
    // o después de que el ad se completa/falla).
}


/**
 * Verifica el estado del Faucet para el usuario actual y actualiza la UI.
 * Se llama al cargar la pantalla del Faucet y después de un reclamo exitoso.
 */
async function checkFaucetStatus() {
    const user = authInstance.currentUser;
    if (!user) {
        if (claimButton) claimButton.disabled = true;
        if (faucetMessage) {
            faucetMessage.textContent = "Inicia sesión para usar el faucet.";
            faucetMessage.classList.remove('hidden');
        }
        if (faucetTimerElement) faucetTimerElement.classList.add('hidden');
        return;
    }

    try {
        const userRef = ref(dbInstance, `users/${user.uid}`);
        const snapshot = await get(userRef);

        if (!snapshot.exists()) {
            console.warn("Datos de usuario no encontrados al verificar el estado del Faucet.");
            if (claimButton) claimButton.disabled = true;
            if (faucetMessage) {
                faucetMessage.textContent = "Error: Datos de usuario no disponibles.";
                faucetMessage.classList.remove('hidden');
            }
            if (faucetTimerElement) faucetTimerElement.classList.add('hidden');
            return;
        }

        const userData = snapshot.val();
        const lastClaimTimestamp = userData.lastFaucetClaim || 0;
        const currentTime = Date.now();
        const timeElapsed = (currentTime - lastClaimTimestamp) / 1000; // en segundos

        if (timeElapsed < FAUCET_COOLDOWN_SECONDS) {
            const timeLeft = FAUCET_COOLDOWN_SECONDS - timeElapsed;
            startFaucetCooldownTimer(timeLeft);
            if (faucetMessage) faucetMessage.classList.add('hidden');
            if (faucetTimerElement) faucetTimerElement.classList.remove('hidden');
            console.log(`Faucet en cooldown. Tiempo restante: ${formatTime(timeLeft)}`);
        } else {
            if (claimButton) claimButton.disabled = false;
            if (faucetMessage) {
                faucetMessage.textContent = "¡Faucet listo para reclamar!";
                faucetMessage.classList.remove('hidden');
            }
            if (faucetTimerElement) faucetTimerElement.classList.add('hidden');
            clearInterval(faucetInterval); // Asegurarse de que no haya un temporizador activo si ya está listo
            console.log("Faucet listo para ser reclamado.");
        }

    } catch (error) {
        console.error("Error al verificar el estado del Faucet:", error);
        showNotification("Error al cargar el estado del Faucet.", "error");
        if (claimButton) claimButton.disabled = true; // Deshabilitar por si acaso
    }
}

/**
 * Inicia el temporizador de cuenta regresiva del Faucet en la UI.
 * @param {number} initialTimeLeft Tiempo inicial en segundos.
 */
function startFaucetCooldownTimer(initialTimeLeft = FAUCET_COOLDOWN_SECONDS) {
    let timeLeft = initialTimeLeft;
    if (faucetInterval) clearInterval(faucetInterval); // Limpiar cualquier intervalo anterior

    if (faucetTimerElement) faucetTimerElement.classList.remove('hidden'); // Mostrar el contenedor del temporizador
    if (claimButton) claimButton.disabled = true; // Deshabilitar el botón

    updateFaucetCountdown(timeLeft); // Actualizar inmediatamente el temporizador

    faucetInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(faucetInterval);
            if (claimButton) claimButton.disabled = false;
            if (faucetTimerElement) faucetTimerElement.classList.add('hidden');
            if (faucetMessage) {
                faucetMessage.textContent = "¡Faucet listo para reclamar!";
                faucetMessage.classList.remove('hidden');
            }
            updateFaucetCountdown(0);
            console.log("Faucet cooldown finished.");
        } else {
            updateFaucetCountdown(timeLeft);
        }
    }, 1000);
}

/**
 * Actualiza el texto de la cuenta regresiva del Faucet.
 * @param {number} seconds Tiempo restante en segundos.
 */
function updateFaucetCountdown(seconds) {
    if (!faucetCountdownElement) return;
    faucetCountdownElement.textContent = formatTime(seconds);
}

/**
 * Formatea un número de segundos en un string HH:MM:SS.
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const pad = (num) => String(num).padStart(2, '0');

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}