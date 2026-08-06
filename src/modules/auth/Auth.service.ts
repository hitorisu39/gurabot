import fs from "fs";
import http from "http";
import path from "path";

import { Import } from "@/core/decorators";
import { AbstractService } from "@/core/framework/AbstractService";
import { HttpClient } from "@/http";

import { IAuthResponse } from "@domain/auth/Auth.dto";
import { authConnectionFailImage, authConnectionImage, authConnectionOkImage } from "@domain/auth/configs/Auth.config";
import { EAuthConnectionType } from "@domain/auth/enums/Auth.enum";
import { osuBaseUrl } from "@domain/osu/configs/Osu.config";

import { User } from "@generated/adapter/types";

import { OsuService } from "../osu/Osu.service";
import { UserService } from "../user/User.service";

export class AuthService extends AbstractService {
    @Import() declare private readonly userService: UserService;
    @Import() declare private readonly osuService: OsuService;

    private readonly webDirectory = path.resolve(process.cwd(), "web");
    private readonly templateFile = "auth.html";

    declare private html: string;
    declare private http: HttpClient;

    public async init(): Promise<void> {
        const port = this.config.web.authPort;

        this.http = new HttpClient(this.logger, {
            name: "WebAuth",
        });

        try {
            const templatePath = path.join(this.webDirectory, this.templateFile);
            this.html = fs.readFileSync(templatePath, "utf8");
        } catch (error) {
            this.logger.error(error, `Failed to load ${this.templateFile} template.`);

            return;
        }

        http.createServer(async (req, res) => {
            try {
                const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
                if ((req.method === "GET" || req.method === "HEAD") && this.isStaticAssetPath(url.pathname)) {
                    await this.serveStaticFile(url, req.method, res);
                    return;
                }

                if (req.method === "GET" && url.pathname === "/oauth/osu") {
                    await this.handleOsuAuth(url, res);
                    return;
                }

                this.sendText(res, 404, "Content you're looking for is not here.");
            } catch (error) {
                this.logger.error(error, "OAuth Server Error");

                if (!res.headersSent) {
                    this.sendText(res, 500, "Something went wrong on our end.");
                } else if (!res.writableEnded) {
                    res.end();
                }
            }
        }).listen(port, "0.0.0.0", () => {
            this.logger.info(`OAuth server listening on port ${port}`);
        });
    }

    private isStaticAssetPath(pathname: string): boolean {
        return pathname.startsWith("/styles/") || pathname.startsWith("/assets/") || pathname === "/favicon.ico";
    }

    private async serveStaticFile(url: URL, method: string | undefined, res: http.ServerResponse): Promise<void> {
        let relativePath: string;

        try {
            relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
        } catch {
            this.sendText(res, 400, "Invalid URL.");
            return;
        }

        const filePath = path.resolve(this.webDirectory, relativePath);
        if (filePath !== this.webDirectory && !filePath.startsWith(`${this.webDirectory}${path.sep}`)) {
            this.sendText(res, 403, "Forbidden.");
            return;
        }

        try {
            const stat = await fs.promises.stat(filePath);

            if (!stat.isFile()) {
                this.sendText(res, 404, "Not found.");
                return;
            }

            const contentType = this.getContentType(filePath);

            res.writeHead(200, {
                "Content-Type": contentType,
                "Content-Length": stat.size,
                "Cache-Control": "public, max-age=3600",
                "X-Content-Type-Options": "nosniff",
            });

            if (method === "HEAD") {
                res.end();
                return;
            }

            const stream = fs.createReadStream(filePath);

            stream.on("error", (error) => {
                this.logger.error(error, `Failed to stream static file: ${filePath}`);

                if (!res.headersSent) {
                    this.sendText(res, 500, "Failed to load file.");
                } else if (!res.writableEnded) {
                    res.destroy(error);
                }
            });

            stream.pipe(res);
        } catch (error) {
            const code = (error as NodeJS.ErrnoException).code;
            if (code === "ENOENT" || code === "ENOTDIR") {
                this.sendText(res, 404, "Not found.");
                return;
            }

            throw error;
        }
    }

    private getContentType(filePath: string): string {
        const extension = path.extname(filePath).toLowerCase();

        const contentTypes: Record<string, string> = {
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".svg": "image/svg+xml",
            ".ico": "image/x-icon",
            ".webp": "image/webp",
            ".woff": "font/woff",
            ".woff2": "font/woff2",
            ".ttf": "font/ttf",
        };

        return contentTypes[extension] ?? "application/octet-stream";
    }

    private sendText(res: http.ServerResponse, statusCode: number, message: string): void {
        if (res.writableEnded) {
            return;
        }

        res.writeHead(statusCode, {
            "Content-Type": "text/plain; charset=utf-8",
        });

        res.end(message);
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
            ? [
                  `<nav class="auth-links" aria-label="Legal">`,
                  `<a href="${this.config.app.domain}/terms">Terms</a>`,
                  `<a href="${this.config.app.domain}/privacy">Privacy</a>`,
                  `</nav>`,
              ].join("")
            : `You can contact us <a href="${this.config.app.supportServer}">here</a> for support.`;

        const checkmarkImage = success ? authConnectionOkImage : authConnectionFailImage;

        const rendered = this.html
            .replaceAll("{{TITLE}}", title)
            .replaceAll("{{DESCRIPTION}}", description)
            .replaceAll("{{CONNECTION_IMAGE}}", authConnectionImage[type])
            .replaceAll("{{CHECKMARK_IMAGE}}", checkmarkImage)
            .replaceAll("{{FOOTER}}", footer);

        res.writeHead(statusCode, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        });

        res.end(rendered);
    }

    private async handleOsuAuth(url: URL, res: http.ServerResponse): Promise<void> {
        const state = url.searchParams.get("state");
        const code = url.searchParams.get("code");

        if (!state || !code) {
            this.sendHtml(EAuthConnectionType.Osu, res, 400, "Missing Data", "Missing state or code parameter.", false);
            return;
        }

        const data = await this.cache.get("auth_osu_state", state);

        if (!data) {
            this.sendHtml(
                EAuthConnectionType.Osu,
                res,
                400,
                "Session Expired",
                "Invalid or expired auth session. You may have taken too long to authorize. Try running the command again.",
                false,
            );

            return;
        }

        try {
            const response = await this.http.post<IAuthResponse>(`${osuBaseUrl}/oauth/token`, {
                client_id: this.config.adapter.osu.client_id,
                client_secret: this.config.adapter.osu.client_secret,
                code,
                grant_type: "authorization_code",
                redirect_uri: this.config.adapter.osu.redirect_uri,
            });

            const profile = await this.http.get<User>(`${osuBaseUrl}/api/v2/me`, {
                headers: {
                    Authorization: `Bearer ${response.access_token}`,
                },
            });

            if (!profile) {
                this.sendHtml(
                    EAuthConnectionType.Osu,
                    res,
                    400,
                    "osu! Error",
                    "Failed to fetch your osu! profile from the API.",
                    false,
                );

                return;
            }

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
                "An internal error occurred while trying to link your account.",
                false,
            );
        }
    }
}
