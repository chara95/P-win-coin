// js/home-screen.js

// Importa las funciones directamente de ui-feedback
import { showNotification, showLoadingModal, hideLoadingModal, formatLTC, updateBalanceDisplay } from './ui-feedback.js';
// Importa Firebase SDKs que uses (ref, get, update, increment, onValue, off)
import { ref, get, update, increment, onValue, off } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { logUserActivity } from './utils/activityLogger.js';

// === Referencias a los elementos del DOM (Recompensa Diaria) ===
// userBalanceDisplay ya NO se obtiene aquí, se maneja centralmente por updateBalanceDisplay de ui-feedback.js
let dailyRewardMessage;
let claimDailyRewardButton;
let dailyRewardTimer;

// === Variables de la Recompensa Diaria ===
const DAILY_REWARD_COOLDOWN_SECONDS = 24 * 60 * 60; // 24 horas
const DAILY_REWARD_AMOUNT = 200; // Litoshis

let authInstance;
let dbInstance;
let unsubscribeBalanceListener = null; // Inicializa a null para un manejo seguro
let dailyRewardInterval;
let isClaimDailyRewardListenerAttached = false;


/**
 * Inicializa los listeners y referencias del DOM para la pantalla de inicio (saldo, recompensa).
 * Esta función es llamada desde app.js cuando la homeScreen está activa.
 * @param {object} firebaseAuth La instancia de Firebase Auth.
 * @param {object} firebaseDb La instancia de Firebase Database.
 */
export function initializeHomeScreen(firebaseAuth, firebaseDb) {
    // Si ya estamos inicializados y con las mismas instancias, podríamos evitar reinicializar todo
    if (authInstance === firebaseAuth && dbInstance === firebaseDb) {
        console.log("Home screen already initialized with same instances.");
        // Si solo necesitas refrescar, puedes llamar a loadDailyRewardStatus aquí
        const user = authInstance.currentUser;
        if (user) {
            // No necesitas llamar a updateBalanceDisplay aquí si el listener ya está activo.
            // setupBalanceListener ya manejará la actualización en tiempo real.
            loadDailyRewardStatus();
        }
        return; // Salir si ya está inicializado
    }

    authInstance = firebaseAuth; // Asigna la instancia de auth pasada por parámetro
    dbInstance = firebaseDb;     // Asigna la instancia de db pasada por parámetro
    console.log("Home screen initialized. Auth and DB references set.");

    // === Inicializar elementos del DOM de la Recompensa Diaria ===
    // userBalanceDisplay YA NO se obtiene aquí, ya que updateBalanceDisplay de ui-feedback.js lo gestiona
    dailyRewardMessage = document.getElementById('dailyRewardMessage');
    claimDailyRewardButton = document.getElementById('claimDailyRewardButton');
    dailyRewardTimer = document.getElementById('daily-reward-timer');

    // Listener para el botón de reclamar recompensa diaria
    if (claimDailyRewardButton && !isClaimDailyRewardListenerAttached) {
        claimDailyRewardButton.addEventListener('click', handleClaimDailyReward);
        isClaimDailyRewardListenerAttached = true; // Marca que ya se adjuntó
        console.log("Listener para claimDailyRewardButton adjuntado.");
    } else if (!claimDailyRewardButton) {
        console.warn("Elemento 'claimDailyRewardButton' no encontrado.");
    }


    const user = authInstance.currentUser; // Usa la instancia pasada
    if (user) {
        setupBalanceListener(user.uid); // <--- Llama a la nueva función que configura el listener
        loadDailyRewardStatus();
    } else {
        // Si no hay usuario, limpiar UI (usando la función global updateBalanceDisplay)
        updateBalanceDisplay(0);
        if (dailyRewardMessage) dailyRewardMessage.textContent = 'Inicia sesión para reclamar tu recompensa diaria.';
        updateDailyRewardButtonState(0, false);
        if (unsubscribeBalanceListener) { // Solo si existe un listener activo
            unsubscribeBalanceListener(); // Llama a la función devuelta por onValue directamente
            unsubscribeBalanceListener = null; // Reinicia la variable
        }
        if (dailyRewardInterval) clearInterval(dailyRewardInterval);
    }
}

