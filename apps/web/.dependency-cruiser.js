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
 * 6. features-server-aislado: features/X/server cannot import React or components
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
        path: '^features/([^/]+)/components/',
      },
      to: {
        path: '^features/(?!\\1)[^/]+/server/',
      },
    },

    // Rule 3: components-no-servicios
    {
      name: 'components-no-servicios',
      comment: 'components/ cannot import services or lib/db',
      severity: 'error',
      from: {
        path: '^components/',
      },
      to: {
        path: ['^features/.*/server/', '^lib/db/'],
      },
    },

    // Rule 4: prisma-solo-en-lib-db
    {
      name: 'prisma-solo-en-lib-db',
      comment: '@prisma/client only allowed in lib/db, api/jobs',
      severity: 'error',
      from: {
        pathNot: ['^lib/db/', '^app/api/jobs/'],
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
        path: '^app/',
        pathNot: [
          '^app/api/jobs/',
          '^app/api/health/',
          // Core identity endpoint - reads notification count for current user
          '^app/api/me/',
        ],
      },
      to: {
        path: '^lib/db/',
      },
    },

    // Rule 6: features-server-aislado
    {
      name: 'features-server-aislado',
      comment: 'Server code in features cannot import React or components',
      severity: 'error',
      from: {
        path: '^features/.*/server/',
      },
      to: {
        path: ['^react$', '^react-dom', '^components/', '^features/.*/components/'],
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
