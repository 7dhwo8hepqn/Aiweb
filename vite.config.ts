import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  // Get the API key from the loaded environment variables
  const apiKey = env.API_KEY || '';

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      target: 'esnext',
      minify: 'esbuild',
    },
    define: {
      // Defines process.env as a global object in the browser environment.
      // We stringify the object to ensure the values are embedded as strings.
      'process.env': JSON.stringify({
        API_KEY: apiKey
      })
    }
  };
});