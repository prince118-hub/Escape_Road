import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'public',
  // Serve additional static assets from root-level folders
  server: {
    fs: {
      // Allow serving files from the project root
      allow: ['..']
    }
  }
});
