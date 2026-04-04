import {
    ECalculatorType,
    ICalculateDifficultyOptions,
    ICalculatePerformanceOptions,
    IDifficultyCalculationResponse,
    IPerformanceCalculationResponse,
} from "@domain/core/Calculator";
import { AbstractCalculator } from "./calculator/AbstractCalculator";
import { TConfig } from "./env";
import { TLogger } from "./core";
import { NativeCalculator } from "./calculator/NativeCalculator";
import { GameMode } from "@generated/adapter/types";
import { EApplicationError, Exception } from "@domain/core/Exception";

export class Calculator {
    private readonly calculators: Map<ECalculatorType, AbstractCalculator> = new Map();
    private currentCalculator: ECalculatorType = ECalculatorType.Native;

    constructor(config: TConfig, logger: TLogger) {
        this.register(ECalculatorType.Native, new NativeCalculator(config, logger));
    }

    public register(type: ECalculatorType, instance: AbstractCalculator): void {
        this.calculators.set(type, instance);
    }

    public setCurrentCalculator(type: ECalculatorType): void {
        this.currentCalculator = type;
    }

    public async difficulty<M extends GameMode>(
        options: ICalculateDifficultyOptions<M>,
    ): Promise<IDifficultyCalculationResponse<M>> {
        const calculator = this.calculators.get(this.currentCalculator);
        if (!calculator)
            throw new Exception(EApplicationError.NOT_FOUND, `Calculator ${this.currentCalculator} was not found.`);

        return calculator.difficulty(options);
    }

    public async performance<M extends GameMode>(
        options: ICalculatePerformanceOptions<M>,
    ): Promise<IPerformanceCalculationResponse<M>> {
        const calculator = this.calculators.get(this.currentCalculator);
        if (!calculator)
            throw new Exception(EApplicationError.NOT_FOUND, `Calculator ${this.currentCalculator} was not found.`);

        return calculator.performance(options);
    }

    public async performanceStream<M extends GameMode>(
        requests: ReadonlyArray<ICalculatePerformanceOptions<M>>,
    ): Promise<Array<IPerformanceCalculationResponse<M>>> {
        const calculator = this.calculators.get(this.currentCalculator);
        if (!calculator)
            throw new Exception(EApplicationError.NOT_FOUND, `Calculator ${this.currentCalculator} was not found.`);

        return calculator.performanceStream(requests);
    }

    public destroy(): void {
        this.calculators.forEach((c) => c.destroy());
    }
}
