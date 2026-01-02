// Test script for Auth API
async function testAuthAPI() {
  const baseURL = 'http://localhost:3000';

  console.log('🧪 Testing Auth API...\n');

  // Test 1: Try to login with existing user first
  console.log('1️⃣ Testing User Login with existing user...');
  try {
    const loginResponse = await fetch(`${baseURL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'testuser',
        password: 'testpass123'
      })
    });

    const loginData = await loginResponse.json();
    console.log('Login Response:', loginData);

    if (loginData.success) {
      console.log('✅ Login successful!');
      console.log('📋 User:', loginData.data.user);
      console.log('🔑 JWT Token Length:', loginData.data.session.access_token.length);
      console.log('🔑 Access Token starts with:', loginData.data.session.access_token.substring(0, 50) + '...');

      // 🔍 Decode JWT to check payload
      console.log('\n🔍 Decoding JWT payload...');
      try {
        const jwt = loginData.data.session.access_token;
        const payload = JSON.parse(atob(jwt.split('.')[1]));
        console.log('JWT Payload:', {
          aud: payload.aud,
          role: payload.role,
          sub: payload.sub,
          iat: new Date(payload.iat * 1000).toISOString(),
          exp: new Date(payload.exp * 1000).toISOString()
        });
      } catch (jwtError) {
        console.log('❌ Could not decode JWT:', jwtError.message);
      }

      console.log('\n🎉 HYBRID AUTH WORKING! 🎉');
    } else {
      console.log('❌ Login failed:', loginData.error);

      // If login failed, try to register a new user
      console.log('\n2️⃣ Trying to register new user...');
      const registerResponse = await fetch(`${baseURL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'testuser' + Date.now(),
          password: 'testpass123'
        })
      });

      const registerData = await registerResponse.json();
      console.log('Register Response:', registerData);
    }
  } catch (error) {
    console.error('❌ API Error:', error.message);
  }
}

testAuthAPI();
