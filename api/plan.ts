import { createStageHandler } from '../server/handler.js';
import { planStage } from '../server/stages.js';

/** Stage 2 — architecture: screens, navigation, data model, files and build steps. */
export default createStageHandler(planStage);
