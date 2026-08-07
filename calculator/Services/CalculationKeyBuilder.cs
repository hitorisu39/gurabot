using System.Globalization;
using Calculator.Protos;

namespace Calculator.Services;

internal static class CalculationKeyBuilder
{
    public static string BuildModsKey(IEnumerable<ModMessage> mods, double? customClockRate)
    {
        string modsKey = string.Join(
            ",",
            mods.OrderBy(mod => mod.Acronym, StringComparer.Ordinal)
                .Select(mod =>
                {
                    string settings = string.Join(
                        ";",
                        mod.Settings.OrderBy(pair => pair.Key, StringComparer.Ordinal)
                            .Select(pair => $"{pair.Key}={pair.Value}")
                    );

                    return $"{mod.Acronym}[{settings}]";
                })
        );

        string rate = customClockRate?.ToString("R", CultureInfo.InvariantCulture) ?? "default";
        return $"{modsKey}@{rate}";
    }
}
