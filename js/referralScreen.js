// js/referralScreen.js
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get, set, update, query, orderByChild, equalTo, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { showNotification, showLoadingModal, hideLoadingModal } from './ui-feedback.js';
import { logUserActivity } from './utils/activityLogger.js'; // Importa el logger de actividad


const auth = getAuth();
let authInstance;
let dbInstance;

// === CONSTANTES DE RECOMPENSA (AJUSTA ESTOS VALORES SEGÚN TU PREFERENCIA) ===
const REFERRAL_REWARD_REFEREE = 200;  // Recompensa para el usuario que aplica el código
const REFERRAL_REWARD_REFERRER = 200; // Recompensa para el usuario que fue referido (el dueño del código)

// Elementos del DOM para la pantalla de referidos
let userReferralCodeDisplay;     // Input para mostrar el código del usuario
let copyReferralLinkBtn;         // Botón para copiar el enlace
let shareReferralLinkBtn;        // Botón para compartir
let applyReferralCodeInput;      // Input para aplicar un código
let applyReferralCodeBtn;        // Botón para aplicar el código
let referralAppliedStatusText;   // Nuevo: Para el mensaje "Ya has aplicado un código de referido."
let referredUsersList;           // Nuevo: Lista de usuarios referidos (cambiado de referralList para mayor claridad)
let referralMessageDisplay;      // Para mensajes generales (reemplaza referralStatusMessage)
const BACKEND_URL = 'https://my-faucet-backend-3.onrender.com';
/**
 * Inicializa la lógica para la pantalla de referidos.
 * @param {object} firebaseAuth La instancia de Firebase Auth.
 * @param {object} firebaseDb La instancia de Firebase Database.
 */
export function initializeReferralsScreen(firebaseAuth, firebaseDb) {
    authInstance = firebaseAuth;
    dbInstance = firebaseDb;
    console.log("Referrals screen initialized.");

    // Asocia los elementos del DOM (¡asegúrate de que los IDs coincidan con tu HTML!)
    userReferralCodeDisplay = document.getElementById('userReferralCodeDisplay');
    copyReferralLinkBtn = document.getElementById('copyReferralLinkBtn');
    shareReferralLinkBtn = document.getElementById('shareReferralLinkBtn');
    applyReferralCodeInput = document.getElementById('applyReferralCodeInput');
    applyReferralCodeBtn = document.getElementById('applyReferralCodeBtn');
    referralAppliedStatusText = document.getElementById('referralAppliedStatusText'); // Nuevo ID
    referredUsersList = document.getElementById('referredUsersList'); // Nuevo ID
    referralMessageDisplay = document.getElementById('referralMessageDisplay'); // Nuevo ID para mensajes generales

    // Consola para depuración: verifica si los elementos se encuentran
    console.log("Elementos DOM Referidos:", {
        userReferralCodeDisplay,
        copyReferralLinkBtn,
        shareReferralLinkBtn,
        applyReferralCodeInput,
        referralAppliedStatusText,
        applyReferralCodeBtn,
        referredUsersList,
        referralMessageDisplay
    });

    // Añade event listeners (prevenir duplicados es buena práctica)
    if (copyReferralLinkBtn) {
        copyReferralLinkBtn.removeEventListener('click', handleCopyReferralLink);
        copyReferralLinkBtn.addEventListener('click', handleCopyReferralLink);
    }
    if (shareReferralLinkBtn) {
        shareReferralLinkBtn.removeEventListener('click', handleShareReferralLink);
        shareReferralLinkBtn.addEventListener('click', handleShareReferralLink);
    }
    if (applyReferralCodeBtn) {
        applyReferralCodeBtn.removeEventListener('click', handleApplyReferralCode);
        applyReferralCodeBtn.addEventListener('click', handleApplyReferralCode);
    }

    // Carga y muestra el código de referido del usuario y sus referidos
    loadReferralData();
}

/**
 * Carga y muestra el código de referido del usuario actual
 * y la lista de usuarios que ha referido.
 */
