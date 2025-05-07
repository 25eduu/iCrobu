
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const socket = new WebSocket('ws://https://zombsroyale.onrender.com');

let players = {};
let bullets = [];
let myId = null;

const keys = {};
let mouse = { x: 0, y: 0 };

document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);
canvas.addEventListener('mousedown', e => {
    const angle = Math.atan2(e.offsetY - players[myId].y, e.offsetX - players[myId].x);
    socket.send(JSON.stringify({ type: 'shoot', angle }));
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
