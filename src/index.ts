import { openInteractivePrompt } from "./interactivePrompt";
import * as bots from "./bots/importBots";
import { readArgs } from "./commandMode";

// Unhandled promise rejections should throw exceptions
process.on('unhandledRejection', up => { throw up });

if (process.argv.length <= 2 ) {
    openInteractivePrompt();
} else {
    readArgs();
}

bots;