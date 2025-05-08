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

const WEAPONS = {
  punch: { damage: 5, speed: 0, range: 40 },
  pistol: { damage: 10, speed: 8, range: 800 },
  shotgun: { damage: 20, speed: 5, range: 600 }
};

wss.on('connection', socket => {
  const id = ++idCounter;

  //  🟢 Inizializzazione con dati di base
  players[id] = { x: 400, y: 300, hp: 100, nickname: 'Player' + id,weapon: 'punch' };

  // Invia init a questo client
  socket.send(JSON.stringify({ type: 'init', id, players }));
  broadcast({ type: 'update', id, player: players[id] });

  socket.on('message', msgStr => {
    const msg = JSON.parse(msgStr);
    console.log(`[SERVER] Ricevuto messaggio:`, msg); // ✅ Controllo di tutti i messaggi ricevuti

  
    // 🟢 Imposta il nickname al momento della connessione
    if (msg.type === 'join' && msg.nickname) {
      players[id].nickname = msg.nickname;
      broadcast({ type: 'update', id, player: players[id] });
    }

    // 🔄 Cambio arma
    if (msg.type === 'changeWeapon' && WEAPONS[msg.weapon]) {
      players[id].weapon = msg.weapon;
      console.log(`[SERVER] ${id} ha cambiato arma in ${msg.weapon}`); // ✅ Log di cambio arma
      broadcast({ type: 'update', id, player: players[id] });
    }

    if (msg.type === 'move' && players[id]) {
      players[id].x = msg.x;
      players[id].y = msg.y;
      broadcast({ type: 'update', id, player: players[id] });

    } else if (msg.type === 'shoot' && players[id]) {
      console.log(`[SERVER] Messaggio di sparo ricevuto da ${id} con arma ${msg.weapon}`);
      const weapon = WEAPONS[players[id].weapon];
      

    // 🥊 Attacco ravvicinato (pugno)
    if (players[id].weapon === 'punch') {
      console.log(`[SERVER] Attacco pugno confermato - Verifico il danno...`);
      for (let pid in players) {
        if (pid != id && players[pid]) {
          const p = players[pid];
          const distance = Math.hypot(p.x - players[id].x, p.y - players[id].y);
                    console.log(`Distanza tra ${id} e ${pid}: ${distance}`); // Verifica la distanza
          if (Math.hypot(p.x - players[id].x, p.y - players[id].y) < weapon.range) {
            console.log(`Attacco riuscito su ${pid} a distanza: ${Math.hypot(p.x - players[id].x, p.y - players[id].y)}`);
            p.hp -= weapon.damage;
            if (p.hp <= 0) {
              broadcast({ type: 'kill', killerId: id, victimId: pid });
              delete players[pid];
              broadcast({ type: 'remove', id: pid });
            } else {
              broadcast({ type: 'update', id: pid, player: p });
            }
          }
        }
      }
    } else {
      // 🔫 Pistola o fucile
      bullets.push({
        x: players[id].x,
        y: players[id].y,
        dx: Math.cos(msg.angle) * weapon.speed,
        dy: Math.sin(msg.angle) * weapon.speed,
        owner: id,
        life: weapon.range / weapon.speed,
        damage: weapon.damage
      });
    }
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

// 3) Avvia tutto su porta 10000
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Game running on port ${PORT}`));
