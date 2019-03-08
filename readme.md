## Fifth Aeon - Bot Tool Kit
This repository contains a command line tool intended to make it easier to produce bots for the Fifth Aeon A.I competition.

### Getting Started
1. If you are not familiar with the Fifth Aeon card game's rules, then you should learn them by playing at [fifthaeon.com](https://fifthaeon.com). Don't skip this step, without knowing the rules you will be lost when making your bot.
2. Install the Bot Tool Kit using the instructions in the next section.
3. Run the BTK with `npm start` and choose "Create a new bot". Give your bot a unique name.
4. Navigate to your newly created bot in the src/bots folder.
5. Start working on implementing your bot. A great place to start is by looking at the documentation and source code for [DefaultAI](https://docs.fifthaeon.com/classes/_ai_defaultai_.defaultai.html).
6. Get help and help others by contributing to the [wiki](https://github.com/Fifth-Aeon/Fifth-Aeon-Wiki/wiki) or chatting on the [discord](https://discord.gg/QHqDae2).
7. To test an A.I run the tool than select run tournament. Then select the Standard Preconstructed option.

### Installation
1. Clone the repository with submodules using the command `git clone --recurse-submodules https://github.com/FifthAeon/Bot-Tool-Kit.git` (if you don't already have git you can get it [here](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git))
2. Install NodeJS version 10.x.x from <https://nodejs.org/en/download/>
3. Navigate your terminal into the folder you cloned the repository into and run `npm install` to get the dependencies
4. Run `npm start` to start the tool.
5. (Optional) I recommend using [Visual Studio Code](https://code.visualstudio.com/) as an editor. If you want to follow the style of the default code install the [TSLint](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-typescript-tslint-plugin) extension.

### Testing Decks
You can play with any of the decks the A.I uses in preconstructed tournaments. This may clarify the decks and devising strategies.
1. Go to fifthaeon.com then go to settings and the dev tab. Click "Unlock Cards".
2. Go into the folder data/decks and open one of the JSON files, copy paste its content.
3. Select play vs A.I then in the deck selection screen, select new deck.
4. Edit the new deck
5. Select the 3 dots next to the trash icon, then select import deck.
6. Copy paste the JSON.
7. Click ok and the deck will be imported. You can now use it to play against DefaultAI or in multiplayer.

### Playing Against your A.I
You can play against your A.I using the web client.

1. Start the tool with `npm start`.
2. Select the "Start A.I Server" option. (If you don't see this option, try updating the BTK using the next section).
3. Select an A.I and a deck for it to play.
4. Go to fifthaeon.com you should see an option called "Play vs Local Server A.I" then select a deck to use.
5. You should now be able to manually play against your bot. If your bot ever "quits" that means it crashed or sent an illegal action.

### Updating the Bot Tool Kit
1. Run `git pull origin master` to get the latest version of the BTK code.
2. Navigate to the game_model folder with `cd src/game_model`.
3. Within the game_model folder run `git pull origin master` to update the submodule code.
