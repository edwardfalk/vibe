/* eslint-env browser */
// comprehensive-probe-runner.js
// Comprehensive Probe System Runner and Reporter

import { random } from '@vibe/core';

(async function () {
  // Import ticketManager API if available
  let ticketManager = null;
  try {
    ticketManager = await import(
      new URL('../githubIssueManager.js', import.meta.url).href
    );
  } catch (e) {
    // Not available in all contexts
  }

  const probeRunner = {
    async runAllProbes() {
      console.log('🔍 Starting comprehensive probe system...');

      // Early console hook: capture errors/warnings from the entire probe run (including boot)
      try {
        if (!window.__probeLogs) {
          window.__probeLogs = { errors: [] };
          const _origErr = console.error;
          const _origWarn = console.warn;
          console.error = function (...args) {
            try {
              window.__probeLogs.errors.push(args.join(' '));
            } catch {}
            return _origErr.apply(this, args);
          };
          console.warn = function (...args) {
            try {
              window.__probeLogs.errors.push(args.join(' '));
            } catch {}
            return _origWarn.apply(this, args);
          };
        }
      } catch {}

      // Guard: ensure p5 draw loop started to avoid early-frame races
      await (async function waitForDrawStart(timeoutMs = 3500) {
        const start =
          typeof performance !== 'undefined' && performance.now
            ? performance.now()
            : Date.now();
        return new Promise((resolve) => {
          function tick() {
            const now =
              typeof performance !== 'undefined' && performance.now
                ? performance.now()
                : Date.now();
            const ok =
              window.p5 &&
              window.p5.instance &&
              typeof window.p5.instance.frameCount === 'number' &&
              window.p5.instance.frameCount > 0;
            if (ok) return resolve(true);
            if (now - start >= timeoutMs) return resolve(false);
            (typeof window !== 'undefined' &&
              typeof window.requestAnimationFrame === 'function'
              ? window.requestAnimationFrame
              : setTimeout)(tick, 16);
          }
          tick();
        });
      })();

      const results = {
        timestamp: Date.now(),
        probes: {},
        summary: {
          total: 0,
          passed: 0,
          failed: 0,
          warnings: 0,
        },
        overallHealth: 'unknown',
      };

      // List of available probes
      const probes = [
        {
          name: 'liveness',
          module: './ai-liveness-probe.js',
          description: 'Game liveness and entity presence',
        },
        {
          name: 'collision',
          module: './collision-detection-probe.js',
          description: 'Collision detection system',
        },
        {
          name: 'audio',
          module: './audio-system-probe.js',
          description: 'Audio system and beat clock',
        },
        {
          name: 'vfx',
          module: './vfx-liveness-probe.js',
          description:
            'Visual FX liveness (canvas change) and console/audio sanity',
        },
      ];

      // Run each probe
      for (const probe of probes) {
        try {
          console.log(`🔍 Running ${probe.name} probe: ${probe.description}`);
          const t0 = performance?.now?.() ?? Date.now();

          const probeModule = await import(probe.module);
          const result = await probeModule.default;
          const t1 = performance?.now?.() ?? Date.now();
          const durationMs = Math.round(t1 - t0);

          results.probes[probe.name] = {
            ...result,
            description: probe.description,
            durationMs,
            status: result.failure
              ? 'failed'
              : result.warnings?.length > 0
                ? 'warning'
                : 'passed',
          };

          // On failure, attempt a canvas screenshot if available
          if (result.failure && window.mcp?.screenshot) {
            try {
              await window.mcp.screenshot(
                `probe-${probe.name}-failure-${Date.now()}`
              );
            } catch {}
          }

          results.summary.total++;

          if (result.failure) {
            results.summary.failed++;
            console.log(`❌ ${probe.name} probe failed: ${result.failure}`);
          } else if (result.warnings?.length > 0) {
            results.summary.warnings++;
            console.log(
              `⚠️ ${probe.name} probe passed with warnings: ${result.warnings.length} issues`
            );
          } else {
            results.summary.passed++;
            console.log(`✅ ${probe.name} probe passed`);
          }
        } catch (error) {
          console.error(`💥 Error running ${probe.name} probe:`, error);
          results.probes[probe.name] = {
            error: error.message,
            status: 'error',
            description: probe.description,
          };
          results.summary.failed++;
          results.summary.total++;
        }
      }

      // Determine overall health
      if (results.summary.failed === 0) {
        if (results.summary.warnings === 0) {
          results.overallHealth = 'excellent';
        } else {
          results.overallHealth = 'good';
        }
      } else if (results.summary.failed < results.summary.passed) {
        results.overallHealth = 'degraded';
      } else {
        results.overallHealth = 'critical';
      }

      // Generate comprehensive report
      this.generateReport(results);

      // Create summary ticket if there are critical issues
      if (results.overallHealth === 'critical') {
        await this.createSummaryTicket(results);
      }

      return results;
    },

    generateReport(results) {
      console.log('\n📊 COMPREHENSIVE PROBE SYSTEM REPORT');
      console.log('=====================================');
      console.log(`🕐 Timestamp: ${new Date(results.timestamp).toISOString()}`);
      console.log(`🎯 Overall Health: ${results.overallHealth.toUpperCase()}`);
      console.log(
        `📈 Summary: ${results.summary.passed}/${results.summary.total} passed, ${results.summary.failed} failed, ${results.summary.warnings} warnings`
      );

      console.log('\n🔍 PROBE DETAILS:');
      for (const [name, probe] of Object.entries(results.probes)) {
        const statusIcon =
          probe.status === 'passed'
            ? '✅'
            : probe.status === 'warning'
              ? '⚠️'
              : probe.status === 'error'
                ? '💥'
                : '❌';

        console.log(
          `${statusIcon} ${name.toUpperCase()}: ${probe.description}`
        );

        if (probe.failure) {
          console.log(`   💀 Failure: ${probe.failure}`);
        }

        if (probe.warnings?.length > 0) {
          console.log(`   ⚠️ Warnings: ${probe.warnings.join(', ')}`);
        }

        if (probe.criticalFailures?.length > 0) {
          console.log(`   🔥 Critical: ${probe.criticalFailures.join(', ')}`);
        }

        if (probe.error) {
          console.log(`   💥 Error: ${probe.error}`);
        }
      }

      // Health recommendations
      console.log('\n💡 RECOMMENDATIONS:');
      if (results.overallHealth === 'excellent') {
        console.log('✨ All systems are operating optimally!');
      } else if (results.overallHealth === 'good') {
        console.log('👍 Systems are stable with minor issues to address.');
      } else if (results.overallHealth === 'degraded') {
        console.log(
          '⚠️ Some systems need attention. Address warnings to improve stability.'
        );
      } else {
        console.log(
          '🚨 CRITICAL: Multiple system failures detected. Immediate action required!'
        );
      }

      console.log('=====================================\n');
    },

    async createSummaryTicket(results) {
      if (!ticketManager?.createTicket) return;

      try {
        const shortId = random().toString(36).substr(2, 8);
        const failedProbes = Object.entries(results.probes)
          .filter(
            ([_, probe]) =>
              probe.status === 'failed' || probe.status === 'error'
          )
          .map(([name, probe]) => `${name}: ${probe.failure || probe.error}`)
          .join('; ');

        const ticketData = {
          id: `PROBE-SUMMARY-${shortId}`,
          title: 'Critical System Health Issues Detected',
          description: `Comprehensive probe system detected critical failures in multiple systems: ${failedProbes}`,
          timestamp: new Date().toISOString(),
          category: 'bug',
          priority: 'critical',
          state: results,
          artifacts: [],
          status: 'Open',
          history: [
            {
              type: 'comprehensive_probe_failure',
              description: `Multiple system failures detected`,
              failedProbes: Object.keys(results.probes).filter(
                (name) =>
                  results.probes[name].status === 'failed' ||
                  results.probes[name].status === 'error'
              ),
              overallHealth: results.overallHealth,
              at: new Date().toISOString(),
            },
          ],
          verification: [],
          relatedTickets: [],
          tags: [
            'automated',
            'comprehensive',
            'probe',
            'critical',
            'system-health',
          ],
        };

        await ticketManager.createTicket(ticketData);
        console.log('🎫 Critical system health ticket created:', ticketData.id);
      } catch (err) {
        console.error('⚠️ Failed to create system health ticket:', err);
      }
    },

    // Quick health check method for frequent monitoring
    async quickHealthCheck() {
      const basicChecks = {
        gameLoop: !!(
          window.p5 &&
          window.p5.instance &&
          typeof window.p5.instance.frameCount === 'number' &&
          window.p5.instance.frameCount > 0
        ),
        player: !!window.player,
        gameState: !!window.gameState,
        audio: !!window.audio,
        collisionSystem: !!window.collisionSystem,
      };

      const healthScore =
        Object.values(basicChecks).filter(Boolean).length /
        Object.keys(basicChecks).length;

      return {
        timestamp: Date.now(),
        healthScore: Math.round(healthScore * 100),
        checks: basicChecks,
        status:
          healthScore >= 0.8
            ? 'healthy'
            : healthScore >= 0.6
              ? 'degraded'
              : 'critical',
      };
    },
  };

  // Expose probe runner globally for easy access
  window.probeRunner = probeRunner;

  // Auto-run comprehensive check if in test mode
  if (window.testMode || window.location.search.includes('probe=true')) {
    console.log('🔍 Auto-running comprehensive probe system...');
    setTimeout(() => probeRunner.runAllProbes(), 2000); // Wait for game initialization
  }

  return probeRunner;
})();

export default (async () => {
  if (window.probeRunner) return window.probeRunner;
  return new Promise((resolve) => {
    const check = () => {
      if (window.probeRunner) {
        resolve(window.probeRunner);
      } else {
        setTimeout(check, 25);
      }
    };
    check();
  });
})();
