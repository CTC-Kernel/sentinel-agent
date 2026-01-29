const fs = require('fs');

try {
    const content = fs.readFileSync('test-results.json', 'utf8');
    const results = JSON.parse(content);

    if (!results.testResults) {
        console.log('No test results found');
        process.exit(0);
    }

    let failureCount = 0;

    results.testResults.forEach(fileResult => {
        if (fileResult.status === 'failed' || fileResult.assertionResults.some(r => r.status === 'failed')) {
            console.log(`\nFile: ${fileResult.name}`);
            fileResult.assertionResults.forEach(test => {
                if (test.status === 'failed') {
                    console.log(`  ✖ ${test.fullName}`);
                    test.failureMessages.forEach(msg => {
                        console.log(`      Error: ${msg.split('\n')[0]}`); // First line of error
                    });
                    failureCount++;
                }
            });
        }
    });

    console.log(`\nTotal failures: ${failureCount}`);

} catch (e) {
    console.error('Error parsing JSON:', e);
}
