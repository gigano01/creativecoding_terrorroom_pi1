const EventEmitter = require('events');
class MyEmitter extends EventEmitter { }
const myEmitter = new MyEmitter();

module.exports = myEmitter;


const { initializeDevices, sendHueLampData, flickerHueLamps, flickerHueLampsFailed, resetLamps } = require("./lib/devices.js")
const { initWebsocket, sendNewInitPhase, sendColorQueue, sendColor, sendMessage } = require("./lib/server.js")


//anders zaagt het programma
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
// vraag aan leerkrachten hoe dit op te lossen!!

const STATES = {
	setup: "setup", inGameColorShowing: "inGameColorShowing",
	inGameReceivingInput: "inGameReceivingInput", fail: "fail", end: "end",
	awaitingResponds: "awaitingResponds", intro: "intro", awaitingGameStart: "awaitingGameStart",
	emergencyStop: "emergencyStop"
}

let state = STATES.setup

let roundNR = 0
let fails = 0
let colorQueue = []
let introQueueDone = false

let outroCounter = 0

var Gpio = require('onoff').Gpio
//var pushButton = new Gpio(12, 'in')
const noodStop = new Gpio(12, 'in', 'rising', { debounceTimeout: 10 });
const knopBlauw = new Gpio(21, 'in', 'rising', { debounceTimeout: 10 })
const knopRood = new Gpio(20, 'in', 'rising', { debounceTimeout: 10 })
const knopGroen = new Gpio(16, 'in', 'rising', { debounceTimeout: 10 })
const knopGeel = new Gpio(26, 'in', 'rising', { debounceTimeout: 10 })
const flasher = new Gpio(23, 'out', 'digital', { debounceTimeout: 10 })
flasher.writeSync(1)

setTimeout(() => {
	flasher.writeSync(0)
}, 3000)
setupButtons()
buttonColor = { blauw: 4, groen: 3, geel: 2, rood: 1 }

let lastPressed = null
let queueStep = 0 //voor de input code
introCounter = 0


//IMPORTANT GAME VARS
let gameMode = null //ADHD, HSP of ASS
let stimuliCurve = 0


//setup de websocket connection
let currentStage = "pre-init"
const wss = initWebsocket({ port: 8080 }, currentStage)
wss.on('connection', function connection(ws) {
	console.log('WebSocket connected');
	sendNewInitPhase(wss, currentStage)

	ws.on('message', (message) => {
		const data = JSON.parse(message.toString())
		console.log(JSON.stringify(data))
		if (data.type === "queueDone" || data.type === "colorDone") {
			introQueueDone = true
			if (state !== STATES.fail && state !== STATES.intro && state !== STATES.emergencyStop) {
				state = STATES.inGameReceivingInput
				lastPressed = null
			}
		}
	})

	// Event handler for WebSocket close event
	ws.on('close', function close() {
		console.log('Client disconnected');
		// Perform any cleanup or additional actions when a client disconnects
	});
});


async function setup() {
	newPhase("init")

	// Call the function to start checking for lamps online
	const dvConfig = await initializeDevices(require("./config/devices.json"))

	newPhase("ready")

	console.log("setup-lamps")
	//set-up the lamps
	sendHueLampData(dvConfig, { "dimming": { "brightness": 20.0 }, "color": { "xy": { "x": 0.315, "y": 0.3 } }, powerup: { "preset": "custom", color: { mode: "color", "color": { "xy": { "x": 0.700, "y": 0.250 } } } } }, dvConfig.lamps[0])
	sendHueLampData(dvConfig, { "dimming": { "brightness": 20.0 }, "color": { "xy": { "x": 0.315, "y": 0.3 } }, powerup: { "preset": "custom", color: { mode: "color", "color": { "xy": { "x": 0.700, "y": 0.260 } } } } }, dvConfig.lamps[1])
	sendHueLampData(dvConfig, { "dimming": { "brightness": 10.0 }, "color": { "xy": { "x": 0.315, "y": 0.3 } }, powerup: { "preset": "custom", color: { mode: "color", "color": { "xy": { "x": 0.7, "y": 0.250 } } } } }, dvConfig.ledStrips[0])
	sendHueLampData(dvConfig, { "dimming": { "brightness": 10.0 }, "color": { "xy": { "x": 0.315, "y": 0.3 } }, powerup: { "preset": "custom", color: { mode: "color", "color": { "xy": { "x": 0.7, "y": 0.250 } } } } }, dvConfig.ledStrips[1])

	setTimeout(() => { state = STATES.awaitingGameStart }, 1100)
	setInterval(() => { run(dvConfig) }, 400)
}

