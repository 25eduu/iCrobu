const path = require('path');
const express = require('express');
const app = express();
const http = require('http');
const WebSocket = require('ws');

const MAP_WIDTH = 3000;
const MAP_HEIGHT = 3000;


// 1) HTTP server con Express
app.use(express.static(path.join(__dirname))); // serve index.html, client.js, ecc.

const server = http.createServer(app);

// 2) WebSocket accorpato allo stesso server HTTP
const wss = new WebSocket.Server({ server });

let players = {};
let bullets = [];
let idCounter = 0;

let pistolAmmoPacks = [];
let shotgunAmmoPacks = [];

const WEAPONS = {
  pistol: { damage: 10, speed: 8, range: 800 },
  shotgun: { damage: 20, speed: 5, range: 600 }
};

wss.on('connection', socket => {
  const id = ++idCounter;

  //  🟢 Inizializzazione con dati di base
  players[id] = { 
    x: Math.random() * MAP_WIDTH, 
    y: Math.random() * MAP_HEIGHT, 
    hp: 100, 
    nickname: 'Player' + id, 
    weapon: 'pistol',
    isAlive: true 
  };

  // Invia init a questo client
  socket.send(JSON.stringify({ type: 'init', id, players }));
  broadcast({ type: 'update', id, player: players[id] });

  socket.on('message', msgStr => {
    const msg = JSON.parse(msgStr);
    console.log(`[SERVER] Ricevuto messaggio:`, msg); // ✅ Controllo di tutti i messaggi ricevuti

    // Non processare messaggi per giocatori non vivi
    if (!players[id]) return;
  
    // 🟢 Imposta il nickname al momento della connessione
    if (msg.type === 'join' && msg.nickname) {
      players[id].nickname = msg.nickname;
      players[id].isAlive = true;
      players[id].hp = 100;
      players[id].x = Math.random() * 3000;
      players[id].y = Math.random() * 3000;
      broadcast({ type: 'update', id, player: players[id] });
    }

    // 🔄 Cambio arma
    else if (msg.type === 'changeWeapon' && WEAPONS[msg.weapon]) {
      players[id].weapon = msg.weapon;
      broadcast({ type: 'update', id, player: players[id] });
    }

    else if (msg.type === 'move' && players[id]) {
      players[id].x = msg.x;
      players[id].y = msg.y;
      broadcast({ type: 'update', id, player: players[id] });

    } else if (msg.type === 'shoot' && players[id]) {
      console.log(`[SERVER] Messaggio di sparo ricevuto da ${id} con arma ${msg.weapon}`);

      const weapon = WEAPONS[msg.weapon] || WEAPONS[players[id].weapon];
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
    else if (msg.type === 'respawn' && players[id]) {
    players[id].hp = 100;
    players[id].isAlive = true;
    players[id].x = Math.random() * 3000;
    players[id].y = Math.random() * 3000;
    players[id].ammo = { pistol: 15, shotgun: 5 }; // Ricarica le munizioni
    
    // Controlliamo che broadcast funzioni
    broadcast({ type: 'respawned', id, player: players[id] });
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
    if (c.readyState === WebSocket.OPEN) {
      try {
        c.send(s);
      } catch (e) {
        console.error(`Errore nell'invio del messaggio: ${e.message}`);
      }
    }
  });
}

// aggiornamento proiettili + collisioni
function updateBullets() {
  for (let b of bullets) {
    b.x += b.dx;
    b.y += b.dy;
    b.life--;

    for (let pid in players) {
      if (pid != b.owner && players[pid] && players[pid].isAlive) {
        const p = players[pid];
        if (Math.hypot(p.x - b.x, p.y - b.y) < 12) {
          p.hp -= b.damage;

          if (p.hp <= 0) {
            p.isAlive = false;
            broadcast({ type: 'kill', killerId: b.owner, victimId: pid });
            broadcast({ type: 'died', id: pid });
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

function spawnAmmo(type) {
    const ammoPack = {
        id: Math.random().toString(36).substring(2, 9),
        x: Math.random() * MAP_WIDTH,
        y: Math.random() * MAP_HEIGHT,
        type: type
    };

    if (type === 'pistol') {
        pistolAmmoPacks.push(ammoPack);
    } else if (type === 'shotgun') {
        shotgunAmmoPacks.push(ammoPack);
    }

    // 🔄 Invia l'aggiornamento ai client
    broadcast({
        type: 'ammo_spawn',
        ammoPack
    });
}

function checkAmmoPickup() {
    for (let id in players) {
        const player = players[id];

        if (player.isAlive) {
            // Controllo munizioni pistola
            pistolAmmoPacks = pistolAmmoPacks.filter(pack => {
                if (Math.hypot(pack.x - player.x, pack.y - player.y) < 20) {
                    // Incrementa le munizioni sul client
                    broadcast({ 
                        type: 'ammo_pickup', 
                        playerId: id, 
                        weapon: 'pistol',
                        amount: 10  // Puoi decidere il valore che preferisci
                    });
                    return false; // Rimuove l'oggetto dall'array
                }
                return true;
            });

            // Controllo munizioni fucile a pompa
            shotgunAmmoPacks = shotgunAmmoPacks.filter(pack => {
                if (Math.hypot(pack.x - player.x, pack.y - player.y) < 20) {
                    broadcast({ 
                        type: 'ammo_pickup', 
                        playerId: id, 
                        weapon: 'shotgun',
                        amount: 5
                    });
                    return false;
                }
                return true;
            });
        }
    }
}

// Controllo ogni 100ms
setInterval(checkAmmoPickup, 300);

// Spawn ogni 30 secondi
setInterval(() => {
    spawnAmmo('pistol');
    spawnAmmo('shotgun');
}, 15000);

setInterval(updateBullets, 1000 / 30);

// 3) Avvia tutto su porta 10000
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Game running on port ${PORT}`));