
const jwt = require('jsonwebtoken');
const http = require('http');

const secret = 'secret'; // From .env
const payload = {
    sub: 27, // Manager ID
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    type: 'ACCESS'
};

const token = jwt.sign(payload, secret);

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/v1/users',
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
};

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        if (res.statusCode !== 200) {
            console.log('Status:', res.statusCode);
            console.log('Response:', data);
            return;
        }

        try {
            const json = JSON.parse(data);
            console.log('Debug Filter:', JSON.stringify(json.debugFilter, null, 2));
            console.log('Returned Users Count:', json.results.length);
            console.log('Returned Users:', JSON.stringify(json.results.map(u => ({ id: u.id, username: u.username, role: u.role })), null, 2));
        } catch (e) {
            console.error('Error parsing JSON:', e);
            console.log('Raw Data:', data);
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.end();
