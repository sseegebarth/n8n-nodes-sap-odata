import { config } from '@n8n/node-cli/eslint';

// Override no-unused-vars in the config object that has the @typescript-eslint plugin
const overriddenConfig = config.map((item) => {
	if (item.plugins?.['@typescript-eslint']) {
		return {
			...item,
			rules: {
				...item.rules,
				'@typescript-eslint/no-unused-vars': [
					'error',
					{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
				],
			},
		};
	}
	return item;
});

export default [
	...overriddenConfig,
	{
		files: ['__tests__/**/*.ts'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
		},
	},
];
