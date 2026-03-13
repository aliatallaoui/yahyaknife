const axios = require('axios');

async function testHealth() {
    try {
        const response = await axios.get('http://localhost:5005/health');
        console.log('Health:', response.data);
    } catch (err) {
        console.error('Health check failed:', err.message);
    }
}

async function testLogin() {
    try {
        const response = await axios.post('http://127.0.0.1:5005/api/auth/login', {
            email: 'admin@yahya.com',
            password: 'password123'
        });
        console.log('Login successful! Role:', response.data.role);
    } catch (err) {
        console.error('Login Error Object:', err.toJSON ? err.toJSON() : err);
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
        }
    }
}

testHealth().then(testLogin);
