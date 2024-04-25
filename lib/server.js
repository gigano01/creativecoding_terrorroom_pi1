const WebSocket = require('ws');



function initWebsocket(config){
	const wss = new WebSocket.Server(config);
	return wss
}


async function sendNewInitPhase(wss, stage, state) {
	//currentStage = stage
    // Send "new_init_phase" message to all connected clients
    const package = {
        type: "setup",
        data: {stage: stage, state:state}
    };
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(package));
        }
    });
}

async function sendColorQueue(wss, colorQueue){
	const package = {
        type: "colorQueue",
        data: {queue: colorQueue}
    };
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(package))
        }
    });
}

async function sendColor(wss, color){
	if(!color) {
		console.error("color not provided")
	}
	const package = {
        type: "color",
        data: {color: color}
    };
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(package))
        }
    });
}

async function sendMessage(wss, type, data){
	const package = {
        type: type,
        data: data
    };

	console.log(package)
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(package))
        }
    });
}


module.exports = { initWebsocket, sendNewInitPhase, sendColorQueue, sendColor, sendMessage}