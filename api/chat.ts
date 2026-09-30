import { createStageHandler } from '../server/handler.js';
import { chatStage } from '../server/stages.js';

/** AI mentor — answers questions about the project, or edits/fixes it with <file> blocks. */
export default createStageHandler(chatStage);
