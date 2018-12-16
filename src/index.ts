import { openInteractivePrompt } from "./tool/interactivePrompt";
import * as bots from "./bots/importBots";
import { readArgs } from "./tool/commandMode";

// Unhandled promise rejections should throw exceptions
process.on('unhandledRejection', up => { throw up });

if (process.argv.length <= 2 ) {
    openInteractivePrompt();
} else {
    readArgs();
}

bots;