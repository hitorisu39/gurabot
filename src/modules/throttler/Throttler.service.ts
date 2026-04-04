import { AbstractService } from "@/core/framework/AbstractService";

export class ThrottlerService extends AbstractService {
    private readonly cooldowns = new Map<string, number>();

    public consume(key: string, cooldownSeconds: number): number | false {
        if (cooldownSeconds <= 0) return false;

        const cooldownAmount = cooldownSeconds * 1000;
        const now = Date.now();

        if (this.cooldowns.has(key)) {
            const expirationTime = this.cooldowns.get(key)!;
            const timeLeft = (expirationTime - now) / 1000;

            if (timeLeft > 0) {
                return timeLeft;
            }
        }

        this.cooldowns.set(key, now + cooldownAmount);
        setTimeout(() => this.cooldowns.delete(key), cooldownAmount);

        return false;
    }
}
