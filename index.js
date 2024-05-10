import express from 'express'
import path from 'path'
import http from 'http'
import fs from 'fs'
import { wss as wss1 } from './wsutils.js'
import { WebSocketServer } from 'ws';
import { ExpressPeerServer } from 'peer'
import cors from 'cors'


const __dirname = import.meta.dirname
const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

/*
const options = {
    key: fs.readFileSync(path.join(__dirname, "key.pem")),
    cert: fs.readFileSync(path.join(__dirname, "cert.pem")),
};

const server = https.createServer(options, app);
*/
const server = http.createServer(app);

app.get('/', async(req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = 7072
server.listen(port, () => {
    console.log(`server listening on port ${port}`)
})

let wss2
function createWebSocketServer(options){
    wss2 =  new WebSocketServer({ noServer: true, path: '/myapp/peerjs' });
    return wss2
}

const peerServer = ExpressPeerServer(server, {
	path: "/myapp",
    debug: true,
    port: 7072,
    createWebSocketServer
});

app.use("/peerjs", peerServer);


server.on("upgrade", (request, socket, head) => {
    console.log(request.url)
    if(request.url.includes('ws')){
        wss1.handleUpgrade(request, socket, head, (websocket) => {
            wss1.emit("connection", websocket, request);
        });
    } else {
        wss2.handleUpgrade(request, socket, head, (websocket) => {
            wss2.emit("connection", websocket, request);
        });
        
    }
  });
