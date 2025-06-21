// js/helpScreen.js

/**
 * Inicializa la pantalla de ayuda, configurando la lógica de los FAQ.
 * @param {object} auth - Instancia de Firebase Auth.
 * @param {object} db - Instancia de Firestore Database.
 */
export function initializeHelpScreen(auth, db) {
    console.log("Inicializando HelpScreen (FAQ interactivo)...");

    // Selecciona todos los botones de preguntas FAQ
    const faqQuestions = document.querySelectorAll('.faq-question');

    faqQuestions.forEach(button => {
        // Elimina cualquier listener previo para evitar duplicados si la pantalla se inicializa varias veces
        button.removeEventListener('click', toggleFaqAnswer);
        // Añade el listener para el clic
        button.addEventListener('click', toggleFaqAnswer);
    });

    // Opcional: Asegurarse de que al cargar la pantalla, todos los FAQ están cerrados (siempre)
    // Esto es bueno para la UX, así el usuario los abre uno a uno
    document.querySelectorAll('.faq-answer').forEach(answer => {
        answer.classList.add('hidden');
    });
    document.querySelectorAll('.faq-question i').forEach(icon => {
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    });
}

/**
 * Función para alternar la visibilidad de la respuesta FAQ.
 * @param {Event} event - El evento de clic.
 */
function toggleFaqAnswer(event) {
    const questionButton = event.currentTarget;
    const answer = questionButton.nextElementSibling; // La respuesta está justo después del botón
    const icon = questionButton.querySelector('i');

    if (answer && icon) {
        answer.classList.toggle('hidden'); // Alterna la clase 'hidden'
        icon.classList.toggle('fa-chevron-down'); // Cambia el icono hacia abajo
        icon.classList.toggle('fa-chevron-up');   // Cambia el icono hacia arriba
    }
}