function setupButtons() {
	noodStop.watch(function (err, value) { //Watch for hardware interrupts on pushButton GPIO, specify callback function
		if (err) { //if an error
			console.error('There was an error', err); //output error message to console
			return;
		}

		if (state === STATES.inGameColorShowing || state === STATES.inGameReceivingInput || state === STATES.awaitingResponds) {
			console.log("noodstop")
			state = STATES.emergencyStop
			sendMessage(wss, "stop", { failCount: fails, rounds: roundNR })
		}

	});

	knopBlauw.watch(function (err, value) { //Watch for hardware interrupts on pushButton GPIO, specify callback function
		if (err) { //if an error
			console.error('There was an error', err); //output error message to console
			return;
		}
		console.log("blauw")
		lastPressed = "blauw"
	});

	knopGeel.watch(function (err, value) { //Watch for hardware interrupts on pushButton GPIO, specify callback function
		if (err) { //if an error
			console.error('There was an error', err); //output error message to console
			return;
		}
		console.log("geel")
		lastPressed = "geel"
	});
	knopGroen.watch(function (err, value) { //Watch for hardware interrupts on pushButton GPIO, specify callback function
		if (err) { //if an error
			console.error('There was an error', err); //output error message to console
			return;
		}
		console.log("groen")
		lastPressed = "groen"
	});
	knopRood.watch(function (err, value) { //Watch for hardware interrupts on pushButton GPIO, specify callback function
		if (err) { //if an error
			console.error('There was an error', err); //output error message to console
			return;
		}
		console.log("rood")
		lastPressed = "rood"
	});
}

function newPhase(name) {
	currentStage = name
	sendNewInitPhase(wss, name, state)
}


