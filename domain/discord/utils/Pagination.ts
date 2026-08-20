import { ActionRow } from "@/core/discord/ui/ActionRow";
import { ButtonStyle } from "discord.js";

export class Pagination {
    public static build(prefix: string, sessionID: string, page: number, totalPages: number): ActionRow {
        const isFirst = page === 1;
        const isLast = page === totalPages || totalPages === 0;

        return new ActionRow()
            .addEmojiButton("⏪", `${prefix}_first:${sessionID}`, ButtonStyle.Secondary, { disabled: isFirst })
            .addEmojiButton("◀️", `${prefix}_prev:${sessionID}`, ButtonStyle.Secondary, { disabled: isFirst })
            .addButton(`${page} / ${totalPages}`, `${prefix}_modal:${sessionID}`, ButtonStyle.Secondary)
            .addEmojiButton("▶️", `${prefix}_next:${sessionID}`, ButtonStyle.Secondary, { disabled: isLast })
            .addEmojiButton("⏩", `${prefix}_last:${sessionID}`, ButtonStyle.Secondary, { disabled: isLast });
    }

    public static buildLazy(prefix: string, sessionID: string, page: number, lastPage?: number): ActionRow {
        const isFirst = page === 1;
        const isLast = lastPage !== undefined && page >= lastPage;

        return new ActionRow()
            .addEmojiButton("⏪", `${prefix}_first:${sessionID}`, ButtonStyle.Secondary, { disabled: isFirst })
            .addEmojiButton("◀️", `${prefix}_prev:${sessionID}`, ButtonStyle.Secondary, { disabled: isFirst })
            .addButton(
                lastPage !== undefined ? `${page} / ${lastPage}` : `${page} / ?`,
                `${prefix}_modal:${sessionID}`,
                ButtonStyle.Secondary,
            )
            .addEmojiButton("▶️", `${prefix}_next:${sessionID}`, ButtonStyle.Secondary, { disabled: isLast })
            .addEmojiButton("⏩", `${prefix}_last:${sessionID}`, ButtonStyle.Secondary, {
                disabled: lastPage === undefined || isLast,
            });
    }

    public static calculateNewPage(action: string, current: number, total: number): number {
        switch (action) {
            case "first":
                return 1;
            case "prev":
                return Math.max(1, current - 1);
            case "next":
                return Math.min(total, current + 1);
            case "last":
                return total;
            default:
                return current;
        }
    }
}
