// =============== DIPENDENZE ===============
const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
// NUOVO: Importazione del modulo sqlite3
const sqlite3 = require("sqlite3").verbose();
const { open } = require("sqlite"); // Usiamo la versione con Promise per codice più pulito

// =============== CONFIGURAZIONE DB ===============
const DB_FILE = path.join(__dirname, "chat.db");
let db; 

// =============== SERVER SETUP ===============
const app = express();
const server = http.createServer(app);
// Aumenta la dimensione massima del payload per gestire i file Base64 (es. 10MB)
const wss = new WebSocket.Server({ server, maxPayload: 10 * 1024 * 1024 }); 

// Serve static files
app.use(express.static(path.join(__dirname)));

// =============== DATI SERVER (in RAM) ===============
// users[tempConnectionId] = { socket, nickname: "...", status: 'connected' };
let users = {}; 
let nextTempId = 1; // ID temporaneo per l'oggetto socket in RAM
const MAX_MESSAGE_LENGTH = 65536; 

function checkMessageLength(text) {
    if (typeof text !== 'string') return false; 
    return text.length <= MAX_MESSAGE_LENGTH;
}

// NUOVO: Funzione per trovare il TEMPORARY ID a partire dal nickname
function getTempIdByNickname(nickname) {
    for (const tempId in users) {
        if (users[tempId].nickname === nickname) {
            return Number(tempId);
        }
    }
    return null;
}

// =============== FUNZIONE BROADCAST ===============
function broadcast(message, excludeTempId = null) {
    const data = JSON.stringify(message);
    wss.clients.forEach(c => {
        const tempId = Object.keys(users).find(key => users[key].socket === c);
        
        if (c.readyState === WebSocket.OPEN && Number(tempId) !== excludeTempId) {
            c.send(data);
        }
    });
}

// =============== FUNZIONI ASINCRONE DB ===============

/** Controlla se un nickname esiste nel DB. */
async function userExists(nickname) {
    const user = await db.get("SELECT nickname FROM users WHERE nickname = ?", nickname);
    return !!user;
}

/** Controlla le credenziali di accesso. Restituisce il nickname se login ok. */
async function checkLogin(nickname, password) {
    const user = await db.get("SELECT nickname FROM users WHERE nickname = ? AND password = ?", nickname, password);
    return user ? user.nickname : null;
}

/** Aggiunge un nuovo utente al DB. */
async function addUser(nickname, password) {
    await db.run("INSERT INTO users (nickname, password) VALUES (?, ?)", nickname, password);
}


// =============== INIZIALIZZAZIONE DB ===============
async function initializeDB() {
    db = await open({
        filename: DB_FILE,
        driver: sqlite3.Database
    });

    await db.run(
        "CREATE TABLE IF NOT EXISTS users (nickname TEXT PRIMARY KEY, password TEXT NOT NULL)"
    );
    console.log("Database SQLite pronto e connesso. Nickname usato come Primary Key.");
}