/**
 * Configura el listener en tiempo real para el balance del usuario.
 * @param {string} uid El UID del usuario.
 */
async function setupBalanceListener(uid) {
    // Si ya hay un listener activo, desactívalo antes de crear uno nuevo
    if (unsubscribeBalanceListener) {
        unsubscribeBalanceListener(); // Llama a la función de unsubscription
        unsubscribeBalanceListener = null;
    }

    const userRef = ref(dbInstance, `users/${uid}`);

    // Guarda la función de unsubscription devuelta por onValue
    unsubscribeBalanceListener = onValue(userRef, (snapshot) => {
        if (snapshot.exists()) {
            const userData = snapshot.val();
            const balance = userData.balance || 0;
            updateBalanceDisplay(balance); // <--- Llama a la función global importada de ui-feedback.js
        } else {
            updateBalanceDisplay(0); // <--- Llama a la función global importada de ui-feedback.js
        }
    }, (error) => {
        console.error("Error al leer el balance:", error);
        showNotification("Error al cargar tu balance.", "error");
        updateBalanceDisplay(0); // Mostrar 0 en caso de error
    });
}


async function loadDailyRewardStatus() {
    const user = authInstance.currentUser; // Usa authInstance
    if (!user) {
        updateDailyRewardButtonState(0, false);
        return;
    }
    const userRef = ref(dbInstance, `users/${user.uid}`);
    const snapshot = await get(userRef);
    const userData = snapshot.val();
    const lastClaimTime = userData.lastDailyRewardClaim || 0;
    const currentTime = Date.now();
    const elapsedTimeSeconds = Math.floor((currentTime - lastClaimTime) / 1000);
    const timeLeft = DAILY_REWARD_COOLDOWN_SECONDS - elapsedTimeSeconds;

    if (timeLeft <= 0) {
        updateDailyRewardButtonState(0, true);
    } else {
        updateDailyRewardButtonState(timeLeft, false);
        startDailyRewardCountdown(timeLeft);
    }
}


 export async function grantDailyRewardAfterAd() {
    showLoadingModal("Otorgando recompensa diaria..."); // Show loading specifically for reward processing
    try {
        const user = authInstance.currentUser;
        if (!user) {
            showNotification("No hay usuario autenticado para otorgar la recompensa.", "error");
            return;
        }

        const userRef = ref(dbInstance, `users/${user.uid}`);
        const currentTime = Date.now();

        await update(userRef, {
            balance: increment(DAILY_REWARD_AMOUNT),
            lastDailyRewardClaim: currentTime
        });

        showNotification(`¡Has reclamado ${DAILY_REWARD_AMOUNT} Litoshis de recompensa diaria!`, "success", 5000);
        loadDailyRewardStatus(); // Recarga el estado para actualizar el contador/UI
        await logUserActivity(user.uid, 'daily_reward', DAILY_REWARD_AMOUNT, `Recompensa Diaria por Anuncio`);
        console.log("Recompensa diaria otorgada y logueada.");

    } catch (error) {
        console.error("Error al otorgar recompensa diaria:", error);
        showNotification(`Error al otorgar recompensa: ${error.message}`, "error");
    } finally {
        hideLoadingModal(); // Always hide the loading modal
    }
}

window.grantDailyRewardAfterAd = grantDailyRewardAfterAd;

