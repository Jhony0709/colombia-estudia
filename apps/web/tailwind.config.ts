import type { Config } from 'tailwindcss';
import { designTokensPlugin } from '@colombia-estudia/design-tokens';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  plugins: [designTokensPlugin],
};

export default config;
