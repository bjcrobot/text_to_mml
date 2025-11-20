import { defineConfig } from 'vite';

export default defineConfig({
    base: '/text_to_mml/',
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
    }
});
