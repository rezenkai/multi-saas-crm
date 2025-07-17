const http = require('http');

// Функция для отправки HTTP запроса
function makeRequest(options, data = null) {
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

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

// Тестирование маршрутизации API Gateway
async function testApiGatewayRouting() {
  console.log('🔀 Testing API Gateway Routing...\n');
  
  const tests = [
    {
      name: 'API Gateway Health Check',
      path: '/health',
      method: 'GET'
    },
    {
      name: 'Plugin System via Gateway',
      path: '/api/plugins/health',
      method: 'GET'
    },
    {
      name: 'ERP Service via Gateway',
      path: '/api/erp/health',
      method: 'GET'
    },
    {
      name: 'Marketing Service via Gateway',
      path: '/api/marketing/health',
      method: 'GET'
    }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}`);
      
      const options = {
        hostname: 'localhost',
        port: 3001,
        path: test.path,
        method: test.method,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      const result = await makeRequest(options);
      results.push({
        name: test.name,
        success: result.statusCode === 200,
        statusCode: result.statusCode,
        response: result.data
      });
      
      if (result.statusCode === 200) {
        console.log(`✅ ${test.name}: OK`);
        try {
          const jsonData = JSON.parse(result.data);
          console.log(`   Response: ${JSON.stringify(jsonData)}`);
        } catch (e) {
          console.log(`   Response: ${result.data}`);
        }
      } else {
        console.log(`❌ ${test.name}: HTTP ${result.statusCode}`);
        console.log(`   Response: ${result.data}`);
      }
      
    } catch (error) {
      results.push({
        name: test.name,
        success: false,
        error: error.message
      });
      console.log(`❌ ${test.name}: ${error.message}`);
    }
    console.log('');
  }
  
  // Сводка результатов
  const successCount = results.filter(r => r.success).length;
  const totalCount = tests.length;
  
  console.log('📊 Routing Test Summary:');
  console.log(`   Total tests: ${totalCount}`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Failed: ${totalCount - successCount}`);
  console.log(`   Success rate: ${Math.round((successCount / totalCount) * 100)}%`);
  
  if (successCount === totalCount) {
    console.log('\n🎉 API Gateway routing is working correctly!');
  } else {
    console.log('\n⚠️  Some routes are not working. Check API Gateway configuration.');
  }
}

// Запуск тестов
testApiGatewayRouting().catch(console.error);