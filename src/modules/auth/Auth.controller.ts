import { Import, On } from "@/core/decorators";
import { AbstractController } from "@/core/framework/AbstractController";
import { AuthService } from "./Auth.service";

export class AuthController extends AbstractController {
    @Import() declare private readonly authService: AuthService;

    @On("app", "ready")
    private async onAppReady(): Promise<void> {
        if (!this.ctx.discord.isMainCluster()) return;

        return await this.authService.init();
    }
}
