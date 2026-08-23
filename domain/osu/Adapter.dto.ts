import { AdapterProvider } from "@generated/adapter/types";

export const LinkableAdapterProvider = {
    Bancho: AdapterProvider.Bancho,
    Akatsuki: AdapterProvider.Akatsuki,
} as const;

export type LinkableAdapterProvider = (typeof LinkableAdapterProvider)[keyof typeof LinkableAdapterProvider];
export type UserScoreType = "best" | "recent" | "firsts" | "pinned";