// =============== WEBSOCKET HANDLING ===============
wss.on("connection", socket => {
    const tempId = nextTempId++;
    users[tempId] = { socket, nickname: null, status: 'connecting' };

    socket.send(JSON.stringify({ type: "welcome", id: tempId })); 

    socket.on("message", async data => { 
        let msg;
        try { msg = JSON.parse(data); } catch (e) { return; }

        // ----- LOGIN / REGISTRAZIONE -----
        
        if (msg.type === "login") {
            try {
                const loggedInNickname = await checkLogin(msg.nickname, msg.password);
                if (loggedInNickname) {
                    users[tempId].nickname = loggedInNickname;
                    users[tempId].status = 'connected';
                    
                    socket.send(JSON.stringify({ type: "login_success", nickname: loggedInNickname })); 

                    const onlineUsers = Object.keys(users)
                        .filter(tid => users[tid].nickname && users[tid].nickname !== loggedInNickname) 
                        .map(tid => ({ id: users[tid].nickname, nickname: users[tid].nickname })); 
                    socket.send(JSON.stringify({ type: "online_users", users: onlineUsers }));
                    
                    broadcast({ type: "user_joined", id: loggedInNickname, nickname: loggedInNickname }, tempId);
                } else {
                    socket.send(JSON.stringify({ type: "login_fail" }));
                }
            } catch (error) {
                console.error("Errore DB durante il login:", error);
                socket.send(JSON.stringify({ type: "login_fail" }));
            }
        }

        if (msg.type === "register") {
            try {
                if (await userExists(msg.nickname)) {
                    socket.send(JSON.stringify({ type: "register_fail", reason: "Nickname già esistente" }));
                } else {
                    await addUser(msg.nickname, msg.password); 
                    
                    users[tempId].nickname = msg.nickname;
                    users[tempId].status = 'connected';

                    socket.send(JSON.stringify({ type: "register_success", nickname: msg.nickname })); 

                    const onlineUsers = Object.keys(users)
                        .filter(tid => users[tid].nickname && users[tid].nickname !== msg.nickname)
                        .map(tid => ({ id: users[tid].nickname, nickname: users[tid].nickname }));
                    socket.send(JSON.stringify({ type: "online_users", users: onlineUsers }));

                    broadcast({ type: "user_joined", id: msg.nickname, nickname: msg.nickname }, tempId);
                }
            } catch (error) {
                console.error("Errore DB durante la registrazione:", error);
                socket.send(JSON.stringify({ type: "register_fail", reason: "Errore interno del server." }));
            }
        }
        
        const senderNickname = users[tempId].nickname;
        if (!senderNickname) return; 

        // ----- CHAT GENERALE (CON GESTIONE FILE) -----
        if (msg.type === "channel_message") {
            const text = msg.text || "";
            const file = msg.file;

            if (!text && !file) return; 

            if (!checkMessageLength(text)) {
                console.log(`[AVVISO SICUREZZA] Messaggio troppo lungo (channel).`);
                return; 
            }
            // Controllo dimensione/struttura del file Base64 (max 5MB)
            if (file && (typeof file.base64 !== 'string' || file.base64.length > 5 * 1024 * 1024 * 1.4)) { 
                console.log(`[AVVISO SICUREZZA] Dati file non validi o troppo grandi (channel).`);
                return;
            }

            broadcast({ 
                type: "channel_message", 
                message: { 
                    id: senderNickname, 
                    nickname: senderNickname, 
                    text: text, 
                    file: file // INOLTRA IL CAMPO FILE
                } 
            });
        }

        // ----- DM (MESSAGGIO PRIVATO CON GESTIONE FILE) -----
        if (msg.type === "dm") {
            const text = msg.text || "";
            const file = msg.file;

            if (!text && !file) return; 

            if (!checkMessageLength(text)) {
                console.log(`[AVVISO SICUREZZA] Messaggio troppo lungo (dm).`);
                return; 
            }
            if (file && (typeof file.base64 !== 'string' || file.base64.length > 5 * 1024 * 1024 * 1.4)) {
                console.log(`[AVVISO SICUREZZA] Dati file non validi o troppo grandi (dm).`);
                return;
            }

            const receiverNickname = msg.to; 
            const receiverTempId = getTempIdByNickname(receiverNickname); 
            const receiver = users[receiverTempId];
            
            if (!receiver || receiverTempId === tempId) return; 

            const payload = { 
                type: "dm", 
                message: { 
                    from: senderNickname, 
                    to: receiverNickname, 
                    nickname: senderNickname, 
                    text: text, 
                    file: file // INOLTRA IL CAMPO FILE
                } 
            };
            
            receiver.socket.send(JSON.stringify(payload));
            users[tempId].socket.send(JSON.stringify(payload));
        }
    });

    // ----- DISCONNESSIONE -----
    socket.on("close", () => {
        if (users[tempId] && users[tempId].nickname) {
            broadcast({ type: "user_left", id: users[tempId].nickname, nickname: users[tempId].nickname });
        }
        delete users[tempId];
    });
});

// =============== AVVIO SERVER ===============
const PORT = process.env.PORT || 10000;

initializeDB().then(() => {
    server.listen(PORT, () => {
        console.log(`Server avviato su http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error("Impossibile avviare il server a causa di un errore DB:", err);
});