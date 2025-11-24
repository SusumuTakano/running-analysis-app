module.exports = {
  apps: [
    {
      name: 'running-analysis-app',
      script: 'npx',
      args: 'vite --host 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
