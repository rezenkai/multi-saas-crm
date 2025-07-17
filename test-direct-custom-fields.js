const http = require('http');

// Тестирование Custom Fields Service напрямую
async function testDirectCustomFields() {
  console.log('🔧 Testing Custom Fields Service Direct Connection...\n');
  
  const tests = [
    {
      name: 'Port 8009 Response',
      port: 8009,
      path: '/',
      description: 'Check if service responds on port 8009'
    },
    {
      name: 'Health Endpoint',
      port: 8009,
      path: '/health',
      description: 'Check health endpoint'
    },
    {
      name: 'API Status',
      port: 8009,
      path: '/api/status',
      description: 'Check API status endpoint'
    }
  ];

  for (const test of tests) {
    console.log(`Testing: ${test.name} - ${test.description}`);
    
    try {
      const options = {
        hostname: 'localhost',
        port: test.port,
        path: test.path,
        method: 'GET',
        timeout: 5000
      };

      const result = await makeRequest(options);
      
      if (result.statusCode >= 200 && result.statusCode < 500) {
        console.log(`✅ ${test.name}: HTTP ${result.statusCode}`);
        
        try {
          const data = JSON.parse(result.data);
          if (data.status) {
            console.log(`   Status: ${data.status}`);
          }
          if (data.service) {
            console.log(`   Service: ${data.service}`);
          }
        } catch (e) {
          console.log(`   Response: ${result.data.substring(0, 100)}...`);
        }
      } else {
        console.log(`❌ ${test.name}: HTTP ${result.statusCode}`);
      }
      
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.code || error.message}`);
      
      if (error.code === 'ECONNREFUSED') {
        console.log(`   ⚠️  Service not running on port ${test.port}`);
      }
    }
    
    console.log('');
  }
  
  console.log('📋 Custom Fields Service Diagnosis:');
  console.log('   1. Check if container is running: docker ps | grep custom-fields');
  console.log('   2. Check container logs: docker logs crmproject-custom-fields-service-1');
  console.log('   3. Check docker-compose: docker-compose -f docker-compose.simple.yml ps');
  console.log('   4. Try restarting: docker-compose -f docker-compose.simple.yml restart custom-fields-service');
}

function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: responseData
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

// Запуск тестирования
testDirectCustomFields().catch(console.error);