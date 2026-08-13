import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // relative base so the same build works at the repository root and under
  // /barycentric-rational/ on GitHub Pages
  base: './',
  // .m files are pulled in with ?raw; tell vite they are assets, not modules
  assetsInclude: ['**/*.m'],
})
