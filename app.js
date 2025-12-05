// =================================== VARIABILI GLOBALI ===================================
let nickname = null;
let conversations = {};
let currentChat = "general";
let onlineUsers = {};
const MAX_LENGTH = 65536;

// =================================== WEBSOCKET CONNECTION ===================================
const host = "icrobu.onrender.com";
const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const socket = new WebSocket(`${protocol}//${host}/`);

// =================================== FUNZIONE PRINCIPALE ===================================
// Funzione che viene chiamata per mostrare l'app dopo il login
function showAppScreen() {
    const loginScreen = document.getElementById("loginScreen");
    if (loginScreen) {
        loginScreen.style.display = "none";
    }
}

// =================================== SOCKET ONMESSAGE ===================================
socket.onmessage = e => {
    const msg = JSON.parse(e.data);

    // Gestione Login/Registrazione
    if (msg.type === "login_success" || msg.type === "register_success") {
        nickname = msg.nickname;
        conversations.general = [];
        currentChat = "general";
        showAppScreen(); // Nasconde la schermata di login

        renderChatList();
        const generalItem = document.querySelector(`.chatItem[data-id="general"]`);
        if (generalItem) {
            generalItem.classList.add('active');
        }

        renderChatHeader();
        renderMessages();
    }

    if (msg.type === "login_fail") {
        alert("Login fallito: " + (msg.reason || "nickname o password errati"));
    }

    if (msg.type === "register_fail") {
        alert("Registrazione fallita: " + msg.reason);
    }

    // Gestione Utenti Online
    if (msg.type === "online_users") {
        onlineUsers = {};
        msg.users.forEach(user => {
            onlineUsers[user.id] = user;
        });
        renderChatList();
    }

    // Gestione Entrata/Uscita Utente
    if (msg.type === "user_joined") {
        onlineUsers[msg.id] = { id: msg.id, nickname: msg.nickname };
        renderChatList();
    }

    if (msg.type === "user_left") {
        delete onlineUsers[msg.id];
        if (currentChat === msg.id) {
            currentChat = 'general';
            renderChatHeader();
            renderMessages();
        }
        renderChatList();
    }

    // Gestione Messaggi Channel
    if (msg.type === "channel_message") {
        const m = msg.message;
        const isMe = (m.nickname === nickname);

        if (!conversations.general) {
            conversations.general = [];
        }

        if (isMe || (currentChat === "general")) {
            m.read = true;
        } else {
            m.read = false;
        }
        conversations.general.push(m);

        if (currentChat === "general") {
            renderMessages();
        } else if (!isMe) {
            renderChatList();
        }
    }

    // Gestione Messaggi DM
    if (msg.type === "dm") {
        const m = msg.message;
        const isMe = (m.from === nickname);
        let peer;
        if (isMe) {
            peer = m.to;
        } else {
            peer = m.from;
        }

        if (!conversations[peer]) {
            conversations[peer] = [];
        }

        if (isMe || (currentChat === peer)) {
            m.read = true;
        } else {
            m.read = false;
        }
        conversations[peer].push(m);

        if (!onlineUsers[peer]) {
            onlineUsers[peer] = { id: peer, nickname: m.nickname };
        }

        renderChatList();
        if (currentChat === peer) {
            renderMessages();
        }
    }
};

console.log("app.js caricato");