const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const socket = new WebSocket('wss://zombsroyale.onrender.com');
const MAP_WIDTH = 3000; // Larghezza totale della mappa
const MAP_HEIGHT = 3000; // Altezza totale della mappa

let players = {};
let bullets = [];
let myId = null;
let nickname = null;
let gameStarted = false;
let isLoggedIn = false;
let selectedWeapon = "pistol";
let killCount = 0;

const keys = {};
let mouse = { x: 0, y: 0 };

// Minimappa Implementation for ZombsRoyale Clone
const minimap = document.createElement('canvas');
minimap.id = 'minimap';
minimap.width = 200;
minimap.height = 200;
document.body.appendChild(minimap);

// Kill Counter Element
const killCounterDiv = document.createElement('div');
killCounterDiv.id = 'killCounter';
killCounterDiv.style.position = 'fixed';
killCounterDiv.style.top = '230px';
killCounterDiv.style.right = '20px';
killCounterDiv.style.color = 'white';
killCounterDiv.style.backgroundColor = 'rgba(44, 48, 54, 0.7)';
killCounterDiv.style.padding = '10px';
killCounterDiv.style.borderRadius = '8px';
killCounterDiv.innerText = `Kills: 0`;
document.body.appendChild(killCounterDiv);

const minimapCtx = minimap.getContext('2d');
const SCALE = 0.1; // Ratio for minimap scaling

function updateMinimap(players) {
    minimapCtx.clearRect(0, 0, minimap.width, minimap.height);

    // Disegna i giocatori, ma non disegnarli se non è loggato
    for (const id in players) {
        const p = players[id];
        if (isLoggedIn) {
            minimapCtx.fillStyle = id === myId ? 'green' : 'blue';
        } else {
            minimapCtx.fillStyle = 'gray'; // Colore dei giocatori non visibili durante il login
        }
        minimapCtx.fillRect(p.x * SCALE, p.y * SCALE, 5, 5);
    }
}

// Create Death Screen
const deathScreen = document.createElement('div');
deathScreen.id = 'deathScreen';
deathScreen.style.display = 'none';
deathScreen.style.position = 'fixed';
deathScreen.style.top = '0';
deathScreen.style.left = '0';
deathScreen.style.width = '100%';
deathScreen.style.height = '100%';
deathScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
deathScreen.style.zIndex = '1000';
deathScreen.style.justifyContent = 'center';
deathScreen.style.alignItems = 'center';
deathScreen.style.flexDirection = 'column';
deathScreen.innerHTML = `
    <h2 style="color: white; margin-bottom: 20px;">You Died!</h2>
    <p style="color: white; margin-bottom: 20px;">Kills: <span id="finalKills">0</span></p>
    <button id="respawnButton" style="
        padding: 10px 20px; 
        background-color: #4a8af4; 
        color: white; 
        border: none; 
        border-radius: 8px; 
        cursor: pointer;
    ">Respawn</button>
`;
document.body.appendChild(deathScreen);

// Respawn button event listener
document.getElementById('respawnButton').addEventListener('click', () => {
    deathScreen.style.display = 'none';
    showLoginScreen();
});

// Initialize kill counter div and death screen as hidden
killCounterDiv.style.display = 'none';
deathScreen.style.display = 'none';

document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

canvas.addEventListener('mousemove', e => {
    mouse.x = e.offsetX;
    mouse.y = e.offsetY;
});

// Funzione per mostrare la schermata di login
function showLoginScreen() {
    const startScreen = document.getElementById('startScreen');
    if (startScreen) {
        startScreen.style.display = 'flex';
        
        // Pre-fill the nickname input
        const nicknameInput = document.getElementById('nicknameInput');
        if (nicknameInput && nickname) {
            nicknameInput.value = nickname;
        }
    }
    
    // Resetta lo stato del gioco
    gameStarted = false;
    isLoggedIn = false;
    players = {};
    bullets = [];
    killCount = 0;
    
    // Nascondi elementi di gioco
    killCounterDiv.style.display = 'none';
    
    // Aggiorna la minimappa anche se il giocatore non è ancora loggato
    updateMinimap(players);
}

function updateKillCounter() {
    killCounterDiv.innerText = `Kills: ${killCount}`;
}

// 🟢 Quando premi "Gioca"
document.getElementById('playButton').addEventListener('click', () => {
    const nicknameInput = document.getElementById('nicknameInput');
    const startScreen = document.getElementById('startScreen');
    
    isLoggedIn = true;
    nickname = nicknameInput.value.trim();
    const minLength = 3;
    const maxLength = 16;
    const nicknameRegex = /^[a-zA-Z0-9_]+$/; // Solo lettere, numeri e underscore
    
    if (nickname.length < minLength || nickname.length > maxLength) {
        alert(`Il nickname deve essere tra ${minLength} e ${maxLength} caratteri.`);
        return;
    }
    
    if (!nicknameRegex.test(nickname)) {
        alert("Il nickname può contenere solo lettere, numeri e underscore (_).");
        return;
    }
    
    // Nascondi schermata di login
    if (startScreen) {
        startScreen.style.display = 'none';
    }
    
    gameStarted = true;
    
    // Mostra elementi di gioco
    killCounterDiv.style.display = 'block';
    
    // Log per vedere cosa viene inviato
    console.log('Invio nickname al server:', nickname);
    
    // Invia al server il nickname
    socket.send(JSON.stringify({ type: 'join', nickname }));
});

