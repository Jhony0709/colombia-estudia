/**
 * Storybook test runner configuration.
 *
 * CORRECTION 15: axe-playwright integration, http-server (not serve).
 */

import type { TestRunnerConfig } from '@storybook/test-runner';
import { injectAxe, checkA11y } from 'axe-playwright';

const config: TestRunnerConfig = {
  async preVisit(page) {
    // Inject axe-core before each story
    await injectAxe(page);
  },

  async postVisit(page) {
    // Run accessibility checks after each story renders
    await checkA11y(page, '#storybook-root', {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    });
  },
};

export default config;
