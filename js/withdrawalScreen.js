// js/withdrawalScreen.js

import { ref, get, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { showNotification, showLoadingModal, hideLoadingModal } from './ui-feedback.js';
import { logUserActivity } from './utils/activityLogger.js';

let authInstance;
let dbInstance;

// === CONSTANTES DE RETIRO ===
// Todos los montos se manejan en Litoshis internamente.
// 1 LTC = 100,000,000 Litoshis
const LTC_TO_LITOSHIS_FACTOR = 100_000_000;
const MIN_WITHDRAWAL_LITOSHIS = 1000; // 0.0001 LTC (100,000 Litoshis) - Esto debe coincidir con tu backend
const WITHDRAWAL_FEE_LITOSHIS = 1000; // 0.00001 LTC (1,000 Litoshis) - Esto DEBE coincidir con tu backend (server.js)

// Definición de las opciones de retiro en Litoshis
// ¡Ajustado para que los 'value' sean los LITOSHIS correctos para cada monto LTC!
const WITHDRAWAL_OPTIONS = [
    // El 'label' es lo que se muestra al usuario, el 'amountLitoshis' es el valor interno
    { amountLTC: 0.00001, amountLitoshis: 1000, label: "0.00001 LTC" },
    { amountLTC: 0.00005, amountLitoshis: 5000, label: "0.00005 LTC" },
    { amountLTC: 0.0001, amountLitoshis: 10000, label: "0.00010 LTC" }, // Este es el mínimo que deseas mostrar en el error
    { amountLTC: 0.0005, amountLitoshis: 50000, label: "0.00050 LTC" },
    { amountLTC: 0.001, amountLitoshis: 100000, label: "0.00100 LTC" },
    // Agrega más opciones si lo deseas
];

// === URL DE TU BACKEND EN RENDER ===
// ¡IMPORTANTE! Reemplaza esto con la URL REAL de tu aplicación en Render.
// Durante el desarrollo local, puedes usar http://localhost:3001
const BACKEND_URL = 'https://my-faucet-backend-3.onrender.com'; // Cambia esto por tu URL de Render ej: 'https://tu-app-de-backend.onrender.com'


// Elementos del DOM - Ajustados a tus IDs actuales
let displayEmail;
let editEmailBtn;
let emailInputSection;
let emailInput;
let saveEmailBtn;
let emailStatusMessage;

let withdrawalBalanceDisplay;
let withdrawalFeeDisplay; // Asumo que tienes un span para esto ahora en tu HTML
let withdrawalAmountSelect;
let requestWithdrawalBtn;
let minWithdrawalErrorDisplay;

/**
 * Inicializa la lógica para la pantalla de retiros.
 * @param {object} firebaseAuth La instancia de Firebase Auth.
 * @param {object} firebaseDb La instancia de Firebase Database.
 */
export function initializeWithdrawalScreen(firebaseAuth, firebaseDb) {
    authInstance = firebaseAuth;
    dbInstance = firebaseDb;
    console.log("Withdrawal screen initialized.");

    // Asocia los elementos del DOM
    displayEmail = document.getElementById('displayEmail');
    editEmailBtn = document.getElementById('editEmailBtn');
    emailInputSection = document.getElementById('emailInputSection');
    emailInput = document.getElementById('emailInput');
    saveEmailBtn = document.getElementById('saveEmailBtn');
    emailStatusMessage = document.getElementById('emailStatusMessage');

    withdrawalBalanceDisplay = document.getElementById('withdrawalBalanceDisplay');
    withdrawalFeeDisplay = document.getElementById('withdrawalFeeDisplay'); // Asegúrate de que tienes <span id="withdrawalFeeDisplay"> en tu HTML
    withdrawalAmountSelect = document.getElementById('withdrawalAmountSelect');
    requestWithdrawalBtn = document.getElementById('requestWithdrawalBtn');
    minWithdrawalErrorDisplay = document.getElementById('minWithdrawalErrorDisplay');


    // Event Listeners
    if (editEmailBtn) {
        editEmailBtn.addEventListener('click', () => toggleEmailInput(true));
    }
    if (saveEmailBtn) {
        saveEmailBtn.addEventListener('click', handleSaveFaucetPayEmail);
    }
    if (requestWithdrawalBtn) {
        requestWithdrawalBtn.addEventListener('click', handleWithdrawalRequest);
    }
    if (withdrawalAmountSelect) {
        withdrawalAmountSelect.addEventListener('change', updateWithdrawalDetails);
    }

    // Llenar el select con las opciones de retiro
    populateWithdrawalOptions();
    // Cargar los datos del usuario al iniciar la pantalla
    loadWithdrawalData();

    // Actualiza la visualización de la comisión al iniciar
    if (withdrawalFeeDisplay) {
        withdrawalFeeDisplay.textContent = `${(WITHDRAWAL_FEE_LITOSHIS / LTC_TO_LITOSHIS_FACTOR).toFixed(8)} LTC`;
    }
}

/**
 * Carga los datos de retiro del usuario y actualiza la UI.
 */
async function loadWithdrawalData() {
    if (!authInstance.currentUser) {
        showNotification("Debes iniciar sesión para ver los detalles de retiro.", "error");
        updateWithdrawalUI(0, null); // Restablece la UI si no hay usuario
        return;
    }

    const userId = authInstance.currentUser.uid;
    const userRef = ref(dbInstance, `users/${userId}`);

    try {
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
            const userData = snapshot.val();
            updateWithdrawalUI(userData.balance || 0, userData.faucetPayEmail || null);
        } else {
            showNotification("Error: No se encontraron los datos del usuario.", "error");
            updateWithdrawalUI(0, null);
        }
    } catch (error) {
        console.error("Error loading withdrawal data:", error);
        showNotification("Error al cargar los datos de retiro.", "error");
        updateWithdrawalUI(0, null);
    }
}

