import { loadConfig, createPool } from './config';
import { createApp } from './app';

const cfg = loadConfig();
const db = createPool(cfg);
const app = createApp(db, cfg);

const server = app.listen(cfg.port, () => {
  console.log(`[server] ฟังที่พอร์ต ${cfg.port} (${cfg.isProd ? 'production' : 'development'})`);
});

const stop = () => { server.close(() => { void db.end().then(() => process.exit(0)); }); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
