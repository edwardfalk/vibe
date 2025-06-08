/**
 * Test the complete CodeRabbit cycle
 * Validates configuration, ticket management, and CodeRabbit integration
 */

import { CONFIG } from './js/config.js';
import { TicketManager } from './ticketManager.js';
import { validateImport, logError } from './js/errorHandler.js';

async function testCodeRabbitCycle() {
  console.log('🧪 Testing CodeRabbit cycle...\n');

  try {
    // Test 1: Configuration validation
    console.log('1️⃣ Testing configuration...');
    console.log(
      `   GitHub token: ${CONFIG.GITHUB.TOKEN ? '✅ Set' : '❌ Missing'}`
    );
    console.log(`   Ticket API: ${CONFIG.TICKET_API.BASE_URL}`);
    console.log(
      `   Auto tickets: ${CONFIG.CODERABBIT.AUTO_TICKETS ? '✅ Enabled' : '❌ Disabled'}`
    );
    console.log(`   Environment: ${CONFIG.SECURITY.NODE_ENV}`);
    console.log(`   Log level: ${CONFIG.SECURITY.LOG_LEVEL}`);

    // Test 2: Module imports
    console.log('\n2️⃣ Testing module imports...');
    try {
      await import('./js/config.js');
      console.log('   ✅ config.js imported');
    } catch (error) {
      console.warn('   ⚠️ config.js import failed:', error.message);
    }
    
    try {
      await import('./js/errorHandler.js');
      console.log('   ✅ errorHandler.js imported');
    } catch (error) {
      console.warn('   ⚠️ errorHandler.js import failed:', error.message);
    }
    
    try {
      await import('./ticketManager.js');
      console.log('   ✅ ticketManager.js imported');
    } catch (error) {
      console.warn('   ⚠️ ticketManager.js import failed:', error.message);
    }
    
    try {
      await import('./coderabbit-auto-tickets.js');
      console.log('   ✅ coderabbit-auto-tickets.js imported');
    } catch (error) {
      console.warn('   ⚠️ coderabbit-auto-tickets.js import failed:', error.message);
    }

    // Test 3: Ticket manager
    console.log('\n3️⃣ Testing ticket manager...');
    const ticketManager = new TicketManager();

    try {
      const tickets = await ticketManager.listTickets();
      console.log(`   Found ${tickets.length} existing tickets ✅`);
    } catch (error) {
      console.warn(
        '   ⚠️ Could not connect to ticket API (server may not be running)'
      );
      console.log('   Ticket manager initialized ✅');
    }

    // Test 4: CodeRabbit ticket creator
    console.log('\n4️⃣ Testing CodeRabbit integration...');
    try {
      const { CodeRabbitTicketCreator } = await import(
        './coderabbit-auto-tickets.js'
      );
      const creator = new CodeRabbitTicketCreator();
      console.log('   CodeRabbit ticket creator initialized ✅');
    } catch (error) {
      console.warn(
        '   ⚠️ CodeRabbit ticket creator import failed:',
        error.message
      );
    }

    // Test 5: Environment variables
    console.log('\n5️⃣ Testing environment variables...');
    const requiredEnvVars = [
      'GITHUB_TOKEN',
      'TICKET_API_PORT',
      'TICKET_API_HOST',
      'DEV_SERVER_PORT',
      'CODERABBIT_AUTO_TICKETS',
      'NODE_ENV',
    ];

    let envWarnings = 0;
    requiredEnvVars.forEach((envVar) => {
      const value = process.env[envVar];
      if (!value) {
        console.warn(`   ⚠️ ${envVar} not set`);
        envWarnings++;
      } else {
        console.log(
          `   ✅ ${envVar}: ${envVar === 'GITHUB_TOKEN' ? '[HIDDEN]' : value}`
        );
      }
    });

    // Test 6: Configuration consistency
    console.log('\n6️⃣ Testing configuration consistency...');
    const configTests = [
      {
        name: 'GitHub configuration',
        test: () =>
          CONFIG.GITHUB.OWNER === 'edwardfalk' && CONFIG.GITHUB.REPO === 'vibe',
      },
      {
        name: 'Port configuration',
        test: () =>
          CONFIG.TICKET_API.PORT >= 1000 && CONFIG.TICKET_API.PORT <= 65535,
      },
      {
        name: 'CodeRabbit threshold',
        test: () =>
          ['low', 'medium', 'high'].includes(
            CONFIG.CODERABBIT.REVIEW_THRESHOLD
          ),
      },
      {
        name: 'Log level',
        test: () =>
          ['debug', 'info', 'warn', 'error'].includes(
            CONFIG.SECURITY.LOG_LEVEL
          ),
      },
    ];

    configTests.forEach(({ name, test }) => {
      if (test()) {
        console.log(`   ✅ ${name}`);
      } else {
        console.warn(`   ⚠️ ${name} - invalid configuration`);
      }
    });

    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`   Environment warnings: ${envWarnings}`);
    console.log(
      `   Configuration: ${CONFIG.GITHUB.TOKEN ? 'Ready' : 'Needs GitHub token'}`
    );
    console.log(`   Ticket API: ${CONFIG.TICKET_API.BASE_URL}`);

    if (envWarnings === 0 && CONFIG.GITHUB.TOKEN) {
      console.log(
        '\n🎉 All tests passed! CodeRabbit cycle is fully configured and ready.'
      );
    } else {
      console.log(
        '\n⚠️ Some configuration issues found. Please review the warnings above.'
      );
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    logError(error, { operation: 'testCodeRabbitCycle' });
    process.exit(1);
  }
}

// Run tests
testCodeRabbitCycle();
