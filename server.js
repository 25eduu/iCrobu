const path = require('path');
const express = require('express');
const app = express();
const http = require('http');
const WebSocket = require('ws');

// 1) HTTP server con Express
app.use(express.static(path.join(__dirname))); // serve index.html, client.js, ecc.

const server = http.createServer(app);

// 2) WebSocket accorpato allo stesso server HTTP
const wss = new WebSocket.Server({ server });

let players = {};
let bullets = [];
let idCounter = 0;

wss.on('connection', socket => {
  const id = ++idCounter;

  //  🟢 Inizializzazione con dati di base
  players[id] = { x: 400, y: 300, hp: 100, nickname: 'Player' + id };

  // Invia init a questo client
  socket.send(JSON.stringify({ type: 'init', id, players }));
  broadcast({ type: 'update', id, player: players[id] });

  socket.on('message', msgStr => {
    const msg = JSON.parse(msgStr);

  
    // 🟢 Imposta il nickname al momento della connessione
    if (msg.type === 'join' && msg.nickname) {
      console.log(`Giocatore con nickname: ${msg.nickname} sta entrando`);
      players[id].nickname = msg.nickname;
      broadcast({ type: 'update', id, player: players[id] });
    }

    if (msg.type === 'move' && players[id]) {
      players[id].x = msg.x;
      players[id].y = msg.y;
      broadcast({ type: 'update', id, player: players[id] });
    } else if (msg.type === 'shoot' && players[id]) {
      const speed = 5;
      bullets.push({
        x: players[id].x,
        y: players[id].y,
        dx: Math.cos(msg.angle) * speed,
        dy: Math.sin(msg.angle) * speed,
        owner: id,
        life: 60
      });
    }
  });

  socket.on('close', () => {
    delete players[id];
    broadcast({ type: 'remove', id });
  });
});

function broadcast(o) {
  const s = JSON.stringify(o);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(s);
  });
}

// aggiornamento proiettili + collisioni
function updateBullets() {
  for (let b of bullets) {
    b.x += b.dx;
    b.y += b.dy;
    b.life--;

    for (let pid in players) {
      if (pid != b.owner && players[pid]) {
        const p = players[pid];
        if (Math.hypot(p.x - b.x, p.y - b.y) < 12) {
          p.hp -= 20;

          if (p.hp <= 0) {
            broadcast({ type: 'kill', killerId: b.owner, victimId: pid });
            delete players[pid];
            broadcast({ type: 'remove', id: pid });
          } else {
            broadcast({ type: 'update', id: pid, player: p });
          }
          b.life = 0;
        }
      }
    }
  }
  bullets = bullets.filter(b => b.life > 0);
  broadcast({ type: 'bullets', bullets });
}

setInterval(updateBullets, 1000 / 30);

// 3) Avvia tutto su porta 3000
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Game running on port ${PORT}`));
