import { readFile } from "node:fs/promises";
import path from "path";
import sharp, { type OverlayOptions } from "sharp";
import { Import, Trace } from "@/core/decorators";
import { TMessagePayload } from "@/core/discord/context/CommandContext";
import { AbstractService } from "@/core/framework/AbstractService";
import { HttpClient } from "@/http";
import {
    skillCardLayout,
    skillCardMaximumStars,
    skillCardModeAssets,
    skillCardThemes,
} from "@domain/osu/configs/SkillCard.config";
import { SkillCategoryResultDto, SkillRankDto } from "@domain/osu/Skill.dto";
import { ProfileFormatter } from "@domain/osu/formatters/Profile.formatter";
import { SkillStatsViewDto } from "@domain/osu/views/SkillStats.view";
import { ProviderMeta } from "@generated/adapter";
import { GameMode } from "@generated/adapter/types";
import { AttachmentBuilder } from "discord.js";
import { ProfileViewService } from "../profile/ProfileView.service";
import { SkillRankService } from "./SkillRank.service";
import { clamp } from "@domain/utils";
import { ESkillRank } from "@domain/osu/enums/Skill.enum";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { createCanvas } from "canvas";
import { PopulatedUser } from "@domain/osu/Profile.dto";

interface ICachedImageAsset {
    buffer: Buffer;
    width: number;
    height: number;
}

interface ISkillCardThemeAssets {
    background: ICachedImageAsset;
    emptyBar: ICachedImageAsset;
    filledBar: ICachedImageAsset;
}

export class SkillCardViewService extends AbstractService {
    @Import() declare private readonly profileViewService: ProfileViewService;
    @Import() declare private readonly skillRankService: SkillRankService;

    declare private assets: string;
    declare private http: HttpClient;

    private readonly assetCache = new Map<string, Promise<ICachedImageAsset>>();
    private readonly modeIconCache = new Map<GameMode, Promise<Buffer>>();
    private readonly textMeasurementContext = createCanvas(1, 1).getContext("2d");
    private readonly maximumAvatarBytes = 10 * 1024 * 1024;

    public async init(): Promise<void> {
        this.assets = path.join(process.cwd(), this.config.app.resources, "cards");
        this.http = new HttpClient(this.logger, { name: "OsuSkillCard" });
    }

    @Trace()
    public async build(data: SkillStatsViewDto): Promise<TMessagePayload> {
        const skillRank = this.skillRankService.calculate(data.profile.mode, data.categories);
        const image = await this.generate(data, skillRank);

        const filename = `skill-card-${data.profile.id}-${data.profile.mode}-${skillRank.rank.toLowerCase()}.png`;
        const embed = this.profileViewService.createBaseEmbed(data.profile, data.timestamp, false);

        embed.setThumbnail(null).setTitle("Skill card").setImage(`attachment://${filename}`);

        return {
            embeds: [embed],
            files: [new AttachmentBuilder(image, { name: filename })],
        };
    }

    private async generate(data: SkillStatsViewDto, skillRank: SkillRankDto): Promise<Buffer> {
        const [assets, modeIcon, avatar] = await Promise.all([
            this.getThemeAssets(skillRank.rank),
            this.getModeIcon(data.profile.mode),
            this.loadAvatar(data),
        ]);

        const barComposites = await this.createSkillBarComposites(data.profile.mode, data.categories, assets);
        const foreground = Buffer.from(this.createForegroundSvg(data, skillRank));

        const composites: Array<OverlayOptions> = [
            {
                input: modeIcon,
                left: skillCardLayout.modeIconX,
                top: skillCardLayout.modeIconY,
            },
            {
                input: avatar,
                left: skillCardLayout.avatarX,
                top: skillCardLayout.avatarY,
            },
            ...barComposites,
            {
                input: foreground,
                left: 0,
                top: 0,
            },
        ];

        return await sharp(assets.background.buffer)
            .resize(skillCardLayout.width, skillCardLayout.height, {
                fit: "fill",
            })
            .composite(composites)
            .png({
                compressionLevel: 7,
                adaptiveFiltering: true,
            })
            .toBuffer();
    }

    //#region Foreground

