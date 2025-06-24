// js/mobileBridge.js

import { showNotification, hideLoadingModal } from './ui-feedback.js';
import { grantFaucetRewardAfterAd } from './faucetScreen.js'; // Función para la recompensa del Faucet
import { grantDailyRewardAfterAd } from './home-screen.js';   // Función para la recompensa diaria del Home Screen
import { continueGameAfterInterstitial } from './game.js';    // Función para continuar el juego de memoria

// Banderas y variables de contexto globales
window.isShowingGameInterstitial = false; // Para el contexto del anuncio intersticial del juego
window.currentRewardAdContext = null;    // Para el contexto del anuncio recompensado (e.g., 'faucet', 'daily_reward')
window.isShowingWithdrawalInterstitial = false;

// === UNIFICACIÓN DE window.AndroidBridge ===
// Este objeto es el puente principal para que el código Java de Android llame a funciones JavaScript.
window.AndroidBridge = {
    // --- Funciones para Google Sign-In (existentes) ---
    showToast: function (message) {
        console.log(`[JS] Toast solicitado: ${message}`);
        // Implementación real para Android si es necesario, o un fallback JS
        if (typeof Android !== 'undefined' && Android.showToast) {
            Android.showToast(message);
        } else {
            console.warn("[JS] Android.showToast no está disponible. Mostrando notificación JS.");
            showNotification(message, "info");
        }
    },
    startGoogleSignIn: function () {
        console.log("[JS] Solicitando Google Sign-In a Android.");
        if (typeof Android !== 'undefined' && Android.startGoogleSignIn) {
            Android.startGoogleSignIn();
        } else {
            console.error("[JS] Android.startGoogleSignIn no está disponible.");
            showNotification("Error: No se pudo iniciar sesión con Google. Servicio no disponible.", "error");
        }
    },
    onGoogleSignInSuccess: function (uid) {
        console.log(`[JS] Google Sign-In exitoso. UID: ${uid}`);
        // Aquí podrías tener una función global en tu app para manejar el inicio de sesión
        if (typeof onGoogleSignInSuccessGlobal === 'function') {
            onGoogleSignInSuccessGlobal(uid);
        } else {
            console.warn("[JS] onGoogleSignInSuccessGlobal no está definida.");
        }
    },
    onGoogleSignInFailure: function (errorMessage) {
        console.error(`[JS] Google Sign-In fallido. Mensaje: ${errorMessage}`);
        // Aquí podrías tener una función global para manejar fallos de inicio de sesión
        if (typeof onGoogleSignInFailureGlobal === 'function') {
            onGoogleSignInFailureGlobal(errorMessage);
        } else {
            console.warn("[JS] onGoogleSignInFailureGlobal no está definida.");
            showNotification(`Error de Google Sign-In: ${errorMessage}`, "error");
        }
    },
    shareApp: function (textToShare) {
        console.log(`[JS] Solicitando compartir app a Android con texto: ${textToShare}`);
        if (typeof window.AndroidBridge !== 'undefined' && window.AndroidBridge.shareApp) {
            AndroidBridge.shareApp(textToShare);
        } else {
            console.warn("[JS] window.AndroidBridge.shareApp no está disponible.");
            showNotification("Función de compartir no disponible.", "info");
        }
    },

    // --- RECOMPENSA DE ANUNCIOS (Faucet/Daily Reward/etc.) ---
    // Esta es la función que MainActivity.java llama cuando un anuncio recompensado se COMPLETA.
    rewardUser: async function () {
        console.log("[JS] Recibida notificación de Android: ¡Usuario recompensado!");

        // Usar la variable de contexto para determinar qué recompensa otorgar
        switch (window.currentRewardAdContext) {
            case 'faucet':
                console.log("[JS] Otorgando recompensa del Faucet.");
                if (typeof grantFaucetRewardAfterAd === 'function') {
                    await grantFaucetRewardAfterAd();
                } else {
                    console.error("[JS] 'grantFaucetRewardAfterAd' no está definida o accesible.");
                    showNotification("Error interno al otorgar recompensa del Faucet.", "error");
                    hideLoadingModal();
                }
                break;
            case 'daily_reward':
                console.log("[JS] Otorgando recompensa diaria del Home Screen.");
                if (typeof grantDailyRewardAfterAd === 'function') {
                    await grantDailyRewardAfterAd();
                } else {
                    console.error("[JS] 'grantDailyRewardAfterAd' no está definida o accesible.");
                    showNotification("Error interno al otorgar recompensa diaria.", "error");
                    hideLoadingModal();
                }
                break;
            default:
                console.log("[JS] rewardUser llamado sin un contexto de recompensa específico. Manejando genéricamente.");
                showNotification("¡Has recibido una recompensa genérica!", "success");
                hideLoadingModal();
                break;
        }
        // IMPORTANTE: Resetear el contexto después de haberlo manejado
        window.currentRewardAdContext = null;
    },

    // --- ANUNCIO INTERSTICIAL (Juego de Memoria) ---
    // Esta es la función que MainActivity.java llama cuando un anuncio intersticial se cierra.
    interstitialAdClosed: function () {
        console.log("[JS] AndroidBridge.interstitialAdClosed() llamado desde Android.");

        if (window.isShowingGameInterstitial) {
            window.isShowingGameInterstitial = false;
            console.log("[JS] Intersticial de juego cerrado. Llamando a continuar juego...");
            if (typeof continueGameAfterInterstitial === 'function') {
                continueGameAfterInterstitial();
            } else {
                console.error("[JS] 'continueGameAfterInterstitial' no está definida.");
                hideLoadingModal();
                showNotification("Error interno al continuar juego.", "error");
            }
        } else if (window.isShowingWithdrawalInterstitial) {
            window.isShowingWithdrawalInterstitial = false; // Resetear la bandera
            console.log("[JS] Intersticial de retiro cerrado. Mostrando notificación de éxito y recargando datos.");

            if (window.lastWithdrawalMessage) {
                showNotification(window.lastWithdrawalMessage, "success", 7000); // Muestra el mensaje guardado
                window.lastWithdrawalMessage = null; // Limpiar mensaje temporal
            } else {
                showNotification("¡Retiro solicitado con éxito!", "success"); // Mensaje de fallback
            }

            // ¡¡¡AQUÍ ES DONDE DEBES LLAMAR A loadWithdrawalData()!!!
            if (typeof loadWithdrawalData === 'function') {
                loadWithdrawalData(); // <-- ¡Llamar para refrescar el balance y UI!
            } else {
                console.error("[JS] 'loadWithdrawalData' no está definida o accesible en mobileBridge.");
                // Considera cómo manejar esto si no está globalmente accesible.
                // Puede que necesites importarla en mobileBridge.js o asegurarte de que se exponga al window.
            }

            hideLoadingModal(); // Asegura que cualquier modal de carga se oculte
        } else {
            console.log("[JS] Intersticial cerrado sin contexto específico. Ocultando modal.");
            hideLoadingModal();
        }
    }
};