async function handleClaimDailyReward() {
    showLoadingModal("Comprobando recompensa diaria..."); // Mensaje de carga inicial

    try {
        const user = authInstance.currentUser;
        if (!user) {
            showNotification("No hay usuario autenticado para reclamar.", "error");
            hideLoadingModal();
            return;
        }

        const userRef = ref(dbInstance, `users/${user.uid}`);
        const snapshot = await get(userRef);
        const userData = snapshot.val();
        const lastClaimTime = userData.lastDailyRewardClaim || 0;
        const currentTime = Date.now();
        const elapsedTimeSeconds = Math.floor((currentTime - lastClaimTime) / 1000);

        if (elapsedTimeSeconds >= DAILY_REWARD_COOLDOWN_SECONDS) {
            // Cooldown ha pasado, ahora intentamos mostrar el anuncio
            console.log("Cooldown diario pasado. Intentando mostrar anuncio recompensado.");

            // Verifica si UnityAdsBridge y showRewardedAd están disponibles
            if (typeof UnityAdsBridge !== 'undefined' && UnityAdsBridge.showRewardedAd) {
                // Establece el flag global para que AndroidBridge.rewardUser sepa el contexto
              

                window.currentRewardAdContext = 'daily_reward';
                showLoadingModal("Mostrando anuncio de recompensa...", "info"); 
                UnityAdsBridge.showRewardedAd();

            } else {
                console.warn("[JS] UnityAdsBridge.showRewardedAd no está disponible. No se puede mostrar el anuncio.");
                showNotification("Error: Servicio de anuncios no disponible.", "error");
                hideLoadingModal(); // Oculta el modal si el servicio de anuncios no está disponible
            }
        } else {
            // Todavía dentro del período de cooldown
            const timeLeft = DAILY_REWARD_COOLDOWN_SECONDS - elapsedTimeSeconds;
            showNotification(`Debes esperar ${formatTime(timeLeft)} para reclamar de nuevo.`, "info", 5000);
            hideLoadingModal(); // Oculta el modal si todavía está en cooldown
        }
    } catch (error) {
        console.error("Error al iniciar el reclamo de recompensa diaria:", error);
        showNotification(`Error: ${error.message}`, "error");
        hideLoadingModal();
    }
}


// --- Existing: Listener for the daily reward claim button ---
// Ensure this part remains as is, calling handleClaimDailyReward
if (claimDailyRewardButton && !isClaimDailyRewardListenerAttached) {
    claimDailyRewardButton.addEventListener('click', handleClaimDailyReward);
    isClaimDailyRewardListenerAttached = true; // Mark as attached
    console.log("Listener para claimDailyRewardButton adjuntado.");
} else if (!claimDailyRewardButton) {
    console.warn("Elemento 'claimDailyRewardButton' no encontrado.");
}

function updateDailyRewardButtonState(timeLeft, canClaim) {
    if (claimDailyRewardButton) {
        if (canClaim) {
            claimDailyRewardButton.textContent = 'Reclamar Recompensa Diaria';
            claimDailyRewardButton.disabled = false;
            claimDailyRewardButton.classList.remove('btn-disabled');
            claimDailyRewardButton.classList.add('btn-primary');
            if (dailyRewardTimer) dailyRewardTimer.textContent = '';
            if (dailyRewardMessage) dailyRewardMessage.textContent = '¡Reclama tu recompensa diaria!';
        } else {
            claimDailyRewardButton.textContent = 'Próxima recompensa';
            claimDailyRewardButton.disabled = true;
            claimDailyRewardButton.classList.add('btn-disabled');
            claimDailyRewardButton.classList.remove('btn-primary');
            if (dailyRewardMessage) dailyRewardMessage.textContent = 'Vuelve cada 24 horas para reclamar un bonus de Litoshis.';
        }
    }
}

function startDailyRewardCountdown(seconds) {
    if (dailyRewardInterval) clearInterval(dailyRewardInterval);

    let timeLeft = seconds;
    if (dailyRewardTimer) dailyRewardTimer.textContent = `Próxima recompensa en: ${formatTime(timeLeft)}`;

    dailyRewardInterval = setInterval(() => {
        timeLeft--;
        if (dailyRewardTimer) dailyRewardTimer.textContent = `Próxima recompensa en: ${formatTime(timeLeft)}`;

        if (timeLeft <= 0) {
            clearInterval(dailyRewardInterval);
            updateDailyRewardButtonState(0, true);
        }
    }, 1000);
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