    private createForegroundSvg(data: SkillStatsViewDto, skillRank: SkillRankDto): string {
        const theme = skillCardThemes[skillRank.rank];

        const serverName = this.escapeXml(ProviderMeta[data.profile.provider].name);
        const username = this.escapeXml(data.profile.username);
        const profileRank = this.escapeXml(this.formatProfileRank(data.profile));

        const usernameFontSize = this.getUsernameFontSize(data.profile.username);
        const usernameWidth = this.measureTextWidth(data.profile.username, usernameFontSize, 700);

        const usernameStartX = skillCardLayout.usernameCenterX - usernameWidth / 2;
        const profileRankY = skillCardLayout.usernameCenterY + skillCardLayout.profileRankOffsetY;

        const skillRows = this.createSkillRowsSvg(data.categories);

        return `
            <svg
                width="${skillCardLayout.width}"
                height="${skillCardLayout.height}"
                viewBox="0 0 ${skillCardLayout.width} ${skillCardLayout.height}"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <filter id="text-shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow
                            dx="0"
                            dy="1"
                            stdDeviation="1"
                            flood-color="#000000"
                            flood-opacity="0.5"
                        />
                    </filter>
                </defs>

                <style>
                    .card-text {
                        font-family: "Quicksand", "Inter", "Arial", sans-serif;
                    }

                    .server {
                        font-size: 17px;
                        font-weight: 700;
                        fill: #e0e0e0;
                    }

                    .username {
                        font-size: ${usernameFontSize}px;
                        font-weight: 700;
                        fill: ${theme.username};
                    }

                    .profile-rank {
                        font-size: 13px;
                        font-weight: 700;
                        fill: #575757;
                    }

                    .skill-name {
                        font-size: 17px;
                        font-weight: 700;
                        fill: ${theme.skillName};
                    }

                    .skill-value {
                        font-size: 17px;
                        font-weight: 700;
                        fill: ${theme.skillValue};
                    }
                </style>

                <text
                    class="card-text server"
                    x="${skillCardLayout.serverCenterX}"
                    y="${skillCardLayout.serverY}"
                    text-anchor="middle"
                    filter="url(#text-shadow)"
                >${serverName}</text>

                <text
                    class="card-text username"
                    x="${skillCardLayout.usernameCenterX}"
                    y="${skillCardLayout.usernameCenterY}"
                    text-anchor="middle"
                    filter="url(#text-shadow)"
                >${username}</text>

                ${
                    profileRank
                        ? `
                            <text
                                class="card-text profile-rank"
                                x="${usernameStartX}"
                                y="${profileRankY}"
                                text-anchor="start"
                            >${profileRank}</text>
                        `
                        : ""
                }

                ${skillRows}
            </svg>
        `;
    }

    private measureTextWidth(value: string, fontSize: number, fontWeight: number): number {
        this.textMeasurementContext.font = `${fontWeight} ${fontSize}px Quicksand, Inter, Arial`;
        return this.textMeasurementContext.measureText(value).width;
    }

    private createSkillRowsSvg(categories: Array<SkillCategoryResultDto>): string {
        return categories
            .slice(0, 5)
            .map((category, index) => {
                const rowY = skillCardLayout.skillAreaTop + index * skillCardLayout.skillRowHeight;
                const label = this.escapeXml(category.label);
                const value = this.escapeXml(`${Math.round(category.average * 100)}`);

                return `
                    <text
                        class="card-text skill-name"
                        x="${skillCardLayout.skillLabelX}"
                        y="${rowY + 17}"
                    >${label}</text>

                    <text
                        class="card-text skill-value"
                        x="${skillCardLayout.skillValueX}"
                        y="${rowY + 17}"
                        text-anchor="end"
                    >${value}</text>
                `;
            })
            .join("");
    }

    //#endregion

    //#region Skill bars

    private async createSkillBarComposites(
        mode: GameMode,
        categories: Array<SkillCategoryResultDto>,
        assets: ISkillCardThemeAssets,
    ): Promise<Array<OverlayOptions>> {
        const maximumStars = skillCardMaximumStars[mode];

        const rows = await Promise.all(
            categories.slice(0, 5).map(async (category, index) => {
                const rowY = skillCardLayout.skillAreaTop + index * skillCardLayout.skillRowHeight;
                const percentage = clamp(category.average / maximumStars, 0, 1);

                const composites: Array<OverlayOptions> = [
                    {
                        input: assets.emptyBar.buffer,
                        left: skillCardLayout.emptyBarX,
                        top: rowY + skillCardLayout.emptyBarOffsetY,
                    },
                ];

                if (percentage <= 0) {
                    return composites;
                }

                const width = Math.max(1, Math.round(assets.filledBar.width * percentage));
                const filledBar = await this.cropFilledBar(assets.filledBar, width);

                composites.push({
                    input: filledBar,
                    left: skillCardLayout.filledBarX,
                    top: rowY + skillCardLayout.filledBarOffsetY,
                });

                return composites;
            }),
        );

        return rows.flat();
    }

