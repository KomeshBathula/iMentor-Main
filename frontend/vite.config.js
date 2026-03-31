// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // --- API Proxy Configuration ---
  server: {
    port: 3005,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:5005',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:5005',
        changeOrigin: true,
        secure: false,
        ws: true,   // proxy WebSocket upgrades
      },
    },
  },
  // --- ADD THIS SECTION TO FIX THE "global is not defined" ERROR ---
  define: {
    'global': {},
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React — cached long-term, changes rarely
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Markdown / math rendering
          'vendor-markdown': ['marked', 'dompurify', 'katex', 'prismjs'],
          // Heavy visualization libs — loaded only when needed
          'vendor-charts': ['chart.js', 'react-chartjs-2'],
          'vendor-network': ['vis-network', 'react-vis-network-graph', 'dagre'],
          'vendor-reactflow': ['reactflow'],
          // Communication
          'vendor-io': ['axios', 'socket.io-client'],
          // Icon library
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
})
