import * as grpc from "@grpc/grpc-js";

import { ICalculateDifficultyOptions, ICalculatePerformanceOptions, IDifficultyCalculationResponse, IPerformanceCalculationResponse } from "@domain/core/Calculator";
import { AbstractCalculator } from "./AbstractCalculator";
import { TConfig } from "@/env";
import { TLogger } from "@/core";
import { CalculatorClient, DifficultyResponse, PerformanceResponse } from "@generated/calculator/calculator";
import { GameMode } from "@generated/adapter/types";
import { EApplicationError, Exception } from "@domain/core/Exception";

export class NativeCalculator extends AbstractCalculator {
    private client: CalculatorClient;

    constructor(
        private readonly config: TConfig,
        private readonly logger: TLogger
    ) {
        super();
        const serverAddress = `${config.calculator.host}:${config.calculator.port}`;

        this.client = new CalculatorClient(
            serverAddress,
            grpc.credentials.createInsecure()
        );

        this.logger.debug(`Initialized Calculator Client targeting ${serverAddress}`);
    }

    public async difficulty<M extends GameMode>(options: ICalculateDifficultyOptions<M>): Promise<IDifficultyCalculationResponse<M>> {
        return new Promise((resolve, reject) => [
            this.client.calculateDifficulty({ ...options, rulesetId: this.getRulesetID(options.mode), mods: options.mods || [], calculateStrains: options.calculateStrains }, (error: grpc.ServiceError | null, response: DifficultyResponse) => {
                if (error) {
                    this.logger.error(error, "Failed to calculate difficulty");
                    return reject(new Exception(EApplicationError.INTERNAL_ERROR, "Calculator service error"))
                }

                resolve(response as IDifficultyCalculationResponse<M>);
            })
        ]);
    }

    public async performance<M extends GameMode>(options: ICalculatePerformanceOptions<M>): Promise<IPerformanceCalculationResponse<M>> {
        return new Promise((resolve, reject) => [
            this.client.calculatePerformance({
                ...options,
                rulesetId: this.getRulesetID(options.mode),
                precalculatedDifficulty: options.precalculatedDifficulty || {},
                mods: options.mods || []
            }, (error: grpc.ServiceError | null, response: PerformanceResponse) => {
                if (error) {
                    this.logger.error(error, "Failed to calculate performance");
                    return reject(new Exception(EApplicationError.INTERNAL_ERROR, "Calculator service error"))
                }
                
                resolve(response as IPerformanceCalculationResponse<M>)
            })
        ]);
    }

    public async performanceStream<M extends GameMode>(requests: ReadonlyArray<ICalculatePerformanceOptions<M>>): Promise<Array<IPerformanceCalculationResponse<M>>> {
        return new Promise((resolve, reject) => {
            const results: Array<IPerformanceCalculationResponse<M>> = [];
            const stream = this.client.calculatePerformanceStream();

            stream.on('data', (response: PerformanceResponse) => {
                results.push(response as IPerformanceCalculationResponse<M>);
            });

            stream.on('error', (err) => {
                this.logger.error(err, "gRPC performance stream error");
                reject(new Exception(EApplicationError.INTERNAL_ERROR, "Calculator service stream error"));
            });

            stream.on('end', () => {
                resolve(results);
            });

            for (const request of requests) {
                stream.write({
                    ...request,
                    rulesetId: this.getRulesetID(request.mode),
                    precalculatedDifficulty: request.precalculatedDifficulty || {},
                    mods: request.mods || []
                });
            }
            
            stream.end();
        });
    }

    public destroy(): void {
        if (this.client) {
            this.client.close();
            this.logger.info("Disconnected from Calculator service.");
        }
    }

    private getRulesetID(mode: GameMode): number {
        switch (mode) {
            case GameMode.Standard: return 0;
            case GameMode.Taiko: return 1;
            case GameMode.Catch: return 2;
            case GameMode.Mania: return 3;
            default: return 0;
        }
    }
}