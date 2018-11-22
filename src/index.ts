import { openInteractivePrompt } from "./interactivePrompt";
import * as bots from "./bots/importBots";

// Unhandled promise rejections should throw exceptions
process.on('unhandledRejection', up => { throw up });
openInteractivePrompt();

bots;