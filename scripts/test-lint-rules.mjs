import { ESLint } from 'eslint';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import { architecturePlugin } from '../eslint.config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const fixtures = [
  {
    file: 'lint-fixtures/no-explicit-any.ts',
    expectedRule: '@typescript-eslint/no-explicit-any',
  },
  {
    file: 'lint-fixtures/no-console.ts',
    expectedRule: 'no-console',
  },
  {
    file: 'lint-fixtures/no-floating-promises.ts',
    expectedRule: '@typescript-eslint/no-floating-promises',
  },
  {
    file: 'lint-fixtures/no-misused-promises.ts',
    expectedRule: '@typescript-eslint/no-misused-promises',
  },
  {
    file: 'lint-fixtures/ordered-imports.ts',
    expectedRule: 'simple-import-sort/imports',
  },
  {
    file: 'lint-fixtures/raw-queries.ts',
    expectedRule: 'architecture/raw-queries-only-in-repositories',
  },
  {
    file: 'lint-fixtures/cross-module-import.ts',
    expectedRule: 'architecture/cross-module-index-imports',
  },
  {
    file: 'lint-fixtures/valid/modules/users/controllers/user.controller.ts',
    expectedRule: null,
  },
  {
    file: 'lint-fixtures/valid/modules/users/services/user.service.ts',
    expectedRule: null,
  },
  {
    file: 'lint-fixtures/valid/modules/users/user.repository.ts',
    expectedRule: null,
  },
];

async function runFixtureTests() {
  console.log('Testing ESLint fixtures against expected rule IDs...\n');

  const fixtureEslint = new ESLint({
    cwd: rootDir,
    overrideConfigFile: true,
    overrideConfig: [
      ...tseslint.configs.recommendedTypeChecked,
      {
        files: ['lint-fixtures/**/*.ts'],
        languageOptions: {
          parserOptions: {
            project: ['./tsconfig.eslint.json'],
            tsconfigRootDir: rootDir,
          },
        },
        plugins: {
          'simple-import-sort': simpleImportSort,
          architecture: architecturePlugin,
        },
        rules: {
          '@typescript-eslint/no-explicit-any': 'error',
          'no-console': 'error',
          '@typescript-eslint/no-floating-promises': 'error',
          '@typescript-eslint/no-misused-promises': 'error',
          'simple-import-sort/imports': 'error',
          'simple-import-sort/exports': 'error',
          'architecture/raw-queries-only-in-repositories': 'error',
          'architecture/cross-module-index-imports': 'error',
        },
      },
    ],
  });

  let totalFailures = 0;

  for (const { file, expectedRule } of fixtures) {
    const filePath = path.join(rootDir, file);
    const results = await fixtureEslint.lintFiles([filePath]);
    const fileResult = results[0];

    if (!fileResult) {
      console.error(`[FAIL] No lint results produced for ${file}`);
      totalFailures++;
      continue;
    }

    const messages = fileResult.messages;
    const ruleIds = messages.map((m) => m.ruleId).filter(Boolean);

    if (expectedRule === null) {
      if (messages.length === 0) {
        console.log(`[PASS] ${file} passed with zero lint errors as expected`);
      } else {
        console.error(
          `[FAIL] ${file} was expected to produce 0 lint errors, but produced: [${ruleIds.join(', ')}]`,
        );
        totalFailures++;
      }
      continue;
    }

    if (messages.length === 0) {
      console.error(`[FAIL] ${file} passed but was expected to fail with ${expectedRule}`);
      totalFailures++;
      continue;
    }

    if (ruleIds.includes(expectedRule)) {
      console.log(`[PASS] ${file} failed as expected with rule '${expectedRule}'`);
    } else {
      console.error(
        `[FAIL] ${file} failed with rules [${ruleIds.join(', ')}], but expected rule '${expectedRule}' was not found.`,
      );
      totalFailures++;
    }
  }

  console.log('\n----------------------------------------');
  if (totalFailures > 0) {
    console.error(`Fixture testing failed with ${totalFailures} error(s).`);
    process.exit(1);
  } else {
    console.log(
      `All ${fixtures.length} fixtures passed validation against their expected rule IDs.`,
    );
    process.exit(0);
  }
}

runFixtureTests().catch((err) => {
  console.error('Unexpected error running fixture tests:', err);
  process.exit(1);
});
