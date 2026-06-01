// Simulate CI job status check
const needs = {
  "lint": { "result": "success" },
  "test": { "result": "success" },
  "build": { "result": "success" },
  "security-audit": { "result": "success" },
  "e2e-tests": { "result": "failure" }
};

const failed = [];
for (const [name, info] of Object.entries(needs)) {
  const result = info.result;
  console.log(`${name}: ${result}`);
  if (result !== "success") {
    failed.push(`${name}=${result}`);
  }
}

if (failed.length) {
  console.error(`❌ CI failed: ${failed.join(", ")}`);
  process.exit(1);
}

console.log("✅ All CI jobs passed.");