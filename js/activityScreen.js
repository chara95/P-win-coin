// js/activityScreen.js

import { showNotification, showLoadingModal, hideLoadingModal } from './ui-feedback.js';
import { ref, get, onValue, off, query, orderByChild } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let authInstance;
let dbInstance;
let activityListElement; // Asegúrate de tener un div/ul con este ID en tu HTML
let unsubscribeActivityListener = null;

/**
 * Inicializa la lógica para la pantalla de actividad.
 * @param {object} firebaseAuth La instancia de Firebase Auth.
 * @param {object} firebaseDb La instancia de Firebase Database.
 */
export function initializeActivityScreen(firebaseAuth, firebaseDb) {
    authInstance = firebaseAuth;
    dbInstance = firebaseDb;
    console.log("Activity screen initialized.");

    activityListElement = document.getElementById('activityLogList'); // Asegúrate de que este ID exista en tu HTML

    if (activityListElement) {
        loadUserActivities();
    } else {
        console.warn("Elemento 'activityList' no encontrado en el DOM.");
    }
}

/**
 * Carga y muestra las actividades del usuario desde la base de datos.
 * Utiliza un listener en tiempo real para mantener la lista actualizada.
 */
async function loadUserActivities() {
    const user = authInstance.currentUser;
    if (!user) {
        if (activityListElement) {
            activityListElement.innerHTML = '<li class="text-gray-400">Inicia sesión para ver tu historial de actividades.</li>';
        }
        return;
    }

    if (unsubscribeActivityListener) {
        unsubscribeActivityListener(); // Desuscribe el listener anterior si existe
        unsubscribeActivityListener = null;
    }

    const userActivitiesRef = ref(dbInstance, `users/${user.uid}/activities`);
    // Opcional: ordenar las actividades por timestamp si las guardas con uno
    const activitiesQuery = query(userActivitiesRef, orderByChild('timestamp')); // Asumiendo que guardas un timestamp

   

    showLoadingModal("Cargando actividades...");

    unsubscribeActivityListener = onValue(activitiesQuery, (snapshot) => {
        hideLoadingModal();
        if (activityListElement) {
            activityListElement.innerHTML = ''; // Limpiar lista
            if (snapshot.exists()) {
                const activities = snapshot.val();
                const activityKeys = Object.keys(activities).sort((a, b) => activities[b].timestamp - activities[a].timestamp); // Ordenar por timestamp descendente

                activityKeys.forEach(key => {
                    const activity = activities[key];
                    const li = document.createElement('li');
                    li.className = 'bg-gray-700 p-3 rounded-lg mb-2 shadow-sm flex items-center justify-between text-sm';
                    
                    const date = new Date(activity.timestamp).toLocaleString();
                    let icon = '📜'; // Icono por defecto

                    if (activity.type === 'daily_reward') {
                        icon = '🎁';
                        li.classList.add('border-l-4', 'border-green-400');
                    } else if (activity.type === 'faucet_claim') {
                        icon = '💧';
                        li.classList.add('border-l-4', 'border-blue-400');
                    } else if (activity.type === 'game_win') {
                        icon = '🏆';
                        li.classList.add('border-l-4', 'border-purple-400');
                    } else if (activity.type === 'referral_applied') {
                        icon = '🤝';
                        li.classList.add('border-l-4', 'border-yellow-400');
                    } else if (activity.type === 'withdrawal') {
                        icon = '💸';
                        li.classList.add('border-l-4', 'border-red-400');
                    }

                    li.innerHTML = `
                        <div class="flex items-center">
                            <span class="mr-3 text-xl">${icon}</span>
                            <div>
                                <p class="font-semibold text-ltc-primary">${activity.description}</p>
                                <p class="text-xs text-gray-400">${date}</p>
                            </div>
                        </div>
                        ${activity.amount ? `<span class="text-ltc-green-neon font-bold">${activity.amount > 0 ? '+' : ''}${activity.amount} Litoshis</span>` : ''}
                    `;
                    activityListElement.appendChild(li);
                });
            } else {
                activityListElement.innerHTML = '<li class="text-gray-400">No hay actividades recientes.</li>';
            }
        }
    }, (error) => {
        hideLoadingModal();
        console.error("Error al cargar actividades:", error);
        showNotification("Error al cargar tu historial de actividades.", "error");
        if (activityListElement) {
            activityListElement.innerHTML = '<li class="text-ltc-error">Error al cargar actividades.</li>';
        }
    });
}