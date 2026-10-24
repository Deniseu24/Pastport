import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Pastport',
    description: 'Experience the Past. Takes the internet back to any year you pick.',
    permissions: ['storage'],
  },
});
