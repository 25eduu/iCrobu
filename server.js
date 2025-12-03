// =============== DIPENDENZE ===============
const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

// NUOVE DIPENDENZE PER DATABASE E SICUREZZA
const { Pool } = require('pg'); // Client PostgreSQL
const bcrypt = require("bcryptjs"); // Hashing delle password
require('dotenv').config(); // Carica variabili d'ambiente (come DATABASE_URL)

// =============== SERVER SETUP ===============
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, maxPayload: 10 * 1024 * 1024 }); // Aumenta payload per file

// Serve static files
app.use(express.static(path.join(__dirname)));

// =============== DATABASE POSTGRESQL SETUP ===============
const SALT_ROUNDS = 10; 

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Configurazione SSL necessaria per Render
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

/** Inizializza il DB e crea la tabella 'users' se non esiste. */
async function initializeDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                nickname VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL 
            );
        `);
        console.log("Tabella 'users' verificata o creata con successo.");
    } catch (err) {
        console.error("❌ Errore durante l'inizializzazione del DB:", err);
        process.exit(1);
    }
}

/** Controlla le credenziali di accesso. Restituisce il nickname se login ok. */
async function checkLogin(nickname, password) {
    const result = await pool.query('SELECT nickname, password_hash FROM users WHERE nickname = $1', [nickname]);
    
    if (result.rows.length === 0) return null; // Utente non trovato

    const user = result.rows[0];
    // Confronta la password fornita con l'hash salvato
    if (await bcrypt.compare(password, user.password_hash)) {
        return user.nickname; // Login OK
    }
    return null; // Password errata
}

/** Aggiunge un nuovo utente al DB con password hashata. */
async function addUser(nickname, password) {
    // Genera l'hash della password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS); 
    
    try {
        await pool.query('INSERT INTO users (nickname, password_hash) VALUES ($1, $2)', [nickname, passwordHash]);
        return true;
    } catch (error) {
        // Codice errore 23505 è per violazione di chiave unica (nickname già esistente)
        if (error.code === '23505') return false; 
        throw error; // Rilancia altri errori DB
    }
}

/** Controlla se un nickname esiste nel DB. */
async function userExists(nickname) {
    const result = await pool.query('SELECT 1 FROM users WHERE nickname = $1', [nickname]);
    return result.rows.length > 0;
}


// =============== DATI SERVER (in RAM) ===============
// users[tempConnectionId] = { socket, nickname: "..." };
let users = {}; 
let nextTempId = 1; // ID temporaneo per l'oggetto socket in RAM
const MAX_MESSAGE_LENGTH = 65536; 

function checkMessageLength(data) {
    // Controlla la lunghezza del payload JSON serializzato (messaggio + file)
    return JSON.stringify(data).length <= MAX_MESSAGE_LENGTH * 1.5; 
}

// Funzione per trovare il TEMPORARY ID a partire dal nickname
function getTempIdByNickname(nickname) {
    for (const tempId in users) {
        if (users[tempId].nickname === nickname) {
            return Number(tempId);
        }
    }
    return null;
}

// Ottiene la lista degli utenti online (escluso l'utente corrente)
function getOnlineUsersList(currentNickname) {
    return Object.keys(users)
        .filter(tid => users[tid].nickname && users[tid].nickname !== currentNickname)
        .map(tid => ({ id: users[tid].nickname, nickname: users[tid].nickname }));
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

// =============== WEBSOCKET HANDLING ===============
wss.on("connection", socket => {
    const tempId = nextTempId++;
    users[tempId] = { socket, nickname: null, status: 'connecting' };

    socket.send(JSON.stringify({ type: "welcome", id: tempId })); 

    socket.on("message", async data => { 
        let msg;
        try { msg = JSON.parse(data.toString()); } catch (e) { return; }

        // ----- LOGIN / REGISTRAZIONE (ASINCRONO) -----
        
        if (msg.type === "login") {
            try {
                const loggedInNickname = await checkLogin(msg.nickname, msg.password);
                if (loggedInNickname) {
                    
                    // Verifica se l'utente è già connesso
                    const alreadyLoggedIn = Object.values(users).some(u => u.nickname === loggedInNickname && Number(Object.keys(users).find(key => users[key].socket === u.socket)) !== tempId);
                    if (alreadyLoggedIn) {
                        socket.send(JSON.stringify({ type: "login_fail", reason: "Utente già connesso." }));
                        return;
                    }

                    users[tempId].nickname = loggedInNickname;
                    users[tempId].status = 'connected';
                    
                    socket.send(JSON.stringify({ type: "login_success", nickname: loggedInNickname })); 

                    // Invia la lista degli online solo a questo utente
                    socket.send(JSON.stringify({ 
                        type: "online_users", 
                        users: getOnlineUsersList(loggedInNickname) 
                    }));
                    
                    // Notifica gli altri
                    broadcast({ type: "user_joined", id: loggedInNickname, nickname: loggedInNickname }, tempId);
                } else {
                    socket.send(JSON.stringify({ type: "login_fail", reason: "Nickname o password errati." }));
                }
            } catch (error) {
                console.error("Errore DB durante il login:", error);
                socket.send(JSON.stringify({ type: "login_fail", reason: "Errore interno del server." }));
            }
        }

        if (msg.type === "register") {
            try {
                const success = await addUser(msg.nickname, msg.password);
                
                if (success) {
                    // Login automatico
                    users[tempId].nickname = msg.nickname;
                    users[tempId].status = 'connected';

                    socket.send(JSON.stringify({ type: "register_success", nickname: msg.nickname })); 

                    // Invia la lista degli online solo a questo utente
                    socket.send(JSON.stringify({ 
                        type: "online_users", 
                        users: getOnlineUsersList(msg.nickname) 
                    }));

                    broadcast({ type: "user_joined", id: msg.nickname, nickname: msg.nickname }, tempId);
                } else {
                    socket.send(JSON.stringify({ type: "register_fail", reason: "Nickname già esistente." }));
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
            const file = msg.file; // Il campo file contiene dati Base64

            if (!text && !file) return; 
            
            // Controllo dimensione/struttura del payload totale
            if (!checkMessageLength(msg)) {
                console.log(`[AVVISO SICUREZZA] Utente ${senderNickname} ha tentato di inviare un payload troppo grande (channel).`);
                return; 
            }

            broadcast({ 
                type: "channel_message", 
                message: { 
                    id: senderNickname, // Usiamo il nickname come ID
                    nickname: senderNickname, 
                    text: text, 
                    file: file
                } 
            });
        }

        // ----- DM (MESSAGGIO PRIVATO CON GESTIONE FILE) -----
        if (msg.type === "dm") {
            const text = msg.text || "";
            const file = msg.file;

            if (!text && !file) return; 

            // Controllo dimensione/struttura del payload totale
            if (!checkMessageLength(msg)) {
                console.log(`[AVVISO SICUREZZA] Utente ${senderNickname} ha tentato di inviare un payload troppo grande (dm).`);
                return; 
            }

            const receiverNickname = msg.to; 
            const receiverTempId = getTempIdByNickname(receiverNickname); 
            const receiver = users[receiverTempId];
            
            // Non inviare se il destinatario non è online o è l'utente stesso
            if (!receiver || receiverTempId === tempId) return; 

            const payload = { 
                type: "dm", 
                message: { 
                    from: senderNickname, 
                    to: receiverNickname, 
                    nickname: senderNickname, 
                    text: text, 
                    file: file
                } 
            };
            
            // Invia al destinatario e a se stesso
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

// Prima di avviare il server, inizializza il DB in modo asincrono
initializeDB().then(() => {
    server.listen(PORT, () => {
        console.log(`Server avviato su http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error("Impossibile avviare il server a causa di un errore DB:", err);
    process.exit(1);
});