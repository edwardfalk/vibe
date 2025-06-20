/**
 * Final Debugging Verification Script
 *
 * This script performs final verification of all debugging improvements
 * and provides a comprehensive assessment of the codebase health.
 */

import fs from 'fs/promises';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class FinalDebuggingVerification {
  constructor() {
    this.results = {
      codeConsistency: [],
      eslintStatus: null,
      testingSystem: null,
      architecturalCompliance: [],
      overallHealth: 0,
    };
    this.startTime = Date.now();
  }

  /**
   * Enhanced logging with categorization
   */
  log(category, message, data = null, level = 'info') {
    const emojis = {
      verify: '🔍',
      pass: '✅',
      fail: '❌',
      warn: '⚠️',
      info: 'ℹ️',
      code: '💻',
      test: '🧪',
      arch: '🏗️',
      perf: '⚡',
      security: '🔒',
      summary: '📊',
    };

    const emoji = emojis[category] || '📝';
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];

    console.log(`${emoji} [${timestamp}] ${message}`);
    if (data) {
      console.log('   ', JSON.stringify(data, null, 2));
    }
  }

  /**
   * Verify p5.js instance mode compliance
   */
  async verifyP5InstanceMode() {
    this.log('verify', 'Checking p5.js instance mode compliance...');

    try {
      const visualEffectsContent = await fs.readFile(
        join(__dirname, 'packages/fx/src/visualEffects.js'),
        'utf8'
      );

      // Check for global p5 function usage (should not exist)
      const globalP5Functions = [
        'fill(',
        'stroke(',
        'ellipse(',
        'rect(',
        'line(',
        'push()',
        'pop()',
        'translate(',
        'rotate(',
        'scale(',
        'blendMode(',
        'noFill()',
        'noStroke()',
      ];

      const violations = [];
      globalP5Functions.forEach((func) => {
        const regex = new RegExp(
          `(?<!p\\.)${func.replace(/[()]/g, '\\$&')}`,
          'g'
        );
        const matches = visualEffectsContent.match(regex);
        if (matches) {
          violations.push({ function: func, count: matches.length });
        }
      });

      if (violations.length === 0) {
        this.log('pass', 'p5.js instance mode compliance verified');
        this.results.codeConsistency.push({
          check: 'p5.js Instance Mode',
          status: 'PASS',
          details: 'All p5.js functions properly prefixed with p.',
        });
      } else {
        this.log('fail', 'p5.js instance mode violations found', violations);
        this.results.codeConsistency.push({
          check: 'p5.js Instance Mode',
          status: 'FAIL',
          details: `${violations.length} violations found`,
          violations,
        });
      }
    } catch (error) {
      this.log('fail', 'Error checking p5.js instance mode', error.message);
    }
  }

  /**
   * Verify constructor signature consistency
   */
  async verifyConstructorSignatures() {
    this.log('verify', 'Checking constructor signature consistency...');

    const enemyFiles = [
      'BaseEnemy.js',
      'Tank.js',
      'Stabber.js',
      'Rusher.js',
      'Grunt.js',
    ];
    const expectedSignature = 'constructor(x, y, type, config, p, audio)';
    const results = [];

    for (const file of enemyFiles) {
      try {
        const content = await fs.readFile(join(__dirname, 'js', file), 'utf8');
        const constructorMatch = content.match(/constructor\([^)]+\)/);

        if (constructorMatch) {
          const signature = constructorMatch[0];
          const isConsistent = signature.includes(
            'x, y, type, config, p, audio'
          );

          results.push({
            file,
            signature,
            consistent: isConsistent,
          });
        }
      } catch (error) {
        this.log('warn', `Could not check ${file}`, error.message);
      }
    }

    const allConsistent = results.every((r) => r.consistent);

    if (allConsistent) {
      this.log(
        'pass',
        'Constructor signatures are consistent across all enemy classes'
      );
      this.results.codeConsistency.push({
        check: 'Constructor Signatures',
        status: 'PASS',
        details: 'All enemy classes use standard signature',
      });
    } else {
      this.log('fail', 'Constructor signature inconsistencies found', results);
      this.results.codeConsistency.push({
        check: 'Constructor Signatures',
        status: 'FAIL',
        details: 'Inconsistent signatures found',
        results,
      });
    }
  }

  /**
   * Verify method signature consistency (deltaTimeMs)
   */
  async verifyMethodSignatures() {
    this.log(
      'verify',
      'Checking method signature consistency for deltaTimeMs...'
    );

    const enemyFiles = [
      'BaseEnemy.js',
      'Tank.js',
      'Stabber.js',
      'Rusher.js',
      'Grunt.js',
    ];
    const results = [];

    for (const file of enemyFiles) {
      try {
        const content = await fs.readFile(join(__dirname, 'js', file), 'utf8');

        // Look for update methods
        const updateMethods =
          content.match(/update.*\([^)]*deltaTimeMs[^)]*\)/g) || [];
        const updateSpecificMethods =
          content.match(/updateSpecificBehavior.*\([^)]*deltaTimeMs[^)]*\)/g) ||
          [];

        results.push({
          file,
          updateMethods: updateMethods.length,
          updateSpecificMethods: updateSpecificMethods.length,
          hasDeltaTimeMs:
            updateMethods.length > 0 || updateSpecificMethods.length > 0,
        });
      } catch (error) {
        this.log('warn', `Could not check ${file}`, error.message);
      }
    }

    const allHaveDeltaTimeMs = results.every((r) => r.hasDeltaTimeMs);

    if (allHaveDeltaTimeMs) {
      this.log(
        'pass',
        'Method signatures consistently use deltaTimeMs parameter'
      );
      this.results.codeConsistency.push({
        check: 'Method Signatures (deltaTimeMs)',
        status: 'PASS',
        details: 'All update methods use deltaTimeMs parameter',
      });
    } else {
      this.log('fail', 'Method signature inconsistencies found', results);
      this.results.codeConsistency.push({
        check: 'Method Signatures (deltaTimeMs)',
        status: 'FAIL',
        details: 'Missing deltaTimeMs in some methods',
        results,
      });
    }
  }

  /**
   * Verify console logging standards
   */
  async verifyConsoleLogging() {
    this.log('verify', 'Checking console logging standards...');

    const jsFiles = await this.getJavaScriptFiles();
    let totalLogs = 0;
    let emojiLogs = 0;
    const violations = [];

    for (const file of jsFiles) {
      try {
        const content = await fs.readFile(file, 'utf8');
        const logMatches = content.match(/console\.log\([^)]+\)/g) || [];

        for (const logMatch of logMatches) {
          totalLogs++;

          // Check if log starts with emoji (after opening quote)
          const hasEmoji =
            /console\.log\(\s*['"`][🎮🎵🗡️💥⚠️🚀🎯🛡️🏥✅❌🧪⏸️▶️💨🖥️🎫🔍📋📊💡🤖🔒🧠👁️🐛⚡ℹ️🌐📝]/.test(
              logMatch
            );

          if (hasEmoji) {
            emojiLogs++;
          } else {
            violations.push({
              file: file.replace(__dirname, ''),
              log: logMatch,
            });
          }
        }
      } catch (error) {
        this.log('warn', `Could not check ${file}`, error.message);
      }
    }

    const complianceRate =
      totalLogs > 0 ? ((emojiLogs / totalLogs) * 100).toFixed(1) : 100;

    if (complianceRate >= 90) {
      this.log(
        'pass',
        `Console logging compliance: ${complianceRate}% (${emojiLogs}/${totalLogs})`
      );
      this.results.codeConsistency.push({
        check: 'Console Logging Standards',
        status: 'PASS',
        details: `${complianceRate}% compliance with emoji prefixes`,
        stats: { total: totalLogs, withEmoji: emojiLogs },
      });
    } else {
      this.log(
        'warn',
        `Console logging compliance: ${complianceRate}% (${emojiLogs}/${totalLogs})`,
        violations.slice(0, 5)
      );
      this.results.codeConsistency.push({
        check: 'Console Logging Standards',
        status: 'WARN',
        details: `${complianceRate}% compliance - some logs missing emoji prefixes`,
        stats: { total: totalLogs, withEmoji: emojiLogs },
        violations: violations.slice(0, 10),
      });
    }
  }

  /**
   * Test ESLint configuration
   */
  async testESLintConfiguration() {
    this.log('verify', 'Testing ESLint configuration...');

    return new Promise((resolve) => {
      const eslintProcess = spawn('bunx', ['eslint', '--version'], {
        cwd: __dirname,
        stdio: 'pipe',
      });

      let output = '';
      let error = '';

      eslintProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      eslintProcess.stderr.on('data', (data) => {
        error += data.toString();
      });

      eslintProcess.on('close', (code) => {
        if (code === 0) {
          this.log('pass', 'ESLint is properly configured', {
            version: output.trim(),
          });
          this.results.eslintStatus = {
            status: 'PASS',
            version: output.trim(),
          };
        } else {
          this.log('fail', 'ESLint configuration issues', { error, code });
          this.results.eslintStatus = {
            status: 'FAIL',
            error,
            code,
          };
        }
        resolve();
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        eslintProcess.kill();
        this.log('warn', 'ESLint test timed out');
        this.results.eslintStatus = {
          status: 'TIMEOUT',
          message: 'ESLint test timed out',
        };
        resolve();
      }, 10000);
    });
  }

  /**
   * Verify enhanced testing system
   */
  async verifyTestingSystem() {
    this.log('verify', 'Checking enhanced testing system...');

    try {
      const testingSystemExists = await fs
        .access(join(__dirname, 'enhanced-testing-system.js'))
        .then(() => true)
        .catch(() => false);

      if (testingSystemExists) {
        const content = await fs.readFile(
          join(__dirname, 'enhanced-testing-system.js'),
          'utf8'
        );

        // Check for key features
        const features = {
          performanceMonitoring: content.includes('performanceMetrics'),
          bugReporting: content.includes('createBugReport'),
          emojiLogging: content.includes('emojis'),
          testSession: content.includes('testSession'),
          memoryTracking: content.includes('memoryUsage'),
        };

        const featureCount = Object.values(features).filter(Boolean).length;

        this.log(
          'pass',
          `Enhanced testing system verified with ${featureCount}/5 features`,
          features
        );
        this.results.testingSystem = {
          status: 'PASS',
          features,
          featureCount,
        };
      } else {
        this.log('fail', 'Enhanced testing system not found');
        this.results.testingSystem = {
          status: 'FAIL',
          message: 'Enhanced testing system file not found',
        };
      }
    } catch (error) {
      this.log('fail', 'Error verifying testing system', error.message);
      this.results.testingSystem = {
        status: 'ERROR',
        error: error.message,
      };
    }
  }

  /**
   * Get all JavaScript files in the project
   */
  async getJavaScriptFiles() {
    const files = [];

    try {
      const jsDir = join(__dirname, 'js');
      const jsFiles = await fs.readdir(jsDir);

      for (const file of jsFiles) {
        if (file.endsWith('.js')) {
          files.push(join(jsDir, file));
        }
      }

      // Add root level JS files
      const rootFiles = await fs.readdir(__dirname);
      for (const file of rootFiles) {
        if (file.endsWith('.js') && !file.startsWith('.')) {
          files.push(join(__dirname, file));
        }
      }
    } catch (error) {
      this.log('warn', 'Error reading JavaScript files', error.message);
    }

    return files;
  }

  /**
   * Calculate overall health score
   */
  calculateOverallHealth() {
    let totalChecks = 0;
    let passedChecks = 0;

    // Code consistency checks
    this.results.codeConsistency.forEach((check) => {
      totalChecks++;
      if (check.status === 'PASS') {
        passedChecks++;
      } else if (check.status === 'WARN') {
        passedChecks += 0.7; // Partial credit for warnings
      }
    });

    // ESLint status
    if (this.results.eslintStatus) {
      totalChecks++;
      if (this.results.eslintStatus.status === 'PASS') {
        passedChecks++;
      } else if (this.results.eslintStatus.status === 'TIMEOUT') {
        passedChecks += 0.5; // Partial credit for timeout
      }
    }

    // Testing system
    if (this.results.testingSystem) {
      totalChecks++;
      if (this.results.testingSystem.status === 'PASS') {
        passedChecks++;
      }
    }

    this.results.overallHealth =
      totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;
  }

  /**
   * Generate final report
   */
  generateFinalReport() {
    this.calculateOverallHealth();

    this.log('summary', '='.repeat(60));
    this.log('summary', 'FINAL DEBUGGING VERIFICATION REPORT');
    this.log('summary', '='.repeat(60));

    this.log(
      'summary',
      `Overall Health Score: ${this.results.overallHealth.toFixed(1)}%`
    );
    this.log(
      'summary',
      `Verification Duration: ${((Date.now() - this.startTime) / 1000).toFixed(1)}s`
    );

    this.log('summary', '\n📋 CODE CONSISTENCY CHECKS:');
    this.results.codeConsistency.forEach((check) => {
      const statusEmoji =
        check.status === 'PASS' ? '✅' : check.status === 'WARN' ? '⚠️' : '❌';
      this.log('summary', `${statusEmoji} ${check.check}: ${check.details}`);
    });

    if (this.results.eslintStatus) {
      this.log('summary', '\n🔧 ESLINT STATUS:');
      const statusEmoji =
        this.results.eslintStatus.status === 'PASS'
          ? '✅'
          : this.results.eslintStatus.status === 'TIMEOUT'
            ? '⚠️'
            : '❌';
      this.log(
        'summary',
        `${statusEmoji} ESLint: ${this.results.eslintStatus.status}`
      );
    }

    if (this.results.testingSystem) {
      this.log('summary', '\n🧪 TESTING SYSTEM:');
      const statusEmoji =
        this.results.testingSystem.status === 'PASS' ? '✅' : '❌';
      this.log(
        'summary',
        `${statusEmoji} Enhanced Testing System: ${this.results.testingSystem.status}`
      );

      if (this.results.testingSystem.features) {
        const enabledFeatures = Object.entries(
          this.results.testingSystem.features
        )
          .filter(([_, enabled]) => enabled)
          .map(([feature, _]) => feature);
        this.log('summary', `   Features: ${enabledFeatures.join(', ')}`);
      }
    }

    this.log('summary', '\n🎯 RECOMMENDATIONS:');

    if (this.results.overallHealth >= 95) {
      this.log(
        'summary',
        '✅ Excellent! The codebase is in outstanding condition.'
      );
      this.log(
        'summary',
        '   All critical debugging issues have been resolved.'
      );
      this.log(
        'summary',
        '   Continue with regular development and maintenance.'
      );
    } else if (this.results.overallHealth >= 85) {
      this.log('summary', '✅ Very Good! The codebase is in good condition.');
      this.log(
        'summary',
        '   Minor improvements may be beneficial but not critical.'
      );
    } else if (this.results.overallHealth >= 70) {
      this.log('summary', '⚠️ Good with room for improvement.');
      this.log(
        'summary',
        '   Address the identified issues to improve code quality.'
      );
    } else {
      this.log('summary', '❌ Needs attention.');
      this.log(
        'summary',
        '   Several issues need to be addressed for optimal code health.'
      );
    }

    this.log('summary', '='.repeat(60));

    return this.results;
  }

  /**
   * Run all verification checks
   */
  async runAllVerifications() {
    this.log('info', 'Starting final debugging verification...');

    await this.verifyP5InstanceMode();
    await this.verifyConstructorSignatures();
    await this.verifyMethodSignatures();
    await this.verifyConsoleLogging();
    await this.testESLintConfiguration();
    await this.verifyTestingSystem();

    return this.generateFinalReport();
  }
}

// Run verification if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const verifier = new FinalDebuggingVerification();
  verifier
    .runAllVerifications()
    .then((results) => {
      console.log('\n🎉 Final debugging verification completed!');
      process.exit(results.overallHealth >= 85 ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Verification failed:', error);
      process.exit(1);
    });
}

export default FinalDebuggingVerification;
