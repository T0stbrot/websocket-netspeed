const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');

const sslKey = fs.readFileSync('your-key');
const sslCert = fs.readFileSync('your-cert');

const server = https.createServer({
    key: sslKey,
    cert: sslCert
});

const wss = new WebSocket.Server({ server });

const interfaceName = "your-interface"

var sending
var receiving

function readNetworkStats() {
    try {
        const devFile = fs.readFileSync('/proc/net/dev', 'utf-8');

        const lines = devFile.split('\n');
        for (let line of lines) {
            if (line.includes(interfaceName)) {
                const stats = line.trim().split(/\s+/);

                if (stats.length < 10) {
                    console.error('Invalid stats format');
                    return null;
                }

                const rxBytes = parseInt(stats[1]);
                const txBytes = parseInt(stats[9]);
                return {
                    rx_bytes: rxBytes,
                    tx_bytes: txBytes
                };
            }
        }
        console.error('Interface', interfaceName, 'not found');
        return null;
    } catch (error) {
        console.error('Error reading /proc/net/dev:', error);
        return null;
    }
}

function getThroughputData() {
    const statsStart = readNetworkStats();

    if (!statsStart) {
        console.error('Network interface stats not found');
        return;
    }

    let rxBytesStart = statsStart.rx_bytes;
    let txBytesStart = statsStart.tx_bytes;

    setInterval(() => {
        const statsEnd = readNetworkStats(interfaceName);

        if (!statsEnd) {
            console.error('Network interface stats not found');
            return;
        }

        const rxBytesEnd = statsEnd.rx_bytes;
        const txBytesEnd = statsEnd.tx_bytes;
        const rxSpeed = rxBytesEnd - rxBytesStart;
        const txSpeed = txBytesEnd - txBytesStart;
        const rxMbitSpeed = rxSpeed/125000;
        const txMbitSpeed = txSpeed/125000;

        sending = txMbitSpeed;
        receiving = rxMbitSpeed;

        rxBytesStart = rxBytesEnd;
        txBytesStart = txBytesEnd;
    }, 1000);
}

wss.on('connection', function connection(ws) {
    console.log('WebSocket connection established.');

    const interval = setInterval(() => {
        const data = [
            { 
                tx: sending, 
                rx: receiving, 
            }
        ];
        const jsonData = JSON.stringify(data);
        ws.send(jsonData);
    }, 100);

    ws.on('close', function close() {
        console.log('WebSocket connection closed.');
        clearInterval(interval);
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
    console.log(`Server is running on port ${PORT}`);
});

getThroughputData();
