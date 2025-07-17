const http = require('http');

// Функция для получения статуса через API Gateway
function getGatewayStatus() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/health',
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (e) {
          resolve({ error: 'Invalid JSON response', data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Основная функция
async function showStatus() {
  console.log('📊 Multi-SaaS Platform Status\n');
  
  try {
    const status = await getGatewayStatus();
    
    console.log('🔗 API Gateway Status:');
    console.log(`   Status: ${status.status || 'Unknown'}`);
    console.log(`   Timestamp: ${status.timestamp || 'Unknown'}`);
    console.log(`   Uptime: ${status.uptime ? Math.round(status.uptime) + 's' : 'Unknown'}`);
    
    if (status.services) {
      console.log('\n🏢 Registered Services:');
      Object.entries(status.services).forEach(([name, service]) => {
        const statusIcon = service.status === 'available' ? '✅' : 
                          service.status === 'unavailable' ? '❌' : '⚠️';
        console.log(`   ${statusIcon} ${name.charAt(0).toUpperCase() + name.slice(1)} Service`);
        console.log(`      URL: ${service.url}`);
        console.log(`      Status: ${service.status}`);
        if (service.lastCheck) {
          console.log(`      Last Check: ${service.lastCheck}`);
        }
      });
    }
    
    if (status.memory) {
      console.log('\n💾 Memory Usage:');
      console.log(`   Used: ${Math.round(status.memory.used / 1024 / 1024)}MB`);
      console.log(`   Total: ${Math.round(status.memory.total / 1024 / 1024)}MB`);
    }
    
  } catch (error) {
    console.log('❌ API Gateway is not responding');
    console.log(`   Error: ${error.message}`);
    console.log('\n💡 Try starting the services:');
    console.log('   docker-compose -f docker-compose.simple.yml up -d');
  }
}

// Запуск
showStatus().catch(console.error);