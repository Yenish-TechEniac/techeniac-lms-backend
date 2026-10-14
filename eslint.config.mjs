import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

const rawQueriesRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow direct database queries outside *.repository.ts files and src/core/db/**',
    },
    schema: [],
    messages: {
      prohibitedQuery:
        "Direct database access method '{{method}}' is prohibited outside *.repository.ts and src/core/db/**.",
    },
  },
  create(context) {
    const filename = (context.filename ?? context.getFilename?.() ?? '').replace(/\\/g, '/');
    const isAllowed =
      filename.endsWith('.repository.ts') ||
      filename.includes('/src/core/db/') ||
      filename.startsWith('src/core/db/');

    if (isAllowed) {
      return {};
    }

    const restrictedMethods = new Set(['query', 'createQueryBuilder', 'getRepository']);

    return {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          !node.callee.computed &&
          node.callee.property.type === 'Identifier' &&
          restrictedMethods.has(node.callee.property.name)
        ) {
          context.report({
            node: node.callee.property,
            messageId: 'prohibitedQuery',
            data: { method: node.callee.property.name },
          });
        }
      },
    };
  },
};

const crossModuleImportsRule = {
  meta: {
    type: 'problem',
    docs: {
      description: "Ensure cross-module imports only import through the target module's index.ts",
    },
    schema: [],
    messages: {
      internalImport:
        "Cross-module import '{{importPath}}' must go through the module's public entry point (index.ts).",
    },
  },
  create(context) {
    const filename = (context.filename ?? context.getFilename?.() ?? '').replace(/\\/g, '/');
    const moduleMatch = filename.match(/\/src\/modules\/([^/]+)\//);

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value;
        if (typeof importPath !== 'string') return;

        // Check relative imports traversing to another module: ../other-module/subpath
        const relativeModuleMatch = importPath.match(/^\.\.\/([^/]+)\/(.+)$/);
        if (relativeModuleMatch) {
          const subPath = relativeModuleMatch[2];
          if (subPath !== 'index' && subPath !== 'index.ts' && subPath !== 'index.js') {
            context.report({
              node: node.source,
              messageId: 'internalImport',
              data: { importPath },
            });
            return;
          }
        }

        // Check module imports targeting internal paths: src/modules/<mod>/<subpath> or @modules/<mod>/<subpath>
        const explicitModuleMatch = importPath.match(/^(?:src\/modules|@modules)\/([^/]+)\/(.+)$/);
        if (explicitModuleMatch) {
          const targetModule = explicitModuleMatch[1];
          const subPath = explicitModuleMatch[2];
          if (subPath !== 'index' && subPath !== 'index.ts' && subPath !== 'index.js') {
            if (!moduleMatch || moduleMatch[1] !== targetModule) {
              context.report({
                node: node.source,
                messageId: 'internalImport',
                data: { importPath },
              });
              return;
            }
          }
        }

        // Check fixtures importing internal files
        if (filename.includes('lint-fixtures') && importPath.includes('/modules/')) {
          const fixtureMatch = importPath.match(/\/modules\/([^/]+)\/(.+)$/);
          if (fixtureMatch) {
            const subPath = fixtureMatch[2];
            if (subPath !== 'index' && subPath !== 'index.ts' && subPath !== 'index.js') {
              context.report({
                node: node.source,
                messageId: 'internalImport',
                data: { importPath },
              });
            }
          }
        }
      },
    };
  },
};

export const architecturePlugin = {
  rules: {
    'raw-queries-only-in-repositories': rawQueriesRule,
    'cross-module-index-imports': crossModuleImportsRule,
  },
};

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'lint-fixtures/**', 'scripts/**'],
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
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
  prettierConfig,
);