// === UNITY ADS CALLBACKS (Llamados desde Android a JS) ===
// Estos callbacks son generalmente llamados por Android para notificar el estado de los anuncios de Unity Ads.
window.UnityAdsBridge = window.UnityAdsBridge || {}; // Asegurarse de que el objeto existe

window.UnityAdsBridge.onAdLoaded = function (placementId) {
    console.log(`[JS] Unity Ad cargado: ${placementId}`);
    // No ocultar el modal aquí si es un ad que aún se va a mostrar manualmente.
    // El modal se oculta cuando el ad empieza a mostrarse (onAdShowStart) o falla.
    if (typeof showNotification === 'function') {
        showNotification(`Anuncio listo: ${placementId}`, "info");
    }
};

// Llamada cuando no se pudo cargar el anuncio
window.UnityAdsBridge.onAdLoadFailed = function (placementId, message) {
    console.error(`[JS] Unity Ad falló al cargar: ${placementId}, Mensaje: ${message}`);

    // Resetear el contexto de recompensa si era un rewarded ad
    if (placementId && placementId.includes('Rewarded')) { // Asumiendo tus placement IDs de recompensados incluyen 'Rewarded'
        window.currentRewardAdContext = null;
    }

    // Resetear bandera de intersticial de juego si era un interstitial ad
    if (window.isShowingGameInterstitial) {
        window.isShowingGameInterstitial = false;
        // Si falló el intersticial del juego, el juego debe continuar
        if (typeof continueGameAfterInterstitial === 'function') {
            console.log("[JS] Intersticial de juego no cargó, continuando juego.");
            continueGameAfterInterstitial();
        }
    }
    hideLoadingModal();
    showNotification(`No se pudo cargar el anuncio (${placementId}). Intenta de nuevo.`, "error");
};

