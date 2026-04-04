import path from "path";
import fs from "fs";
import http from "http";

import { Import } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { UserService } from "../user/User.service";
import { OsuService } from "../osu/Osu.service";
import { EAuthConnectionType } from "@domain/auth/enums/Auth.enum";
import { authConnectionFailImage, authConnectionImage, authConnectionOkImage } from "@domain/auth/configs/Auth.config";
import { HttpClient } from "@/http";
import { IAuthResponse } from "@domain/auth/Auth.dto";
import { osuBaseUrl } from "@domain/osu/configs/Osu.config";
import { User } from "@generated/adapter/types";

export class AuthService extends AbstractService {
    @Import() declare private readonly userService: UserService;
    @Import() declare private readonly osuService: OsuService;

    private readonly dir: string = "web";
    private readonly file: string = "auth.html";

    declare private html: string;
    declare private http: HttpClient;

    public async init(): Promise<void> {
        const port = this.config.web.authPort;
        this.http = new HttpClient(this.logger, { name: "WebAuth" });

        try {
            const dir = path.resolve(process.cwd(), this.dir);
            this.html = fs.readFileSync(path.join(dir, this.file), "utf8");
        } catch (error) {
            this.logger.error(error, `Failed to load ${this.file} template.`);
            return;
        }

        http.createServer(async (req, res) => {
            try {
                const url = new URL(req.url || "/", `http://${req.headers.host}`);
                if (req.method === "GET" && url.pathname.startsWith("/oauth/osu"))
                    return await this.handleOsuAuth(url, res);

                res.writeHead(404, "Content you're looking for is not here.");
            } catch (error) {
                this.logger.error(error, "OAuth Server Error");
                res.writeHead(500, "Something went wrong on our end.");
            }
        }).listen(port, () => {
            this.logger.info(`OAuth server listening on port ${port}`);
        });
    }

    private sendHtml(
        type: EAuthConnectionType,
        res: http.ServerResponse,
        statusCode: number,
        title: string,
        description: string,
        success: boolean,
    ): void {
        const footer = success
            ? `<a href="${this.config.app.domain}/terms">Terms</a>  <a href="${this.config.app.domain}/privacy">Privacy</a>`
            : `You contact us <a href="${this.config.app.supportServer}">here</a> for support`;

        const rendered = this.html
            .replace("{{TITLE}}", title)
            .replace("{{DESCRIPTION}}", description)
            .replace("{{CONNECTION_IMAGE}}", authConnectionImage[type])
            .replace("{{CHECKMARK_IMAGE}}", success ? authConnectionOkImage : authConnectionFailImage)
            .replace("{{FOOTER}}", footer);

        res.writeHead(statusCode, { "Content-Type": "text/html" });
        res.end(rendered);
    }

    private async handleOsuAuth(url: URL, res: http.ServerResponse): Promise<void> {
        const state = url.searchParams.get("state");
        const code = url.searchParams.get("code");

        if (!state || !code)
            return this.sendHtml(
                EAuthConnectionType.Osu,
                res,
                400,
                "Missing Data",
                "Missing state or code parameter.",
                false,
            );

        const data = await this.cache.get("auth_osu_state", state);
        if (!data)
            return this.sendHtml(
                EAuthConnectionType.Osu,
                res,
                400,
                "Session Expired",
                "Invalid or expired auth session. You may have took too long to authorize. Try to run the command again.",
                false,
            );

        try {
            const response = await this.http.post<IAuthResponse>(`${osuBaseUrl}/oauth/token`, {
                client_id: this.config.adapter.osu.client_id,
                client_secret: this.config.adapter.osu.client_secret,
                code: code,
                grant_type: "authorization_code",
                redirect_uri: this.config.adapter.osu.redirect_uri,
            });

            const profile = await this.http.get<User>(`${osuBaseUrl}/api/v2/me`, {
                headers: { Authorization: `Bearer ${response.access_token}` },
            });

            if (!profile)
                return this.sendHtml(
                    EAuthConnectionType.Osu,
                    res,
                    400,
                    "osu! Error",
                    "Failed to fetch your osu! profile from the API.",
                    false,
                );

            await this.userService.link(data.discord, profile.id, data.provider);
            await this.cache.delete("auth_osu_state", state);

            this.logger.debug(`${profile.username} has linked their account on ${data.provider}`);
            this.sendHtml(
                EAuthConnectionType.Osu,
                res,
                200,
                "Authorized",
                `Your osu! account has been successfully linked to ${this.config.app.name}. You can close this page now.`,
                true,
            );
        } catch (error) {
            this.logger.error(error, "osu! linking error");
            this.sendHtml(
                EAuthConnectionType.Osu,
                res,
                500,
                "Failed",
                "An internal error occured while trying to link your account.",
                false,
            );
        }
    }
}
