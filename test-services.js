const http = require('http');

// Список сервисов для тестирования
const services = [
  { name: 'API Gateway', url: 'http://localhost:3001/health' },
  { name: 'Plugin System', url: 'http://localhost:8008/health' },
  { name: 'ERP Service', url: 'http://localhost:8006/health' },
  { name: 'Marketing Service', url: 'http://localhost:8007/health' }
];

// Функция для проверки здоровья сервиса
function checkService(service) {
  return new Promise((resolve, reject) => {
    const url = new URL(service.url);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          name: service.name,
          status: res.statusCode,
          data: data
        });
      });
    });

    req.on('error', (err) => {
      reject({
        name: service.name,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject({
        name: service.name,
        error: 'Request timeout'
      });
    });

    req.end();
  });
}

// Основная функция тестирования
async function testAllServices() {
  console.log('🧪 Testing Multi-SaaS Platform Services...\n');
  
  const results = [];
  
  for (const service of services) {
    try {
      const result = await checkService(service);
      results.push(result);
      
      if (result.status === 200) {
        console.log(`✅ ${result.name}: OK`);
        try {
          const jsonData = JSON.parse(result.data);
          console.log(`   Response: ${JSON.stringify(jsonData)}`);
        } catch (e) {
          console.log(`   Response: ${result.data}`);
        }
      } else {
        console.log(`❌ ${result.name}: HTTP ${result.status}`);
      }
    } catch (error) {
      results.push(error);
      console.log(`❌ ${error.name}: ${error.error}`);
    }
    console.log('');
  }
  
  // Сводка результатов
  const successCount = results.filter(r => r.status === 200).length;
  const totalCount = services.length;
  
  console.log('📊 Test Summary:');
  console.log(`   Total services: ${totalCount}`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Failed: ${totalCount - successCount}`);
  console.log(`   Success rate: ${Math.round((successCount / totalCount) * 100)}%`);
  
  if (successCount === totalCount) {
    console.log('\n🎉 All services are healthy and ready!');
  } else {
    console.log('\n⚠️  Some services are not responding. Check Docker logs.');
  }
}

// Запуск тестов
testAllServices().catch(console.error);