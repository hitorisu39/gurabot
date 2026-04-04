import { ICalculateDifficultyOptions, ICalculatePerformanceOptions, IDifficultyCalculationResponse, IPerformanceCalculationResponse, } from "@domain/core/Calculator";
import { GameMode } from "@generated/adapter/types";

export abstract class AbstractCalculator {
    public abstract difficulty<M extends GameMode>(options: ICalculateDifficultyOptions<M>): Promise<IDifficultyCalculationResponse<M>>;
    public abstract performance<M extends GameMode>(options: ICalculatePerformanceOptions<M>): Promise<IPerformanceCalculationResponse<M>>;
    public abstract performanceStream<M extends GameMode>(requests: ReadonlyArray<ICalculatePerformanceOptions<M>>): Promise<Array<IPerformanceCalculationResponse<M>>>;
    public abstract destroy(): void;
}