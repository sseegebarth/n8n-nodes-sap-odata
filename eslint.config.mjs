import { config } from '@n8n/node-cli/eslint';

export default [
	...config,
	{
		files: ['__tests__/**/*.ts'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
		},
	},
];