// 🟢 Funzione aggiornata per disegnare il player con nickname
function drawPlayer(player, isSelf = false, offsetX = 0, offsetY = 0) {
    if (!gameStarted || !player) return; // 🔴 Non disegna se il gioco non è partito
    ctx.fillStyle = isSelf ? 'lime' : 'red';
    ctx.beginPath();
    ctx.arc(player.x - offsetX, player.y - offsetY, 10, 0, Math.PI * 2);
    ctx.fill();

    // Nickname sopra il giocatore
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(player.nickname || 'Player', player.x - offsetX, player.y - 15 - offsetY);

    // HP sotto il nickname
    ctx.fillText(player.hp + " HP", player.x - offsetX, player.y - 25 - offsetY);
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameStarted && myId && players[myId]) {
        let me = players[myId];

        // 🔄 Movimento limitato ai bordi della mappa
        if (keys['w'] && me.y > 0) me.y -= 2;
        if (keys['s'] && me.y < MAP_HEIGHT - 10) me.y += 2;
        if (keys['a'] && me.x > 0) me.x -= 2;
        if (keys['d'] && me.x < MAP_WIDTH - 10) me.x += 2;

        // 🔄 Inviamo subito al server il movimento
        socket.send(JSON.stringify({ type: 'move', x: me.x, y: me.y }));

        // 🔄 Calcolo dell'offset della camera
        const offsetX = Math.max(0, Math.min(me.x - canvas.width / 2, MAP_WIDTH - canvas.width));
        const offsetY = Math.max(0, Math.min(me.y - canvas.height / 2, MAP_HEIGHT - canvas.height));

        // 🔄 Disegna i giocatori con offset di camera
        for (let id in players) {
            const p = players[id];
            if (p.x > offsetX - 50 && p.x < offsetX + canvas.width + 50 &&
                p.y > offsetY - 50 && p.y < offsetY + canvas.height + 50) {
                drawPlayer(p, id === myId, offsetX, offsetY);
            }
        }

        // 🔄 Disegna i proiettili con offset di camera
        for (let bullet of bullets) {
            if (bullet.x > offsetX && bullet.x < offsetX + canvas.width &&
                bullet.y > offsetY && bullet.y < offsetY + canvas.height) {
                drawBullet(bullet, offsetX, offsetY);
            }
        }

        // 🔄 Aggiorna la minimappa
        updateMinimap(players);
    }

    requestAnimationFrame(gameLoop);
}

function drawBullet(bullet, offsetX = 0, offsetY = 0) {
    ctx.fillStyle = 'yellow';
    ctx.beginPath();
    ctx.arc(bullet.x - offsetX, bullet.y - offsetY, 3, 0, Math.PI * 2);
    ctx.fill();
}

socket.onmessage = event => {
    const msg = JSON.parse(event.data);

    if (msg.type === 'init') {
        myId = msg.id;
        players = msg.players;
    } else if (msg.type === 'update') {
        players[msg.id] = msg.player;
    } else if (msg.type === 'remove') {
        delete players[msg.id];
    } else if (msg.type === 'bullets') {
        bullets = msg.bullets;
    } else if (msg.type === 'kill') {
        if (msg.killerId === myId) {
            killCount++;
            updateKillCounter();
        }
    } else if (msg.type === 'died') {
        // Mostra schermata di morte se il giocatore è morto
        if (msg.id === myId) {
            gameStarted = false;
            document.getElementById('finalKills').textContent = killCount;
            deathScreen.style.display = 'flex';
            killCounterDiv.style.display = 'none';
        }
    }
};

// Variabili globali
let ammo = {
    pistol: 15,
    shotgun: 5
};

// Ascolta i click sulla barra
document.getElementById('pistol').addEventListener('click', () => {
    selectedWeapon = "pistol";
    socket.send(JSON.stringify({ type: 'changeWeapon', weapon: 'pistol' }));
    console.log("[CLIENT] Cambio arma in pistola");
});

document.getElementById('shotgun').addEventListener('click', () => {
    selectedWeapon = "shotgun";
    socket.send(JSON.stringify({ type: 'changeWeapon', weapon: 'shotgun' }));
    console.log("[CLIENT] Cambio arma in fucile a pompa");
});

// Aggiorna il testo dei pulsanti
function updateWeaponUI() {
    document.getElementById('pistol').innerText = `Pistola (${ammo.pistol})`;
    document.getElementById('shotgun').innerText = `Fucile (${ammo.shotgun})`;
}

// Logica di sparo
canvas.addEventListener('mousedown', e => {
    if (gameStarted) {
        // Calcolo dell'offset della telecamera
         const offsetX = Math.max(0, Math.min(players[myId].x - canvas.width / 2, MAP_WIDTH - canvas.width));
         const offsetY = Math.max(0, Math.min(players[myId].y - canvas.height / 2, MAP_HEIGHT - canvas.height));

          // Calcola la posizione reale del mouse nella mappa
        const realMouseX = e.offsetX + offsetX;
        const realMouseY = e.offsetY + offsetY;

         // Calcolo corretto dell'angolo
        const angle = Math.atan2(realMouseY - players[myId].y, realMouseX - players[myId].x);

        if (selectedWeapon === "pistol" && ammo.pistol > 0) {
            ammo.pistol--;
            socket.send(JSON.stringify({ type: 'shoot', weapon: 'pistol', angle }));
            
        } else if (selectedWeapon === "shotgun" && ammo.shotgun > 0) {
            ammo.shotgun--;
            socket.send(JSON.stringify({ type: 'shoot', weapon: 'shotgun', angle }));
        }
        
        updateWeaponUI();
    }
});




gameLoop();