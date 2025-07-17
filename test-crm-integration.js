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

// Тестирование CRM интеграции
async function testCRMIntegration() {
  console.log('🧪 Testing CRM Backend Integration...\n');
  
  const tests = [
    {
      name: 'Direct CRM Backend Health Check',
      path: '/health',
      method: 'GET',
      port: 8000,
      host: 'localhost'
    },
    {
      name: 'CRM Backend API Status',
      path: '/api/v1/status',
      method: 'GET',
      port: 8000,
      host: 'localhost'
    },
    {
      name: 'CRM Auth via API Gateway',
      path: '/api/v1/auth/health',
      method: 'GET',
      port: 3001,
      host: 'localhost'
    },
    {
      name: 'CRM Contacts via API Gateway',
      path: '/api/v1/contacts',
      method: 'GET',
      port: 3001,
      host: 'localhost'
    },
    {
      name: 'CRM Companies via API Gateway',
      path: '/api/v1/companies',
      method: 'GET',
      port: 3001,
      host: 'localhost'
    },
    {
      name: 'CRM Opportunities via API Gateway',
      path: '/api/v1/opportunities',
      method: 'GET',
      port: 3001,
      host: 'localhost'
    },
    {
      name: 'CRM Dashboard via API Gateway',
      path: '/api/v1/dashboard',
      method: 'GET',
      port: 3001,
      host: 'localhost'
    }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}`);
      
      const options = {
        hostname: test.host,
        port: test.port,
        path: test.path,
        method: test.method,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      const result = await makeRequest(options);
      results.push({
        name: test.name,
        success: result.statusCode === 200 || result.statusCode === 401, // 401 для protected endpoints
        statusCode: result.statusCode,
        response: result.data
      });
      
      if (result.statusCode === 200) {
        console.log(`✅ ${test.name}: OK`);
        try {
          const jsonData = JSON.parse(result.data);
          console.log(`   Response: ${JSON.stringify(jsonData).substring(0, 200)}...`);
        } catch (e) {
          console.log(`   Response: ${result.data.substring(0, 200)}...`);
        }
      } else if (result.statusCode === 401) {
        console.log(`🔐 ${test.name}: Authentication Required (OK)`);
      } else {
        console.log(`❌ ${test.name}: HTTP ${result.statusCode}`);
        console.log(`   Response: ${result.data.substring(0, 200)}...`);
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
  
  console.log('📊 CRM Integration Test Summary:');
  console.log(`   Total tests: ${totalCount}`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Failed: ${totalCount - successCount}`);
  console.log(`   Success rate: ${Math.round((successCount / totalCount) * 100)}%`);
  
  if (successCount === totalCount) {
    console.log('\n🎉 CRM Backend integration is working correctly!');
    console.log('\n🔧 Next steps:');
    console.log('   1. Configure authentication flow');
    console.log('   2. Test CRUD operations');
    console.log('   3. Set up custom fields system');
  } else {
    console.log('\n⚠️  Some CRM integration tests failed. Check Docker logs:');
    console.log('   docker-compose -f docker-compose.simple.yml logs crm-backend');
  }
}

// Запуск тестов
testCRMIntegration().catch(console.error);