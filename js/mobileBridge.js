// js/mobileBridge.js

// Asegúrate de que este objeto UnityAdsBridge esté definido en tu JS global
// Si ya lo tenías para onAdLoaded, onAdShowComplete, etc., solo añade los métodos de llamada.
if (typeof window.UnityAdsBridge === 'undefined') {
    window.UnityAdsBridge = {}; // Inicializar si no existe
}

// Métodos para llamar desde tu HTML/JS a la lógica nativa
function requestInterstitialAd() {
    if (window.AndroidBridge && window.AndroidBridge.showToast) {
        window.AndroidBridge.showToast("Solicitando anuncio intersticial...");
    }
    if (window.UnityAdsBridge && window.UnityAdsBridge.loadInterstitialAd) {
        window.UnityAdsBridge.loadInterstitialAd();
    } else {
        console.error("UnityAdsBridge o loadInterstitialAd no disponible.");
    }
}

function displayInterstitialAd() {
    if (window.UnityAdsBridge && window.UnityAdsBridge.showInterstitialAd) {
        // Opcional: Verificar si el anuncio está listo antes de intentar mostrarlo
        if (window.UnityAdsBridge.isAdReady("Interstitial_Android")) { // Usa tu Placement ID
            window.UnityAdsBridge.showInterstitialAd();
        } else {
            console.warn("Anuncio intersticial no está listo aún.");
            if (window.AndroidBridge && window.AndroidBridge.showToast) {
                window.AndroidBridge.showToast("Anuncio intersticial no listo, intenta cargarlo primero.");
            }
        }
    } else {
        console.error("UnityAdsBridge o showInterstitialAd no disponible.");
    }
}

// Métodos de callback desde nativo a JS
// Estos serán llamados por MainActivity.java cuando un anuncio se cargue o se complete/falle
window.UnityAdsBridge.onAdLoaded = function(placementId) {
    console.log("JS Callback: Ad cargado para Placement ID: " + placementId);
    // Aquí puedes actualizar tu UI web (ej. habilitar un botón "Ver Anuncio")
    if (placementId === "Interstitial_Android") {
        // Acciones específicas para intersticial cargado
        // Por ejemplo, mostrarlo automáticamente después de un tiempo o al pasar de nivel
        // setTimeout(displayInterstitialAd, 1000); // Muestra el anuncio 1 segundo después de cargado
    }
};

window.UnityAdsBridge.onAdLoadFailed = function(placementId, message) {
    console.error("JS Callback: Fallo al cargar ad para Placement ID: " + placementId + ", Mensaje: " + message);
    if (window.AndroidBridge && window.AndroidBridge.showToast) {
        window.AndroidBridge.showToast("Fallo al cargar anuncio: " + message);
    }
};

window.UnityAdsBridge.onAdShowComplete = function(placementId, state) {
    console.log("JS Callback: Ad mostrado completamente para Placement ID: " + placementId + ", Estado: " + state);
    if (window.AndroidBridge && window.AndroidBridge.showToast) {
        window.AndroidBridge.showToast("Anuncio finalizado: " + placementId + " Estado: " + state);
    }
    // Lógica para recompensar al usuario o continuar el juego
};

window.UnityAdsBridge.onAdShowFailed = function(placementId, message) {
    console.error("JS Callback: Fallo al mostrar ad para Placement ID: " + placementId + ", Mensaje: " + message);
    if (window.AndroidBridge && window.AndroidBridge.showToast) {
        window.AndroidBridge.showToast("Fallo al mostrar anuncio: " + message);
    }
};

