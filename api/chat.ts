import { createStageHandler } from '../server/handler.ts';
import { chatStage } from '../server/stages.ts';

/** AI mentor — answers questions about the project, or edits/fixes it with <file> blocks. */
export default createStageHandler(chatStage);
