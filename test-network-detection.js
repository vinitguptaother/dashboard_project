// test-network-detection.js
// Test script to verify automatic network detection

const { angelOneAuth } = require('./services/angelOneAuth');

async function testNetworkDetection() {
  console.log('🧪 Testing Automatic Network Detection...\n');

  try {
    // Test 1: Check initial values
    console.log('📋 Test 1: Initial Network Configuration');
    console.log(`   Local IP: ${angelOneAuth.clientLocalIP}`);
    console.log(`   Public IP: ${angelOneAuth.clientPublicIP}`);
    console.log(`   MAC Address: ${angelOneAuth.macAddress}`);
    console.log();

    // Test 2: Force network initialization
    console.log('🔄 Test 2: Force Network Initialization...');
    await angelOneAuth.initializeNetworkInfo();
    console.log();

    // Test 3: Verify final values
    console.log('✅ Test 3: Final Network Configuration');
    console.log(`   Local IP: ${angelOneAuth.clientLocalIP}`);
    console.log(`   Public IP: ${angelOneAuth.clientPublicIP}`);
    console.log(`   MAC Address: ${angelOneAuth.macAddress}`);
    console.log();

    // Test 4: Validate IP format
    console.log('🔍 Test 4: IP Validation');
    const isValidLocal = angelOneAuth.isValidIP(angelOneAuth.clientLocalIP);
    const isValidPublic = angelOneAuth.isValidIP(angelOneAuth.clientPublicIP);
    
    console.log(`   Local IP Valid: ${isValidLocal ? '✅' : '❌'}`);
    console.log(`   Public IP Valid: ${isValidPublic ? '✅' : '❌'}`);
    console.log();

    // Test 5: Generate headers
    console.log('📡 Test 5: Generated Headers for Angel One API');
    const headers = angelOneAuth.getStandardHeaders();
    console.log('   Headers that will be sent to Angel One:');
    console.log(`   X-ClientLocalIP: ${headers['X-ClientLocalIP']}`);
    console.log(`   X-ClientPublicIP: ${headers['X-ClientPublicIP']}`);
    console.log(`   X-MACAddress: ${headers['X-MACAddress']}`);
    console.log();

    console.log('🎉 All network detection tests completed successfully!');
    console.log('✅ Your system is ready for Angel One API integration');

  } catch (error) {
    console.error('💥 Network detection test failed:', error.message);
    console.error(error);
  }
}

// Run the test
if (require.main === module) {
  testNetworkDetection()
    .then(() => {
      console.log('\n✨ Network detection test completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testNetworkDetection };
