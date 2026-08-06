// Matches any of: ! > < ? | \ / ^ @ # $ % & *
export const discordRegexSpecialCharacters = /[!><?|\\/^@#$%&*]/;

// Matches any number
export const discordRegexAnyNumber = /^\d+$/;

// The max visual characters for a line to avoid Discord wrapping nicely.
export const discordMaxVisualLineLength = 52;

// Space unicode character that allows to add space in embeds.
export const discordSpaceUnicode = " ";
