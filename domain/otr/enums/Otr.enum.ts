export enum EOtrKeyType {
    Otr = "Otr",
    Osu = "Osu",
    Username = "Username",
}

/**
 * 0 = osu!
 * 1 = taiko
 * 2 = catch
 * 3 = mania (other)
 * 4 = mania 4K
 * 5 = mania 7K
 */
export enum EOtrRuleset {
    Standard = 0,
    Taiko = 1,
    Catch = 2,
    Mania = 3,
    Mania4K = 4,
    Mania7K = 5,
}

export enum EOtrRatingAdjustmentType {
    Initial = 0,
    Decay = 1,
    Match = 2,
}

export enum EOtrVerificationStatus {
    None = 0,
    PreRejected = 1,
    PreVerified = 2,
    Rejected = 3,
    Verified = 4,
}
