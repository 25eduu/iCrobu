console.log("client.js caricato");

// WebSocket
const socket = new WebSocket("ws://localhost:10000");

// =================================== DOM REFERENCES ===================================
const loginScreen = document.getElementById("loginScreen");
const nicknameInput = document.getElementById("nicknameInput");
const passwordInput = document.getElementById("passwordInput");
const togglePassword = document.getElementById("togglePassword"); 

const loginButton = document.getElementById("loginButton");
const registerButton = document.getElementById("registerButton");

const chatList = document.getElementById("chatList");
const messages = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

// Riferimenti Allegati
const attachmentButton = document.getElementById("attachmentButton"); 
const attachmentInput = document.getElementById("attachmentInput");

// Riferimenti Anteprima Input
const attachmentPreviewContainer = document.getElementById("attachmentPreviewContainer");
const previewFileName = document.getElementById("previewFileName");
const removeAttachmentButton = document.getElementById("removeAttachmentButton");
const imagePreview = document.getElementById("imagePreview");

// Elementi per l'header della chat
const chatHeader = document.getElementById("chatHeader"); 
const profilePic = document.getElementById("profilePic"); 
const chattingWithName = document.getElementById("chattingWithName"); 

// NUOVI RIFERIMENTI PER LA MODALE
const imageModal = document.getElementById("imageModal");
const imageModalContent = document.getElementById("imageModalContent");
const closeModal = document.querySelector(".close-modal");

// =================================== DATA & CONFIG ===================================
let nickname = null; 
let conversations = {}; 
let currentChat = "general";
let onlineUsers = {}; 
const MAX_LENGTH = 65536; 

// Funzione per ripulire lo stato dell'allegato
function clearAttachment() {
    if (!attachmentInput) return;
    
    attachmentInput.value = null; 
    attachmentPreviewContainer.classList.add('hidden');
    previewFileName.textContent = '';
    imagePreview.src = '';
    imagePreview.classList.add('hidden');
}

// =================================== HELPER FUNCTIONS ===================================

// RENDER SIDEBAR
function renderChatList() {
    chatList.innerHTML = "";
    
    // 1. CHAT GENERALE (Sempre presente)
    const generalUnread = conversations.general ? conversations.general.some(m => !m.read) : false;
    const generalBadge = generalUnread ? `<span class="unread-dot"></span>` : '';
    
    chatList.innerHTML += `
        <div class="chatItem ${currentChat === 'general' ? 'active' : ''}" data-id="general">
            <b>Chat Generale</b>${generalBadge}
        </div>
    `;
    
    // 2. CHAT PRIVATE (DM)
    for (let peerNickname in onlineUsers) { 
        if (peerNickname === nickname) continue; 
        
        const user = onlineUsers[peerNickname];
        const isActive = peerNickname === currentChat ? 'active' : ''; 
        
        const dmUnread = conversations[peerNickname] ? conversations[peerNickname].some(m => !m.read) : false;
        const dmBadge = dmUnread ? `<span class="unread-dot"></span>` : '';
        
        chatList.innerHTML += `
            <div class="chatItem ${isActive}" data-id="${peerNickname}"> 
                Chat con ${user.nickname} ${dmBadge}
            </div>
        `;
    }
    
    document.querySelectorAll(".chatItem").forEach(item => {
        item.onclick = () => { 
            const newChatId = item.dataset.id; 
            if (newChatId === currentChat) return;

            document.querySelectorAll(".chatItem").forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            currentChat = newChatId; 
            
            if (conversations[currentChat]) {
                conversations[currentChat].forEach(m => m.read = true);
            }
            renderChatList();
            renderChatHeader(); 
            renderMessages(); 
        };
    });
}

// Aggiorna l'header della chat
function renderChatHeader() {
    if (!chattingWithName) return; 

    if (currentChat === 'general') {
        chattingWithName.textContent = "Chat Generale";
        if (profilePic) profilePic.src = "img/noprofilo.jpg"; 
    } else {
        const user = onlineUsers[currentChat]; 
        if (user) {
            chattingWithName.textContent = user.nickname;
            if (profilePic) profilePic.src = "img/noprofilo.jpg"; 
        } else {
            chattingWithName.textContent = `Chat con ${currentChat} (offline)`; 
            if (profilePic) profilePic.src = "img/noprofilo.jpg"; 
        }
    }
}


