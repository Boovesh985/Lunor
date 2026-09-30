import { createStageHandler } from '../server/handler.ts';
import { understandStage } from '../server/stages.ts';

/** Stage 1 — analyse the idea: users, MVP scope, assumptions, clarifying questions. */
export default createStageHandler(understandStage);
