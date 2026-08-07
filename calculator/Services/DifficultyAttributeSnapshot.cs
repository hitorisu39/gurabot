using System.Collections.Concurrent;
using System.Globalization;
using System.Reflection;
using Grpc.Core;
using osu.Game.Rulesets.Catch.Difficulty;
using osu.Game.Rulesets.Difficulty;
using osu.Game.Rulesets.Mania.Difficulty;
using osu.Game.Rulesets.Mods;
using osu.Game.Rulesets.Osu.Difficulty;
using osu.Game.Rulesets.Taiko.Difficulty;

namespace Calculator.Services;

internal sealed class DifficultyAttributeSnapshot
{
    private static readonly ConcurrentDictionary<Type, NumericProperty[]> SnapshotPropertiesCache = new();

    private static readonly ConcurrentDictionary<
        Type,
        IReadOnlyDictionary<string, PropertyInfo>
    > WritablePropertiesCache = new();

    private readonly Type attributeType;
    private readonly double[] values;

    private DifficultyAttributeSnapshot(Type attributeType, double[] values)
    {
        this.attributeType = attributeType;
        this.values = values;
    }

    public static DifficultyAttributeSnapshot Capture(DifficultyAttributes attributes)
    {
        ArgumentNullException.ThrowIfNull(attributes);

        Type type = attributes.GetType();

        NumericProperty[] properties = SnapshotPropertiesCache.GetOrAdd(
            type,
            static targetType =>
                targetType
                    .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                    .Where(property =>
                        property.GetIndexParameters().Length == 0
                        && property.GetGetMethod(nonPublic: false) is not null
                        && property.CanWrite
                        && IsSupportedNumericType(property.PropertyType)
                    )
                    .Select(property => new NumericProperty(property))
                    .ToArray()
        );

        var values = new double[properties.Length];

        for (int i = 0; i < properties.Length; i++)
        {
            PropertyInfo property = properties[i].Property;
            object? value = property.GetValue(attributes);

            values[i] = value switch
            {
                double doubleValue => doubleValue,
                float floatValue => floatValue,
                int intValue => intValue,
                uint uintValue => uintValue,
                long longValue => longValue,

                _ => throw new InvalidOperationException(
                    $"Property {type.FullName}.{property.Name} returned an unsupported numeric value."
                ),
            };
        }

        return new DifficultyAttributeSnapshot(type, values);
    }

    public DifficultyAttributes Restore(uint rulesetId, Mod[] mods)
    {
        DifficultyAttributes attributes = CreateEmpty(rulesetId);

        if (attributes.GetType() != attributeType)
        {
            throw new InvalidOperationException(
                $"Cached difficulty attribute type {attributeType.FullName} does not match "
                    + $"expected type {attributes.GetType().FullName}."
            );
        }

        NumericProperty[] properties = SnapshotPropertiesCache.GetOrAdd(
            attributeType,
            static targetType =>
                targetType
                    .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                    .Where(property =>
                        property.GetIndexParameters().Length == 0
                        && property.GetGetMethod(nonPublic: false) is not null
                        && property.CanWrite
                        && IsSupportedNumericType(property.PropertyType)
                    )
                    .Select(property => new NumericProperty(property))
                    .ToArray()
        );

        if (properties.Length != values.Length)
        {
            throw new InvalidOperationException(
                $"Cached difficulty attribute layout for {attributeType.FullName} has changed."
            );
        }

        attributes.Mods = mods;

        for (int i = 0; i < properties.Length; i++)
        {
            PropertyInfo property = properties[i].Property;

            object converted = Convert.ChangeType(values[i], property.PropertyType, CultureInfo.InvariantCulture);
            property.SetValue(attributes, converted);
        }

        return attributes;
    }

    public static DifficultyAttributes Create(uint rulesetId, Mod[] mods, IReadOnlyDictionary<string, double> values)
    {
        DifficultyAttributes attributes = CreateEmpty(rulesetId);
        attributes.Mods = mods;

        IReadOnlyDictionary<string, PropertyInfo> properties = WritablePropertiesCache.GetOrAdd(
            attributes.GetType(),
            static type =>
                type.GetProperties(BindingFlags.Public | BindingFlags.Instance)
                    .Where(property =>
                        property.CanWrite
                        && IsSupportedNumericType(
                            Nullable.GetUnderlyingType(property.PropertyType) ?? property.PropertyType
                        )
                    )
                    .GroupBy(property => property.Name, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase)
        );

        foreach (KeyValuePair<string, double> pair in values)
        {
            if (!properties.TryGetValue(pair.Key, out PropertyInfo? property))
                continue;

            Type targetType = Nullable.GetUnderlyingType(property.PropertyType) ?? property.PropertyType;
            object converted = Convert.ChangeType(pair.Value, targetType, CultureInfo.InvariantCulture);

            property.SetValue(attributes, converted);
        }

        return attributes;
    }

    private static DifficultyAttributes CreateEmpty(uint rulesetId) =>
        rulesetId switch
        {
            0 => new OsuDifficultyAttributes(),
            1 => new TaikoDifficultyAttributes(),
            2 => new CatchDifficultyAttributes(),
            3 => new ManiaDifficultyAttributes(),
            _ => throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid ruleset ID.")),
        };

    private static bool IsSupportedNumericType(Type type)
    {
        return type == typeof(double)
            || type == typeof(float)
            || type == typeof(int)
            || type == typeof(uint)
            || type == typeof(long);
    }

    private readonly record struct NumericProperty(PropertyInfo Property);
}