// RENDER MESSAGGI (Visualizzazione File)
function renderMessages() {
    messages.innerHTML = "";
    if (!conversations[currentChat]) return;
    conversations[currentChat].forEach(m => {
        
        const senderIdentifier = m.from || m.id;
        const isMe = senderIdentifier === nickname; 
        
        const div = document.createElement("div");
        div.classList.add("msg");
        if (isMe) div.classList.add("me");
        
        const senderNickname = m.nickname || `Utente ${senderIdentifier}`;
        
        let contentHTML = `<b>${senderNickname}:</b>`;
        
        // Se c'è un allegato
        if (m.file && m.file.base64 && m.file.name) {
            contentHTML += `<div class="msg-content">`;
            
            if (m.file.type && m.file.type.startsWith('image/')) {
                // Visualizza come Immagine (anteprima)
                contentHTML += `<img src="${m.file.base64}" alt="${m.file.name}" class="attached-image clickable-image">`;
                
            } else {
                // Visualizza come File linkabile
                contentHTML += `<a href="${m.file.base64}" download="${m.file.name}" class="attached-file">
                                         💾 ${m.file.name}
                                     </a>`;
            }

            // Aggiunge il testo sotto l'allegato, se presente
            if (m.text) {
                contentHTML += `<p style="margin-top: 5px; margin-bottom: 0;">${m.text}</p>`;
            }
            contentHTML += `</div>`;
        } else {
            // Messaggio di solo testo
            contentHTML += ` ${m.text}`;
        }
        
        div.innerHTML = contentHTML;
        messages.appendChild(div);
    });
    
    messages.scrollTop = messages.scrollHeight;
    attachImageClickHandlers(); 
}


// =================================== EVENT HANDLERS ===================================

// LOGICA OCCHIOLINO
if (togglePassword) {
    togglePassword.classList.add('hidden'); 
    togglePassword.onclick = () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        if (type === 'text') {
            togglePassword.classList.remove('hidden');
            togglePassword.classList.add('visible'); 
        } else {
            togglePassword.classList.remove('visible');
            togglePassword.classList.add('hidden'); 
        }
    };
}


// LOGIN / REGISTRAZIONE 
loginButton.onclick = () => {
    const nick = nicknameInput.value.trim();
    const pass = passwordInput.value;
    if (!nick || !pass) return alert("Inserisci Nickname e Password.");
    socket.send(JSON.stringify({ type: "login", nickname: nick, password: pass }));
};

registerButton.onclick = () => {
    const nick = nicknameInput.value.trim();
    const pass = passwordInput.value;
    if (!nick || !pass) return alert("Inserisci Nickname e Password.");
    socket.send(JSON.stringify({ type: "register", nickname: nick, password: pass }));
};

// Funzione principale per l'invio
function sendMessage(text, fileData = null) {
    if (currentChat !== "general") {
        socket.send(JSON.stringify({ 
            type: "dm", 
            to: currentChat, 
            text, 
            file: fileData
        }));
    } else {
        socket.send(JSON.stringify({ 
            type: "channel_message", 
            text, 
            file: fileData
        }));
    }
}

// Gestore click del pulsante Invia
sendButton.onclick = () => {
    const text = messageInput.value.trim();
    const files = attachmentInput.files;

    if (!text && files.length === 0) return;

    // 1. GESTIONE SOLO TESTO
    if (files.length === 0) {
        if (text.length > MAX_LENGTH) {
            alert(`Il messaggio supera il limite massimo di ${MAX_LENGTH} caratteri.`);
            return;
        }
        sendMessage(text);
        messageInput.value = "";
        return;
    }

    // 2. GESTIONE ALLEGATI (Inviamo solo il primo file)
    const file = files[0]; 
    if (file.size > 5 * 1024 * 1024) { // Limite 5MB
        clearAttachment();
        return alert("File troppo grande. Limite massimo 5MB.");
    }
    
    // Legge il file in Base64
    const reader = new FileReader();
    reader.onload = function(event) {
        const base64Data = event.target.result;
        
        const fileData = {
            base64: base64Data, 
            name: file.name,
            type: file.type
        };
        
        sendMessage(text, fileData);
        
        messageInput.value = "";
        clearAttachment(); 
    };
    
    reader.onerror = () => alert("Errore nella lettura del file.");
    
    reader.readAsDataURL(file); 
};


messageInput.addEventListener("keydown", e => {
    if (e.key === "Enter") { 
        e.preventDefault(); 
        sendButton.click(); 
    }
});

// Logica Graffetta: Clicca sul pulsante, attiva l'input file nascosto
if(attachmentButton && attachmentInput) {
    attachmentButton.onclick = () => {
        attachmentInput.click(); 
    };
}

