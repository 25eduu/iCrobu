const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const socket = new WebSocket('wss://zombsroyale.onrender.com');
const safeZone = { x: 500, y: 500, radius: 200 }; // Può essere dinamica

let players = {};
let bullets = [];
let myId = null;
let nickname = null;
let gameStarted = false;
let isLoggedIn = false; // Nuova variabile per verificare se il giocatore ha fatto login


const keys = {};
let mouse = { x: 0, y: 0 };

// Minimappa Implementation for ZombsRoyale Clone
const minimap = document.createElement('canvas');
minimap.id = 'minimap'; // Assicurati che la minimappa abbia un ID per stilizzarla
minimap.width = 200;
minimap.height = 200;
minimap.style.position = 'absolute';
minimap.style.top = '10px';
minimap.style.right = '10px';
minimap.style.border = '2px solid white';
minimap.style.backgroundColor = '#111';
document.body.appendChild(minimap);

const minimapCtx = minimap.getContext('2d');
const SCALE = 0.1; // Ratio for minimap scaling

function updateMinimap(players) {
    minimapCtx.clearRect(0, 0, minimap.width, minimap.height);

    // Disegna la safe zone
    minimapCtx.strokeStyle = 'white';
    minimapCtx.beginPath();
    minimapCtx.arc(safeZone.x * SCALE, safeZone.y * SCALE, safeZone.radius * SCALE, 0, 2 * Math.PI);
    minimapCtx.stroke();

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

    // Aggiorna il pannello informativo
    updateInfoPanel();
}

document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);
canvas.addEventListener('mousedown', e => {
    if (gameStarted) {
        const angle = Math.atan2(e.offsetY - players[myId].y, e.offsetX - players[myId].x);
        socket.send(JSON.stringify({ type: 'shoot', angle }));
    }
});
canvas.addEventListener('mousemove', e => {
    mouse.x = e.offsetX;
    mouse.y = e.offsetY;
});

// Funzione per mostrare la schermata di login
function showLoginScreen() {
    document.getElementById('startScreen').style.display = 'block';
    document.getElementById('overlay').style.display = 'block';
    // Aggiorna la minimappa anche se il giocatore non è ancora loggato
    updateMinimap(players);
}

// Mostra il login
showLoginScreen();

// 🟢 Quando premi "Gioca"
document.getElementById('playButton').addEventListener('click', () => {
    isLoggedIn = true;
    nickname = document.getElementById('nicknameInput').value.trim();
    if (nickname) {
        // Nascondi schermata di login e overlay
        document.getElementById('startScreen').style.display = 'none';
        document.getElementById('overlay').style.display = 'none';
        
        gameStarted = true;
        // Log per vedere cosa viene inviato
        console.log('Invio nickname al server:', nickname);
        
        // Invia al server il nickname
        socket.send(JSON.stringify({ type: 'join', nickname }));
    }
});

// 🟢 Funzione aggiornata per disegnare il player con nickname
function drawPlayer(player, isSelf = false) {
    if (!gameStarted || !player) return; // 🔴 Non disegna se il gioco non è partito
    ctx.fillStyle = isSelf ? 'lime' : 'red';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 10, 0, Math.PI * 2);
    ctx.fill();

    // Nickname sopra il giocatore
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(player.nickname || 'Player', player.x, player.y - 15);

    // HP sotto il nickname
    ctx.fillText(player.hp + " HP", player.x, player.y - 25);
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameStarted && myId && players[myId]) {
        let me = players[myId];
        if (keys['w']) me.y -= 2;
        if (keys['s']) me.y += 2;
        if (keys['a']) me.x -= 2;
        if (keys['d']) me.x += 2;
        socket.send(JSON.stringify({ type: 'move', x: me.x, y: me.y }));
    }

    for (let id in players) {
        drawPlayer(players[id], id === myId);
    }

    for (let bullet of bullets) {
        drawBullet(bullet);
    }

    requestAnimationFrame(gameLoop);
}

function drawBullet(bullet) {
    ctx.fillStyle = 'yellow';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
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
    }
};

gameLoop();
