import { createStageHandler } from '../server/handler.ts';
import { buildStage } from '../server/stages.ts';

/** Stage 3 — stream the app's source code as <file> blocks (resumable). */
export default createStageHandler(buildStage);
