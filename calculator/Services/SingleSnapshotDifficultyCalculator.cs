using System.Collections.Concurrent;
using System.Reflection;
using System.Runtime.ExceptionServices;
using osu.Game.Beatmaps;
using osu.Game.Rulesets.Difficulty;
using osu.Game.Rulesets.Difficulty.Preprocessing;
using osu.Game.Rulesets.Difficulty.Skills;
using osu.Game.Rulesets.Mods;
using osu.Game.Rulesets.Objects;

namespace Calculator.Services;

internal static class SingleSnapshotDifficultyCalculator
{
    private static readonly ConcurrentDictionary<Type, CalculatorAccessors> accessors = new();

    public static PreparedDifficultyContext Prepare(
        DifficultyCalculator calculator,
        IEnumerable<Mod> mods,
        CancellationToken cancellationToken
    )
    {
        ArgumentNullException.ThrowIfNull(calculator);
        ArgumentNullException.ThrowIfNull(mods);

        CalculatorAccessors calculatorAccessors = accessors.GetOrAdd(calculator.GetType(), CalculatorAccessors.Create);

        calculatorAccessors.PreProcess(calculator, mods, cancellationToken);

        return new PreparedDifficultyContext(
            calculatorAccessors.GetBeatmap(calculator),
            calculatorAccessors.GetPlayableMods(calculator)
        );
    }

    public static PreparedDifficultyContext GetPreparedContext(DifficultyCalculator calculator)
    {
        ArgumentNullException.ThrowIfNull(calculator);

        CalculatorAccessors calculatorAccessors = accessors.GetOrAdd(calculator.GetType(), CalculatorAccessors.Create);

        return new PreparedDifficultyContext(
            calculatorAccessors.GetBeatmap(calculator),
            calculatorAccessors.GetPlayableMods(calculator)
        );
    }

    public static Skill[] CreateSkills(DifficultyCalculator calculator, IBeatmap playableBeatmap, Mod[] playableMods)
    {
        CalculatorAccessors calculatorAccessors = accessors.GetOrAdd(calculator.GetType(), CalculatorAccessors.Create);

        return calculatorAccessors.CreateSkills(calculator, playableBeatmap, playableMods);
    }

    public static IEnumerable<DifficultyHitObject> CreateSortedDifficultyHitObjects(
        DifficultyCalculator calculator,
        IBeatmap playableBeatmap,
        Mod[] playableMods
    )
    {
        CalculatorAccessors calculatorAccessors = accessors.GetOrAdd(calculator.GetType(), CalculatorAccessors.Create);

        return calculatorAccessors.SortObjects(
            calculator,
            calculatorAccessors.CreateDifficultyHitObjects(calculator, playableBeatmap, playableMods)
        );
    }

    public static DifficultyAttributes CreateDifficultyAttributes(
        DifficultyCalculator calculator,
        IBeatmap playableBeatmap,
        Mod[] playableMods,
        Skill[] skills
    )
    {
        CalculatorAccessors calculatorAccessors = accessors.GetOrAdd(calculator.GetType(), CalculatorAccessors.Create);

        return calculatorAccessors.CreateDifficultyAttributes(calculator, playableBeatmap, playableMods, skills);
    }

    public static DifficultyAttributes Calculate(
        DifficultyCalculator calculator,
        IBeatmap playableBeatmap,
        Mod[] playableMods,
        int topLevelObjectCount,
        CancellationToken cancellationToken
    )
    {
        ArgumentNullException.ThrowIfNull(calculator);
        ArgumentNullException.ThrowIfNull(playableBeatmap);
        ArgumentNullException.ThrowIfNull(playableMods);

        if (topLevelObjectCount <= 0 || topLevelObjectCount > playableBeatmap.HitObjects.Count)
        {
            throw new ArgumentOutOfRangeException(
                nameof(topLevelObjectCount),
                topLevelObjectCount,
                $"Snapshot must be between 1 and {playableBeatmap.HitObjects.Count}."
            );
        }

        cancellationToken.ThrowIfCancellationRequested();

        CalculatorAccessors calculatorAccessors = accessors.GetOrAdd(calculator.GetType(), CalculatorAccessors.Create);

        Skill[] skills = calculatorAccessors.CreateSkills(calculator, playableBeatmap, playableMods);

        IEnumerable<DifficultyHitObject> difficultyObjects = calculatorAccessors.SortObjects(
            calculator,
            calculatorAccessors.CreateDifficultyHitObjects(calculator, playableBeatmap, playableMods)
        );

        (IBeatmap progressiveBeatmap, List<HitObject> progressiveHitObjects) = ProgressiveBeatmapFactory.Create(
            playableBeatmap,
            topLevelObjectCount
        );

        for (int index = 0; index < topLevelObjectCount; index++)
        {
            progressiveHitObjects.Add(playableBeatmap.HitObjects[index]);
        }

        double snapshotEndTime = playableBeatmap.HitObjects[topLevelObjectCount - 1].GetEndTime();

        foreach (DifficultyHitObject difficultyObject in difficultyObjects)
        {
            if (difficultyObject.BaseObject.GetEndTime() > snapshotEndTime)
                break;

            foreach (Skill skill in skills)
            {
                cancellationToken.ThrowIfCancellationRequested();
                skill.Process(difficultyObject);
            }
        }

        return calculatorAccessors.CreateDifficultyAttributes(calculator, progressiveBeatmap, playableMods, skills);
    }

