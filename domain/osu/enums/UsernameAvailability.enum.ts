export enum EUsernameAvailabilityStatus {
    Available = "Available",
    Invalid = "Invalid",
    Protected = "Protected",
    AvailableLater = "AvailableLater",
    Unknown = "Unknown",
}

export enum EUsernameValidationIssue {
    LeadingOrTrailingSpaces = "LeadingOrTrailingSpaces",
    TooShort = "TooShort",
    TooLong = "TooLong",
    InvalidCharacters = "InvalidCharacters",
    ConsecutiveSpaces = "ConsecutiveSpaces",
    MixedSpacesAndUnderscores = "MixedSpacesAndUnderscores",
}

export enum EUsernameProtectionReason {
    Top100 = "Top100",
    Badges = "Badges",
    Beatmaps = "Beatmaps",
}