async function loadReferralData() {
    if (!authInstance.currentUser) {
        console.warn("No user logged in for referral data.");
        if (userReferralCodeDisplay) userReferralCodeDisplay.value = "N/A";
        if (referredUsersList) referredUsersList.innerHTML = '<li class="text-gray-400">Inicia sesión para ver tus referidos.</li>';
        updateApplyReferralUI(false); // Asegura que el campo esté habilitado si no hay usuario
        return;
    }

    const userId = authInstance.currentUser.uid;
    const userRef = ref(dbInstance, `users/${userId}`);

    try {
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
            const userData = snapshot.val();

            // Actualizar el código de referido del usuario en la UI
            if (userReferralCodeDisplay) {
                userReferralCodeDisplay.value = userData.referralCode || "Generando...";
            }

            // Si el usuario ya aplicó un código, deshabilita el campo
            if (userData && userData.referredBy) {
                updateApplyReferralUI(true);
            } else {
                updateApplyReferralUI(false);
            }

            // Cargar y mostrar referidos solo si el usuario tiene un código (es un referente)
            if (userData && userData.referralCode) {
                displayReferrals(userData.referralCode);
            } else {
                // Si el usuario aún no tiene código de referido, generar uno y guardarlo
                await generateAndSaveReferralCode(userId);
            }

        } else {
            if (userReferralCodeDisplay) userReferralCodeDisplay.value = "Error";
            if (referredUsersList) referredUsersList.innerHTML = '<li class="text-ltc-error">Datos de usuario no encontrados.</li>';
            updateApplyReferralUI(false); // Por si hay un error, mantener habilitado
            showNotification("Error al cargar datos de usuario de referidos.", "error");
        }
    } catch (error) {
        console.error("Error loading referral data:", error);
        showNotification("Error al cargar datos de referidos.", "error");
    }
}

/**
 * Muestra los usuarios referidos por el usuario actual.
 * @param {string} referrerCode El código de referido del usuario actual.
 */
async function displayReferrals() { // Ya no necesita referrerCode como parámetro
    if (!authInstance.currentUser || !referredUsersList) return;

    const userId = authInstance.currentUser.uid;
    const userReferralsRef = ref(dbInstance, `users/${userId}/referrals`); // <-- Nueva ruta

    referredUsersList.innerHTML = '<li class="text-gray-400">Cargando referidos...</li>';

    try {
        const snapshot = await get(userReferralsRef); // <-- Lectura directa
        let foundReferrals = false;

        if (snapshot.exists()) {
            referredUsersList.innerHTML = '';
            snapshot.forEach(childSnapshot => {
                const referredUserId = childSnapshot.key; // El UID del referido
                // Opcional: Si necesitas más datos del referido (displayName, etc.)
                // tendrías que hacer una lectura adicional a users/${referredUserId}
                // o guardar más datos directamente en el nodo 'referrals'

                const li = document.createElement('li');
                li.className = 'text-sm text-gray-200 bg-gray-700 p-2 rounded-md mb-1 flex items-center justify-between';
                li.innerHTML = `
                    <div class="flex items-center">
                        <span class="mr-2">👤</span>
                        <span class="font-medium">${referredUserId.substring(0, 6)}...</span>
                    </div>
                    <span class="text-xs text-gray-400">ID: ${referredUserId.substring(0, 6)}...</span>
                `;
                // Si quieres mostrar el referralCode del referido, lo leerías de su perfil
                // li.innerHTML = `<span>${referredUser.referralCode || 'Desconocido'}</span>`;

                referredUsersList.appendChild(li);
                foundReferrals = true;
            });
        }

        if (!foundReferrals) {
            referredUsersList.innerHTML = '<li class="text-gray-400">Aún no tienes referidos. ¡Comparte tu código!</li>';
        }

    } catch (error) {
        console.error("Error fetching referred users:", error);
        referredUsersList.innerHTML = '<li class="text-ltc-error">Error al cargar referidos.</li>';
        showNotification("Error al cargar referidos.", "error");
    }
}

