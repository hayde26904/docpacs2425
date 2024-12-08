const { name } = require('ejs');
const jwt = require('jsonwebtoken');
const express = require('express');
const session = require('express-session');
const path = require('path');
const { addParamsToURL } = require('./util');

const app = express();
const PORT = 3000;
const THIS_URL = 'http://localhost:' + PORT;
//const FB_URL = 'http://172.16.3.100:420';
const FB_URL = 'https://formbar.yorktechapps.com';
const AUTH_URL = FB_URL + '/oauth';
const SECRET = "guh";

const http = require('http').Server(app);
const io = require('socket.io')(http);

const commands = require('./commands');

let sessionMiddleware = session({
    secret: SECRET,
    resave: false,
    saveUninitialized: false
});

let chats = new Set();

app.set('view engine', 'ejs');
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

function isLoggedIn(req, res, next) {
    if(req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

http.listen(PORT, () => {
    console.log(`Server is running on ${THIS_URL}`);
});

app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

io.on('connection', (socket) => {
    console.log('User Connected');
    socket.user = socket.request.session.user;

    socket.on('chat message', (data) => {
        let message = data.message;
        let user = data.user;

        if(message[0] === '/'){
            const tokens = message.split(' ');
            const command = tokens[0];
            const args = tokens.slice(1);

            if(commands.commandMap.has(command)){
                const commandFunction = commands.commandMap.get(command);
                const result = commandFunction(args, io, socket);
                
                if(result){
                    socket.emit('chat message', { message: result, user: { name: 'Server' } });
                }

            } else {
                socket.emit('chat message', { message: 'Invalid Command', user: { name: 'Server' } });
            }

        } else {
            io.emit('chat message', { message, user });
        }

    });

    socket.on('disconnect', () => {
        console.log('User Disconnected');
    });
});

app.get('/login', async (req, res) => {

    if (!req.query.token) {
        const redirectUrl = addParamsToURL(`${AUTH_URL}`, { redirectURL: `${THIS_URL}/login` });
        res.redirect(redirectUrl);
        return;
    }

    let tokenData = jwt.decode(req.query.token);
    req.session.user = tokenData;

    res.redirect('/');
});

app.get('/', isLoggedIn, (req, res) => {
    res.render('chat', { user: req.session.user });
});