    internal readonly record struct PreparedDifficultyContext(IBeatmap PlayableBeatmap, Mod[] PlayableMods);

    private sealed class CalculatorAccessors
    {
        private readonly MethodInfo preProcess;
        private readonly PropertyInfo beatmap;
        private readonly FieldInfo playableMods;
        private readonly MethodInfo createSkills;
        private readonly MethodInfo createDifficultyHitObjects;
        private readonly MethodInfo sortObjects;
        private readonly MethodInfo createDifficultyAttributes;

        private CalculatorAccessors(
            MethodInfo preProcess,
            PropertyInfo beatmap,
            FieldInfo playableMods,
            MethodInfo createSkills,
            MethodInfo createDifficultyHitObjects,
            MethodInfo sortObjects,
            MethodInfo createDifficultyAttributes
        )
        {
            this.preProcess = preProcess;
            this.beatmap = beatmap;
            this.playableMods = playableMods;
            this.createSkills = createSkills;
            this.createDifficultyHitObjects = createDifficultyHitObjects;
            this.sortObjects = sortObjects;
            this.createDifficultyAttributes = createDifficultyAttributes;
        }

        public static CalculatorAccessors Create(Type calculatorType)
        {
            return new CalculatorAccessors(
                FindInstanceMethod(calculatorType, "preProcess", typeof(IEnumerable<Mod>), typeof(CancellationToken)),
                FindInstanceProperty(calculatorType, "Beatmap"),
                FindInstanceField(calculatorType, "playableMods"),
                FindInstanceMethod(calculatorType, "CreateSkills", typeof(IBeatmap), typeof(Mod[])),
                FindInstanceMethod(calculatorType, "CreateDifficultyHitObjects", typeof(IBeatmap), typeof(Mod[])),
                FindInstanceMethod(calculatorType, "SortObjects", typeof(IEnumerable<DifficultyHitObject>)),
                FindInstanceMethod(
                    calculatorType,
                    "CreateDifficultyAttributes",
                    typeof(IBeatmap),
                    typeof(Mod[]),
                    typeof(Skill[])
                )
            );
        }

        public void PreProcess(
            DifficultyCalculator calculator,
            IEnumerable<Mod> mods,
            CancellationToken cancellationToken
        )
        {
            Invoke(preProcess, calculator, mods, cancellationToken);
        }

        public IBeatmap GetBeatmap(DifficultyCalculator calculator)
        {
            return beatmap.GetValue(calculator) as IBeatmap
                ?? throw new InvalidOperationException(
                    "DifficultyCalculator.preProcess() did not produce a playable beatmap."
                );
        }

        public Mod[] GetPlayableMods(DifficultyCalculator calculator)
        {
            return playableMods.GetValue(calculator) as Mod[]
                ?? throw new InvalidOperationException(
                    "DifficultyCalculator.preProcess() did not produce playable mods."
                );
        }

        public Skill[] CreateSkills(DifficultyCalculator calculator, IBeatmap beatmap, Mod[] mods)
        {
            return InvokeRequired<Skill[]>(createSkills, calculator, beatmap, mods);
        }

        public IEnumerable<DifficultyHitObject> CreateDifficultyHitObjects(
            DifficultyCalculator calculator,
            IBeatmap beatmap,
            Mod[] mods
        )
        {
            return InvokeRequired<IEnumerable<DifficultyHitObject>>(
                createDifficultyHitObjects,
                calculator,
                beatmap,
                mods
            );
        }