// Función para aplicar el código de referido
async function handleApplyReferralCode() {
    const applyReferralCodeInput = document.getElementById('applyReferralCodeInput');
    const referralCodeToApply = applyReferralCodeInput.value.trim().toUpperCase();
    const referralAppliedStatusText = document.getElementById('referralAppliedStatusText');

    if (!referralCodeToApply) {
        showNotification("Por favor, introduce un código de referido.", "warning");
        return;
    }

    if (!auth.currentUser) {
        showNotification("Debes iniciar sesión para aplicar un código de referido.", "error");
        return;
    }

    const userId = auth.currentUser.uid;
    const idToken = await auth.currentUser.getIdToken(); // Obtener el ID Token para autenticar la llamada al backend
    showLoadingModal("Procesando Codigo de referido...");

    try {
        // PUNTOS CLAVE PARA EL CAMBIO:
        // 1. Ya no necesitas hacer la validación local de 'referredBy' aquí, el backend lo hará.
        // 2. Ya no buscas al referidor localmente.
        // 3. Ya no actualizas el balance o el nodo 'referrals' directamente.

        const backendUrl = 'https://my-faucet-backend-3.onrender.com/api/apply-referral-code'; // ¡Asegúrate de que esta URL sea correcta!

        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}` // Envía el token de Firebase para que tu backend lo verifique
            },
            body: JSON.stringify({ referralCode: referralCodeToApply }) // Solo envías el código
        });

        const data = await response.json();

        if (response.ok) { // Si el backend responde con un status 200 (ok)
            showNotification(data.message || "Código de referido aplicado exitosamente!", "success");
            referralAppliedStatusText.textContent = data.message || "¡Código de referido aplicado!";
            referralAppliedStatusText.classList.remove('hidden', 'text-yellow-400', 'text-red-400');
            referralAppliedStatusText.classList.add('text-green-400');

            // Recargar la lista de referidos y el balance después de aplicar uno nuevo
            loadReferralData(); // Si displayReferrals lee del nuevo nodo /users/$uid/referrals
            // Y si tienes una función para actualizar el balance en el UI, llámala también.
            // Por ejemplo, si tienes una función para escuchar cambios en el balance del usuario.

        } else { // Si el backend respondió con un error (400, 404, 500, etc.)
            showNotification(data.message || "Error al aplicar código de referido.", "error");
            referralAppliedStatusText.textContent = data.message || "Error al aplicar código.";
            referralAppliedStatusText.classList.remove('hidden', 'text-green-400', 'text-yellow-400');
            referralAppliedStatusText.classList.add('text-red-400');
        }

    } catch (error) {
        console.error("Error al aplicar código de referido (fetch):", error);
        showNotification("Error de red al aplicar código de referido.", "error");
        referralAppliedStatusText.textContent = "Error de conexión al aplicar código.";
        referralAppliedStatusText.classList.remove('hidden', 'text-green-400', 'text-yellow-400');
        referralAppliedStatusText.classList.add('text-red-400');
    } finally {
        hideLoadingModal();
    }
}

function updateApplyReferralUI(applied) {
    if (applyReferralCodeInput) {
        applyReferralCodeInput.disabled = applied;
        applyReferralCodeInput.value = ""; // Siempre limpia el valor cuando se actualiza el estado
        applyReferralCodeInput.placeholder = applied ? "" : "CÓDIGO DEL REFERENTE";
        // Añade o remueve la clase 'hidden' para el input
        applyReferralCodeInput.classList.toggle('hidden', applied);
    }
    if (applyReferralCodeBtn) {
        applyReferralCodeBtn.disabled = applied;
        applyReferralCodeBtn.textContent = applied ? "Código Aplicado" : "Aplicar Código";
        // Añade o remueve la clase 'hidden' para el botón
        applyReferralCodeBtn.classList.toggle('hidden', applied);
    }
    if (referralAppliedStatusText) {
        // Muestra el mensaje "Ya has aplicado..." solo cuando `applied` es true
        referralAppliedStatusText.classList.toggle('hidden', !applied);
        referralAppliedStatusText.textContent = "Ya has aplicado un código de referido.";
    }

    // Opcional: Si tienes un contenedor padre para el bloque de "Aplicar Código",
    // también podrías ocultar todo el bloque para mayor limpieza.
    // Asumiendo que tienes un div con ID 'applyReferralSection' envolviendo todo:
    // const applyReferralSection = document.getElementById('applyReferralSection');
    // if (applyReferralSection) {
    //     applyReferralSection.classList.toggle('hidden', applied);
    // }
}

/**
 * Función para actualizar la UI del campo de aplicar código
 * @param {boolean} applied Si el código ya fue aplicado por el usuario.
 */


/**
 * Función para generar un código único de 6 caracteres alfanuméricos
 */
async function generateUniqueReferralCode() {
    let code = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const codeLength = 6;
    let isUnique = false;

    while (!isUnique) {
        code = '';
        for (let i = 0; i < codeLength; i++) {
            code += characters.charAt(Math.floor(Math.random() * characters.length));
        }

        const usersRef = ref(dbInstance, 'users');
        const codeQuery = query(usersRef, orderByChild('referralCode'), equalTo(code));
        const snapshot = await get(codeQuery);

        if (!snapshot.exists()) {
            isUnique = true;
        }
    }
    return code;
}

/**
 * Función para generar y guardar el código de referido si el usuario no tiene uno.
 * @param {string} uid El UID del usuario.
 */
async function generateAndSaveReferralCode(uid) {
    try {
        const userRef = ref(dbInstance, `users/${uid}`);
        const code = await generateUniqueReferralCode();
        await update(userRef, { referralCode: code });
        if (userReferralCodeDisplay) {
            userReferralCodeDisplay.value = code;
        }
        console.log(`Código de referido generado y guardado para ${uid}: ${code}`);
        // Después de generar y guardar, refrescar la lista de referidos si aplica
        displayReferrals(code);
    } catch (error) {
        console.error("Error al generar y guardar código de referido:", error);
        showNotification("Error al generar tu código de referido.", "error");
    }
}

/**
 * Maneja el clic en el botón "Copiar Enlace".
 * }
 * 
 * 
 */


async function handleCopyReferralLink() {
    const referralCode = userReferralCodeDisplay.value;
    if (!referralCode || referralCode === "Generando..." || referralCode === "N/A" || referralCode === "Error") {
        showNotification("No hay un código de referido válido para copiar.", "warning");
        return;
    }


    try {
        await navigator.clipboard.writeText(referralCode); // Copia el enlace completo
        showNotification("¡Enlace de referido copiado al portapapeles!", "success");
    } catch (err) {
        console.error('Error al copiar el enlace:', err);
        showNotification("No se pudo copiar el enlace. Intenta manualmente.", "error");
    }
}

/**
 * Maneja el clic en el botón "Compartir".
 */
async function handleShareReferralLink() {
    const referralCode = userReferralCodeDisplay.value; 

    if (!referralCode || referralCode === "Generando..." || referralCode === "N/A" || referralCode === "Error") {
        showNotification("No hay un código de referido válido para compartir.", "warning");
        return;
    }

    const appPlayStoreUrl = "https://play.google.com/store/apps/details?id=com.win_coin.app"; 
    const shareUrl = `${appPlayStoreUrl}`; // Puedes usar shareUrl o appPlayStoreUrl, son lo mismo aquí.

    const shareText = `¡Únete a Win Coin y gana criptomonedas! Usa mi código de referido: ${referralCode} para obtener una recompensa al registrarte. Descárgala aquí: ${shareUrl}`;

    // *** ESTE ES EL CAMBIO CLAVE EN handleShareReferralLink ***
    // Verificamos y llamamos a la función triggerNativeShare que está DENTRO de window.AndroidBridge
    if (typeof window.AndroidBridge !== 'undefined' && typeof window.AndroidBridge.triggerNativeShare === 'function') {
        try {
            window.AndroidBridge.triggerNativeShare(shareText); // <-- ¡LLAMADA CORRECTA A TU PROPIO PUENTE JS!
            console.log('Solicitud de compartir enviada a window.AndroidBridge.triggerNativeShare.');
        } catch (e) {
            console.error('Error al llamar a window.AndroidBridge.triggerNativeShare:', e);
            fallbackToNavigatorShare(shareText, shareUrl); // Fallback si la llamada JS falla inesperadamente
        }
    } else {
        // Este bloque se ejecutará si window.AndroidBridge no existe o no tiene triggerNativeShare
        console.warn('window.AndroidBridge.triggerNativeShare no está disponible. Cayendo a navigator.share o copiar.');
        fallbackToNavigatorShare(shareText, shareUrl); // Fallback si la interfaz no está disponible
    }
}



async function fallbackToNavigatorShare(shareText, shareUrl) {
    // Si la API Web Share (navigator.share) está disponible
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Win Coin App', // Título que se mostrará en el selector de compartir
                text: shareText,      // El mensaje principal
                url: shareUrl         // La URL que se compartirá
            });
            console.log('Contenido compartido con éxito usando Web Share API.');
            showNotification('¡Compartido con éxito!', 'success');
        } catch (error) {
            console.error('Error al compartir con Web Share API:', error);
            // Si el usuario cancela la compartición, esto también es un error
            if (error.name === 'AbortError') {
                showNotification('Compartir cancelado.', 'info');
            } else {
                showNotification('Error al compartir. Inténtalo de nuevo.', 'error');
            }
        }
    } else {
        // Fallback para navegadores que no soportan navigator.share (o si hay un error)
        // Intentar copiar al portapapeles
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(shareText);
                showNotification('Mensaje de referido copiado al portapapeles. ¡Pégalo donde quieras!', 'info');
                console.log('Mensaje copiado al portapapeles:', shareText);
            } catch (err) {
                console.error('No se pudo copiar el texto al portapapeles:', err);
                showNotification('Tu dispositivo no soporta compartir automáticamente o copiar. Copia el mensaje manualmente.', 'warning');
                console.log('Mensaje a compartir (cópialo manualmente):', shareText);
            }
        } else {
            // Último recurso: instruir al usuario a copiar manualmente
            showNotification('Tu dispositivo no soporta compartir automáticamente o copiar. Copia el mensaje manualmente.', 'warning');
            console.log('Mensaje a compartir (cópialo manualmente):', shareText);
        }
    }
}
/**
 * Muestra un mensaje en la pantalla de referidos.
 * Esta función fue renombrada para usar un nuevo elemento de DOM.
 * @param {string} message El mensaje a mostrar.
 * @param {string} type El tipo de mensaje ('error', 'info', 'success', 'warning').
 */
function showReferralMessage(message, type) {
    if (referralMessageDisplay) {
        referralMessageDisplay.textContent = message;
        // Limpiar todas las clases de tipo antes de añadir la nueva
        referralMessageDisplay.classList.remove('hidden', 'text-ltc-error', 'text-ltc-info', 'text-green-400', 'text-red-400', 'text-blue-400', 'text-yellow-400');
        // Usar clases de Tailwind CSS para colores directos, o mantener tus clases 'ltc-color'
        if (type === 'error') {
            referralMessageDisplay.classList.add('text-red-400');
        } else if (type === 'info') {
            referralMessageDisplay.classList.add('text-blue-400');
        } else if (type === 'success') {
            referralMessageDisplay.classList.add('text-green-400'); // Asumiendo green-400 para éxito
        } else if (type === 'warning') {
            referralMessageDisplay.classList.add('text-yellow-400');
        }
        referralMessageDisplay.classList.remove('hidden');
    }
}







