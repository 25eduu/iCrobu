// Le variabili sono ora globali in app.js, le usiamo qui direttamente

// =================================== DOM REFERENCES ===================================
const nicknameInput = document.getElementById("nicknameInput");
const passwordInput = document.getElementById("passwordInput");
const togglePassword = document.getElementById("togglePassword");
const loginButton = document.getElementById("loginButton");
const registerButton = document.getElementById("registerButton");

// =================================== EVENT HANDLERS ===================================

// LOGICA OCCHIOLINO
if (passwordInput && togglePassword) {
    togglePassword.classList.add('hidden');

    passwordInput.addEventListener('input', () => {
        if (passwordInput.value.length > 0) {
            togglePassword.style.display = 'block';
        } else {
            togglePassword.style.display = 'none';
        }
    });

    togglePassword.onclick = () => {
        let type;
        if (passwordInput.getAttribute('type') === 'password') {
            type = 'text';
        } else {
            type = 'password';
        }

        passwordInput.setAttribute('type', type);
        // Cambia l'icona (sostituzione del ternario)
        if (type === 'password') {
            togglePassword.classList.add('hidden');
            togglePassword.classList.remove('visible');
        } else {
            togglePassword.classList.remove('hidden');
            togglePassword.classList.add('visible');
        }
    };
}


// LOGIN / REGISTRAZIONE
if (loginButton) {
    loginButton.onclick = () => {
        const nick = nicknameInput.value.trim();
        const pass = passwordInput.value;

        if (!nick || !pass) {
            return alert("Inserisci Nickname e Password.");
        }
        socket.send(JSON.stringify({ type: "login", nickname: nick, password: pass }));
    };
}

if (registerButton) {
    registerButton.onclick = () => {
        const nick = nicknameInput.value.trim();
        const pass = passwordInput.value;

        if (!nick || !pass) {
            return alert("Inserisci Nickname e Password.");
        }
        socket.send(JSON.stringify({ type: "register", nickname: nick, password: pass }));
    };
}

console.log("auth.js caricato");