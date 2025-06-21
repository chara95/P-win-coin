// js/firebase-config.js
// 
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';



const firebaseConfig = {
    apiKey: "AIzaSyCxnROg2syd_R_RVyk_XuToTlVfMS8TH1c",
    authDomain: "win-coin-fc28c.firebaseapp.com",
    databaseURL: "https://win-coin-fc28c-default-rtdb.firebaseio.com",
    projectId: "win-coin-fc28c",
    storageBucket: "win-coin-fc28c.appspot.com",
    messagingSenderId: "551978963189",
    appId: "1:551978963189:web:16bb22a13291bc738475bc",
    databaseURL: "https://win-coin-fc28c-default-rtdb.firebaseio.com/"
};



const app = initializeApp(firebaseConfig);
export const authInstance = getAuth(app);
export const dbInstance = getDatabase(app); // Asegúrate de que esto esté exportado
console.log("Firebase app and services (Auth, DB) initialized and exported.");