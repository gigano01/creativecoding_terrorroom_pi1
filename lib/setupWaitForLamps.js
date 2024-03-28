const axios = require("axios")

async function makeApiRequest(lampID, bridgeIp, bridgeAccesKey) {
    let config = {
        method: 'GET',
        maxBodyLength: Infinity,
        url: `https://${bridgeIp}/clip/v2/resource/light/${lampID}`,
        headers: {
            'hue-application-key': bridgeAccesKey,
            'Content-Type': 'application/json'
        },
    };

    try {
        const response = await axios.request(config);
        return response;
    } catch (error) {
        // If there's an error, log it and retry after a delay
        console.error('Error making API request:', error.message);
        return await makeApiRequestWithDelay(lampID, bridgeIp, bridgeAccesKey); // Retry recursively
    }
}

async function makeApiRequestWithDelay(lampID, bridgeIp, bridgeAccesKey) {
    return new Promise(resolve => {
        setTimeout(async () => {
            const response = await makeApiRequest(lampID, bridgeIp, bridgeAccesKey);
            resolve(response);
        }, 4000); // 4 seconds delay
    });
}

async function waitForApi(lampID, bridgeIp, bridgeAccesKey) {
    try {
        const response = await makeApiRequest(lampID, bridgeIp, bridgeAccesKey);
        if (response.status === 200) {
            console.log('API returned status code 200:', response.data);
            return response.data;
        } else {
            console.log(`API returned status code ${response.status}. Retrying...`);
            return await waitForApi(); // Retry recursively
        }
    } catch (error) {
        console.error('Error waiting for API:', error.message);
        // You can handle errors here if needed
    }
}

module.exports = {waitForApi}