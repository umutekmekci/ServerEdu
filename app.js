import express from 'express'
import path from 'path'
import http from 'http'
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

app.get('/.well-known/pki-validation/431B5564CDAD42D3F97D0D762C5EF490.txt', async(req, res) => {
    res.sendFile(path.join(__dirname, 'public', '431B5564CDAD42D3F97D0D762C5EF490.txt'));
});

const port = 7072
server.listen(port, () => {
    console.log(`server listening on port ${port}`)
})