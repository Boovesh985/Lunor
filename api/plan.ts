import { createStageHandler } from '../server/handler.ts';
import { planStage } from '../server/stages.ts';

/** Stage 2 — architecture: screens, navigation, data model, files and build steps. */
export default createStageHandler(planStage);
