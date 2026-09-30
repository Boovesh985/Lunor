import { createStageHandler } from '../server/handler.js';
import { learnStage } from '../server/stages.js';

/** Stage 5 — personalised concepts (mapped to Lunor's roadmap), quiz and challenges. */
export default createStageHandler(learnStage);