// Llamada si el anuncio falla y no se pudo mostrar
window.UnityAdsBridge.onAdShowFailed = function (placementId, message) {
    console.error(`[JS] Unity Ad falló al mostrar: ${placementId}, Mensaje: ${message}`);

    // Resetear el contexto de recompensa si era un rewarded ad
    if (placementId && placementId.includes('Rewarded')) { // Asumiendo tus placement IDs de recompensados incluyen 'Rewarded'
        window.currentRewardAdContext = null;
    }

    // Resetear bandera de intersticial de juego si era un interstitial ad
    if (window.isShowingGameInterstitial) {
        window.isShowingGameInterstitial = false;
        // Si falló el intersticial del juego, el juego debe continuar
        if (typeof continueGameAfterInterstitial === 'function') {
            console.log("[JS] Intersticial de juego no se mostró, continuando juego.");
            continueGameAfterInterstitial();
        }
    }
    hideLoadingModal();
    showNotification(`No se pudo mostrar el anuncio (${placementId}). Intenta de nuevo.`, "error");
};

// Llamada cuando un anuncio se empieza a mostrar
window.UnityAdsBridge.onAdShowStart = function (placementId) {
    console.log(`[JS] Unity Ad comenzó a mostrarse: ${placementId}`);
    // Ocultar el modal de carga una vez que el anuncio comienza a mostrarse
    hideLoadingModal();
};

// Llamada cuando se hizo clic en un anuncio
window.UnityAdsBridge.onAdShowClick = function (placementId) {
    console.log(`[JS] Unity Ad clickeado: ${placementId}`);
    // No hay acción específica aquí usualmente, solo log.
};

// Llamada del .JAVA cuando se completó un anuncio (Interesticial o Recompensado)
// Esta es una notificación general de Unity Ads. La lógica de recompensa/continuación del juego
// se maneja en AndroidBridge.rewardUser y AndroidBridge.interstitialAdClosed,
// que son llamadas CONDICIONALMENTE desde Java.
window.UnityAdsBridge.onAdShowComplete = function (placementId, state) {
    console.log(`[JS] Unity Ad completado (general callback): ${placementId}, Estado: ${state}`);
    // Aquí no se otorga la recompensa directamente, solo se registra.
    // La recompensa se otorga cuando Android llama a AndroidBridge.rewardUser().
    // La continuación del juego se maneja cuando Android llama a AndroidBridge.interstitialAdClosed().

    // Como fallback o para asegurar, si hay un modal de carga activo aquí y no se maneja
    // por las funciones de AndroidBridge, ocúltalo.
    hideLoadingModal();
};

// === FUNCIONES PARA LLAMAR A ANDROID DESDE JS (Unity Ads) ===
// Estas funciones son llamadas desde tu código JS (e.g., faucetScreen, game, home-screen)
// para solicitar a Android que realice una acción con Unity Ads.

// Llamada para cargar el anuncio Intersticial
window.UnityAdsBridge.loadInterstitialAd = function () {
    if (typeof Android !== 'undefined' && Android.loadInterstitialAd) {
        Android.loadInterstitialAd();
        console.log("[JS] Solicitando cargar anuncio intersticial via Android.");
    } else {
        console.warn("[JS] Android.loadInterstitialAd no está disponible.");
        showNotification("Error: No se pudo cargar el servicio de anuncios. Revisa la conexión.", "error");
    }
};

// Llamada para mostrar anuncio Intersticial
window.UnityAdsBridge.showInterstitialAd = function () {
    if (typeof Android !== 'undefined' && Android.showInterstitialAd) {
        Android.showInterstitialAd();
        console.log("[JS] Solicitando mostrar anuncio intersticial via Android.");
    } else {
        console.warn("[JS] Android.showInterstitialAd no está disponible.");
        showNotification("No se pudo mostrar el anuncio. Revisa la conexión.", "error");
        // Si el ad intersticial no se muestra (por fallback JS), continuar el juego directamente
        if (window.isShowingGameInterstitial && typeof continueGameAfterInterstitial === 'function') {
            console.log("[JS] Ad intersticial no disponible, continuando el juego sin ad.");
            continueGameAfterInterstitial(); // Asegurarse de que el juego no se quede bloqueado
        }
    }
};

// Llamada para mostrar anuncio recompensado
window.UnityAdsBridge.showRewardedAd = function () {
    if (typeof Android !== 'undefined' && Android.showRewardedAd) {
        Android.showRewardedAd();
        console.log("[JS] Solicitando mostrar anuncio recompensado via Android.");
    } else {
        console.warn("[JS] Android.showRewardedAd no está disponible.");
        showNotification("No se pudo mostrar el anuncio de recompensa. Revisa la conexión.", "error");
        // Si el ad recompensado no se muestra (por fallback JS), resetear el contexto
        if (window.currentRewardAdContext !== null) {
            window.currentRewardAdContext = null; // Resetear para que no se quede esperando una recompensa
            hideLoadingModal(); // Asegurarse de ocultar el modal
        }
    }
};