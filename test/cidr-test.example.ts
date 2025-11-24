/**
 * Example test cases for CIDR checking implementation
 * This demonstrates the functionality without external dependencies
 */

import { isIpAllowed } from '../nodes/Shared/utils/WebhookUtils';

// Test cases to demonstrate the CIDR implementation
const testCases = [
	// IPv4 Tests
	{
		ip: '192.168.1.100',
		whitelist: ['192.168.1.0/24'],
		expected: true,
		description: 'IPv4 in /24 subnet',
	},
	{
		ip: '192.168.2.100',
		whitelist: ['192.168.1.0/24'],
		expected: false,
		description: 'IPv4 outside /24 subnet',
	},
	{
		ip: '10.0.0.50',
		whitelist: ['10.0.0.0/16'],
		expected: true,
		description: 'IPv4 in /16 subnet',
	},
	{
		ip: '10.1.0.50',
		whitelist: ['10.0.0.0/16'],
		expected: true,
		description: 'IPv4 in /16 subnet (different octet)',
	},
	{
		ip: '192.168.1.1',
		whitelist: ['192.168.1.1'],
		expected: true,
		description: 'IPv4 exact match',
	},
	{
		ip: '172.16.0.1',
		whitelist: ['172.16.0.0/12'],
		expected: true,
		description: 'IPv4 in /12 subnet',
	},

	// IPv6 Tests
	{
		ip: '2001:db8::1',
		whitelist: ['2001:db8::/32'],
		expected: true,
		description: 'IPv6 in /32 subnet',
	},
	{
		ip: '2001:db9::1',
		whitelist: ['2001:db8::/32'],
		expected: false,
		description: 'IPv6 outside /32 subnet',
	},
	{
		ip: 'fe80::1',
		whitelist: ['fe80::/10'],
		expected: true,
		description: 'IPv6 link-local in /10',
	},
	{
		ip: '::1',
		whitelist: ['::1/128'],
		expected: true,
		description: 'IPv6 loopback exact match',
	},

	// IPv4-mapped IPv6
	{
		ip: '::ffff:192.168.1.1',
		whitelist: ['192.168.1.0/24'],
		expected: true,
		description: 'IPv4-mapped IPv6 address',
	},

	// Mixed whitelists
	{
		ip: '192.168.1.50',
		whitelist: ['192.168.1.0/24', '10.0.0.0/8', '172.16.0.0/12'],
		expected: true,
		description: 'Multiple CIDR ranges',
	},
	{
		ip: '8.8.8.8',
		whitelist: ['192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12'],
		expected: false,
		description: 'IP not in any range',
	},

	// Wildcard
	{
		ip: '1.2.3.4',
		whitelist: ['*'],
		expected: true,
		description: 'Wildcard allows all',
	},

	// Edge cases
	{
		ip: '192.168.1.255',
		whitelist: ['192.168.1.0/24'],
		expected: true,
		description: 'Broadcast address in range',
	},
	{
		ip: '192.168.1.0',
		whitelist: ['192.168.1.0/24'],
		expected: true,
		description: 'Network address in range',
	},
];

// Run tests
function runTests(): void {
	console.log('CIDR Implementation Test Results:\n');
	console.log('=' . repeat(60));

	let passed = 0;
	let failed = 0;

	for (const test of testCases) {
		const result = isIpAllowed(test.ip, test.whitelist);
		const status = result === test.expected ? '✅ PASS' : '❌ FAIL';

		if (result === test.expected) {
			passed++;
		} else {
			failed++;
		}

		console.log(`${status}: ${test.description}`);
		console.log(`  IP: ${test.ip}`);
		console.log(`  Whitelist: ${JSON.stringify(test.whitelist)}`);
		console.log(`  Expected: ${test.expected}, Got: ${result}`);
		console.log();
	}

	console.log('=' . repeat(60));
	console.log(`Results: ${passed} passed, ${failed} failed`);
}

// Export for testing
export { testCases, runTests };

// Usage example for documentation
const exampleUsage = `
// Example 1: Simple IPv4 CIDR check
const allowed = isIpAllowed('192.168.1.100', ['192.168.1.0/24']);
console.log(allowed); // true

// Example 2: Multiple ranges
const allowedRanges = [
  '192.168.0.0/16',  // Private network
  '10.0.0.0/8',      // Another private network
  '203.0.113.0/24'   // Test network
];
const isAllowed = isIpAllowed('10.5.5.5', allowedRanges);
console.log(isAllowed); // true

// Example 3: IPv6 CIDR
const ipv6Allowed = isIpAllowed('2001:db8::1', ['2001:db8::/32']);
console.log(ipv6Allowed); // true

// Example 4: Exact match
const exactMatch = isIpAllowed('192.168.1.1', ['192.168.1.1']);
console.log(exactMatch); // true

// Example 5: Wildcard (allow all)
const allAllowed = isIpAllowed('any.ip.address', ['*']);
console.log(allAllowed); // true
`;