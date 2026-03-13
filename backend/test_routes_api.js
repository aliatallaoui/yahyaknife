const axios = require('axios');

async function testRequests() {
    try {
        const responseLog = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'admin@yahya.com',
            password: 'password123'
        });
        console.log('Login Response:', responseLog.status, responseLog.data);
    } catch (err) {
        console.log('Login error:', err.response ? err.response.status : err.message);
        if (err.response) console.log(err.response.data);
    }

    try {
        const responseMe = await axios.get('http://localhost:5000/api/auth/me');
        console.log('Me Response:', responseMe.status);
    } catch (err) {
        console.log('Me error:', err.response ? err.response.status : err.message);
        if (err.response) console.log(err.response.data);
    }
}

testRequests();
