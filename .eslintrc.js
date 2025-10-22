module.exports = {
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: 'module',
	},
	extends: [
		'plugin:n8n-nodes-base/community',
	],
	rules: {
		'n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options': 'off',
		'n8n-nodes-base/node-param-resource-without-no-data-expression': 'off',
	},
};
