// js/faucetScreen.js

import { showNotification, showLoadingModal, hideLoadingModal, updateBalanceDisplay, formatLTC } from './ui-feedback.js';
import { logUserActivity } from './utils/activityLogger.js';
import { ref, get, set, update, serverTimestamp, query, orderByChild, equalTo, increment, push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


const FAUCET_REWARD = 200; // Litoshis
const FAUCET_COOLDOWN_SECONDS = 60 * 60; // 1 hora
const FAUCET_CLAIM_ACTIVITY_DESCRIPTION = 'Reclamo de Faucet';

let authInstance; // La instancia de Auth se pasará en la inicialización
let dbInstance;   // La instancia de DB se pasará en la inicialización

let claimButton;
let faucetMessage;
let faucetTimerElement; // Renombrado de faucetTimer para claridad
let faucetCountdownElement; // Renombrado de faucetCountdown
let faucetInterval; // Para el clearInterval

/**
 * Inicializa la lógica para la pantalla del Faucet.
 * @param {object} firebaseAuth La instancia de Firebase Auth.
 * @param {object} firebaseDb La instancia de Firebase Database.
 */
export function initializeFaucetScreen(firebaseAuth, firebaseDb) { // Exportamos con el nombre CORRECTO
    authInstance = firebaseAuth;
    dbInstance = firebaseDb;
    console.log("Faucet screen initialized.");

    // Obtener referencias a los elementos del DOM (solo si no se han obtenido antes)
    if (!claimButton) { // Solo asignamos si no están ya asignados
        claimButton = document.getElementById('claimFaucetButton');
        faucetMessage = document.getElementById('faucetMessage');
        faucetTimerElement = document.getElementById('faucetTimer'); // ID del div que contiene el countdown
        faucetCountdownElement = document.getElementById('faucetCooldownDisplay'); // ID del span/div del texto del countdown

        if (!claimButton) {
            console.error("Elemento #claimFaucetButton no encontrado en faucetScreen.js");
            return;
        }
        claimButton.addEventListener('click', handleFaucetClaim);
        console.log("Listener para claimFaucetButton añadido.");
    }

    checkFaucetStatus();
}

/**
 * Maneja el reclamo del Faucet, actualizando balance y cooldown en Firebase Realtime Database.
 */
async function handleFaucetClaim() {
    showLoadingModal("Procesando reclamo del Faucet...");
    if (claimButton) claimButton.disabled = true;

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

        if (timeElapsed < FAUCET_COOLDOWN_SECONDS) {
            const timeLeft = FAUCET_COOLDOWN_SECONDS - timeElapsed;
            showNotification(`El Faucet está en cooldown. Espera ${formatTime(timeLeft)}.`, "warning");
            updateFaucetCountdown(timeLeft); // Actualiza la UI del temporizador
            if (faucetTimerElement) faucetTimerElement.classList.remove('hidden');
            if (faucetMessage) faucetMessage.classList.add('hidden');
            if (claimButton) claimButton.disabled = true; // Asegúrate de que el botón siga deshabilitado
            hideLoadingModal();
            return;
        }

        // Proceder con el reclamo: actualizar balance y lastFaucetClaim en la DB
        const currentBalance = userData.balance || 0;
        const newBalance = currentBalance + FAUCET_REWARD;

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


        showNotification(`¡Has reclamado ${formatLTC(FAUCET_REWARD)}!`, "success");
        updateBalanceDisplay(newBalance); // Actualiza el balance visible en la UI
        await logUserActivity(user.uid, 'faucet_claim', FAUCET_REWARD, `Reclamo de Faucet`);
        // Inicia el temporizador de cooldown en la UI
        startFaucetCooldownTimer();

        if (faucetMessage) faucetMessage.classList.add('hidden'); // Ocultar mensaje de "listo para reclamar"
        if (faucetTimerElement) faucetTimerElement.classList.remove('hidden'); // Mostrar el temporizador

    } catch (error) {
        console.error("Error al reclamar Faucet:", error);
        showNotification("Error al reclamar el Faucet. Inténtalo de nuevo.", "error");
    } finally {
        hideLoadingModal();
        // El botón se habilitará automáticamente al finalizar el cooldown o si hay un error no fatal
        // Si hay un error, el botón debería volver a habilitarse aquí si no se deshabilitó antes por cooldown
        if (claimButton && !faucetInterval) claimButton.disabled = false;
    }
}

/**
 * Verifica el estado del Faucet para el usuario actual y actualiza la UI.
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