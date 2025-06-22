// js/mobileBridge.js

// Ensure AndroidBridge and UnityAdsBridge exist globally
window.AndroidBridge = window.AndroidBridge || {};
window.UnityAdsBridge = window.UnityAdsBridge || {};

// --- Global flag for daily reward ad context (existing) ---
let isWatchingDailyRewardAd = false;

// --- Existing Unity Ads Callbacks (Rewarded Ads) ---
// These functions will be called by Android via webView.evaluateJavascript
window.UnityAdsBridge.onAdLoaded = function(placementId) {
    console.log(`[JS] Unity Ad cargado: ${placementId}`);
    // This callback is generic for any loaded ad (interstitial or rewarded)
    if (typeof hideLoadingModal === 'function') hideLoadingModal(); // Hide initial loading
    if (typeof showNotification === 'function') showNotification(`Anuncio listo: ${placementId}`, "info");
};

window.UnityAdsBridge.onAdLoadFailed = function(placementId, message) {
    console.error(`[JS] Unity Ad falló al cargar: ${placementId}, Mensaje: ${message}`);
    if (isWatchingDailyRewardAd) {
        isWatchingDailyRewardAd = false; // Reset the flag
        if (typeof hideLoadingModal === 'function') hideLoadingModal();
        if (typeof showNotification === 'function') showNotification(`Error: No se pudo cargar el anuncio de recompensa diaria.`, "error");
    } else {
        // Handle failure for other types of ads (like interstitial)
        if (typeof showNotification === 'function') showNotification(`Error al cargar anuncio (${placementId}): ${message}`, "error");
    }
};

window.UnityAdsBridge.onAdShowFailed = function(placementId, message) {
    console.error(`[JS] Unity Ad falló al mostrar: ${placementId}, Mensaje: ${message}`);
    if (isWatchingDailyRewardAd) {
        isWatchingDailyRewardAd = false; // Reset the flag
        if (typeof hideLoadingModal === 'function') hideLoadingModal();
        if (typeof showNotification === 'function') showNotification(`Error: No se pudo mostrar el anuncio de recompensa diaria.`, "error");
    } else {
        // Handle failure for other types of ads (like interstitial)
        if (typeof showNotification === 'function') showNotification(`Error al mostrar anuncio (${placementId}): ${message}`, "error");
    }
};

window.UnityAdsBridge.onAdShowStart = function(placementId) {
    console.log(`[JS] Unity Ad comenzó a mostrarse: ${placementId}`);
    if (typeof hideLoadingModal === 'function') hideLoadingModal(); // Hide any loading modal
};

window.UnityAdsBridge.onAdShowClick = function(placementId) {
    console.log(`[JS] Unity Ad clickeado: ${placementId}`);
};

// This callback is for any ad type completion
window.UnityAdsBridge.onAdShowComplete = function(placementId, state) {
    console.log(`[JS] Unity Ad completado: ${placementId}, Estado: ${state}`);

    if (placementId === 'Rewarded' && state === 'COMPLETED') {
        // Reward is handled by AndroidBridge.rewardUser()
        console.log("[JS] Anuncio recompensado completado. Esperando callback de recompensa de Android.");
    } else {
        // Handle non-rewarded completion (e.g., interstitial or skipped rewarded)
        if (isWatchingDailyRewardAd) {
            isWatchingDailyRewardAd = false; // Reset flag if rewarded ad was skipped/not completed
            if (typeof hideLoadingModal === 'function') hideLoadingModal();
            if (typeof showNotification === 'function') showNotification("Anuncio de recompensa diaria no completado. No se otorgará la recompensa.", "info");
        } else if (placementId === 'Interstitial') {
            console.log("[JS] Anuncio Intersticial completado.");
            // No specific action needed here for successful interstitial completion, just log.
            // If you had a loading state for interstitial, you'd hide it.
        }
    }
};


// --- NEW: Methods for Interstitial Ads ---
// These functions will be called from JavaScript to Android
window.UnityAdsBridge.loadInterstitialAd = function() {
    if (typeof AndroidBridge !== 'undefined' && AndroidBridge.loadInterstitialAd) {
        AndroidBridge.loadInterstitialAd();
        console.log("[JS] Solicitando cargar anuncio intersticial via AndroidBridge.");
    } else {
        console.warn("[JS] AndroidBridge.loadInterstitialAd no está disponible.");
    }
};

window.UnityAdsBridge.showInterstitialAd = function() {
    if (typeof AndroidBridge !== 'undefined' && AndroidBridge.showInterstitialAd) {
        AndroidBridge.showInterstitialAd();
        console.log("[JS] Solicitando mostrar anuncio intersticial via AndroidBridge.");
    } else {
        console.warn("[JS] AndroidBridge.showInterstitialAd no está disponible.");
    }
};


// --- Existing AndroidBridge methods (JS to Android) ---
window.AndroidBridge.showToast = function(message) { /* ... */ };
window.AndroidBridge.startGoogleSignIn = function() { /* ... */ };
window.AndroidBridge.onGoogleSignInSuccess = function(uid) { /* ... */ };
window.AndroidBridge.onGoogleSignInFailure = function(errorMessage) { /* ... */ };
window.AndroidBridge.shareApp = function(textToShare) { /* ... */ };


// --- MODIFIED: AndroidBridge.rewardUser callback (Existing) ---
// This is the function in JS that MainActivity.java calls when a rewarded ad is *completed*.
window.AndroidBridge.rewardUser = async function() {
    console.log("[JS] Recibida notificación de Android: ¡Usuario recompensado!");

    if (isWatchingDailyRewardAd) {
        isWatchingDailyRewardAd = false; // Reset the flag
        console.log("[JS] Otorgando recompensa diaria tras ver el anuncio.");
        if (typeof grantDailyRewardAfterAd === 'function') {
            await grantDailyRewardAfterAd();
        } else {
            console.error("[JS] 'grantDailyRewardAfterAd' no está definido o accesible en el ámbito global.");
            if (typeof showNotification === 'function') showNotification("Error interno al otorgar recompensa diaria.", "error");
            if (typeof hideLoadingModal === 'function') hideLoadingModal();
        }
    } else {
        console.log("[JS] Recompensa genérica recibida de Android. Manejar según corresponda.");
        if (typeof showNotification === 'function') showNotification("¡Has recibido una recompensa!", "success");
        if (typeof hideLoadingModal === 'function') hideLoadingModal();
    }
};

window.AndroidBridge = {
    // ... otras funciones ...
    rewardUser: function() {
        // Lógica existente para anuncios recompensados
        if (window.grantRewardBasedOnContext && typeof window.grantRewardBasedOnContext === 'function') {
            window.grantRewardBasedOnContext();
        }
    },
    interstitialAdClosed: function() { // <--- ¡NUEVA FUNCIÓN!
        console.log("[JS] AndroidBridge.interstitialAdClosed() llamado desde Android.");
        // Verifica si estábamos esperando un intersticial del juego
        if (window.isShowingGameInterstitial) {
            // Llama a la función en game.js para continuar el juego
            if (typeof continueGameAfterInterstitial === 'function') {
                continueGameAfterInterstitial();
            } else {
                console.error("[JS] continueGameAfterInterstitial no está definida.");
                // Si por alguna razón no está definida, al menos oculta el modal
                hideLoadingModal();
            }
        } else {
            console.log("[JS] Intersticial cerrado sin contexto de juego. Posiblemente un intersticial general.");
            hideLoadingModal(); // Oculta el modal por si acaso.
        }
    }
};
