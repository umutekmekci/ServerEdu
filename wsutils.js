import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
const wss = new WebSocketServer({ noServer: true, path: '/ws' });

const connections = new Map()
let masterIsConnected = false
const masterShape = {width:1, height: 1}
const MESSAGECODE = ['move-end', 'client-move-end', 'move-end-img', 'client-move-end-img', 'add-image', 'client-add-image', 'sync', 'translate-all-objects', 'updatexy', 'update-border', 'pen-transfer', 'image-transfer', 'scale-factor', 'widget']

let SyncTarget = null

function isMessageJson(message){
    return message.slice(0,1)[0] === 123
}

wss.on('connection', (socket, request)=> {
    if(connections.has(socket)){
        console.log('duplicate connection request')
    }
    connections.set(socket, {uuid: uuidv4(), role: null, shape:null})   
    console.log(`got connection request from ${connections.get(socket).uuid}`)  

    socket.on('message', (message)=> {
        const clientInfo = connections.get(socket)
        let decoded
        if(isMessageJson(message)){
            try{
                decoded = JSON.parse(message)
            } catch(ex){
                console.log(ex)
                decoded = {event: 'invalid'}
            }
        } else {
            const messageCode = new Uint32Array(message.slice(0,4))[0]
            const event = MESSAGECODE[messageCode]
            decoded = {event}
        }

        if(decoded.event === 'move-start' || decoded.event === 'master-role' || decoded.event === 'resize'){
            console.log(`got data from ${clientInfo.uuid} role: ${clientInfo.role}`)
            console.log(decoded)
        }

        switch(decoded.event){
            case 'master-role': {
                if(connections.size === 1){
                    clientInfo.role = 'master'
                    masterIsConnected = true
                    masterShape.width = decoded.data.width
                    masterShape.height = decoded.data.height
                    socket.send(JSON.stringify({
                        event: 'master-role',
                        data: { success: true }
                    }))
                }
                break
            }
            case 'heart-beat':
            case 'invalid': {
                console.log('heart-beat')
                break
            }
            case 'viewbox-coord':{
                clientInfo.shape = {...decoded.data}
                if(clientInfo.role === 'master'){
                    masterShape.width = decoded.data.width
                    masterShape.height = decoded.data.height
                }
                if(clientInfo.role === 'slave'){  //this condition does not happen, in the 'role' event shape is sent to slave
                    socket.send(JSON.stringify({
                        event: 'viewbox-coord',
                        data: { ...masterShape }
                    }))
                }
                console.log(`${clientInfo.uuid} ${clientInfo.role} set its viewbox dimensions to w:${clientInfo.shape.width}, h:${clientInfo.shape.height}`)
                break
            }
            case 'widget':
            case 'scale-factor':
            case 'image-transfer':
            case 'pen-transfer':
            case 'update-border':
            case 'updatexy':
            case 'translate-all-objects':
            case 'move-end':
            case 'client-move-end':
            case 'move-end-img':
            case 'client-move-end-img':
            case 'add-image':{
                for(let [conn, other] of connections){
                    if(other.uuid !== clientInfo.uuid){
                        console.log(`sending data to ${other.uuid}`)
                        conn.send(message)
                    }
                }
                break
            }
            case 'client-sync':
            {
                if(SyncTarget == null)
                {
                    clientInfo.role = 'slave'
                    console.log('got client-sync')
                    SyncTarget = clientInfo.uuid
                    for(let [conn, other] of connections){
                        if(other.role === 'master'){
                            conn.send(JSON.stringify({
                                event:'client-sync',
                                data: ''
                            }))
                        }
                    }
                }
                else
                {
                    socket.send(JSON.stringify(
                    {
                        event:'master-is-in-sync-state',
                        data: ''
                    }))
                }
                break
            }
            case 'sync':
            {
                console.log('sending sync')
                for(let [conn, other] of connections){
                    if(other.uuid === SyncTarget){
                        console.log(`sending data to client ${other.uuid}`)
                        conn.send(message)
                        break
                    }
                }
                break
            }
            case 'sync-end':
            {
                console.log(`sending ${decoded.event}`)
                for(let [conn, other] of connections){
                    if(other.uuid === SyncTarget){
                        console.log(`sending data to ${other.uuid}`)
                        conn.send(JSON.stringify({
                            event:'sync-end',
                            data:''
                        }))
                    }
                }
                SyncTarget = null
                break
            }
            case 'client-add-image': {
                for(let [conn, other] of connections){
                    if(other.role === 'master'){
                        conn.send(message)
                    }
                }
                break 
            }
            case 'shift': 
            case 'drag-image': 
            case 'grid': 
            case 'remote-access-permission':{
                for(let [conn, other] of connections){
                    if(other.uuid !== clientInfo.uuid){
                        console.log(`sending data to ${other.uuid}`)
                        conn.send(JSON.stringify({
                            event: decoded.event,
                            data: decoded.data
                        }))
                    }
                }
                break
            }
            default:{
                console.log('default message handler')
                for(let [conn, other] of connections){
                    if(other.uuid !== clientInfo.uuid){
                        conn.send(JSON.stringify({
                            event: decoded.event,
                            data: decoded.data
                        }))
                    }
                }
            }
        }
    })

    socket.on('close', ()=>{
        const info = connections.get(socket)
        console.log(`${info.uuid}, ${info.role} closed connection`)
        if(info.role === 'master'){
            masterIsConnected = false
            masterShape.width = 1
            masterShape.height = 1
        } 
        connections.delete(socket)  
    })

    socket.on('error', (err)=>{
        console.log(err)
    })
})

export {wss}