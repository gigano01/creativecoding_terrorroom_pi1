const axios = require("axios")
const { waitForApi } = require("./setupWaitForLamps.js")

async function initializeDevices(dvConfig) {
	console.log(`config file: \n${dvConfig}`)

	//wacht tot alle lampen online zijn gekomen.
	for (let i = 0; i < dvConfig.lamps.length; i++) {
		const lampID = dvConfig.lamps[i];
		await waitForApi(lampID, dvConfig.bridge.ip, dvConfig.bridge.accesKey)
	}

	for (let i = 0; i < dvConfig.ledStrips.length; i++) {
		const stripID = dvConfig.ledStrips[i];
		await waitForApi(stripID, dvConfig.bridge.ip, dvConfig.bridge.accesKey)
	}

	//geef de config zodat we 
	return dvConfig
}

async function resetLamps(dvConfig, lampID, duration = 2, color = { "xy": { "x": 0.315, "y": 0.3 } }) {
	await sendHueLampData(dvConfig, { "dimming": { "brightness": 1.0 }, "color": color, dynamics: { duration: duration } }, lampID)
}

async function sendHueLampData(dvConfig, data, lampID) {
	if (!dvConfig) {
		console.error("no config file was provided")
		return
	}

	//zet de config file goed.
	let dataJson = JSON.stringify(data);
	let config = {
		method: 'put',
		maxBodyLength: Infinity,
		url: `https://${dvConfig.bridge.ip}/clip/v2/resource/light/${lampID}`,
		headers: {
			'hue-application-key': dvConfig.bridge.accesKey,
			'Content-Type': 'application/json'
		},
		data: dataJson
	};

	//doe de aanvraag
	let returnValue = null
	await axios.request(config)
		.then((response) => {
			//console.log(JSON.stringify(response.data));
			returnValue = true
		})
		.catch((error) => {
			//console.log(error);
			//console.log(error.response.data.errors)
			returnValue = false
		});

	return returnValue
}

//sleep function
async function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function flickerHueLamps(dvConfig, timesFlickered, lampID, brightness=100, color = { "xy": { "x": 0.315, "y": 0.3 } }) {
	timesFlickered *= 2
	let onOff = false

	const stop = setInterval(async () => {
		if (timesFlickered <= 0) {
			clearInterval(stop)
		}
		await sendHueLampData(dvConfig, { dimming: { brightness: brightness }, color: color, dynamics: { duration: 2 } }, lampID)
		await sleep(190)
		await resetLamps(dvConfig, lampID)
		timesFlickered--
	}, 230)
}

async function flickerHueLampsFailed(dvConfig, timesFlicker, lampID) {
	timesFlicker *= 2
	let onOff = false
	let colorQueue = [{ x: 0.100, y: 0.200 }, { x: 0.400, y: 0.300 }, { x: 0.250, y: 0.100 }]
	let queuePointer = 0

	const stop = setInterval(async () => {
		if (timesFlicker <= 0) {
			clearInterval(stop)
		}

		await sendHueLampData(dvConfig, { "dimming": { "brightness": 100 }, dynamics: { duration: 2 }, color: { "xy": { "x": colorQueue[queuePointer].x, "y": colorQueue[queuePointer].y } } }, lampID)
		await sleep(220)
		await resetLamps(dvConfig, lampID)
		queuePointer = (queuePointer % (colorQueue.length - 1)) + 1

		timesFlicker--
	}, 400)
}

module.exports = { initializeDevices, sendHueLampData, flickerHueLamps, flickerHueLampsFailed, resetLamps }