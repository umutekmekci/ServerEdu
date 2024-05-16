import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { loadImage as createImageBitmap } from 'canvas'

const wss = new WebSocketServer({ noServer: true, path: '/ws' });

const connections = new Map()
let masterIsConnected = false
const masterShape = {width:1, height: 1}
const masterRect = {x0:0, y0:0, x1:0, y1:0}
let lastAddedImage = ''
const peerIds = new Set()

wss.on('connection', (socket, request)=> {
    console.log('got connection request')
    if(connections.has(socket)){
        console.log('duplicate connection request')
    }
    const peerid = peerIds.size === 0 ? 'master' : uuidv4()
    connections.set(socket, {uuid: peerid , role: null, shape:null})
    peerIds.add(peerid)     

    socket.on('message', (message)=> {
        let decoded
        try{
            decoded = JSON.parse(message)
        } catch(ex){
            decoded = {event: 'add-image', data: ''}
        }
        const clientInfo = connections.get(socket)
        if(decoded.event === 'move-start' || decoded.event === 'move-end' || decoded.event === 'role' || decoded.event === 'resize'){
            console.log(`got data from ${clientInfo.uuid} role: ${clientInfo.role}`)
            console.log(decoded)
        }

        switch(decoded.event){
            case 'role': {
                if(connections.size === 1){
                    socket.send(JSON.stringify({
                        event: 'role',
                        data: {role: 'master'}
                    }))
                    clientInfo.role = 'master'
                    masterIsConnected = true
                } else {
                    socket.send(JSON.stringify({
                        event: 'role',
                        data: {role: 'slave'} 
                    }))
                    clientInfo.role = 'slave'
                }
                break
            }
            case 'resize':{
                clientInfo.shape = {...decoded.data}
                if(clientInfo.role === 'master'){
                    masterShape.width = decoded.data.width
                    masterShape.height = decoded.data.height
                }
                if(clientInfo.role === 'slave'){
                    const transform = translate({x: masterRect.x0, y: masterRect.y0}, masterShape, clientInfo.shape)
                    socket.send(JSON.stringify({
                        event: 'shift-initial',
                        data: { x0: transform.x, y0: transform.y }
                        //data: translateRect(masterRect, masterShape, clientInfo.shape)
                    }))
                }
                console.log(`${clientInfo.uuid} ${clientInfo.role} changed its dimensions to w:${clientInfo.shape.width}, h:${clientInfo.shape.height}`)
                break
            }
            case 'get-master-peer-id':{
                socket.send(JSON.stringify({
                    event: 'get-master-peer-id',
                    data: { ids: [...peerIds.keys()].filter(v=>v!==clientInfo.uuid), myPeerId: clientInfo.uuid}
                    //data: translateRect(masterRect, masterShape, clientInfo.shape)
                }))
                break
            }
            case 'move-end': {
                for(let [conn, other] of connections){
                    if(other.uuid !== clientInfo.uuid){
                        console.log(`sending data to ${other.uuid}`)
                        conn.send(JSON.stringify({
                            event: 'move-end',
                        }))
                    }
                }
                break
            }
            case 'move-end-img': {
                for(let [conn, other] of connections){
                    if(other.uuid !== clientInfo.uuid){
                        console.log(`sending data to ${other.uuid}`)
                        conn.send(JSON.stringify({
                            event: 'move-end-img',
                            data: decoded.data
                        }))
                    }
                }
                break
            }
            case 'shift': {
                // only master can send shift event
                masterRect.x0 = decoded.data.x0
                masterRect.x1 = decoded.data.x1
                masterRect.y0 = decoded.data.y0
                masterRect.y1 = decoded.data.y1
                for(let [conn, other] of connections){
                    if(other.uuid !== clientInfo.uuid){
                        console.log(`sending data to ${other.uuid}`)
                        const newData = translateRect(decoded.data, clientInfo.shape, other.shape)
                        console.log(`old shift: x0: ${masterRect.x0}, y0: ${masterRect.y0}`)
                        console.log(`new shift: x0: ${newData.x0}, y0: ${newData.y0}`)
                        conn.send(JSON.stringify({
                            event: decoded.event,
                            data: newData
                        }))
                    }
                }
                break
            }
            case 'pre-add-image': {
                lastAddedImage = decoded.data.uuid
                break
            }
            case 'add-image': {
                //const {buffer, width, height} = decoded.data
                //const shift = decoded.shift
                for(let [conn, other] of connections){
                    if(other.uuid !== clientInfo.uuid){
                        console.log(`sending data to ${other.uuid}`)
                        createImageBitmap(message).then(originalBmp => {
                            const { width, height } = originalBmp;
                            console.log(`width: ${width}, height: ${height}`)
                            const {x: newWidth, y: newHeight} = translate({x: width, y: height}, clientInfo.shape, other.shape)
                            const scaleX = other.shape.width / clientInfo.shape.width
                            const scaleY = other.shape.height / clientInfo.shape.height
                            console.log(`scaleX: ${scaleX}, scaleY: ${scaleY}`)
                            conn.send(JSON.stringify({
                                event:'pre-add-image',
                                data: {width: newWidth, height: newHeight, scaleX, scaleY, uuid: lastAddedImage}
                            }))
                            conn.send(message)
                        })
                    }
                }
                break
            }
            case 'drag-image': {
                const dirX = decoded.data.dirX
                const dirY = decoded.data.dirY
                const uuid = decoded.data.uuid
                for(let [conn, other] of connections){
                    if(other.uuid !== clientInfo.uuid){
                        const {x: newDirX, y: newDirY} = translate({x: dirX, y: dirY}, clientInfo.shape, other.shape)
                        console.log(`dirX: ${dirX}, dirY:${dirY}, newDirX: ${newDirX}, newDirY: ${newDirY}`)
                        conn.send(JSON.stringify({
                            event:decoded.event,
                            data: {dirX: newDirX, dirY: newDirY, uuid}
                        }))
                    }
                }
                break
            }
            case 'resize-image': {
                const dirX = decoded.data.dirX
                const dirY = decoded.data.dirY
                const uuid = decoded.data.uuid
                for(let [conn, other] of connections){
                    if(other.uuid !== clientInfo.uuid){
                        const {x: newDirX, y: newDirY} = translate({x: dirX, y: dirY}, clientInfo.shape, other.shape)
                        console.log(`dirX: ${dirX}, dirY:${dirY}, newDirX: ${newDirX}, newDirY: ${newDirY}`)
                        conn.send(JSON.stringify({
                            event:decoded.event,
                            data: {dirX: newDirX, dirY: newDirY, uuid}
                        }))
                    }
                }
                break
            }
            case 'move-start-img': {
                for(let [conn, other] of connections){
                    if(other.uuid !== clientInfo.uuid){
                        console.log(`sending data to ${other.uuid}`)
                        conn.send(JSON.stringify({
                            event: 'move-start-img',
                            data: {...translate(decoded.data, clientInfo.shape, other.shape), uuid: decoded.data.uuid }
                        }))
                    }
                }
                break
            }
            case 'move-img': {
                for(let [conn, other] of connections){
                    if(other.uuid !== clientInfo.uuid){
                        console.log(`sending data to ${other.uuid}`)
                        conn.send(JSON.stringify({
                            event: 'move-img',
                            data: {...translate(decoded.data, clientInfo.shape, other.shape), uuid: decoded.data.uuid }
                        }))
                    }
                }
                break
            }
            default:{
                for(let [conn, other] of connections){
                    if(other.uuid !== clientInfo.uuid){
                        console.log(`sending data to ${other.uuid}`)
                        conn.send(JSON.stringify({
                            event: decoded.event,
                            data: translate(decoded.data, clientInfo.shape, other.shape) 
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
            masterRect.x0 = 0
            masterRect.x1 = 0
            masterRect.y0 = 0
            masterRect.y1 = 0
        }
        peerIds.delete(info.uuid) 
        connections.delete(socket)  
    })

    socket.on('error', (err)=>{
        console.log(err)
        // handle this situation correctly
    })
})

function translate(coords, sender, receiver){
    if(sender === null || sender.width === null || receiver === null || receiver.width === null){
        return coords
    }

    return {x: (receiver.width / sender.width) * coords.x, y: (receiver.height / sender.height) * coords.y}
}

function translateRect(coords, sender, receiver){
    if(sender === null || sender.width === null || receiver === null || receiver.width === null){
        return coords
    }
    const scaleX = (receiver.width / sender.width)
    const scaleY = (receiver.height / sender.height)
    console.log(`scaleX: ${scaleX}, scaleY: ${scaleY}`)
    return {x0: scaleX * coords.x0, y0: scaleY * coords.y0, x1: scaleX * coords.x1, y1: scaleY * coords.y1}
}

console.log(`websocket server running at 7072...`)
export {wss}