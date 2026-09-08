import { EOtrKeyType, EOtrRuleset } from "../enums/Otr.enum";

export const otrKeyTypeValue: Record<EOtrKeyType, string> = {
    [EOtrKeyType.Otr]: "otr",
    [EOtrKeyType.Osu]: "osu",
    [EOtrKeyType.Username]: "username",
};

export const otrRulesetLabel: Record<EOtrRuleset, string> = {
    [EOtrRuleset.Standard]: "osu!",
    [EOtrRuleset.Taiko]: "osu!taiko",
    [EOtrRuleset.Catch]: "osu!catch",
    [EOtrRuleset.Mania]: "osu!mania",
    [EOtrRuleset.Mania4K]: "osu!mania 4K",
    [EOtrRuleset.Mania7K]: "osu!mania 7K",
};
