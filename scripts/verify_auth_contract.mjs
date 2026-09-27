// Independent verification using the same JSON.stringify and HMAC primitives as the backend.
// Input contains synthetic data only (auth_contract_probe uses a fixed test key).
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
const requests = readFileSync(process.argv[2], 'utf8').trim().split('\n').map(JSON.parse);
for (const request of requests) {
  const body = JSON.stringify(JSON.parse(request.body));
  assert.equal(body, request.body, 'Wire body must survive server JSON.stringify unchanged');
  const payload = `${request.timestamp}:${request.nonce}:${request.method}:${request.path}:${body}`;
  const expected = createHmac('sha256', Buffer.alloc(32, 42)).update(payload).digest('hex');
  assert.equal(request.signature, expected, 'Rust signature must match the Node backend');
}
console.log(`${requests.length} server authentication contract cases passed`);
