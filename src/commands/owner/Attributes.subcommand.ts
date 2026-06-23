// src/commands/owner/Attributes.subcommand.ts
import { Import, IsBoolean, IsString, Option, Subcommand } from "@/core/decorators";
import { AbstractCommand } from "@/core/discord/AbstractCommand";
import { CommandContext } from "@/core/discord/context/CommandContext";
import { Embed } from "@/core/discord/ui/Embed";
import { CommandOption } from "@domain/core/Command";
import { AttributesRecalculationService } from "@/modules/osu/calculator/AttributesRecalculation.service";

@Subcommand({
    root: "owner",
    name: "attributes",
    description: "Recalculate deprecated difficulty attributes.",
    ephemeral: true,
})
export class OwnerAttributesSubcommand extends AbstractCommand {
    @Import() declare private readonly recalculationService: AttributesRecalculationService;

    @Option("date", "Recalculate attributes older than this date (YYYY-MM-DD)")
    @IsString()
    declare private readonly date: CommandOption<string>;

    @Option("force", "Force recalculate all attributes")
    @IsBoolean()
    declare private readonly force: CommandOption<boolean>;

    @Option("no_custom", "Delete custom mod attributes instead of recalculating")
    @IsBoolean()
    declare private readonly noCustom: CommandOption<boolean>;

    public async execute(ctx: CommandContext): Promise<void> {
        if (ctx.author.id !== this.config.discord.dev_id) {
            await ctx.respond(Embed.error("You do not have permission to use this command."));
            return;
        }

        const status = this.recalculationService.getStatus();

        if (status.isRunning) {
            const elapsedMs = Date.now() - status.startTime;
            let etaString = "Calculating...";

            if (status.processed > 0 && status.total > 0) {
                const rate = status.processed / elapsedMs;
                const remainingMs = (status.total - status.processed) / rate;
                etaString = this.formatDuration(remainingMs);
            }

            const progressBar = this.createProgressBar(status.processed, status.total);

            const embed = new Embed()
                .setTitle("🛠️ Attributes Recalculation Job is Running")
                .setDescription(`
                    **Progress:** ${status.processed} / ${status.total}
                    ${progressBar}

                    **Time Elapsed:** ${this.formatDuration(elapsedMs)}
                    **Estimated Time Remaining:** ${etaString}
                `.trim());

            await ctx.respond(embed);
            return;
        }

        const isForce = this.force.unwrapOr(false);
        const dateStr = this.date.unwrapOr("");
        const isNoCustom = this.noCustom.unwrapOr(false);

        if (!isForce && !dateStr) {
            await ctx.respond(Embed.error("You must provide either `date` or `force`."));
            return;
        }

        let targetDate: Date | null = null;
        if (dateStr) {
            targetDate = new Date(dateStr);
            if (isNaN(targetDate.getTime())) {
                await ctx.respond(Embed.error("Invalid `date` format. Please use YYYY-MM-DD."));
                return;
            }
        }

        this.recalculationService.start(targetDate, isForce, isNoCustom);

        await ctx.respond(
            Embed.success("Started attributes recalculation job in the background. Run the command again to view its progress.")
        );
    }

    private formatDuration(ms: number): string {
        if (ms < 0 || !isFinite(ms)) return "Unknown";
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        return `${hours}h ${minutes}m ${seconds}s`;
    }

    private createProgressBar(current: number, total: number, length: number = 20): string {
        const percentage = Math.min(1, Math.max(0, current / (total || 1)));
        const filled = Math.round(length * percentage);
        const empty = length - filled;
        
        return `\`[${'█'.repeat(filled)}${'░'.repeat(empty)}]\` ${(percentage * 100).toFixed(1)}%`;
    }
}