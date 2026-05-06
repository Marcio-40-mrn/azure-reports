import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Accept both "aramis-engenharia" and "https://dev.azure.com/aramis-engenharia"
  const org = (env.VITE_AZURE_ORG || '')
    .replace(/^https?:\/\/[^/]+\//, '')
    .replace(/\/$/, '')
    .trim()

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Main Azure DevOps API (projects, work items, WIQL)
        '/api/devops': {
          target: 'https://dev.azure.com',
          changeOrigin: true,
          rewrite: (path) => `/${org}${path.replace('/api/devops', '')}`,
        },
        // User Entitlements API (list all users)
        '/api/vsaex': {
          target: 'https://vsaex.dev.azure.com',
          changeOrigin: true,
          rewrite: (path) => `/${org}${path.replace('/api/vsaex', '')}`,
        },
      },
    },
  }
})
