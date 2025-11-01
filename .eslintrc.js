module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: 'module',
		project: './tsconfig.json',
	},
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:n8n-nodes-base/community',
	],
	plugins: ['@typescript-eslint', 'import'],
	env: {
		node: true,
		es6: true,
		jest: true,
	},
	rules: {
		// n8n specific rules (keep existing overrides)
		'n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options': 'off',
		'n8n-nodes-base/node-param-resource-without-no-data-expression': 'off',

		// TypeScript rules
		'@typescript-eslint/no-explicit-any': 'warn',
		'@typescript-eslint/explicit-function-return-type': 'off',
		'@typescript-eslint/explicit-module-boundary-types': 'off',
		'@typescript-eslint/no-unused-vars': [
			'error',
			{
				argsIgnorePattern: '^_',
				varsIgnorePattern: '^_',
			},
		],
		'@typescript-eslint/no-non-null-assertion': 'warn',
		'@typescript-eslint/ban-ts-comment': 'warn',

		// Import organization
		'import/order': [
			'error',
			{
				groups: [
					'builtin',
					'external',
					'internal',
					'parent',
					'sibling',
					'index',
				],
				'newlines-between': 'never',
				alphabetize: {
					order: 'asc',
					caseInsensitive: true,
				},
			},
		],
		'import/no-duplicates': 'error',

		// General code quality
		'no-console': 'off',
		'no-debugger': 'error',
		'no-var': 'error',
		'prefer-const': 'error',
		'eqeqeq': ['error', 'always', { null: 'ignore' }],
		'no-eval': 'error',
		'no-throw-literal': 'error',
	},
	ignorePatterns: [
		'dist/**',
		'node_modules/**',
		'coverage/**',
		'*.js',
		'jest.config.js',
	],
};
