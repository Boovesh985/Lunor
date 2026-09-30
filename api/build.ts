import { createStageHandler } from '../server/handler.js';
import { buildStage } from '../server/stages.js';

/** Stage 3 — stream the app's source code as <file> blocks (resumable). */
export default createStageHandler(buildStage);
