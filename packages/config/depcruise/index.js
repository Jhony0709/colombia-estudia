/**
 * Dependency Cruiser configuration for Colombia Estudia
 *
 * Enforces the layer boundaries defined in plan/01-arquitectura-y-estructura.md
 *
 * Rules:
 * 1. domain-es-puro: packages/domain cannot import Prisma, Next, or React
 * 2. features-no-cruzan-server: features/X/components cannot import features/Y/server
 * 3. components-no-servicios: components/ cannot import services or lib/db
 * 4. prisma-solo-en-lib-db: @prisma/client only imported in lib/db, jobs, and scripts
 * 5. app-no-lib-db: app/ routes cannot import lib/db directly (go through features)
 * 6. features-server-aislado: features/x/server cannot import React or components
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // Rule 1: domain-es-puro
    {
      name: 'domain-es-puro',
      comment: 'packages/domain is pure: no Prisma, Next, or React',
      severity: 'error',
      from: {
        path: '^packages/domain/',
      },
      to: {
        path: ['@prisma/client', 'next', 'next/', 'react', 'react-dom'],
      },
    },

    // Rule 2: features-no-cruzan-server
    {
      name: 'features-no-cruzan-server',
      comment: "A feature's components cannot import another feature's server code",
      severity: 'error',
      from: {
        path: '^apps/web/features/([^/]+)/components/',
      },
      to: {
        path: '^apps/web/features/(?!$1)[^/]+/server/',
      },
    },

    // Rule 3: components-no-servicios
    {
      name: 'components-no-servicios',
      comment: 'components/ cannot import services or lib/db',
      severity: 'error',
      from: {
        path: '^apps/web/components/',
      },
      to: {
        path: ['^apps/web/features/.*/server/', '^apps/web/lib/db/'],
      },
    },

    // Rule 4: prisma-solo-en-lib-db
    {
      name: 'prisma-solo-en-lib-db',
      comment: '@prisma/client only allowed in lib/db, api/jobs, and packages/scripts',
      severity: 'error',
      from: {
        path: '^apps/web/',
        pathNot: ['^apps/web/lib/db/', '^apps/web/app/api/jobs/'],
      },
      to: {
        path: '@prisma/client',
      },
    },

    // Rule 5: app-no-lib-db
    {
      name: 'app-no-lib-db',
      comment: 'Route handlers go through features, not lib/db directly',
      severity: 'error',
      from: {
        path: '^apps/web/app/',
        pathNot: ['^apps/web/app/api/jobs/', '^apps/web/app/api/health/'],
      },
      to: {
        path: '^apps/web/lib/db/',
      },
    },

    // Rule 6: features-server-aislado
    {
      name: 'features-server-aislado',
      comment: 'Server code in features cannot import React or components',
      severity: 'error',
      from: {
        path: '^apps/web/features/.*/server/',
      },
      to: {
        path: [
          '^react$',
          '^react-dom',
          '^apps/web/components/',
          '^apps/web/features/.*/components/',
        ],
      },
    },

    // Additional: No direct aria-live or .focus() outside lib/a11y
    {
      name: 'a11y-centralized',
      comment: 'Accessibility utilities must come from lib/a11y',
      severity: 'warn',
      from: {
        path: '^apps/web/',
        pathNot: '^apps/web/lib/a11y/',
      },
      to: {
        // This is a proxy check; actual aria-live checks need lint rules
        path: [],
      },
    },
  ],

  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/(@[^/]+/[^/]+|[^/]+)',
      },
    },
  },
};
