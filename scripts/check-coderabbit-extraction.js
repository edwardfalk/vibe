const { exec } = require('child_process');

exec('bun run coderabbit:refresh', (error, stdout, stderr) => {
  if (error) {
    console.error('Extraction process failed:', error);
    process.exit(1);
  }
  if (stdout.includes('CODERABBIT_EXTRACTION_SUCCESS')) {
    console.log('✅ Extraction succeeded. Proceeding to apply suggestions...');
    // Place your next step here, e.g.:
    // exec('bun run apply-coderabbit-suggestions.js', ...);
  } else if (stdout.includes('CODERABBIT_EXTRACTION_EMPTY')) {
    console.log('ℹ️ No actionable suggestions found. Nothing to do.');
  } else if (stdout.includes('CODERABBIT_EXTRACTION_ERROR')) {
    console.error('❌ Extraction failed. Check logs for details.');
    process.exit(1);
  } else {
    console.error('❓ Unexpected output. Manual check recommended.');
    process.exit(1);
  }
}); 