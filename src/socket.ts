import { io, ManagerOptions, Socket, SocketOptions } from "socket.io-client";
import { TLogger } from "./core/types";

type TEventHandler<T, K extends keyof T> = T[K] extends (...args: any[]) => any ? T[K] : never;

export interface ISocketClientOptions extends Partial<ManagerOptions & SocketOptions> {
    name?: string;
    url: string;
}

export class SocketClient<TListenEvents = Record<string, never>, TEmitEvents = Record<string, never>> {
    private readonly socket: Socket;
    private readonly logger: TLogger;

    private connecting?: Promise<void>;

    constructor(logger: TLogger, options: ISocketClientOptions) {
        this.logger = logger.child({ name: `SocketClient:${options.name || "Default"}` });

        const { url, ...socketOptions } = options;

        this.socket = io(url, {
            autoConnect: false,
            reconnection: true,
            reconnectionDelay: 1_000,
            reconnectionDelayMax: 10_000,
            ...socketOptions,
        });

        this.setupLogging();
    }

    public connect(timeout: number = 10_000): Promise<void> {
        if (this.socket.connected) return Promise.resolve();
        if (this.connecting) return this.connecting;

        const connection = new Promise<void>((resolve, reject) => {
            const cleanup = (): void => {
                clearTimeout(timer);
                this.socket.off("connect", onConnect);
                this.socket.off("connect_error", onError);
            };

            const onConnect = (): void => {
                cleanup();
                resolve();
            };

            const onError = (error: Error): void => {
                cleanup();
                reject(error);
            };

            const timer = setTimeout(() => {
                cleanup();
                reject(new Error(`Socket connection timed out after ${timeout}ms.`));
            }, timeout);

            this.socket.once("connect", onConnect);
            this.socket.once("connect_error", onError);
            this.socket.connect();
        });

        this.connecting = connection.finally(() => {
            this.connecting = undefined;
        });

        return this.connecting;
    }

    public disconnect(): void {
        this.socket.disconnect();
    }

    public isConnected(): boolean {
        return this.socket.connected;
    }

    public on<E extends keyof TListenEvents & string>(event: E, listener: TEventHandler<TListenEvents, E>): this {
        this.socket.on(event, listener as any);
        return this;
    }

    public off<E extends keyof TListenEvents & string>(event: E, listener?: TEventHandler<TListenEvents, E>): this {
        if (listener) {
            this.socket.off(event, listener as any);
        } else {
            this.socket.off(event);
        }

        return this;
    }

    public emit<E extends keyof TEmitEvents & string>(
        event: E,
        ...args: Parameters<TEventHandler<TEmitEvents, E>>
    ): this {
        this.socket.emit(event, ...args);
        return this;
    }

    private setupLogging(): void {
        this.socket.on("connect", () => {
            this.logger.info({ socketID: this.socket.id }, "Socket connected");
        });

        this.socket.on("disconnect", (reason) => {
            this.logger.warn({ reason }, "Socket disconnected");
        });

        this.socket.on("connect_error", (error) => {
            this.logger.error({ message: error.message }, "Socket connection failed");
        });
    }
}
