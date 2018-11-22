import { openInteractivePrompt } from "./interactivePrompt";

// Unhandled promise rejections should throw exceptions
process.on('unhandledRejection', up => { throw up });

openInteractivePrompt();