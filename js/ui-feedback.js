// js/ui-feedback.js

// --- Sistema de Notificaciones/Alertas ---

let notificationContainer; // Se inicializará en DOMContentLoaded
let loadingModal;          // Se inicializará en DOMContentLoaded
let loadingMessage;        // Se inicializará en DOMContentLoaded

document.addEventListener('DOMContentLoaded', () => {
    // Inicialización del contenedor de notificaciones
    notificationContainer = document.getElementById('notificationContainer');
    if (!notificationContainer) {
        console.error('El contenedor de notificaciones #notificationContainer no fue encontrado en el DOM.');
        // Puedes considerar crear el elemento si no existe en el HTML:
        // notificationContainer = document.createElement('div');
        // notificationContainer.id = 'notificationContainer';
        // notificationContainer.className = 'fixed top-4 right-4 z-50 flex flex-col space-y-2';
        // document.body.appendChild(notificationContainer);
    }

    // Inicialización del modal de carga
    loadingModal = document.getElementById('loadingModal');
    loadingMessage = document.getElementById('loadingMessage');

    if (!loadingModal || !loadingMessage) {
        console.warn("Elementos del modal de carga (#loadingModal o #loadingMessage) no encontrados en el DOM. El modal no se mostrará correctamente.");
    }
});


/**
 * Muestra una notificación temporal.
 * @param {string} message El mensaje a mostrar.
 * @param {'success'|'error'|'info'|'warning'} type El tipo de notificación (define el color).
 * @param {number} [duration=3000] La duración en milisegundos antes de que desaparezca.
 */
export function showNotification(message, type = 'info', duration = 3000) {
    if (!notificationContainer) {
        console.error('El contenedor de notificaciones #notificationContainer no fue encontrado en el DOM al llamar showNotification.');
        return;
    }

    const notificationDiv = document.createElement('div');
    notificationDiv.className = `
        px-4 py-3 rounded-lg shadow-md text-white font-medium
        transform -translate-y-full transition-all ease-out duration-300 opacity-0
        flex items-center justify-center space-x-2
    `;

    let bgColorClass = '';
    let iconSvg = '';
    switch (type) {
        case 'success':
            bgColorClass = 'bg-green-500';
            iconSvg = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>`;
            break;
        case 'error':
            bgColorClass = 'bg-red-600';
            iconSvg = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>`;
            break;
        case 'warning':
            bgColorClass = 'bg-yellow-500';
            iconSvg = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.3 2.647-1.3 3.412 0l7.252 12.449c.764 1.3-1.149 2.94-2.64 2.94H3.645c-1.491 0-3.404-1.64-2.64-2.94L8.257 3.099zM10 11a1 1 0 100-2 1 1 0 000 2zm-1 4a1 1 0 102 0 1 1 0 00-2 0z" clip-rule="evenodd"></path></svg>`;
            break;
        default: // info
            bgColorClass = 'bg-blue-500';
            iconSvg = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>`;
            break;
    }

    notificationDiv.classList.add(bgColorClass);
    notificationDiv.innerHTML = `${iconSvg}<span>${message}</span>`;

    notificationContainer.prepend(notificationDiv);

    void notificationDiv.offsetWidth; // Trigger reflow

    // Aplica la transición para que aparezca
    notificationDiv.style.transform = 'translateY(0)';
    notificationDiv.style.opacity = '1';

    const removeNotification = () => {
        // Aplica la transición para que desaparezca
        notificationDiv.style.transform = 'translateY(-100%)';
        notificationDiv.style.opacity = '0';
        notificationDiv.addEventListener('transitionend', () => {
            notificationDiv.remove();
        }, { once: true });
    };

    setTimeout(removeNotification, duration);
}

// --- Sistema de Modal de Carga ---

/**
 * Muestra el modal de carga con un mensaje específico.
 * Se asume que el HTML para el modal de carga ya está en el DOM con los IDs correctos.
 * @param {string} message El mensaje a mostrar en el modal (ej. "Procesando retiro...").
 */
export function showLoadingModal(message = "Cargando...") {
    if (loadingModal && loadingMessage) {
        loadingMessage.textContent = message;
        loadingModal.classList.remove('hidden-completely');
        loadingModal.classList.add('flex');
    } else {
        console.warn('Elementos del modal de carga (#loadingModal o #loadingMessage) no encontrados en el DOM. El modal no se mostrará.');
    }
}






/**
 * Oculta el modal de carga.
 * Se asume que el HTML para el modal de carga ya está en el DOM con los IDs correctos.
 */



export function hideLoadingModal() {
    if (loadingModal) {
        // Usa 'hidden-completely' para ocultar display: none
        loadingModal.classList.add('hidden-completely');
        // Remueve 'flex'
        loadingModal.classList.remove('flex');
    }
}




/**
 * Formatea una cantidad de Litoshis a un string de LTC.
 * @param {number} litoshisAmount La cantidad en Litoshis (entero).
 * @param {number} displayDecimals El número de decimales a mostrar.
 * @returns {string} La cantidad formateada con el sufijo " LTC".
 */
export function formatLTC(litoshisAmount, displayDecimals = 8) {
    if (typeof litoshisAmount !== 'number' || isNaN(litoshisAmount)) {
        return '0.00000000 LTC';
    }
    const ltcValue = litoshisAmount / 100000000;
    return ltcValue.toFixed(displayDecimals) + ' LTC';
}

/**
 * Actualiza el elemento en el DOM que muestra el balance del usuario.
 * Busca un elemento con `id="userBalance"`.
 * @param {number} litoshisBalance - El balance actual del usuario en Litoshis (entero).
 */
export function updateBalanceDisplay(litoshisBalance) {
    const balanceElement = document.getElementById('userBalance'); // <-- Asegúrate que tu HTML tiene este ID
    if (balanceElement) {
        balanceElement.textContent = formatLTC(litoshisBalance);
        console.log("Balance de UI actualizado a:", formatLTC(litoshisBalance));
    } else {
        console.warn("Elemento con ID 'userBalance' no encontrado en el DOM para actualizar el balance. Asegúrate de que tu HTML tenga <span id=\"userBalance\">...</span> en la pantalla principal.");
    }
}