/**
 * Actualiza la UI de la pantalla de retiro.
 * @param {number} balanceLitoshis El balance actual del usuario en Litoshis.
 * @param {string|null} faucetPayEmail El correo electrónico de FaucetPay del usuario, o null si no está configurado.
 */
function updateWithdrawalUI(balanceLitoshis, faucetPayEmail) {
    // === Gestión del correo de FaucetPay ===
    if (faucetPayEmail && displayEmail) {
        displayEmail.textContent = faucetPayEmail;
        toggleEmailInput(false); // Ocultar input, mostrar display
        if (emailStatusMessage) {
            emailStatusMessage.classList.add('hidden'); // Ocultar el mensaje "no configurado" o "guardado"
        }
    } else {
        if (displayEmail) displayEmail.textContent = "no configurado";
        toggleEmailInput(true); // Mostrar input para que lo configure
        if (emailStatusMessage) {
            emailStatusMessage.textContent = "Correo electrónico de FaucetPay: no configurado";
            emailStatusMessage.classList.remove('hidden');
            emailStatusMessage.classList.remove('text-green-400');
            emailStatusMessage.classList.add('text-red-400');
        }
    }

    // === Gestión de balances ===
    if (withdrawalBalanceDisplay) {
        withdrawalBalanceDisplay.textContent = `${(balanceLitoshis / LTC_TO_LITOSHIS_FACTOR).toFixed(8)} LTC`;
    }

    // Siempre actualiza los detalles del retiro seleccionado
    updateWithdrawalDetails();
}

/**
 * Controla la visibilidad del input de correo de FaucetPay y el botón de cambio/guardar.
 * @param {boolean} showInput If true, shows input and save button; hides display and change button.
 */
function toggleEmailInput(showInput) {
    // Estos elementos están envueltos en tu HTML, por lo que su visibilidad se controla mejor a nivel de contenedor.
    // Asumo que el "Correo electrónico de FaucetPay: <span id="displayEmail">" está en un <p> o <div> que queremos ocultar.
    // Y el <div id="emailInputSection"> es lo que se oculta/muestra.

    if (emailInputSection) {
        emailInputSection.classList.toggle('hidden', !showInput);
    }
    // Si displayEmail está en un <p>, podemos ocultar el párrafo padre.
    if (displayEmail) {
        displayEmail.closest('p').classList.toggle('hidden', showInput);
    }
    if (editEmailBtn) {
        editEmailBtn.classList.toggle('hidden', showInput);
    }
}

