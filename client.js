const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const socket = new WebSocket('wss://zombsroyale.onrender.com');

let players = {};
let bullets = [];
let myId = null;

const keys = {};
let mouse = { x: 0, y: 0 };

// Costanti per la mappa
const MAP_WIDTH = 3000;
const MAP_HEIGHT = 3000;

document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);
canvas.addEventListener('mousedown', e => {
    if (players[myId]) {
        const angle = Math.atan2(e.offsetY - players[myId].y, e.offsetX - players[myId].x);
        socket.send(JSON.stringify({ type: 'shoot', angle }));
    }
});
canvas.addEventListener('mousemove', e => {
    mouse.x = e.offsetX;
    mouse.y = e.offsetY;
});

function drawPlayer(player, isSelf = false) {
    ctx.fillStyle = isSelf ? 'lime' : 'red';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillText(player.hp + " HP", player.x - 15, player.y - 15);
}

function drawBullet(bullet) {
    ctx.fillStyle = 'yellow';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
    ctx.fill();
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (myId && players[myId]) {
        let me = players[myId];
        if (keys['w']) me.y = Math.max(0, me.y - 2);
        if (keys['s']) me.y = Math.min(MAP_HEIGHT, me.y + 2);
        if (keys['a']) me.x = Math.max(0, me.x - 2);
        if (keys['d']) me.x = Math.min(MAP_WIDTH, me.x + 2);
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

socket.onmessage = event => {
    const msg = JSON.parse(event.data);

    if (msg.type === 'init') {
        myId = msg.id;
        players = msg.players;
    } else if (msg.type === 'update') {
        players[msg.id] = msg.player;
        updateMinimap(msg.players);
    } else if (msg.type === 'remove') {
        delete players[msg.id];
    } else if (msg.type === 'bullets') {
        bullets = msg.bullets;
    } else if (msg.type === 'kill') {
        console.log("Kill event received:", msg); // 🔍 Debug: Contenuto del messaggio di kill

        if (msg.killerId === myId) {
            console.log("You made a kill!"); // 🔍 Debug: Hai effettuato una kill
            killCount++;
            updateInfoPanel();
        }
    }
};

// --- Minimap Implementation ---
const minimap = document.createElement('canvas');
minimap.width = 200;
minimap.height = 200;
minimap.style.position = 'absolute';
minimap.style.top = '10px';
minimap.style.right = '10px';
minimap.style.border = '2px solid white';
minimap.style.backgroundColor = '#111';
document.body.appendChild(minimap);

const minimapCtx = minimap.getContext('2d');
const SCALE = 0.066; // 200px / 3000px

// Elemento per le kill e il timer
const infoPanel = document.createElement('div');
infoPanel.style.position = 'absolute';
infoPanel.style.top = '220px';
infoPanel.style.right = '10px';
infoPanel.style.color = 'white';
infoPanel.style.backgroundColor = '#333';
infoPanel.style.padding = '5px';
infoPanel.style.borderRadius = '5px';
infoPanel.style.textAlign = 'center';
document.body.appendChild(infoPanel);

let killCount = 0;
let timeLeft = 300; // 5 minuti
let safeZone = { x: 1500, y: 1500, radius: 300 };

// Funzione per aggiornare le informazioni
function updateInfoPanel() {
    infoPanel.innerHTML = `Kills: ${killCount} <br> Safe Zone in: ${timeLeft}s`;
}

// Disegna la minimappa con giocatori e Safe Zone
function updateMinimap(players) {
    minimapCtx.clearRect(0, 0, minimap.width, minimap.height);

    // Disegna la safe zone
    minimapCtx.strokeStyle = 'white';
    minimapCtx.beginPath();
    minimapCtx.arc(safeZone.x * SCALE, safeZone.y * SCALE, safeZone.radius * SCALE, 0, 2 * Math.PI);
    minimapCtx.stroke();

    // Disegna i giocatori
    for (const id in players) {
        const p = players[id];
        minimapCtx.fillStyle = id === myId ? 'green' : 'blue';
        minimapCtx.beginPath();
        minimapCtx.arc(p.x * SCALE, p.y * SCALE, 2, 0, Math.PI * 2);
        minimapCtx.fill();
    }

    // Aggiorna il pannello informativo
    updateInfoPanel();
}

// Timer per la safe zone
setInterval(() => {
    if (timeLeft > 0) {
        timeLeft--;
    } else {
        if (safeZone.radius > 50) {
            safeZone.radius -= 10;
        }
        timeLeft = 60;
    }
    updateInfoPanel();
}, 1000);

gameLoop();
