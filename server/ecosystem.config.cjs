/**
 * PM2 配置。宝塔面板的「Node 项目管理器」底层就是 PM2，
 * 也可以在服务器上直接用：pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'cos-drive',
      script: 'dist/server.js',
      cwd: __dirname,
      instances: 1,
      // 本服务通过 COS 存储状态，理论上可多实例，
      // 但个人网盘没必要，单实例内存占用更省
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      time: true,
    },
  ],
}
