import { createServer } from 'node:http';

import app from './app';
import { env } from './config/env';
import { initRealtime } from './lib/realtime';

const server = createServer(app);
initRealtime(server);

server.listen(env.PORT, () => {
  console.log(`Dipanix API listening on http://localhost:${env.PORT}`);
});
