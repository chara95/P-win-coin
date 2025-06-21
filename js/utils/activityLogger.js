// js/utils/activityLogger.js

import { dbInstance } from '../app.js'; // Asegúrate de que app.js exporta dbInstance
import { push, ref, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/**
 * Registra una actividad en la base de datos del usuario.
 * @param {string} uid El UID del usuario.
 * @param {string} type Tipo de actividad (ej. 'faucet_claim', 'daily_reward', 'game_win').
 * @param {number} amount Cantidad de Litoshis involucrada (positiva para ganancia, negativa para gasto/retiro).
 * @param {string} description Descripción amigable de la actividad.
 * @param {object} [extraDetails={}] Objeto opcional para detalles adicionales (ej. 'status' para retiros).
 */
export async function logUserActivity(uid, type, amount, description, extraDetails = {}) {
    if (!uid) {
        console.error("UID no proporcionado para logUserActivity. No se pudo registrar la actividad.");
        return;
    }
    if (!dbInstance) {
        console.error("dbInstance no está inicializado en logUserActivity. No se pudo registrar la actividad.");
        return;
    }

    try {
        const userActivityRef = ref(dbInstance, `users/${uid}/activities`);
        const newActivityRef = push(userActivityRef);

        await set(newActivityRef, {
            type: type,
            amount: amount,
            description: description,
            timestamp: serverTimestamp(), // Usa el timestamp del servidor para consistencia y ordenar
            ...extraDetails // Añade cualquier detalle extra (ej. { status: 'pending' })
        });
        console.log(`Actividad registrada para ${uid}: ${description} (Monto: ${amount})`);
    } catch (error) {
        console.error("Error al registrar actividad del usuario:", error);
    }
}