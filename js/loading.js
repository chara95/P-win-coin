// js/loading.js

/**
 * Muestra la pantalla de carga.
 */
export function showLoadingScreen() {
    const loadingScreen = document.getElementById('loadingOverlay'); // Usa el ID de tu overlay
    if (loadingScreen) {
        loadingScreen.classList.remove('hidden'); // Solo 'hidden' si no usa hidden-completely
        loadingScreen.classList.remove('hidden-completely'); // Asegúrate de quitar ambas si usas alguna
        loadingScreen.style.display = 'flex'; // Asegúrate de que esté visible para la transición
    }
}

/**
 * Oculta la pantalla de carga.
 */
export function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingOverlay'); // Usa el ID de tu overlay
    if (loadingScreen) {
        loadingScreen.classList.add('hidden'); // Oculta con 'hidden'
        loadingScreen.classList.add('hidden-completely'); // Y la ocultación total para Tailwind

        // Espera a que la transición de opacidad termine antes de ocultar completamente con display: none
        loadingScreen.addEventListener('transitionend', function handler() {
            if (loadingScreen.classList.contains('hidden') || loadingScreen.classList.contains('hidden-completely')) {
                loadingScreen.style.display = 'none';
            }
            loadingScreen.removeEventListener('transitionend', handler);
        }, { once: true });
    }
}