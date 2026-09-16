import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');

const nextConfig: NextConfig = {
  // Next 15.5 moved this out of `experimental` (build warning on 15/9).
  typedRoutes: true,
  // Sentry's OpenTelemetry instrumentation uses dynamic requires; bundling it produces
  // "Critical dependency: the request of a dependency is an expression" warnings.
  // Keeping these packages external is what Sentry documents for Next 15.
  serverExternalPackages: ['import-in-the-middle', 'require-in-the-middle'],
  transpilePackages: [
    '@colombia-estudia/domain',
    '@colombia-estudia/types',
    '@colombia-estudia/design-tokens',
  ],
};

export default withNextIntl(nextConfig);
