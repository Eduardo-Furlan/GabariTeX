import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import Screenshot from './Screenshot.vue';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('Screenshot', Screenshot);
  },
} satisfies Theme;

