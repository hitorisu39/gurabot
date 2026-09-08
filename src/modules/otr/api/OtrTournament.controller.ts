import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { OtrTournamentService } from "./OtrTournament.service";

export class OtrTournamentController extends AbstractController {
    @Import() declare private readonly otrTournamentService: OtrTournamentService;

    @On("app", "ready")
    private async onAppReady(): Promise<void> {
        return await this.otrTournamentService.init();
    }
}
