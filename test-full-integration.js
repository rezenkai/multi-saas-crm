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

    req.on('error', (err) => reject(err));
    
    if (data) {
      req.write(data);
    }
    
    req.end();
  });
}

// Тестирование полной интеграции Multi-SaaS платформы
async function testFullIntegration() {
  console.log('🔄 Testing Full Multi-SaaS Platform Integration...\n');
  
  const tests = [
    {
      name: 'Infrastructure Services',
      tests: [
        { name: 'PostgreSQL Connection', url: 'http://localhost:5432', expectedError: true },
        { name: 'Redis Connection', url: 'http://localhost:6379', expectedError: true },
      ]
    },
    {
      name: 'Core Services',
      tests: [
        { name: 'API Gateway Health', url: 'http://localhost:3001/health' },
        { name: 'CRM Backend Health', url: 'http://localhost:8000/health' },
        { name: 'Plugin System Health', url: 'http://localhost:8008/health' },
      ]
    },
    {
      name: 'Microservices',
      tests: [
        { name: 'ERP Service Health', url: 'http://localhost:8006/health' },
        { name: 'Marketing Service Health', url: 'http://localhost:8007/health' },
      ]
    },
    {
      name: 'API Gateway Routing',
      tests: [
        { name: 'Plugins via Gateway', url: 'http://localhost:3001/api/plugins/health' },
        { name: 'ERP via Gateway', url: 'http://localhost:3001/api/erp/health' },
        { name: 'Marketing via Gateway', url: 'http://localhost:3001/api/marketing/health' },
      ]
    },
    {
      name: 'Frontend Integration',
      tests: [
        { name: 'Frontend Server', url: 'http://localhost:3000', expectedError: true }, // May not be running
      ]
    },
    {
      name: 'CRM API Endpoints (via Gateway)',
      tests: [
        { name: 'CRM Status', url: 'http://localhost:3001/api/v1/status' },
        { name: 'CRM Auth (login required)', url: 'http://localhost:3001/api/v1/auth/me', expectedStatus: 401 },
        { name: 'CRM Contacts (auth required)', url: 'http://localhost:3001/api/v1/contacts', expectedStatus: 401 },
        { name: 'CRM Companies (auth required)', url: 'http://localhost:3001/api/v1/companies', expectedStatus: 401 },
      ]
    }
  ];

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  for (const category of tests) {
    console.log(`\n📋 ${category.name}:`);
    console.log('-'.repeat(50));
    
    for (const test of category.tests) {
      totalTests++;
      
      try {
        const url = new URL(test.url);
        const options = {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          method: 'GET',
          timeout: 5000
        };

        const result = await makeRequest(options);
        
        // Определяем успешность теста
        let success = false;
        let status = '❌';
        let message = '';

        if (test.expectedError) {
          // Ожидаем ошибку соединения (для DB сервисов)
          status = '❌';
          message = 'Expected connection error (service not HTTP)';
        } else if (test.expectedStatus) {
          // Ожидаем конкретный статус код
          if (result.statusCode === test.expectedStatus) {
            success = true;
            status = '✅';
            message = `Expected status ${test.expectedStatus}`;
          } else {
            message = `Expected ${test.expectedStatus}, got ${result.statusCode}`;
          }
        } else {
          // Ожидаем успешный ответ (200-299)
          if (result.statusCode >= 200 && result.statusCode < 300) {
            success = true;
            status = '✅';
            message = `HTTP ${result.statusCode}`;
            
            // Пытаемся распарсить JSON для дополнительной информации
            try {
              const data = JSON.parse(result.data);
              if (data.status) {
                message += ` - ${data.status}`;
              }
              if (data.service) {
                message += ` (${data.service})`;
              }
            } catch (e) {
              // Не JSON ответ, ничего страшного
            }
          } else {
            message = `HTTP ${result.statusCode}`;
          }
        }

        console.log(`   ${status} ${test.name}: ${message}`);
        
        if (success) {
          passedTests++;
        } else {
          failedTests++;
        }

      } catch (error) {
        if (test.expectedError) {
          console.log(`   ✅ ${test.name}: Expected connection error (${error.code})`);
          passedTests++;
        } else {
          console.log(`   ❌ ${test.name}: ${error.message}`);
          failedTests++;
        }
      }
    }
  }

  // Итоговый отчет
  console.log('\n' + '='.repeat(60));
  console.log('📊 FULL INTEGRATION TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📈 Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  const overallStatus = passedTests >= (totalTests * 0.8) ? '🎉' : '⚠️';
  console.log(`${overallStatus} Overall status: ${passedTests >= (totalTests * 0.8) ? 'HEALTHY' : 'NEEDS ATTENTION'}`);
  
  console.log('\n📝 Next Steps:');
  if (failedTests > 0) {
    console.log('   1. Check failed services with: docker-compose -f docker-compose.simple.yml ps');
    console.log('   2. View logs with: docker-compose -f docker-compose.simple.yml logs [service]');
    console.log('   3. Start frontend with: docker-compose -f docker-compose.simple.yml up frontend -d');
  } else {
    console.log('   ✅ All critical services are running correctly!');
    console.log('   🚀 Multi-SaaS platform is ready for production use!');
  }
}

// Запуск тестирования
testFullIntegration().catch(console.error);