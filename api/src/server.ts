import app from "./app";
import { logger } from "./lib/logger";

// Local/dev entrypoint only — Vercel uses api/index.ts's exported handler instead
// of calling listen() (serverless functions don't run a persistent server).
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
  logger.info(`API listening on port ${port}`);
});