// LOGICA: Anteprima nella barra di input
if(attachmentInput) {
    attachmentInput.onchange = (e) => {
        const files = e.target.files;
        if (files.length === 0) {
            clearAttachment();
            return;
        }

        const file = files[0];
        
        if (file.size > 5 * 1024 * 1024) {
            clearAttachment();
            return alert("File troppo grande. Limite massimo 5MB.");
        }

        attachmentPreviewContainer.classList.remove('hidden');
        previewFileName.textContent = file.name;

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(event) {
                imagePreview.src = event.target.result;
                imagePreview.classList.remove('hidden');
            };
            reader.readAsDataURL(file); 
        } else {
            imagePreview.classList.add('hidden');
            imagePreview.src = ''; 
        }
    };
}

// Logica Rimuovi Allegato
if(removeAttachmentButton) {
    removeAttachmentButton.onclick = clearAttachment;
}


// =================================== SOCKET ONMESSAGE ===================================
socket.onmessage = e => {
    const msg = JSON.parse(e.data);
    
    if (msg.type === "login_success" || msg.type === "register_success") {
        nickname = msg.nickname; 
        loginScreen.style.display = "none";
        conversations.general = []; 
        currentChat = "general";
        
        renderChatList();
        const generalItem = document.querySelector(`.chatItem[data-id="general"]`);
        if(generalItem) generalItem.classList.add('active');
        
        renderChatHeader(); 
        renderMessages();
    }
    if (msg.type === "login_fail") alert("Login fallito: nickname o password errati");
    if (msg.type === "register_fail") alert("Registrazione fallita: " + msg.reason);

    if (msg.type === "online_users") {
        onlineUsers = {}; 
        msg.users.forEach(user => {
            onlineUsers[user.id] = user; 
        });
        renderChatList();
    }
    
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

    // MESSAGGIO CHANNEL (Riceve il campo 'file')
    if (msg.type === "channel_message") {
        const m = msg.message;
        const isMe = m.id === nickname; 
        
        m.read = isMe || (currentChat === "general"); 
        conversations.general.push(m);
        
        if (currentChat === "general") {
            renderMessages();
        } else if (!isMe) {
            renderChatList(); 
        }
    }

    // MESSAGGIO DM (Riceve il campo 'file')
    if (msg.type === "dm") {
        const m = msg.message;
        const isMe = m.from === nickname; 
        const peer = isMe ? m.to : m.from; 
        
        if (!conversations[peer]) conversations[peer] = [];
        
        m.read = isMe || (currentChat === peer); 
        conversations[peer].push(m);
        
        if (!onlineUsers[peer]) {
            onlineUsers[peer] = { id: peer, nickname: m.nickname };
        }
        
        renderChatList();
        if (currentChat === peer) renderMessages();
    }
};

// SOCKET ONMESSAGE (Logica di ricezione messaggi)
socket.onmessage = e => {
    const msg = JSON.parse(e.data);
    
    if (msg.type === "login_success" || msg.type === "register_success") {
        nickname = msg.nickname; 
        loginScreen.style.display = "none";
        conversations.general = []; 
        currentChat = "general";
        
        renderChatList();
        const generalItem = document.querySelector(`.chatItem[data-id="general"]`);
        if(generalItem) generalItem.classList.add('active');
        
        renderChatHeader(); 
        renderMessages();
    }
    if (msg.type === "login_fail") alert("Login fallito: nickname o password errati");
    if (msg.type === "register_fail") alert("Registrazione fallita: " + msg.reason);

    if (msg.type === "online_users") {
        onlineUsers = {}; 
        msg.users.forEach(user => {
            onlineUsers[user.id] = user; 
        });
        renderChatList();
    }
    
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

    // MESSAGGIO CHANNEL (Riceve il campo 'file')
    if (msg.type === "channel_message") {
        const m = msg.message;
        const isMe = m.id === nickname; 
        
        m.read = isMe || (currentChat === "general"); 
        conversations.general.push(m);
        
        if (currentChat === "general") {
            renderMessages();
        } else if (!isMe) {
            renderChatList(); 
        }
    }

    // MESSAGGIO DM (Riceve il campo 'file')
    if (msg.type === "dm") {
        const m = msg.message;
        const isMe = m.from === nickname; 
        const peer = isMe ? m.to : m.from; 
        
        if (!conversations[peer]) conversations[peer] = [];
        
        m.read = isMe || (currentChat === peer); 
        conversations[peer].push(m);
        
        // Potrebbe essere un DM da un utente che non era nella lista online
        if (!onlineUsers[peer]) {
            onlineUsers[peer] = { id: peer, nickname: m.nickname };
        }
        
        renderChatList();
        if (currentChat === peer) renderMessages();
    }
};