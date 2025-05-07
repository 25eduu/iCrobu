const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const socket = new WebSocket('wss://zombsroyale.onrender.com');

let players = {};
let bullets = [];
let myId = null;
let nickname = null;
let gameStarted = false;

const keys = {};
let mouse = { x: 0, y: 0 };

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

// 🟢 Quando premi "Gioca"
document.getElementById('playButton').addEventListener('click', () => {
    nickname = document.getElementById('nicknameInput').value.trim();
    if (nickname) {
        document.getElementById('startScreen').style.display = 'none';
        gameStarted = true;

        // Invia al server il nickname
        socket.send(JSON.stringify({ type: 'join', nickname }));
    }
});

// 🟢 Funzione aggiornata per disegnare il player con nickname
function drawPlayer(player, isSelf = false) {
    if (!player) return;
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
