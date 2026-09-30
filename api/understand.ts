import { createStageHandler } from '../server/handler.js';
import { understandStage } from '../server/stages.js';

/** Stage 1 — analyse the idea: users, MVP scope, assumptions, clarifying questions. */
export default createStageHandler(understandStage);
