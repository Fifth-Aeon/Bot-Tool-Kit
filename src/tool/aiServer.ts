import * as WebSocket from 'ws';
import { GameAction } from '../game_model/events/gameAction';
import { GameSyncEvent } from '../game_model/events/syncEvent';
import { AiManager } from './aiManager';
import { SavedDeck, DeckList } from '../game_model/deckList';
import { standardFormat } from '../game_model/gameFormat';

interface StartAIServerGameMessage {
    type: 'StartAIServerGameMessage';
    deckList: SavedDeck;
    playerNumber: number;
}

type AiServerMessage = StartAIServerGameMessage | GameSyncEvent;

export class AiServer {
    private socketServer: WebSocket.Server;
    private clientSocket?: WebSocket;
    private aiManger = new AiManager(this.sendAction.bind(this));

    constructor(private aiName: string) {
        this.socketServer = new WebSocket.Server({ port: 4236 });
        console.log('A.I Server open on port', 4236);

        this.socketServer.on('error', err => {
            console.error('Server Websocket Error:\n', err);
        });

        this.socketServer.on('connection', socket => {
            if (this.clientSocket) {
                this.clientSocket.close();
                console.warn('Found new socket, closing existing one');
            }
            this.clientSocket = socket;
            socket.on('message', this.reciveMessage.bind(this));
        });
    }

    private reciveMessage(message: WebSocket.Data) {
        const event = JSON.parse(message.toString()) as AiServerMessage;
        if (event.type === 'StartAIServerGameMessage') {
            this.aiManger.startAi(
                this.aiName,
                new DeckList(standardFormat, event.deckList),
                event.playerNumber
            );
        } else {
            this.aiManger.reciveSyncronizationEvent(event);
        }
    }

    private sendAction(action: GameAction) {
        if (!this.clientSocket) {
            throw new Error('Cannot send to empty socket');
        }
        this.clientSocket.send(JSON.stringify(action));
    }
}
