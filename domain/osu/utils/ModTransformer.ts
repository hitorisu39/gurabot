import { EModMatchType, ICommandMods } from "@domain/core/Command";
import { EApplicationError, Exception } from "@domain/core/Exception";
import { ParsedMod } from "@generated/adapter/mods";
import { ModUtils } from "@generated/adapter/mods";

export class ModTransformer {
    /**
     * Applies mod operations from left to right.
     *
     * ICommandMods normally represents score-filter matching:
     *
     *   Include => +HD
     *   Match   => +HD!
     *   Exclude => -HD!
     *
     * For transformation purposes those same operations mean:
     *
     *   Include => add the mods, replacing incompatible existing mods
     *   Match   => replace the entire mod combination
     *   Exclude => remove the specified mods
     *
     * Examples:
     *
     *   HDHT + +DT      => HDDT
     *   HDHR + -HR!     => HD
     *   HDHR + +DT!     => DT
     *   HDHR + +DT! +HD => HDDT
     */
    public static apply(original: ReadonlyArray<ParsedMod>, operations: ReadonlyArray<ICommandMods>): Array<ParsedMod> {
        let mods = [...original];

        for (const operation of operations) {
            const operand = ModUtils.fromString(operation.mods);

            switch (operation.type) {
                case EModMatchType.Include:
                    mods = ModTransformer.add(mods, operand);
                    break;
                case EModMatchType.Match:
                    ModTransformer.assertCompatible(operand);
                    mods = [...operand];
                    break;
                case EModMatchType.Exclude:
                    mods = ModTransformer.remove(mods, operand);
                    break;
            }
        }

        return mods;
    }

    private static add(current: ReadonlyArray<ParsedMod>, added: ReadonlyArray<ParsedMod>): Array<ParsedMod> {
        ModTransformer.assertCompatible(added);
        const addedAcronyms = new Set(added.map((mod) => mod.acronym));

        /*
         * Requested mods win over incompatible mods already present
         * on the score.
         *
         * Example:
         *
         *   HDHT + +DT
         *
         * HT conflicts with DT, so HT is removed before DT is added.
         */
        const result = current.filter((existing) => {
            if (addedAcronyms.has(existing.acronym)) {
                return true;
            }

            return !added.some((incoming) => ModUtils.areIncompatible(existing.acronym, incoming.acronym));
        });

        const existingAcronyms = new Set(result.map((mod) => mod.acronym));

        for (const mod of added) {
            if (existingAcronyms.has(mod.acronym)) {
                continue;
            }

            result.push(mod);
            existingAcronyms.add(mod.acronym);
        }

        return result;
    }

    private static remove(current: ReadonlyArray<ParsedMod>, removed: ReadonlyArray<ParsedMod>): Array<ParsedMod> {
        const removedAcronyms = new Set(removed.map((mod) => mod.acronym));

        return current.filter((mod) => !removedAcronyms.has(mod.acronym));
    }

    private static assertCompatible(mods: ReadonlyArray<ParsedMod>): void {
        const conflicts = ModUtils.findIncompatibilities(mods);

        for (const [mod, incompatible] of Object.entries(conflicts)) {
            const conflict = incompatible[0];
            if (conflict)
                throw new Exception(EApplicationError.INPUT_ERROR, `${mod} is incompatible with ${conflict}.`);
        }
    }
}
