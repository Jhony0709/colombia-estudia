/**
 * Storybook preview configuration.
 *
 * CORRECTION 7: NextIntlClientProvider decorator for all stories.
 */

import type { Preview, ReactRenderer } from '@storybook/nextjs-vite';
import { withThemeByClassName } from '@storybook/addon-themes';
import { NextIntlClientProvider } from 'next-intl';
import { createElement } from 'react';
import '../app/globals.css';

// Import messages for Storybook
import messages from '../messages/es-CO.json';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true,
          },
        ],
      },
    },
  },
  decorators: [
    // CORRECTION 7: NextIntlClientProvider for all stories
    (Story) =>
      createElement(NextIntlClientProvider, { locale: 'es-CO', messages }, createElement(Story)),
    // Theme decorator for dark mode toggle
    withThemeByClassName<ReactRenderer>({
      themes: {
        light: '',
        dark: 'dark',
      },
      defaultTheme: 'light',
    }),
  ],
};

export default preview;