/**
 * Llena el dropdown de opciones de retiro con los montos definidos.
 */
function populateWithdrawalOptions() {
    if (!withdrawalAmountSelect) return;

    // Limpiar opciones existentes, excepto la primera "Selecciona un monto"
    while (withdrawalAmountSelect.options.length > 1) {
        withdrawalAmountSelect.remove(1);
    }

    WITHDRAWAL_OPTIONS.forEach(option => {
        const optElement = document.createElement('option');
        optElement.value = option.amountLitoshis; // El valor real para el cálculo (en Litoshis)
        optElement.textContent = option.label;
        withdrawalAmountSelect.appendChild(optElement);
    });

    // Llama a updateWithdrawalDetails para mostrar los detalles del primer monto por defecto
    updateWithdrawalDetails();
}

/**
 * Actualiza la información de retiro basada en la selección del usuario.
 */
function updateWithdrawalDetails() {
    if (!withdrawalAmountSelect || !minWithdrawalErrorDisplay || !requestWithdrawalBtn || !withdrawalBalanceDisplay) return;

    const selectedAmountLitoshis = parseInt(withdrawalAmountSelect.value, 10);
    // Extrae el balance del DOM, lo convierte a número de Litoshis
    const currentUserBalanceLTC = parseFloat(withdrawalBalanceDisplay.textContent);
    const currentUserBalanceLitoshis = Math.round(currentUserBalanceLTC * LTC_TO_LITOSHIS_FACTOR);


    const totalCostLitoshis = selectedAmountLitoshis + WITHDRAWAL_FEE_LITOSHIS;

    // Estado inicial del botón y mensaje de error
    requestWithdrawalBtn.disabled = true; // Deshabilitar por defecto
    minWithdrawalErrorDisplay.classList.add('hidden'); // Ocultar mensaje de error

    // Validaciones
    if (selectedAmountLitoshis === 0) { // Si "Selecciona un monto" está seleccionado (valor por defecto es 0 si no se setea)
        return; // No hacer más validaciones hasta que se seleccione un monto real
    }

    if (selectedAmountLitoshis < MIN_WITHDRAWAL_LITOSHIS) {
        minWithdrawalErrorDisplay.textContent = `La cantidad mínima de retiro es ${(MIN_WITHDRAWAL_LITOSHIS / LTC_TO_LITOSHIS_FACTOR).toFixed(8)} LTC.`;
        minWithdrawalErrorDisplay.classList.remove('hidden');
        return;
    }

    if (currentUserBalanceLitoshis < totalCostLitoshis) {
        showNotification("Balance insuficiente para esta solicitud de retiro, incluyendo la comisión.", "error");
        return;
    }

    // Si todas las validaciones pasan, habilitar el botón
    requestWithdrawalBtn.disabled = false;
}

/**
 * Maneja el guardado del correo electrónico de FaucetPay.
 * Ahora se comunica con el backend para la validación.
 */
