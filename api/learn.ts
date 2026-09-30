import { createStageHandler } from '../server/handler.ts';
import { learnStage } from '../server/stages.ts';

/** Stage 5 — personalised concepts (mapped to Lunor's roadmap), quiz and challenges. */
export default createStageHandler(learnStage);