function run(dvConfig) {
	switch (state) {
		case STATES.inGameColorShowing:
			console.log("time for funky shit")
			roundNR++
			stimuliCurve = 0.15 * roundNR ** 3 * Math.max(1, fails) + fails
			const brightness = Math.min(40 + stimuliCurve * (4 * (gameMode === "HSP")), 100)
			console.log(brightness)

			console.log(`stimuliCurve: ${stimuliCurve}, fails: ${fails}, roundNR: ${roundNR}`)
			colorQueue.push(newColor(stimuliCurve, colorQueue[colorQueue.length - 1]))
			sendColor(wss, colorQueue[colorQueue.length - 1])
			if (roundNR > 1) {
				flickerHueLamps(dvConfig, Math.round(stimuliCurve), dvConfig.lamps[1], brightness)
				flickerHueLamps(dvConfig, Math.round(stimuliCurve * 0.5), dvConfig.lamps[0], brightness)
				flickerHueLamps(dvConfig, Math.round(stimuliCurve), dvConfig.ledStrips[1], Math.min(100, brightness * 0.5))
				flickerHueLamps(dvConfig, Math.round(stimuliCurve * 0.5), dvConfig.ledStrips[0], Math.min(100, brightness * 0.5))
			}
			queueStep = 0
			state = STATES.awaitingResponds
			break;
		case STATES.awaitingResponds:
			//do litteraly nothing
			//just wait

			break;
		case STATES.inGameReceivingInput:
			if (lastPressed != null) {
				const lastColor = colorQueue[queueStep]
				sendColor(wss, lastColor)

				console.log(queueStep + "aaaaaa")
				console.log(colorQueue)
				if (lastColor > 6) {
					// console.log("big")
					// state = STATES.fail
					switch (lastColor) {
						case 7: //appelblauwzeegroen
							if (lastPressed === "blauw" || lastPressed === "groen") {
								correctColor()
							} else {
								wrongColor()
							}
							break;
						case 8: //oranje
							if (lastPressed === "rood" || lastPressed === "geel") {
								correctColor()
							} else {
								wrongColor()
							}
							break;
						case 9: //rood
							if (lastPressed === "rood") {
								correctColor()
							} else {
								wrongColor()
							}
							break;
						case 10: //geel
							if (lastPressed === "geel") {
								correctColor()
							} else {
								wrongColor()
							}
							break;
						case 11: //groen
							if (lastPressed === "groen") {
								correctColor()
							} else {
								wrongColor()
							}
							break;
						case 12: //blauw
							if (lastPressed === "blauw") {
								correctColor()
							} else {
								wrongColor()
							}
							break;
					}
				} else if (buttonColor[lastPressed] === lastColor) {
					correctColor()
				} else {
					wrongColor()
				}
			}

			//state = STATES.inGameColorShowing
			break;

		case STATES.fail:
			fails++
			//sendHueLampData(dvConfig, { "dimming": { "brightness": 100.0 }, "color": { "xy": { "x": 0.700, "y": 0.210 } } }, dvConfig.lamps[0])
			//sendHueLampData(dvConfig, { "dimming": { "brightness": 100.0 }, "color": { "xy": { "x": 0.700, "y": 0.210 } } }, dvConfig.lamps[1])
			flickerHueLampsFailed(dvConfig, stimuliCurve, dvConfig.lamps[0])
			flickerHueLampsFailed(dvConfig, stimuliCurve, dvConfig.lamps[1])
			sendMessage(wss, "fail", {})

			setTimeout(() => {
				failReset()
				state = STATES.inGameColorShowing
			}, 4000)

			console.log("incorrect")

			state = STATES.awaitingResponds //zodat het maar een keer 
			break;

		case STATES.awaitingGameStart:
			console.log("awaitingGameStart")
			if (lastPressed != null) {
				sendMessage(wss, "select", {})
				state = STATES.intro
				console.log(state)
			}
			break;

		case STATES.intro:
			if (lastPressed != null) {

				//start het spel niet als we bij de laatste stap zijn en de kleurtjes nog niet zijn gestopt
				if (introCounter > 3 && !introQueueDone) {
					console.log("KISS MY ASS")
					console.log(introQueueDone)
					console.log(introCounter)
					break;
				}

				console.log(`introstate: ${introCounter}`)

				//counter 3 -> we laten alle kleuren 3 keer zien in de color queue
				if (introCounter === 1) {
					let tempQueue = []
					for (let i = 0; i < 9; i++) {
						tempQueue.push(i % 3 + 1)
					}
					sendColorQueue(wss, tempQueue)
				}

				let succes = true
				//het is 5+1 omdat je het antwoord eigenlijk na de vraag pas krijgt, ookal is de vraag wel op introstate 5
				if (introCounter === 3 + 1) {
					switch (lastPressed) {
						case "geel":
							gameMode = "ADHD"
							state = STATES.inGameColorShowing
							break;
						case "groen":
							gameMode = "HSP"
							state = STATES.inGameColorShowing
							break;
						case "rood":
							gameMode = "ASS"
							state = STATES.inGameColorShowing
							break;
						default:
							succes = false
							break;
					}

					console.log(`mode: ${gameMode}`)

					//state = STATES.inGameColorShowing
				}
				if (succes) {
					introCounter++
					sendMessage(wss, "select", { color: buttonColor[lastPressed] })
				}
			}

			break;

			case STATES.emergencyStop:
				myEmitter.emit('stopFlickering');
				if (lastPressed != null) {
					sendMessage(wss, "oselect", { color: buttonColor[lastPressed] })
					if (outroCounter === 2) {
						reset()
						console.log("reset")
					}
			
					outroCounter++
				}
			
				break

		default:
			console.log(`PANICC UNKNOWN STATE: ${state}`)
			break;
	}

	//reset button presses
	lastPressed = null
}


setup()

function failReset() {
	console.log("reset")
	colorQueue = []
	queueStep = 0
	roundNR = 0
}

function newColor(stimuliCurve, lastColor) {
	let color = Math.round((Math.random() * 3) + 1)

	if (gameMode === "ASS" && Math.round(Math.random() * 40) < stimuliCurve) {
		//colorMath.round((Math.random() * 3) + 7)
		color = Math.round(Math.random() * 5) + 7
		console.log(color)
	}

	if (color === lastColor) { color = newColor(stimuliCurve, lastColor) }
	return color
}

function reset() {
	roundNR = 0
	fails = 0
	colorQueue = []
	lastPressed = null
	queueStep = 0 //voor de input code
	introCounter = 0
	introQueueDone = false
	outroCounter = 0

	gameMode = null //ADHD, HSP of ASS
	stimuliCurve = 0

	state = STATES.awaitingGameStart
}

function correctColor() {
	queueStep++
	console.log(queueStep + "eeeeeee")
	console.log("correct")
	//sendHueLampData(dvConfig, { gradient: {points: [{color: {"xy": { "x": 0.700, "y": 0.210}}}, {color: {"xy": { "x": 0.200, "y": 0.410}}} ]} }, dvConfig.ledStrips[0])
	if (queueStep >= colorQueue.length) {
		state = STATES.awaitingResponds
		setTimeout(() => {
			state = STATES.inGameColorShowing
		}, 1000)
	}
}

function wrongColor() {
	console.log("fail")
	state = STATES.fail
}