async function handleSaveFaucetPayEmail() {
    const currentUser = authInstance.currentUser;
    if (!currentUser) {
        showNotification("Debes iniciar sesión para guardar tu correo de FaucetPay.", "error");
        return;
    }

    const email = emailInput.value.trim();
    if (!email) {
        showNotification("Por favor, ingresa un correo electrónico.", "warning");
        return;
    }
    if (!isValidEmail(email)) {
        showNotification("Formato de correo electrónico inválido.", "error");
        return;
    }

    showLoadingModal("Validando y guardando correo...");

    try {
        const idToken = await currentUser.getIdToken(); // Obtén el token de Firebase Auth
        console.log("[JS] token ", idToken );
        console.log("[JS] Correo a validar:", email);
        

        const response = await fetch(`${BACKEND_URL}/api/validate-faucetpay-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}` // Envía el token al backend
            },
            body: JSON.stringify({ email: email })
        });

        const data = await response.json();

        if (!response.ok) { // Si la respuesta no es 2xx
            throw new Error(data.message || 'Error desconocido al validar correo con FaucetPay.');
        }

        // Si la validación es exitosa en el backend, ahora guardamos el correo en Firebase (cliente)
        // Podrías tener esta lógica en el backend también si quieres ser aún más estricto
        // y que el backend haga el update a Firebase después de validar.
        // Por simplicidad, por ahora el frontend hace el update una vez que el backend valida.
        const userRef = ref(dbInstance, `users/${currentUser.uid}`);
        await update(userRef, { faucetPayEmail: email });


        showNotification("Correo de FaucetPay guardado exitosamente.", "success");
        if (emailInput) emailInput.value = ''; // Limpiar input
        if (emailStatusMessage) {
            emailStatusMessage.textContent = "Correo de FaucetPay guardado.";
            emailStatusMessage.classList.remove('hidden', 'text-red-400');
            emailStatusMessage.classList.add('text-green-400');
        }
        loadWithdrawalData(); // Recargar datos para actualizar la UI

    } catch (error) {
        console.error("Error al guardar correo de FaucetPay:", error);
        showNotification(`Error: ${error.message}`, "error");
    } finally {
        hideLoadingModal();
    }
}

/**
 * Valida el formato básico de un correo electrónico.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

/**
 * Maneja la solicitud de retiro.
 * Ahora se comunica con el backend para procesar el retiro.
 */
async function handleWithdrawalRequest() {
    const currentUser = authInstance.currentUser;
    if (!currentUser) {
        showNotification("Debes iniciar sesión para solicitar un retiro.", "error");
        return;
    }

    const selectedAmountLitoshis = parseInt(withdrawalAmountSelect.value, 10);
    if (isNaN(selectedAmountLitoshis) || selectedAmountLitoshis <= 0) {
        showNotification("Por favor, selecciona un monto de retiro válido.", "warning");
        return;
    }

    const faucetPayEmail = displayEmail.textContent;

    if (!faucetPayEmail || faucetPayEmail === "no configurado") {
        showNotification("Por favor, configura tu correo electrónico de FaucetPay antes de retirar.", "error");
        return;
    }

    showLoadingModal("Procesando retiro...");

    try {
        const user = authInstance.currentUser;
        const idToken = await currentUser.getIdToken();

        const response = await fetch(`${BACKEND_URL}/api/request-faucetpay-withdrawal`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                userId: currentUser.uid,
                email: faucetPayEmail,
                amount: (selectedAmountLitoshis / LTC_TO_LITOSHIS_FACTOR)
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error desconocido al procesar el retiro.');
        }

        // --- All good! Withdrawal successful. ---
        await logUserActivity(user.uid, 'withdrawal', selectedAmountLitoshis, `Solicitud de retiro con éxito.`);

        showNotification(`Solicitud de retiro de ${(selectedAmountLitoshis / LTC_TO_LITOSHIS_FACTOR).toFixed(8)} LTC enviada con éxito.`, "success", 7000);
        loadWithdrawalData(); // Recargar datos para actualizar balance en UI

        // --- NEW: Load and show an Interstitial Ad ---
        console.log("[JS] Retiro exitoso. Intentando mostrar anuncio intersticial.");
        if (typeof UnityAdsBridge !== 'undefined' && UnityAdsBridge.showInterstitialAd) {
            UnityAdsBridge.showInterstitialAd();
        } else {
            console.warn("[JS] UnityAdsBridge.loadInterstitialAd o showInterstitialAd no están disponibles. El anuncio no se mostrará.");
        }

    } catch (error) {
        console.error("Error al procesar retiro:", error);
        showNotification(`Error al procesar retiro: ${error.message}`, "error");
    } finally {
        hideLoadingModal();
    }
}