    private async cropFilledBar(asset: ICachedImageAsset, width: number): Promise<Buffer> {
        if (width >= asset.width) {
            return asset.buffer;
        }

        return await sharp(asset.buffer)
            .extract({
                left: 0,
                top: 0,
                width,
                height: asset.height,
            })
            .png()
            .toBuffer();
    }

    //#endregion

    //#region Theme assets

    private async getThemeAssets(rank: ESkillRank): Promise<ISkillCardThemeAssets> {
        const directory = path.join(this.assets, rank);

        const [background, emptyBar, filledBar] = await Promise.all([
            this.getAsset(path.join(directory, "background.png")),
            this.getAsset(path.join(directory, "empty_bar.png")),
            this.getAsset(path.join(directory, "filled_bar.png")),
        ]);

        return {
            background,
            emptyBar,
            filledBar,
        };
    }

    private async getModeIcon(mode: GameMode): Promise<Buffer> {
        let cached = this.modeIconCache.get(mode);

        if (!cached) {
            cached = this.createModeIcon(mode);
            this.modeIconCache.set(mode, cached);

            cached.catch(() => {
                this.modeIconCache.delete(mode);
            });
        }

        return await cached;
    }

    private async createModeIcon(mode: GameMode): Promise<Buffer> {
        const filename = skillCardModeAssets[mode];
        const asset = await this.getAsset(path.join(this.assets, "Mode", filename));

        return await sharp(asset.buffer)
            .resize(skillCardLayout.modeIconSize, skillCardLayout.modeIconSize, {
                fit: "contain",
            })
            .png()
            .toBuffer();
    }

    private getAsset(filePath: string): Promise<ICachedImageAsset> {
        let cached = this.assetCache.get(filePath);

        if (!cached) {
            cached = this.readImageAsset(filePath);
            this.assetCache.set(filePath, cached);

            cached.catch(() => {
                this.assetCache.delete(filePath);
            });
        }

        return cached;
    }

    private async readImageAsset(filePath: string): Promise<ICachedImageAsset> {
        const buffer = await readFile(filePath);
        const metadata = await sharp(buffer).metadata();

        if (!metadata.width || !metadata.height) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `Could not determine image dimensions for skill-card asset: ${filePath}`,
            );
        }

        return {
            buffer,
            width: metadata.width,
            height: metadata.height,
        };
    }

    //#endregion

    //#region Avatar

    private async loadAvatar(data: SkillStatsViewDto): Promise<Buffer> {
        const avatarUrl = ProfileFormatter.avatar(data.profile.provider, data.profile.id, data.timestamp);

        const source = await this.http.get<Buffer>(avatarUrl, {
            responseType: "arraybuffer",
        });

        if (!source?.length) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `Received an empty avatar response for osu! user ${data.profile.id}.`,
            );
        }

        if (source.length > this.maximumAvatarBytes) {
            throw new Exception(
                EApplicationError.INTERNAL_ERROR,
                `Avatar for osu! user ${data.profile.id} exceeds ${this.maximumAvatarBytes} bytes.`,
            );
        }

        return await this.createCircularAvatar(source);
    }

    private async createCircularAvatar(source: Buffer): Promise<Buffer> {
        const size = skillCardLayout.avatarSize;

        const mask = Buffer.from(`
            <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
                <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#ffffff" />
            </svg>
        `);

        return await sharp(source, {
            limitInputPixels: 16_777_216,
        })
            .resize(size, size, {
                fit: "cover",
                position: "centre",
            })
            .composite([
                {
                    input: mask,
                    blend: "dest-in",
                },
            ])
            .png()
            .toBuffer();
    }

    //#endregion

    //#region Formatting

    private formatProfileRank(profile: PopulatedUser): string {
        const parts: Array<string> = [];

        parts.push(ProfileFormatter.rank(profile.statistics.globalRank));
        parts.push(ProfileFormatter.rank(profile.statistics.countryRank, profile.countryCode));

        return parts.join("  ");
    }

    private getUsernameFontSize(username: string): number {
        if (username.length <= 9) return 40;
        if (username.length <= 12) return 36;
        if (username.length <= 16) return 31;
        if (username.length <= 20) return 27;

        return 23;
    }

    private escapeXml(value: string): string {
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }

    //#endregion
}