        public IEnumerable<DifficultyHitObject> SortObjects(
            DifficultyCalculator calculator,
            IEnumerable<DifficultyHitObject> input
        )
        {
            return InvokeRequired<IEnumerable<DifficultyHitObject>>(sortObjects, calculator, input);
        }

        public DifficultyAttributes CreateDifficultyAttributes(
            DifficultyCalculator calculator,
            IBeatmap beatmap,
            Mod[] mods,
            Skill[] skills
        )
        {
            return InvokeRequired<DifficultyAttributes>(createDifficultyAttributes, calculator, beatmap, mods, skills);
        }
    }

    private static MethodInfo FindInstanceMethod(Type type, string methodName, params Type[] parameterTypes)
    {
        for (Type? current = type; current != null; current = current.BaseType)
        {
            MethodInfo? method = current.GetMethod(
                methodName,
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly,
                binder: null,
                types: parameterTypes,
                modifiers: null
            );

            if (method != null)
                return method;
        }

        throw new MissingMethodException(
            type.FullName,
            $"{methodName}({string.Join(", ", parameterTypes.Select(parameter => parameter.Name))})"
        );
    }

    private static PropertyInfo FindInstanceProperty(Type type, string propertyName)
    {
        for (Type? current = type; current != null; current = current.BaseType)
        {
            PropertyInfo? property = current.GetProperty(
                propertyName,
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly
            );

            if (property != null)
                return property;
        }

        throw new MissingMemberException(type.FullName, propertyName);
    }

    private static FieldInfo FindInstanceField(Type type, string fieldName)
    {
        for (Type? current = type; current != null; current = current.BaseType)
        {
            FieldInfo? field = current.GetField(
                fieldName,
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly
            );

            if (field != null)
                return field;
        }

        throw new MissingFieldException(type.FullName, fieldName);
    }

    private static T InvokeRequired<T>(MethodInfo method, object target, params object?[] arguments)
    {
        object? value = Invoke(method, target, arguments);

        if (value is T typed)
            return typed;

        throw new InvalidOperationException(
            $"{method.DeclaringType?.FullName}.{method.Name}() returned "
                + $"{value?.GetType().FullName ?? "null"}; expected {typeof(T).FullName}."
        );
    }

    private static object? Invoke(MethodInfo method, object target, params object?[] arguments)
    {
        try
        {
            return method.Invoke(target, arguments);
        }
        catch (TargetInvocationException exception) when (exception.InnerException != null)
        {
            ExceptionDispatchInfo.Capture(exception.InnerException).Throw();
            throw;
        }
    }

    private static class ProgressiveBeatmapFactory
    {
        private static readonly Type progressiveBeatmapType =
            typeof(DifficultyCalculator).GetNestedType("ProgressiveCalculationBeatmap", BindingFlags.NonPublic)
            ?? throw new TypeLoadException("DifficultyCalculator.ProgressiveCalculationBeatmap was not found.");

        private static readonly ConstructorInfo constructor =
            progressiveBeatmapType.GetConstructor(
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                binder: null,
                types: new[] { typeof(IBeatmap) },
                modifiers: null
            ) ?? throw new MissingMethodException(progressiveBeatmapType.FullName, ".ctor(IBeatmap)");

        private static readonly FieldInfo hitObjectsField =
            progressiveBeatmapType.GetField(
                "HitObjects",
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic
            ) ?? throw new MissingFieldException(progressiveBeatmapType.FullName, "HitObjects");

        public static (IBeatmap Beatmap, List<HitObject> HitObjects) Create(IBeatmap baseBeatmap, int capacity)
        {
            object instance;

            try
            {
                instance = constructor.Invoke(new object[] { baseBeatmap });
            }
            catch (TargetInvocationException exception) when (exception.InnerException != null)
            {
                ExceptionDispatchInfo.Capture(exception.InnerException).Throw();
                throw;
            }

            if (instance is not IBeatmap beatmap)
            {
                throw new InvalidOperationException(
                    $"{progressiveBeatmapType.FullName} does not implement {typeof(IBeatmap).FullName}."
                );
            }

            if (hitObjectsField.GetValue(instance) is not List<HitObject> hitObjects)
            {
                throw new InvalidOperationException(
                    $"{progressiveBeatmapType.FullName}.HitObjects is not a {typeof(List<HitObject>).FullName}."
                );
            }

            if (capacity > hitObjects.Capacity)
                hitObjects.Capacity = capacity;

            return (beatmap, hitObjects);
        }
    }
}
