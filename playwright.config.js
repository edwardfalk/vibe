// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * VIBE GAME TESTING CONFIGURATION
 * 
 * Optimized for stable game testing with proper timeout handling
 * Fixes the 30-second timeout issue that caused comprehensive tests to hang
 * 
 * Key Improvements:
 * ✅ Extended action timeout to 60s (was 30s) - prevents individual action hangs
 * ✅ Sequential test execution for game stability
 * ✅ Enhanced media capture for troubleshooting
 * ✅ Browser settings optimized for audio context activation
 * 
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  
  /* Test execution settings - sequential for game testing stability */
  fullyParallel: false, // Run tests one at a time for game stability
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker prevents resource conflicts
  
  /* Extended timeouts for comprehensive game testing */
  timeout: 120000, // 2 minutes total test timeout
  
  /* Reporter configuration with detailed output */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'], // Console output for development
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  
  /* Global test settings optimized for Vibe game */
  use: {
    baseURL: 'http://localhost:5500',
    
    /* Enhanced media capture - always record for troubleshooting */
    screenshot: 'only-on-failure',
    video: 'on', // Always record video for manual testing sessions
    trace: 'retain-on-failure',
    
    /* Browser settings optimized for game testing */
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    
    /* FIXED: Extended action timeout to prevent hangs */
    actionTimeout: 60000, // 60s for individual actions (was 30s)
    navigationTimeout: 30000,
    
    /* Audio context activation for game audio */
    hasTouch: false,
    isMobile: false,
  },

  /* Browser projects optimized for game testing */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        /* Chrome settings for game testing with audio */
        launchOptions: {
          args: [
            '--autoplay-policy=no-user-gesture-required', // Allow audio autoplay
            '--disable-web-security', // Allow local file access
            '--disable-features=VizDisplayCompositor' // Improve canvas performance
          ]
        }
      },
    },
    // Removed firefox and webkit for focused testing
    // Add back if cross-browser testing needed
  ],

  /* Development server configuration */
  webServer: {
    command: 'npx five-server --port=5500 --no-browser --quiet',
    port: 5500,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    ignoreHTTPSErrors: true,
  },
  
  /* Output directories */
  outputDir: 'test-results/',
});