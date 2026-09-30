import { createStageHandler } from '../server/handler.ts';
import { explainStage } from '../server/stages.ts';

/** Stage 4 — line-anchored code walkthrough, data flow and glossary. */
export default createStageHandler(explainStage);
