 import { authInstance, dbInstance } from './firebase-config.js'; // ASUME QUE ESTA ES LA RUTA CORRECTA A TU ARCHIVO DE CONFIGURACIÓN
    import { showNotification, showLoadingModal, hideLoadingModal } from './ui-feedback.js'; // Ruta a tu archivo ui-feedback.js
    import { logUserActivity } from './utils/activityLogger.js'; // Ruta a tu activityLogger.js

    // === INICIO DE LA LÓGICA DE ELIMINACIÓN DE CUENTA ===

    /**
     * Muestra un modal de confirmación HTML personalizado.
     * @returns {Promise<boolean>} Resuelve a 'true' si se confirma, 'false' si se cancela.
     */
    function showConfirmationModal() {
        return new Promise((resolve) => {
            const modalOverlay = document.getElementById('confirmationModalOverlay');
            const confirmBtn = document.getElementById('confirmDeleteBtn');
            const cancelBtn = document.getElementById('cancelDeleteBtn');

            // Asegúrate de que el modal existe en el DOM
            if (!modalOverlay || !confirmBtn || !cancelBtn) {
                console.error("Error: Elementos del modal de confirmación no encontrados en el DOM.");
                // Si el modal no existe, volvemos al confirm() de JS como fallback
                const fallbackConfirmed = confirm("¿Estás ABSOLUTAMENTE seguro de que quieres eliminar tu cuenta? Todos tus datos y Litoshis se perderán permanentemente. (Fallback)");
                resolve(fallbackConfirmed);
                return;
            }

            // Muestra el modal
            modalOverlay.classList.remove('hidden');
            modalOverlay.classList.add('flex'); // Para centrarlo con flexbox

            const handleConfirm = () => {
                modalOverlay.classList.add('hidden');
                modalOverlay.classList.remove('flex');
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
                resolve(true);
            };

            const handleCancel = () => {
                modalOverlay.classList.add('hidden');
                modalOverlay.classList.remove('flex');
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
                resolve(false);
            };

            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
        });
    }

    /**
     * Maneja el clic en el botón "Eliminar Cuenta".
     * @param {Event} event El evento de clic.
     */
    window.handleAccountDeletionClick = async function(event) {
        event.preventDefault(); // Evita la navegación del enlace #

        showNotification("Estás a punto de eliminar tu cuenta. Esta acción es irreversible y perderás todos tus Litoshis y datos.", "warning", 8000);

        // Muestra el modal de confirmación personalizado
        const confirmed = await showConfirmationModal();

        if (!confirmed) {
            showNotification("Eliminación de cuenta cancelada.", "info");
            return;
        }

        showLoadingModal("Procesando eliminación de cuenta...");

        try {
            // Usa la instancia de auth directamente importada
            const user = authInstance.currentUser;

            if (!user) {
                hideLoadingModal();
                showNotification("No hay un usuario autenticado para eliminar.", "error");
                // Redirigir al login si no hay usuario
                // screenHandler.showScreen('loginScreen'); // Ejemplo si tienes un screenHandler
                return;
            }

            console.log("Intentando eliminar cuenta de Firebase Auth para UID:", user.uid);

            // Intentar eliminar la cuenta de Firebase Authentication
            await user.delete();

            // Si llegamos aquí, la cuenta de Firebase Auth ha sido eliminada.
            // Ahora, eliminar los datos del usuario de Realtime Database usando la instancia importada.
            if (dbInstance) { // Ahora 'dbInstance' es la referencia directa a tu base de datos
                await dbInstance.ref(`users/${user.uid}`).remove();
                console.log("Datos de usuario eliminados de Realtime Database para UID:", user.uid);
            } else {
                console.warn("dbInstance no está disponible. No se pudieron eliminar los datos del usuario de Realtime Database.");
                showNotification("Cuenta eliminada de Firebase Auth, pero los datos en la base de datos no pudieron ser eliminados. Contacta al soporte.", "warning");
            }
            
            // Log de actividad si el logger está disponible
            if (typeof logUserActivity === 'function') {
                console.log("Actividad de eliminación de cuenta registrada externamente (o en un backend separado).");
                // Nota: logUserActivity podría necesitar un UID válido, que ya no existe en Auth.
                // Si el log se hace en el backend, no hay problema.
            }

            hideLoadingModal();
            showNotification("¡Tu cuenta ha sido eliminada con éxito!", "success", 5000);

            // Redirigir al usuario a la pantalla de inicio de sesión o a una pantalla de bienvenida
            // Desconectar o limpiar el estado de la sesión si es necesario
            setTimeout(() => {
                // Ejemplo: Recargar la página para limpiar el estado de la aplicación
                window.location.reload();
                // O redirigir a una pantalla específica si tienes un screenHandler
                // screenHandler.showScreen('loginScreen');
            }, 2000); // Dar tiempo para ver la notificación

        } catch (error) {
            hideLoadingModal();
            console.error("Error al eliminar la cuenta:", error);

            if (error.code === 'auth/requires-recent-login') {
                showNotification(
                    "Por seguridad, debes iniciar sesión de nuevo para eliminar tu cuenta. Por favor, cierra la aplicación y vuelve a iniciar sesión, luego inténtalo de nuevo.",
                    "error",
                    10000
                );
                // Opcional: Puedes redirigir al usuario a una pantalla de re-autenticación si la tienes.
                // authInstance.signOut(); // Usa authInstance para signOut
                // screenHandler.showScreen('loginScreen');
            } else if (error.code === 'auth/network-request-failed') {
                showNotification("Error de red: No se pudo conectar para eliminar la cuenta. Verifica tu conexión.", "error");
            } else {
                showNotification(`Error al eliminar la cuenta: ${error.message}`, "error");
            }
        }
    };