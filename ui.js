// Le variabili globali (conversations, currentChat, onlineUsers, nickname)
// sono accessibili perché caricate in app.js

// =================================== DOM REFERENCES ===================================
const chatList = document.getElementById("chatList");
const messages = document.getElementById("messages");
const profilePic = document.getElementById("profilePic");
const chattingWithName = document.getElementById("chattingWithName");

// =================================== HELPER FUNCTIONS ===================================

// RENDER SIDEBAR
function renderChatList() {
    if (!chatList) return;
    chatList.innerHTML = "";

    // 1. CHAT GENERALE (Sempre presente)
    let generalUnread = false;
    if (conversations.general) {
        generalUnread = conversations.general.some(m => !m.read);
    }

    let generalBadge = '';
    if (generalUnread) {
        generalBadge = `<span class="unread-dot"></span>`;
    }

    let generalActiveClass = '';
    if (currentChat === 'general') {
        generalActiveClass = 'active';
    }

    chatList.innerHTML += `
        <div class="chatItem ${generalActiveClass}" data-id="general">
            <b>Chat Generale</b>${generalBadge}
        </div>
    `;

    // 2. CHAT PRIVATE (DM)
    for (let peerNickname in onlineUsers) {
        if (peerNickname === nickname) continue;

        const user = onlineUsers[peerNickname];

        let isActive = '';
        if (peerNickname === currentChat) {
            isActive = 'active';
        }

        let dmUnread = false;
        if (conversations[peerNickname]) {
            dmUnread = conversations[peerNickname].some(m => !m.read);
        }

        let dmBadge = '';
        if (dmUnread) {
            dmBadge = `<span class="unread-dot"></span>`;
        }

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
        if (profilePic) {
            profilePic.src = "img/noprofilo.jpg";
        }
    } else {
        const user = onlineUsers[currentChat];
        if (user) {
            chattingWithName.textContent = user.nickname;
            if (profilePic) {
                profilePic.src = "img/noprofilo.jpg";
            }
        } else {
            chattingWithName.textContent = `Chat con ${currentChat} (offline)`;
            if (profilePic) {
                profilePic.src = "img/noprofilo.jpg";
            }
        }
    }
}


// RENDER MESSAGGI (Visualizzazione File)
function renderMessages() {
    if (!messages) return;
    messages.innerHTML = "";
    if (!conversations[currentChat]) return;

    conversations[currentChat].forEach(m => {

        const senderIdentifier = m.from || m.id;
        let isMe = (senderIdentifier === nickname);

        const div = document.createElement("div");
        div.classList.add("msg");
        if (isMe) {
            div.classList.add("me");
        }

        const senderNickname = m.nickname || `Utente ${senderIdentifier}`;

        let contentHTML = `<b>${senderNickname}:</b>`;

        // Se c'è un allegato
        if (m.file && m.file.base64 && m.file.name) {
            contentHTML += `<div class="msg-content">`;

            if (m.file.type && m.file.type.startsWith('image/')) {
                // Visualizza come Immagine
                contentHTML += `<img src="${m.file.base64}" alt="${m.file.name}" class="attached-image">`;

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
}

console.log("ui.js caricato");