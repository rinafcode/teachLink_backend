module.exports = {
	root: true,
	env: {
		node: true,
		jest: true,
		es2021: true,
	},
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:prettier/recommended',
	],
	parser: '@typescript-eslint/parser',
	parserOptions: {
		sourceType: 'module',
		tsconfigRootDir: __dirname,
		project: undefined,
	},
	plugins: ['@typescript-eslint'],
	ignorePatterns: ['dist/**', 'node_modules/**'],
	rules: {
		'no-unused-vars': 'off',
		'@typescript-eslint/no-unused-vars': 'off',
	},
	overrides: [
		{
			files: ['**/*.spec.ts', 'test/**/*.ts'],
			rules: {
				'@typescript-eslint/no-unused-vars': [
					'warn',
					{ argsIgnorePattern: '.*', varsIgnorePattern: '.*', caughtErrorsIgnorePattern: '.*' },
				],
			},
		},
	],
};

module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
  },
};
