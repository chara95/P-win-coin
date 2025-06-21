// js/game.js

import { showNotification, showLoadingModal, hideLoadingModal, formatLTC, updateBalanceDisplay } from './ui-feedback.js';
import { ref, get, update, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { logUserActivity } from './utils/activityLogger.js';

// === Referencias a los elementos del DOM (Juego de Memoria) ===
const activeMemoryGameContainer = document.getElementById('activeMemoryGame'); // Contenedor del juego de memoria activo
const gameGrid = document.getElementById('game-grid');
const movesDisplay = document.getElementById('movesDisplay'); // Elemento para mostrar los movimientos

// === Variables del juego de Memoria ===
const cardIcons = ['🍎', '🍌', '🍒', '🍇', '🍋', '🍊', '🍓', '🍍'];
let cards = [];
let flippedCards = [];
let matchedCards = [];
let lockBoard = false;
let gameStarted = false;
const GAME_REWARD_LITOSHIS = 200;
let moves = 0;
const MAX_MOVES = 20;

let authInstance;
let dbInstance;
let hasGameListenersBeenAttached = false;
let initialGameNotificationShown = false;

/**
 * Inicializa los listeners y referencias del DOM para el juego de memoria.
 * Esta función es llamada desde app.js o screenHandler.js.
 * @param {object} firebaseAuth La instancia de Firebase Auth.
 * @param {object} firebaseDb La instancia de Firebase Database.
 */
export function initializeGameScreen(firebaseAuth, firebaseDb) {
    authInstance = firebaseAuth; // Asigna la instancia
    dbInstance = firebaseDb;     // Asigna la instancia
    console.log("Memory Match game screen initialized.");

    const resetGameButton = document.getElementById('resetGameButton');
    if (resetGameButton) {
        resetGameButton.removeEventListener('click', startGame); // Remueve para evitar duplicados
        resetGameButton.addEventListener('click', startGame);
    }

    // Llama a startGame() aquí para que el juego se inicie al mostrar la pantalla
    //startGame();
}

// === LÓGICA DEL JUEGO DE MEMORIA ===

function resetGameUIElements() {
    // Asegura que el contenedor del juego de memoria esté visible
    if (activeMemoryGameContainer) {
        activeMemoryGameContainer.classList.remove('hidden'); // REMUEVE LA CLASE 'hidden'
        // activeMemoryGameContainer.classList.remove('hidden-completely'); // Esto lo maneja screenHandler.js
    }

    // Asegurarse de que la cuadrícula y el contador de movimientos estén visibles al inicio de un nuevo juego
    if (gameGrid) {
        gameGrid.innerHTML = ''; // Limpia las tarjetas anteriores
        gameGrid.classList.remove('hidden'); // Asegura que la cuadrícula esté visible
    }
    if (movesDisplay) {
        movesDisplay.textContent = `Movimientos restantes: ${MAX_MOVES - moves}`;
    }

    // Ocultar el botón de "Volver a Jugar" y el mensaje de resultado cuando el juego empieza
    const resetGameButton = document.getElementById('resetGameButton');
    if (resetGameButton) {
        resetGameButton.classList.add('hidden');
    }
    removeGameResultMessage(); // Siempre limpia el mensaje de resultado anterior
}

function generateCards() {
    cards = [...cardIcons, ...cardIcons];
    cards.sort(() => 0.5 - Math.random());

    if (!gameGrid) {
        console.error("gameGrid element not found!");
        return;
    }

    gameGrid.innerHTML = '';
    // Asegúrate de que estas clases de Tailwind estén en tu CSS o que se apliquen correctamente
    gameGrid.classList.add('grid-cols-4', 'gap-4', 'justify-center', 'mx-auto'); // Ajustado a gap-4 de tu HTML, añadido mx-auto para centrar


    cards.forEach((icon, index) => {
        const cardElement = document.createElement('div');
        cardElement.classList.add(
            'memory-card', 'relative', 'w-20', 'h-20', 'sm:w-24', 'sm:h-24', 'md:w-28', 'md:h-28',
            'rounded-lg', 'flex', 'items-center', 'justify-center', 'cursor-pointer',
            'transform-gpu', 'transition-transform', 'duration-500', 'ease-in-out', 'perspective-1000',
            'border-2', 'border-blue-500', // Bordes para visibilidad
            'shadow-lg' // Sombra
        );
        cardElement.dataset.icon = icon;
        cardElement.dataset.index = index;

        cardElement.innerHTML = `
            <div class="card-inner w-full h-full relative" style="transform-style: preserve-3d;">
                <div class="card-face card-back absolute inset-0 bg-blue-600 rounded-lg flex items-center justify-center text-white text-4xl font-bold backface-hidden" style="transform: rotateY(0deg);">?</div>
                <div class="card-face card-front absolute inset-0 bg-white rounded-lg flex items-center justify-center text-5xl backface-hidden" style="transform: rotateY(180deg);">
                    ${icon}
                </div>
            </div>
        `;
        cardElement.addEventListener('click', () => flipCard(cardElement), { once: false });
        gameGrid.appendChild(cardElement);
    });
}

export function startGame() {
    console.log("Starting new game...");
    matchedCards = [];
    lockBoard = false;
    flippedCards = [];
    moves = 0;
    updateMovesDisplay();

    resetGameUIElements(); // Asegura que la UI esté limpia y visible al inicio del juego

    generateCards();

     if (!initialGameNotificationShown) {
        showNotification(`¡Encuentra los pares! Tienes ${MAX_MOVES} movimientos.`, "info", 5000);
        initialGameNotificationShown = true; // Marcar que ya se mostró
    }
    gameStarted = true;
    // showNotification(`¡Encuentra los pares! Tienes ${MAX_MOVES} movimientos.`, "info", 5000);
}

function flipCard(card) {
    if (lockBoard || card.classList.contains('flipped') || matchedCards.includes(card)) return;

    card.classList.add('flipped');
    flippedCards.push(card);

    if (flippedCards.length === 2) {
        lockBoard = true;
        checkForMatch();
    }
}

function checkForMatch() {
    const [card1, card2] = flippedCards;
    const isMatch = card1.dataset.icon === card2.dataset.icon;
    moves++;
    updateMovesDisplay();

    if (isMatch) {
        disableCards();
        matchedCards.push(card1, card2);
        if (matchedCards.length === cards.length) {
            gameWon(GAME_REWARD_LITOSHIS);
        }
    } else {
        unflipCards();
    }

    if (moves >= MAX_MOVES && matchedCards.length !== cards.length) {
        setTimeout(() => {
            gameOverLost();
        }, 1000);
    }
}

function updateMovesDisplay() {
    if (movesDisplay) {
        movesDisplay.textContent = `Movimientos restantes: ${MAX_MOVES - moves}`;
    }
}

function gameOverLost() {
    showNotification(`¡Se acabaron los movimientos! Has usado ${moves} de ${MAX_MOVES}.`, "error", 5000);

    // Oculta el contenedor principal del juego y muestra el mensaje de resultado
    if (activeMemoryGameContainer) activeMemoryGameContainer.classList.add('hidden'); // Oculta el contenedor del juego
    
    displayGameResult("¡Juego Terminado! Se agotaron los movimientos. ¡Inténtalo de nuevo!", "error");
    gameStarted = false;
    resetBoard();
}

function disableCards() {
    // Las tarjetas correctas se quedan boca arriba
    resetBoard();
}

function unflipCards() {
    setTimeout(() => {
        // Asegúrate de que las tarjetas existan antes de intentar remover la clase
        if (flippedCards[0]) flippedCards[0].classList.remove('flipped');
        if (flippedCards[1]) flippedCards[1].classList.remove('flipped');
        resetBoard();
    }, 1200);
}

function resetBoard() {
    [flippedCards, lockBoard] = [[], false];
}

async function gameWon(earnedAmount) {
    showLoadingModal("¡Felicidades! Verificando tu recompensa...");
    
    try {
        const user = authInstance.currentUser;
        if (!user) {
            showNotification("No hay usuario autenticado. No se puede reclamar la recompensa.", "error");
            hideLoadingModal();
            return;
        }

        const userRef = ref(dbInstance, `users/${user.uid}`);
        const userSnapshot = await get(userRef);
        if (!userSnapshot.exists()) {
            showNotification("Datos de usuario no encontrados.", "error");
            hideLoadingModal();
            return;
        }

        await update(userRef, {
            balance: increment(GAME_REWARD_LITOSHIS),
            lastGameWin: new Date().toISOString()
        });

        // Oculta el contenedor principal del juego y muestra el mensaje de resultado
        if (activeMemoryGameContainer) activeMemoryGameContainer.classList.add('hidden'); // Oculta el contenedor del juego
        
        displayGameResult("¡Felicidades! Has ganado " + GAME_REWARD_LITOSHIS + " Litoshis.", "success");
        showNotification(`¡Has ganado ${GAME_REWARD_LITOSHIS} Litoshis! Tu balance se ha actualizado.`, "success", 8000);
        await logUserActivity(user.uid, 'game_win', earnedAmount, `Ganancia de Juego (Memory Match)`);
        const updatedUserSnapshot = await get(userRef);
        if (updatedUserSnapshot.exists()) {
            updateBalanceDisplay(updatedUserSnapshot.val().balance);
        }

    } catch (error) {
        console.error("Error al procesar la victoria del juego:", error);
        showNotification(`Error al reclamar la recompensa: ${error.message}`, "error");
    } finally {
        hideLoadingModal();
        gameStarted = false;
    }
}

function removeGameResultMessage() {
    const existingResultMessageWrapper = document.getElementById('gameResultMessageWrapper');
    if (existingResultMessageWrapper) {
        existingResultMessageWrapper.remove();
    }
}

function displayGameResult(message, type) {
    // El contenedor donde se inyectará el resultado (el nuevo div que creamos)
    const parentContainer = document.getElementById('gameResultMessageContainer'); 
    if (!parentContainer) {
        console.error("No se encontró el contenedor 'gameResultMessageContainer' para mostrar el resultado del juego.");
        return;
    }

    removeGameResultMessage(); // Asegura que solo haya un mensaje de resultado a la vez

    const resultWrapper = document.createElement('div');
    resultWrapper.id = 'gameResultMessageWrapper';
    resultWrapper.classList.add(
        'bg-gradient-to-br', 'from-blue-300', 'to-purple-400',
        'rounded-xl', 'shadow-lg', 'p-6', 'text-center',
        'flex', 'flex-col', 'items-center', 'justify-center',
        'w-full', 'max-w-md', 'mx-auto', 'mt-4'
    );

    const resultMessageEl = document.createElement('p');
    resultMessageEl.id = 'gameResultMessage';
    resultMessageEl.classList.add('text-3xl', 'font-bold', 'mb-6');
    resultMessageEl.textContent = message;
    resultMessageEl.classList.add(type === 'success' ? 'text-ltc-green-neon' : 'text-red-500');

    const playAgainBtnEl = document.createElement('button');
    playAgainBtnEl.id = 'playAgainButton';
    playAgainBtnEl.classList.add(
        'bg-gradient-to-r', 'from-green-400', 'to-blue-500',
        'hover:from-green-500', 'hover:to-blue-600',
        'text-white', 'font-bold', 'py-3', 'px-6', 'rounded-lg',
        'transition-all', 'duration-300', 'shadow-md', 'active:scale-95',
        'mt-6'
    );
    playAgainBtnEl.textContent = "Volver a Jugar";

    resultWrapper.appendChild(resultMessageEl);
    resultWrapper.appendChild(playAgainBtnEl);

    parentContainer.appendChild(resultWrapper); // Añade el resultado al nuevo contenedor
    
    playAgainBtnEl.addEventListener('click', handlePlayAgain);
}

function handlePlayAgain() {
    console.log("Play Again button clicked.");
    removeGameResultMessage(); // Oculta el mensaje de resultado
    startGame(); // Inicia una nueva partida
    showNotification("¡Nueva partida de Memory Match!", "info");
}