// SessionService.ts
import { randomUUID } from "crypto";
import { ICacheSchema } from "@domain/core/Cache";
import { AbstractService } from "@/core/framework/AbstractService";
import { TObjectKeys } from "@/core";
import { EApplicationError, Exception } from "@domain/core/Exception";

type TSessionCallback = (sessionID: string) => void;

export class SessionService extends AbstractService {
    /**
     * Active timeouts for sessions.
     */
    private readonly activeTimeouts = new Map<string, NodeJS.Timeout>();

    /**
     * Callbacks for session expiration.
     */
    private readonly callbacks = new Map<
        string,
        Array<{ cb: TSessionCallback; ctx?: unknown; silent?: boolean | undefined }>
    >();

    /**
     * Tracks the last assigned TTL for each session to allow optional "bumping".
     */
    private readonly sessionTtl = new Map<string, number>();

    //#region API

    public async create<K extends keyof ICacheSchema>(
        baseKey: K,
        data: ICacheSchema[K],
        ttl?: number,
    ): Promise<string> {
        const sessionID = randomUUID();
        if (ttl) this.setupTimeout(sessionID, ttl);
        await this.cache.set(baseKey, data, ttl, sessionID);
        return sessionID;
    }

    public async get<K extends keyof ICacheSchema>(baseKey: K, sessionID: string): Promise<ICacheSchema[K] | null> {
        return await this.cache.get(baseKey, sessionID);
    }

    public async set<K extends keyof ICacheSchema>(
        baseKey: K,
        sessionID: string,
        data: ICacheSchema[K],
        ttl?: number,
    ): Promise<void> {
        await this.cache.set(baseKey, data, ttl, sessionID);
    }

    public async update<K extends TObjectKeys<ICacheSchema>>(
        baseKey: K,
        sessionID: string,
        partialData: Partial<ICacheSchema[K]>,
        ttl?: number,
    ): Promise<void> {
        const currentData = await this.get(baseKey, sessionID);

        if (!currentData)
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `Session with ID ${sessionID} for key ${String(baseKey)} not found.`,
            );

        const updatedData = {
            ...currentData,
            ...partialData,
        } as ICacheSchema[K];

        await this.cache.set(baseKey, updatedData, ttl, sessionID);

        if (typeof ttl === "number") this.setupTimeout(sessionID, ttl);
    }

    public async transition<TFrom extends keyof ICacheSchema, TTo extends keyof ICacheSchema>(
        fromKey: TFrom,
        toKey: TTo,
        sessionID: string,
        data: ICacheSchema[TTo],
        ttl?: number,
    ): Promise<void> {
        const current = await this.get(fromKey, sessionID);
        if (!current) {
            throw new Exception(EApplicationError.SESSION_EXPIRED);
        }

        const effectiveTtl = ttl ?? this.sessionTtl.get(sessionID);

        await this.cache.set(toKey, data, effectiveTtl, sessionID);
        await this.cache.delete(fromKey, sessionID);

        if (effectiveTtl) this.setupTimeout(sessionID, effectiveTtl);
    }

    public async destroy<K extends keyof ICacheSchema>(baseKey: K, sessionID: string): Promise<void> {
        await this.cache.delete(baseKey, sessionID);
    }

    public async bump<K extends keyof ICacheSchema>(baseKey: K, sessionID: string, ttl?: number): Promise<void> {
        const data = await this.get(baseKey, sessionID);

        if (!data)
            throw new Exception(EApplicationError.INTERNAL_ERROR, `Cannot bump session ${sessionID}: not found.`);

        const effectiveTtl = ttl ?? this.sessionTtl.get(sessionID);
        if (typeof effectiveTtl !== "number") return;

        await this.set(baseKey, sessionID, data, effectiveTtl);
        this.setupTimeout(sessionID, effectiveTtl);
    }

    public after(sessionID: string, cb: TSessionCallback, ctx?: unknown): void {
        this.addCallback(sessionID, cb, ctx);
    }

    public afterSilent(sessionID: string, cb: TSessionCallback, ctx?: unknown): void {
        this.addCallback(sessionID, cb, ctx, true);
    }

    //#endregion

    //#region Internal

    private addCallback(sessionID: string, cb: TSessionCallback, ctx?: unknown, silent?: boolean): void {
        if (!this.activeTimeouts.has(sessionID)) return;

        let callbacks = this.callbacks.get(sessionID);
        if (!callbacks) {
            callbacks = [];
            this.callbacks.set(sessionID, callbacks);
        }

        callbacks.push({ cb, ctx, silent });
    }

    /**
     * Clears any existing timeout and sets a new one.
     */
    private setupTimeout(sessionID: string, ttl: number): void {
        this.sessionTtl.set(sessionID, ttl);
        this.clearTimeout(sessionID, false);

        const timeout = setTimeout(() => {
            this.handleExpiration(sessionID);
        }, ttl * 1000);

        this.activeTimeouts.set(sessionID, timeout);
    }

    /**
     * Handles the logic when a timer naturally expires.
     */
    private handleExpiration(sessionID: string): void {
        const callbacks = this.callbacks.get(sessionID);

        if (callbacks) {
            for (const { cb, ctx, silent } of callbacks) {
                try {
                    cb.call(ctx, sessionID);
                } catch (error) {
                    if (!silent) this.logger.error(error, `Error in session expiration callback for ID: ${sessionID}`);
                }
            }
        }

        this.clearTimeout(sessionID);
    }

    /**
     * Clears the JS timeout and optionally removes registered callbacks.
     */
    private clearTimeout(sessionID: string, purgeCallbacks: boolean = true): void {
        const timeout = this.activeTimeouts.get(sessionID);
        if (timeout) {
            clearTimeout(timeout);
            this.activeTimeouts.delete(sessionID);
        }

        if (purgeCallbacks) {
            this.callbacks.delete(sessionID);
            this.sessionTtl.delete(sessionID);
        }
    }

    //#endregion
}
