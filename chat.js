// Le variabili globali (currentChat, MAX_LENGTH) sono accessibili

// =================================== DOM REFERENCES ===================================
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const attachmentButton = document.getElementById("attachmentButton");
const attachmentInput = document.getElementById("attachmentInput");
const attachmentPreviewContainer = document.getElementById("attachmentPreviewContainer");
const previewFileName = document.getElementById("previewFileName");
const removeAttachmentButton = document.getElementById("removeAttachmentButton");
const imagePreview = document.getElementById("imagePreview");

// =================================== HELPER FUNCTIONS ===================================

// Funzione per ripulire lo stato dell'allegato
function clearAttachment() {
    if (!attachmentInput) return;

    attachmentInput.value = null;
    attachmentPreviewContainer.classList.add('hidden');
    previewFileName.textContent = '';
    imagePreview.src = '';
    imagePreview.classList.add('hidden');
}

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


// =================================== EVENT HANDLERS ===================================

// Gestore click del pulsante Invia
if (sendButton) {
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
}

// Invio con tasto Enter
if (messageInput) {
    messageInput.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (sendButton) {
                 sendButton.click();
            }
        }
    });
}

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

console.log("chat.js caricato");