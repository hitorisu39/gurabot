import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { globSync } from "glob";

enum ECoreEntryKind {
    Instance = "Instance",
    Command = "Command",
    Middleware = "Middleware",
    Component = "Component",
    Event = "Event",
    SubcommandGroup = "SubcommandGroup",
}

enum EGeneratedImportKind {
    Named = "Named",
    Default = "Default",
    Namespace = "Namespace",
}

interface ICoreEntry {
    file: string;
    importPath: string;
    exportName: string;
    localName: string;
    defaultExport: boolean;
    kind: ECoreEntryKind;
    declaration: ts.ClassDeclaration;
    symbol: ts.Symbol;
}

interface ICoreImport {
    target: ICoreEntry;
    dependency: ICoreEntry;
    propertyKey: string;
}

interface ICoreDispatchHandler {
    target: ICoreEntry;
    domain: string;
    event: string;
    propertyKey: string;
}

interface IGeneratedImport {
    module: string;
    importedName?: string;
    localName: string;
    kind: EGeneratedImportKind;
}

interface IGeneratedFileContext {
    generatedImports: Map<ts.Symbol, IGeneratedImport>;
    generatedImportNames: Set<string>;
    coreEntries: Set<ICoreEntry>;
}

interface IGeneratedCommandProperty {
    propertyKey: string;
    fields: Map<string, string>;
}

interface ICoreCommandBase {
    entry: ICoreEntry;
    optionsExpression: string;
    categoryExpression?: string;
    guildOnly: boolean;
    noUserInstall: boolean;
    help?: string;
    examples?: Array<string>;
    userPermissions: Array<string>;
    botPermissions: Array<string>;
    properties: Array<IGeneratedCommandProperty>;
}

interface ICoreRootCommand extends ICoreCommandBase {
    name: string;
    prefixOnly: boolean;
    slashOnly: boolean;
}

interface ICoreSubcommand extends ICoreCommandBase {
    root: string;
    group?: string;
    name: string;
    prefixOnly: boolean;
}

interface ICoreSubcommandGroup {
    entry: ICoreEntry;
    optionsExpression: string;
    root: string;
    name: string;
}

interface ICoreCommandGraph {
    roots: Array<ICoreRootCommand>;
    subcommands: Array<ICoreSubcommand>;
    groups: Array<ICoreSubcommandGroup>;
}

interface ICoreMiddleware {
    entry: ICoreEntry;
    optionsExpression: string;
}

interface ICoreComponent {
    entry: ICoreEntry;
    optionsExpression: string;
}

const commandPropertyDecorators = new Set([
    "Option",
    "Required",
    "Autocomplete",
    "Inject",
    "InjectToken",
    "InjectMatch",
    "Aliases",
    "IsMods",
    "IsModsArray",
    "IsQuery",
    "IsInlineIndex",
    "IsString",
    "IsNumber",
    "IsInteger",
    "IsRange",
    "IsEnum",
    "IsBoolean",
    "IsUser",
    "IsAttachment",
    "IsDate",
    "IsDateRange",
]);

const generatedReservedNames = new Set([
    "coreImport",
    "coreDispatchHandler",
    "defineCore",
    "ICoreDefinition",
    "ECoreCommandKind",
    "EComponentType",
    "EInjectMode",
    "EOptionType",
]);

const root = process.cwd();
const generatedDirectory = path.join(root, "generated/core");
const configPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
if (!configPath) {
    throw new Error("Could not find tsconfig.json.");
}

const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) {
    throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
}

const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));
const program = ts.createProgram({
    rootNames: config.fileNames,
    options: config.options,
});

const checker = program.getTypeChecker();

const printer = ts.createPrinter({
    removeComments: true,
});

const files = globSync(
    [
        "src/modules/**/*.{controller,service,middleware}.ts",
        "src/commands/**/*.{command,subcommand,group}.ts",
        "src/components/**/*.component.ts",
        "src/events/**/*.event.ts",
    ],
    {
        cwd: root,
        absolute: true,
    },
).sort();

const entries: Array<ICoreEntry> = [];

for (const file of files) {
    const source = program.getSourceFile(file);

    if (!source) {
        throw new Error(`Core source '${file}' was not found in the TypeScript program.`);
    }

    const kind = getKind(file);

    for (const statement of source.statements) {
        if (!ts.isClassDeclaration(statement)) {
            continue;
        }

        if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
            continue;
        }

        if (hasModifier(statement, ts.SyntaxKind.AbstractKeyword)) {
            continue;
        }

        if (!statement.name) {
            throwCoreError(statement, "Core classes must have a name.");
        }

        const symbol = resolveSymbol(checker.getSymbolAtLocation(statement.name));

        if (!symbol) {
            throwCoreError(statement, `Could not resolve class '${statement.name.text}'.`);
        }

        entries.push({
            file,
            importPath: toImportPath(file),
            exportName: statement.name.text,
            localName: "",
            defaultExport: hasModifier(statement, ts.SyntaxKind.DefaultKeyword),
            kind,
            declaration: statement,
            symbol,
        });
    }
}

assignLocalNames(entries);

const instanceEntries = entries.filter((entry) => entry.kind !== ECoreEntryKind.SubcommandGroup);
const entriesBySymbol = new Map<ts.Symbol, ICoreEntry>(instanceEntries.map((entry) => [entry.symbol, entry]));

function getKind(file: string): ECoreEntryKind {
    if (file.endsWith(".middleware.ts")) {
        return ECoreEntryKind.Middleware;
    }

    if (file.endsWith(".command.ts") || file.endsWith(".subcommand.ts")) {
        return ECoreEntryKind.Command;
    }

    if (file.endsWith(".group.ts")) {
        return ECoreEntryKind.SubcommandGroup;
    }

    if (file.endsWith(".component.ts")) {
        return ECoreEntryKind.Component;
    }

    if (file.endsWith(".event.ts")) {
        return ECoreEntryKind.Event;
    }

    return ECoreEntryKind.Instance;
}

//#region AST helpers

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
    if (!ts.canHaveModifiers(node)) {
        return false;
    }

    return ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) ?? false;
}

function resolveSymbol(symbol: ts.Symbol | undefined): ts.Symbol | undefined {
    if (!symbol) {
        return undefined;
    }

    if (symbol.flags & ts.SymbolFlags.Alias) {
        return checker.getAliasedSymbol(symbol);
    }

    return symbol;
}

function getDecoratorName(decorator: ts.Decorator): string | undefined {
    let expression = decorator.expression;
    if (ts.isCallExpression(expression)) {
        expression = expression.expression;
    }

    return resolveSymbol(checker.getSymbolAtLocation(expression))?.getName();
}

function getDecorator(node: ts.Node, name: string): ts.Decorator | undefined {
    if (!ts.canHaveDecorators(node)) {
        return undefined;
    }

    return (ts.getDecorators(node) ?? []).find((decorator) => getDecoratorName(decorator) === name);
}

function hasDecorator(node: ts.Node, name: string): boolean {
    return getDecorator(node, name) !== undefined;
}

function getDecoratorCall(node: ts.Node, name: string): ts.CallExpression | undefined {
    const decorator = getDecorator(node, name);
    if (!decorator) {
        return undefined;
    }

    if (!ts.isCallExpression(decorator.expression)) {
        throwCoreError(decorator, `@${name} must be called as a decorator factory.`);
    }

    return decorator.expression;
}

function getInheritedDecorator(declaration: ts.ClassDeclaration, name: string): ts.Decorator | undefined {
    const hierarchy = getHierarchy(declaration);

    for (let index = hierarchy.length - 1; index >= 0; index--) {
        const decorator = getDecorator(hierarchy[index]!, name);

        if (decorator) {
            return decorator;
        }
    }

    return undefined;
}

function getInheritedDecoratorCall(declaration: ts.ClassDeclaration, name: string): ts.CallExpression | undefined {
    const decorator = getInheritedDecorator(declaration, name);
    if (!decorator) {
        return undefined;
    }

    if (!ts.isCallExpression(decorator.expression)) {
        throwCoreError(decorator, `@${name} must be called as a decorator factory.`);
    }

    return decorator.expression;
}

function hasInheritedDecorator(declaration: ts.ClassDeclaration, name: string): boolean {
    return getInheritedDecorator(declaration, name) !== undefined;
}

function resolveStaticExpression(expression: ts.Expression): ts.Expression {
    if (
        ts.isParenthesizedExpression(expression) ||
        ts.isAsExpression(expression) ||
        ts.isTypeAssertionExpression(expression) ||
        ts.isSatisfiesExpression(expression)
    ) {
        return resolveStaticExpression(expression.expression);
    }

    if (ts.isIdentifier(expression)) {
        const symbol = resolveSymbol(checker.getSymbolAtLocation(expression));
        const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];

        if (
            declaration &&
            ts.isVariableDeclaration(declaration) &&
            declaration.initializer &&
            isConstVariable(declaration)
        ) {
            return resolveStaticExpression(declaration.initializer);
        }
    }

    return expression;
}

function isConstVariable(declaration: ts.VariableDeclaration): boolean {
    return ts.isVariableDeclarationList(declaration.parent) && (declaration.parent.flags & ts.NodeFlags.Const) !== 0;
}

function getDecoratorObjectFromCall(call: ts.CallExpression, name: string): ts.ObjectLiteralExpression {
    const argument = call.arguments[0];
    if (!argument) {
        throwCoreError(call, `@${name} requires an options object.`);
    }

    const expression = resolveStaticExpression(argument);

    if (!ts.isObjectLiteralExpression(expression)) {
        throwCoreError(argument, `@${name} options must be statically resolvable to an object literal.`);
    }

    if (expression.properties.some(ts.isSpreadAssignment)) {
        throwCoreError(expression, `@${name} options cannot use object spreads for command graph validation.`);
    }

    return expression;
}

function getObjectProperty(object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
    for (const property of object.properties) {
        if (ts.isPropertyAssignment(property) && getPropertyName(property.name) === name) {
            return property.initializer;
        }

        if (ts.isShorthandPropertyAssignment(property) && property.name.text === name) {
            return property.name;
        }
    }

    return undefined;
}

function getPropertyName(name: ts.PropertyName): string | undefined {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
        return name.text;
    }

    return undefined;
}

function getMemberKey(name: ts.PropertyName, node: ts.Node): string {
    const key = getPropertyName(name);
    if (key !== undefined) {
        return key;
    }

    throwCoreError(node, "Generated core bindings do not support computed or private # member names.");
}

function getStringValue(expression: ts.Expression): string {
    const resolved = resolveStaticExpression(expression);

    if (ts.isStringLiteral(resolved) || ts.isNoSubstitutionTemplateLiteral(resolved)) {
        return resolved.text;
    }

    if (ts.isPropertyAccessExpression(resolved) || ts.isElementAccessExpression(resolved)) {
        const value = checker.getConstantValue(resolved);

        if (typeof value === "string") {
            return value;
        }
    }

    const type = checker.getTypeAtLocation(resolved);

    if (type.isStringLiteral()) {
        return type.value;
    }

    throwCoreError(expression, `'${expression.getText()}' must be statically resolvable to a string.`);
}

function getBooleanValue(expression: ts.Expression): boolean {
    const resolved = resolveStaticExpression(expression);

    if (resolved.kind === ts.SyntaxKind.TrueKeyword) {
        return true;
    }

    if (resolved.kind === ts.SyntaxKind.FalseKeyword) {
        return false;
    }

    throwCoreError(expression, `'${expression.getText()}' must be statically resolvable to a boolean.`);
}

function getStringOption(object: ts.ObjectLiteralExpression, name: string, required: true): string;
function getStringOption(object: ts.ObjectLiteralExpression, name: string, required?: false): string | undefined;
function getStringOption(object: ts.ObjectLiteralExpression, name: string, required = false): string | undefined {
    const expression = getObjectProperty(object, name);

    if (!expression) {
        if (required) {
            throwCoreError(object, `Missing required option '${name}'.`);
        }

        return undefined;
    }

    return getStringValue(expression);
}

function getBooleanOption(object: ts.ObjectLiteralExpression, name: string): boolean {
    const expression = getObjectProperty(object, name);

    if (!expression) {
        return false;
    }

    return getBooleanValue(expression);
}

//#endregion

//#region Expression generation

function createGeneratedFileContext(): IGeneratedFileContext {
    return {
        generatedImports: new Map(),
        generatedImportNames: new Set([...entries.map((entry) => entry.localName), ...generatedReservedNames]),
        coreEntries: new Set(),
    };
}

function emitExpression(expression: ts.Expression, fileContext: IGeneratedFileContext): string {
    const resolved = resolveStaticExpression(expression);
    const inlining = new Set<ts.Symbol>();

    const result = ts.transform(resolved, [
        (context) => {
            const visitor: ts.Visitor = (node) => {
                if (ts.isShorthandPropertyAssignment(node)) {
                    const replacement = rewriteIdentifier(node.name, visitor, inlining, fileContext);

                    if (replacement && !(ts.isIdentifier(replacement) && replacement.text === node.name.text)) {
                        return ts.factory.createPropertyAssignment(node.name.text, replacement);
                    }
                }

                if (ts.isIdentifier(node)) {
                    const replacement = rewriteIdentifier(node, visitor, inlining, fileContext);

                    if (replacement) {
                        return replacement;
                    }
                }

                return ts.visitEachChild(node, visitor, context);
            };

            return (node) => ts.visitNode(node, visitor) as ts.Expression;
        },
    ]);

    try {
        const transformed = result.transformed[0]!;
        return printer.printNode(ts.EmitHint.Expression, transformed, resolved.getSourceFile());
    } finally {
        result.dispose();
    }
}

function rewriteIdentifier(
    identifier: ts.Identifier,
    visitor: ts.Visitor,
    inlining: Set<ts.Symbol>,
    fileContext: IGeneratedFileContext,
): ts.Expression | undefined {
    const rawSymbol = checker.getSymbolAtLocation(identifier);

    if (!rawSymbol) {
        return undefined;
    }

    if (rawSymbol.flags & ts.SymbolFlags.Alias) {
        const targetSymbol = checker.getAliasedSymbol(rawSymbol);
        const coreEntry = entriesBySymbol.get(targetSymbol);

        if (coreEntry) {
            fileContext.coreEntries.add(coreEntry);
            return ts.factory.createIdentifier(coreEntry.localName);
        }

        const generatedImport = getImportForIdentifier(identifier, fileContext);
        if (generatedImport) {
            return ts.factory.createIdentifier(generatedImport.localName);
        }

        return undefined;
    }

    const symbol = resolveSymbol(rawSymbol);
    const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];

    if (
        symbol &&
        declaration &&
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer &&
        isConstVariable(declaration) &&
        !inlining.has(symbol)
    ) {
        inlining.add(symbol);

        try {
            return ts.visitNode(declaration.initializer, visitor) as ts.Expression;
        } finally {
            inlining.delete(symbol);
        }
    }

    return undefined;
}

function getImportForIdentifier(
    identifier: ts.Identifier,
    fileContext: IGeneratedFileContext,
): IGeneratedImport | undefined {
    const aliasSymbol = checker.getSymbolAtLocation(identifier);
    if (!aliasSymbol || !(aliasSymbol.flags & ts.SymbolFlags.Alias)) {
        return undefined;
    }

    const targetSymbol = checker.getAliasedSymbol(aliasSymbol);
    const existing = fileContext.generatedImports.get(targetSymbol);
    if (existing) {
        return existing;
    }

    const declaration = aliasSymbol.declarations?.[0];
    if (!declaration) {
        return undefined;
    }

    let module: string;
    let preferredName: string;
    let importedName: string | undefined;
    let kind: EGeneratedImportKind;

    if (ts.isImportSpecifier(declaration)) {
        const importDeclaration = declaration.parent.parent.parent;

        if (!ts.isImportDeclaration(importDeclaration) || !ts.isStringLiteral(importDeclaration.moduleSpecifier)) {
            return undefined;
        }

        module = toGeneratedModuleSpecifier(importDeclaration.moduleSpecifier.text, declaration.getSourceFile());
        importedName = declaration.propertyName?.text ?? declaration.name.text;
        preferredName = importedName;
        kind = EGeneratedImportKind.Named;
    } else if (ts.isNamespaceImport(declaration)) {
        const importDeclaration = declaration.parent.parent;

        if (!ts.isImportDeclaration(importDeclaration) || !ts.isStringLiteral(importDeclaration.moduleSpecifier)) {
            return undefined;
        }

        module = toGeneratedModuleSpecifier(importDeclaration.moduleSpecifier.text, declaration.getSourceFile());
        preferredName = declaration.name.text;
        kind = EGeneratedImportKind.Namespace;
    } else if (ts.isImportClause(declaration) && declaration.name) {
        const importDeclaration = declaration.parent;

        if (!ts.isImportDeclaration(importDeclaration) || !ts.isStringLiteral(importDeclaration.moduleSpecifier)) {
            return undefined;
        }

        module = toGeneratedModuleSpecifier(importDeclaration.moduleSpecifier.text, declaration.getSourceFile());
        preferredName = declaration.name.text;
        kind = EGeneratedImportKind.Default;
    } else {
        return undefined;
    }

    const localName = getUniqueGeneratedName(preferredName, fileContext);
    const generatedImport: IGeneratedImport = { module, importedName, localName, kind };

    fileContext.generatedImports.set(targetSymbol, generatedImport);
    return generatedImport;
}

function getUniqueGeneratedName(preferred: string, fileContext: IGeneratedFileContext): string {
    let name = preferred;
    let suffix = 2;

    while (fileContext.generatedImportNames.has(name)) {
        name = `${preferred}${suffix++}`;
    }

    fileContext.generatedImportNames.add(name);
    return name;
}

function toGeneratedModuleSpecifier(module: string, source: ts.SourceFile): string {
    if (!module.startsWith(".")) {
        return module;
    }

    const resolved = ts.resolveModuleName(module, source.fileName, config.options, ts.sys).resolvedModule;
    if (!resolved) {
        throw new Error(`Could not resolve '${module}' from '${source.fileName}'.`);
    }

    return toProjectImportPath(resolved.resolvedFileName);
}

function toProjectImportPath(file: string): string {
    const normalized = file
        .replaceAll("\\", "/")
        .replace(/\.d\.ts$/, "")
        .replace(/\.(tsx?|jsx?)$/, "");

    const roots = [
        {
            directory: path.join(root, "src"),
            alias: "@/",
        },
        {
            directory: path.join(root, "domain"),
            alias: "@domain/",
        },
        {
            directory: path.join(root, "generated"),
            alias: "@generated/",
        },
    ];

    for (const item of roots) {
        const directory = item.directory.replaceAll("\\", "/");

        if (normalized === directory) {
            return item.alias.slice(0, -1);
        }

        if (normalized.startsWith(`${directory}/`)) {
            return item.alias + normalized.slice(directory.length + 1);
        }
    }

    let relative = path.relative(generatedDirectory, normalized).replaceAll("\\", "/");

    if (!relative.startsWith(".")) {
        relative = `./${relative}`;
    }

    return `${relative}.js`;
}

//#endregion

//#region Inheritance

function getHierarchy(declaration: ts.ClassDeclaration): Array<ts.ClassDeclaration> {
    const hierarchy: Array<ts.ClassDeclaration> = [];
    const visited = new Set<ts.Symbol>();

    let current: ts.ClassDeclaration | undefined = declaration;

    while (current) {
        const symbol = current.name ? resolveSymbol(checker.getSymbolAtLocation(current.name)) : undefined;
        if (symbol) {
            if (visited.has(symbol)) {
                break;
            }

            visited.add(symbol);
        }

        hierarchy.unshift(current);
        current = getBaseClass(current);
    }

    return hierarchy;
}

function getBaseClass(declaration: ts.ClassDeclaration): ts.ClassDeclaration | undefined {
    const clause = declaration.heritageClauses?.find((heritage) => heritage.token === ts.SyntaxKind.ExtendsKeyword);
    const type = clause?.types[0];

    if (!type) {
        return undefined;
    }

    const symbol = resolveSymbol(checker.getSymbolAtLocation(type.expression));
    return symbol?.declarations?.find(ts.isClassDeclaration);
}

//#endregion

//#region DI

function collectImports(target: ICoreEntry): Array<ICoreImport> {
    const imports = new Map<string, ICoreImport>();

    for (const declaration of getHierarchy(target.declaration)) {
        for (const member of declaration.members) {
            if (!ts.isPropertyDeclaration(member) || !hasDecorator(member, "Import")) {
                continue;
            }

            const propertyKey = getMemberKey(member.name, member);
            const type = checker.getNonNullableType(checker.getTypeAtLocation(member));
            const dependencySymbol = resolveSymbol(type.aliasSymbol ?? type.getSymbol());

            if (!dependencySymbol) {
                throwCoreError(
                    member,
                    `@Import() property '${propertyKey}' does not resolve to a concrete class type.`,
                );
            }

            const dependency = entriesBySymbol.get(dependencySymbol);

            if (!dependency) {
                throwCoreError(
                    member,
                    `Cannot inject '${checker.typeToString(type)}' into '${target.exportName}.${propertyKey}'. ` +
                        "The dependency is not a discovered core instance.",
                );
            }

            imports.set(propertyKey, {
                target,
                dependency,
                propertyKey,
            });
        }
    }

    return [...imports.values()];
}

//#endregion

//#region @On

function collectDispatchHandlers(target: ICoreEntry): Array<ICoreDispatchHandler> {
    const handlers: Array<ICoreDispatchHandler> = [];

    for (const declaration of getHierarchy(target.declaration)) {
        for (const member of declaration.members) {
            if (!ts.isMethodDeclaration(member)) {
                continue;
            }

            const call = getDecoratorCall(member, "On");
            if (!call) {
                continue;
            }

            const [domainExpression, eventExpression] = call.arguments;
            if (!domainExpression || !eventExpression) {
                throwCoreError(call, "@On() requires both a domain and an event.");
            }

            handlers.push({
                target,
                domain: getStringValue(domainExpression),
                event: getStringValue(eventExpression),
                propertyKey: getMemberKey(member.name, member),
            });
        }
    }

    return handlers;
}

//#endregion

//#region Command properties

function collectCommandProperties(
    target: ICoreEntry,
    fileContext: IGeneratedFileContext,
): Array<IGeneratedCommandProperty> {
    return collectOptionProperties(target.declaration, new Set(), fileContext);
}

function collectOptionProperties(
    declaration: ts.ClassDeclaration,
    queryStack: ReadonlySet<ts.Symbol>,
    fileContext: IGeneratedFileContext,
): Array<IGeneratedCommandProperty> {
    const properties = new Map<string, IGeneratedCommandProperty>();

    for (const current of getHierarchy(declaration)) {
        for (const member of current.members) {
            if (!ts.isPropertyDeclaration(member) || !ts.canHaveDecorators(member)) {
                continue;
            }

            const decorators = ts.getDecorators(member) ?? [];
            const relevant = decorators.filter((decorator) => {
                const name = getDecoratorName(decorator);
                return name !== undefined && commandPropertyDecorators.has(name);
            });

            if (relevant.length === 0) {
                continue;
            }

            const propertyKey = getMemberKey(member.name, member);
            let property = properties.get(propertyKey);

            if (!property) {
                property = {
                    propertyKey,

                    fields: new Map([
                        ["propertyKey", JSON.stringify(propertyKey)],
                        ["required", "false"],
                    ]),
                };

                properties.set(propertyKey, property);
            }

            for (const decorator of [...relevant].reverse()) {
                applyCommandPropertyDecorator(property, decorator, queryStack, fileContext);
            }
        }
    }

    return [...properties.values()];
}

function applyCommandPropertyDecorator(
    property: IGeneratedCommandProperty,
    decorator: ts.Decorator,
    queryStack: ReadonlySet<ts.Symbol>,
    fileContext: IGeneratedFileContext,
): void {
    const name = getDecoratorName(decorator);

    if (!name) {
        return;
    }

    if (!ts.isCallExpression(decorator.expression)) {
        throwCoreError(decorator, `@${name} must be called as a decorator factory.`);
    }

    const call = decorator.expression;
    const fields = property.fields;

    switch (name) {
        case "Option": {
            const nameArgument = requireArgument(call, 0, name);
            const descriptionArgument = requireArgument(call, 1, name);
            fields.set("name", emitExpression(nameArgument, fileContext));
            fields.set("description", emitExpression(descriptionArgument, fileContext));
            break;
        }
        case "Required":
            fields.set("required", "true");
            break;
        case "Autocomplete":
            fields.set("autocomplete", "true");
            break;
        case "Inject":
            fields.set("inject", "EInjectMode.Greedy");
            break;
        case "InjectToken":
            fields.set("inject", "EInjectMode.Token");
            break;
        case "InjectMatch": {
            fields.set("inject", "EInjectMode.Match");
            fields.set("injectMatcher", emitExpression(requireArgument(call, 0, name), fileContext));
            break;
        }
        case "Aliases": {
            const aliases = call.arguments.map((argument) => getStringValue(argument).toLowerCase());
            fields.set("aliases", JSON.stringify(aliases));
            break;
        }
        case "IsMods":
            fields.set("type", "EOptionType.Mods");
            break;
        case "IsModsArray":
            fields.set("type", "EOptionType.ModsArray");
            break;
        case "IsQuery": {
            const queryDtoExpression = requireArgument(call, 0, name);
            const queryDto = resolveClassExpression(queryDtoExpression);

            if (queryStack.has(queryDto.symbol)) {
                throwCoreError(
                    queryDtoExpression,
                    `Recursive @IsQuery() DTO '${queryDto.declaration.name?.text}' is not supported.`,
                );
            }

            const nextStack = new Set(queryStack);
            nextStack.add(queryDto.symbol);

            const queryProperties = collectOptionProperties(queryDto.declaration, nextStack, fileContext);
            fields.set("type", "EOptionType.Query");
            fields.set("queryDto", emitExpression(queryDtoExpression, fileContext));
            fields.set("queryProperties", emitOptionPropertiesExpression(queryProperties));
            break;
        }
        case "IsInlineIndex":
            fields.set("isInlineIndex", "true");
            break;
        case "IsString":
            fields.set("type", "EOptionType.String");
            setOptionalArgument(fields, "min", call, 0, fileContext);
            setOptionalArgument(fields, "max", call, 1, fileContext);
            break;
        case "IsNumber":
            fields.set("type", "EOptionType.Number");
            setOptionalArgument(fields, "min", call, 0, fileContext);
            setOptionalArgument(fields, "max", call, 1, fileContext);
            break;
        case "IsInteger":
            fields.set("type", "EOptionType.Integer");
            setOptionalArgument(fields, "min", call, 0, fileContext);
            setOptionalArgument(fields, "max", call, 1, fileContext);
            break;
        case "IsRange":
            fields.set("type", "EOptionType.Range");
            setOptionalArgument(fields, "min", call, 0, fileContext);
            setOptionalArgument(fields, "max", call, 1, fileContext);
            break;
        case "IsEnum":
            fields.set("type", "EOptionType.Enum");
            fields.set("enumData", emitExpression(requireArgument(call, 0, name), fileContext));
            break;
        case "IsBoolean":
            fields.set("type", "EOptionType.Boolean");
            break;
        case "IsUser":
            fields.set("type", "EOptionType.User");
            break;
        case "IsAttachment":
            fields.set("type", "EOptionType.Attachment");
            break;
        case "IsDate":
            fields.set("type", "EOptionType.Date");
            break;
        case "IsDateRange":
            fields.set("type", "EOptionType.DateRange");
            break;
    }
}

function requireArgument(call: ts.CallExpression, index: number, decorator: string): ts.Expression {
    const argument = call.arguments[index];
    if (!argument) {
        throwCoreError(call, `@${decorator}() is missing argument ${index + 1}.`);
    }

    return argument;
}

function setOptionalArgument(
    fields: Map<string, string>,
    field: string,
    call: ts.CallExpression,
    index: number,
    fileContext: IGeneratedFileContext,
): void {
    const argument = call.arguments[index];
    if (!argument) {
        return;
    }

    fields.set(field, emitExpression(argument, fileContext));
}

function resolveClassExpression(expression: ts.Expression): {
    symbol: ts.Symbol;
    declaration: ts.ClassDeclaration;
} {
    const resolved = resolveStaticExpression(expression);
    const symbol = resolveSymbol(checker.getSymbolAtLocation(resolved));
    if (!symbol) {
        throwCoreError(expression, `'${expression.getText()}' does not resolve to a class.`);
    }

    const declaration = symbol.declarations?.find(ts.isClassDeclaration);
    if (!declaration) {
        throwCoreError(expression, `'${expression.getText()}' does not resolve to a class declaration.`);
    }

    return {
        symbol,
        declaration,
    };
}

function emitOptionPropertiesExpression(properties: ReadonlyArray<IGeneratedCommandProperty>): string {
    if (properties.length === 0) {
        return "[]";
    }

    return `[${properties
        .map((property) => {
            const fields = [...property.fields].map(([name, value]) => `${name}: ${value}`).join(", ");
            return `{ ${fields} }`;
        })
        .join(", ")}]`;
}

//#endregion

//#region Command graph

function collectCommandGraph(
    entries: ReadonlyArray<ICoreEntry>,
    commandContext: IGeneratedFileContext,
    subcommandGroupContext: IGeneratedFileContext,
): ICoreCommandGraph {
    const roots = new Map<string, ICoreRootCommand>();
    const subcommands = new Map<string, ICoreSubcommand>();
    const groups = new Map<string, ICoreSubcommandGroup>();

    for (const entry of entries) {
        if (entry.kind === ECoreEntryKind.SubcommandGroup) {
            const call = getInheritedDecoratorCall(entry.declaration, "SubcommandGroup");

            if (!call) {
                throwCoreError(
                    entry.declaration,
                    `'${entry.exportName}' is a subcommand group but has no @SubcommandGroup() decorator.`,
                );
            }

            const options = getDecoratorObjectFromCall(call, "SubcommandGroup");
            const rootName = getStringOption(options, "root", true);
            const name = getStringOption(options, "name", true);
            const key = getSubcommandGroupKey(rootName, name);

            const existing = groups.get(key);
            if (existing) {
                throwCoreError(
                    entry.declaration,
                    `Duplicate subcommand group '${key}' declared by '${existing.entry.exportName}' and ` +
                        `'${entry.exportName}'.`,
                );
            }

            groups.set(key, {
                entry,
                optionsExpression: emitExpression(requireArgument(call, 0, "SubcommandGroup"), subcommandGroupContext),
                root: rootName,
                name,
            });

            continue;
        }

        if (entry.kind !== ECoreEntryKind.Command) {
            continue;
        }

        const commandCall = getInheritedDecoratorCall(entry.declaration, "Command");
        const subcommandCall = getInheritedDecoratorCall(entry.declaration, "Subcommand");

        if (commandCall && subcommandCall) {
            throwCoreError(entry.declaration, `'${entry.exportName}' resolves both @Command() and @Subcommand().`);
        }

        if (!commandCall && !subcommandCall) {
            throwCoreError(
                entry.declaration,
                `'${entry.exportName}' is a generated command but has neither @Command() nor @Subcommand().`,
            );
        }

        const categoryExpression = getOptionalInheritedArgumentExpression(
            entry.declaration,
            "Category",
            commandContext,
        );
        const guildOnly = hasInheritedDecorator(entry.declaration, "GuildOnly");
        const noUserInstall = hasInheritedDecorator(entry.declaration, "NoUserInstall");
        const help = getCommandHelp(entry.declaration);
        const examples = getCommandExamples(entry.declaration);
        const userPermissions = getCommandPermissions(entry.declaration, "UserPermissions", commandContext);
        const botPermissions = getCommandPermissions(entry.declaration, "BotPermissions", commandContext);
        const properties = collectCommandProperties(entry, commandContext);

        if (commandCall) {
            const options = getDecoratorObjectFromCall(commandCall, "Command");
            const name = getStringOption(options, "name", true);
            const prefixOnly = getBooleanOption(options, "prefixOnly");
            const slashOnly = getBooleanOption(options, "slashOnly");

            if (prefixOnly && slashOnly) {
                throwCoreError(entry.declaration, `Command '${name}' cannot be both prefix-only and slash-only.`);
            }

            const key = name.toLowerCase();
            const existing = roots.get(key);

            if (existing) {
                throwCoreError(
                    entry.declaration,
                    `Duplicate root command '${name}' declared by '${existing.entry.exportName}' and ` +
                        `'${entry.exportName}'.`,
                );
            }

            roots.set(key, {
                entry,
                optionsExpression: emitExpression(requireArgument(commandCall, 0, "Command"), commandContext),
                name,
                prefixOnly,
                slashOnly,
                categoryExpression,
                guildOnly,
                noUserInstall,
                help,
                examples,
                userPermissions,
                botPermissions,
                properties,
            });

            continue;
        }

        const options = getDecoratorObjectFromCall(subcommandCall!, "Subcommand");
        const rootName = getStringOption(options, "root", true);
        const group = getStringOption(options, "group");
        const name = getStringOption(options, "name", true);
        const prefixOnly = getBooleanOption(options, "prefixOnly");
        const key = getSubcommandKey(rootName, group, name);

        if (noUserInstall) {
            throwCoreError(
                entry.declaration,
                `@NoUserInstall() cannot be applied to subcommand '${key}'. ` +
                    `Discord installation types are configured on the root command.`,
            );
        }

        const existing = subcommands.get(key);
        if (existing) {
            throwCoreError(
                entry.declaration,
                `Duplicate subcommand '${key}' declared by '${existing.entry.exportName}' and ` +
                    `'${entry.exportName}'.`,
            );
        }

        subcommands.set(key, {
            entry,
            optionsExpression: emitExpression(requireArgument(subcommandCall!, 0, "Subcommand"), commandContext),
            root: rootName,
            group,
            name,
            prefixOnly,
            categoryExpression,
            guildOnly,
            noUserInstall,
            help,
            examples,
            userPermissions,
            botPermissions,
            properties,
        });
    }

    for (const [key, group] of groups) {
        const rootCommand = roots.get(group.root.toLowerCase());

        if (!rootCommand) {
            throwCoreError(
                group.entry.declaration,
                `Subcommand group '${key}' references missing root command '${group.root}'.`,
            );
        }

        if (rootCommand.prefixOnly) {
            throwCoreError(
                group.entry.declaration,
                `Subcommand group '${key}' cannot belong to prefix-only root command '${rootCommand.name}'.`,
            );
        }
    }

    for (const [key, subcommand] of subcommands) {
        const rootCommand = roots.get(subcommand.root.toLowerCase());

        if (!rootCommand) {
            throwCoreError(
                subcommand.entry.declaration,
                `Subcommand '${key}' references missing root command '${subcommand.root}'.`,
            );
        }

        if (subcommand.group) {
            const groupKey = getSubcommandGroupKey(subcommand.root, subcommand.group);

            if (!groups.has(groupKey)) {
                throwCoreError(
                    subcommand.entry.declaration,
                    `Subcommand '${key}' references missing subcommand group '${groupKey}'.`,
                );
            }
        }

        if (rootCommand.slashOnly && subcommand.prefixOnly) {
            throwCoreError(
                subcommand.entry.declaration,
                `Subcommand '${key}' cannot be prefix-only because root command '${rootCommand.name}' is slash-only.`,
            );
        }

        /*
         * Require categories for prefix commands.
         */
        if (!rootCommand.slashOnly && !subcommand.categoryExpression && !rootCommand.categoryExpression) {
            throwCoreError(
                subcommand.entry.declaration,
                `Prefix-capable subcommand '${key}' has no category and its root command ` +
                    `'${rootCommand.name}' has no category.`,
            );
        }
    }

    for (const rootCommand of roots.values()) {
        if (!rootCommand.slashOnly && !rootCommand.categoryExpression) {
            throwCoreError(
                rootCommand.entry.declaration,
                `Prefix-capable root command '${rootCommand.name}' has no category.`,
            );
        }
    }

    return {
        roots: [...roots.values()],
        subcommands: [...subcommands.values()],
        groups: [...groups.values()],
    };
}

function getOptionalInheritedArgumentExpression(
    declaration: ts.ClassDeclaration,
    decorator: string,
    fileContext: IGeneratedFileContext,
): string | undefined {
    const call = getInheritedDecoratorCall(declaration, decorator);
    if (!call) {
        return undefined;
    }

    return emitExpression(requireArgument(call, 0, decorator), fileContext);
}

function getCommandHelp(declaration: ts.ClassDeclaration): string | undefined {
    const call = getInheritedDecoratorCall(declaration, "Help");
    if (!call) {
        return undefined;
    }

    return getStringValue(requireArgument(call, 0, "Help"));
}

function getCommandExamples(declaration: ts.ClassDeclaration): Array<string> | undefined {
    const call = getInheritedDecoratorCall(declaration, "Examples");
    if (!call) {
        return undefined;
    }

    return call.arguments.map(getStringValue);
}

function getCommandPermissions(
    declaration: ts.ClassDeclaration,
    decorator: "UserPermissions" | "BotPermissions",
    fileContext: IGeneratedFileContext,
): Array<string> {
    const call = getInheritedDecoratorCall(declaration, decorator);

    if (!call) {
        return [];
    }

    return call.arguments.map((argument) => emitExpression(argument, fileContext));
}

function getSubcommandGroupKey(root: string, name: string): string {
    return `${root}:${name}`.toLowerCase();
}

function getSubcommandKey(root: string, group: string | undefined, name: string): string {
    return (group ? `${root}:${group}:${name}` : `${root}:${name}`).toLowerCase();
}

//#endregion

//#region Middleware

function collectMiddlewares(
    entries: ReadonlyArray<ICoreEntry>,
    fileContext: IGeneratedFileContext,
): Array<ICoreMiddleware> {
    return entries
        .filter((entry) => entry.kind === ECoreEntryKind.Middleware)
        .map((entry) => {
            const call = getInheritedDecoratorCall(entry.declaration, "Middleware");

            return {
                entry,
                optionsExpression: call?.arguments[0] ? emitExpression(call.arguments[0], fileContext) : "{}",
            };
        });
}

//#endregion

//#region Components

function collectComponents(
    entries: ReadonlyArray<ICoreEntry>,
    fileContext: IGeneratedFileContext,
): Array<ICoreComponent> {
    return entries
        .filter((entry) => entry.kind === ECoreEntryKind.Component)
        .map((entry) => collectComponent(entry, fileContext));
}

function collectComponent(entry: ICoreEntry, fileContext: IGeneratedFileContext): ICoreComponent {
    const found = getInheritedComponentDecorator(entry.declaration);

    if (!found) {
        throwCoreError(
            entry.declaration,
            `Component '${entry.exportName}' has no @Component(), @Button(), @SelectMenu(), or @Modal() decorator.`,
        );
    }

    const { name, call } = found;

    if (name === "Component") {
        return {
            entry,
            optionsExpression: emitExpression(requireArgument(call, 0, name), fileContext),
        };
    }

    const customID = emitExpression(requireArgument(call, 0, name), fileContext);

    const type =
        name === "Button"
            ? "EComponentType.Button"
            : name === "SelectMenu"
              ? "EComponentType.SelectMenu"
              : "EComponentType.Modal";

    return {
        entry,
        optionsExpression: `{ customID: ${customID}, type: ${type} }`,
    };
}

function getInheritedComponentDecorator(declaration: ts.ClassDeclaration):
    | {
          name: "Component" | "Button" | "SelectMenu" | "Modal";
          call: ts.CallExpression;
      }
    | undefined {
    const hierarchy = getHierarchy(declaration);

    for (let index = hierarchy.length - 1; index >= 0; index--) {
        const decorators = ts.getDecorators(hierarchy[index]!) ?? [];

        for (const decorator of decorators) {
            const name = getDecoratorName(decorator);

            if (name !== "Component" && name !== "Button" && name !== "SelectMenu" && name !== "Modal") {
                continue;
            }

            if (!ts.isCallExpression(decorator.expression)) {
                throwCoreError(decorator, `@${name} must be called as a decorator factory.`);
            }

            return {
                name,
                call: decorator.expression,
            };
        }
    }

    return undefined;
}

//#endregion

//#region Imports/output

function toImportPath(file: string): string {
    const src = path.join(root, "src");
    const relative = path.relative(src, file).replaceAll("\\", "/").replace(/\.ts$/, "");
    return `@/${relative}`;
}

function assignLocalNames(entries: Array<ICoreEntry>): void {
    const used = new Set(generatedReservedNames);

    for (const entry of entries) {
        const preferred = entry.exportName;

        let candidate = preferred;
        let suffix = 2;

        while (used.has(candidate)) {
            candidate = `${preferred}${suffix++}`;
        }

        entry.localName = candidate;
        used.add(candidate);
    }
}

interface IGeneratedContexts {
    commands: IGeneratedFileContext;
    subcommandGroups: IGeneratedFileContext;
    middlewares: IGeneratedFileContext;
    components: IGeneratedFileContext;
}

const generatedHeader = "// AUTO-GENERATED - DO NOT EDIT MANUALLY, CHANGES WILL BE OVERWRITTEN";

function write(
    entries: Array<ICoreEntry>,
    imports: Array<ICoreImport>,
    dispatchHandlers: Array<ICoreDispatchHandler>,
    commandGraph: ICoreCommandGraph,
    middlewares: Array<ICoreMiddleware>,
    components: Array<ICoreComponent>,
    contexts: IGeneratedContexts,
): void {
    fs.rmSync(generatedDirectory, { recursive: true, force: true });
    fs.mkdirSync(generatedDirectory, { recursive: true });

    writeInstances();
    writeCommands(commandGraph, contexts.commands);
    writeSubcommandGroups(commandGraph.groups, contexts.subcommandGroups);
    writeComponents(components, contexts.components);
    writeMiddlewares(middlewares, contexts.middlewares);
    writeEvents(entries.filter((entry) => entry.kind === ECoreEntryKind.Event));
    writeCoreImports(imports);
    writeDispatchHandlers(dispatchHandlers);
    writeIndex();

    console.log(
        [
            `Core generated: ${instanceEntries.length} instances`,
            `${imports.length} imports`,
            `${dispatchHandlers.length} dispatch handlers`,
            `${commandGraph.roots.length + commandGraph.subcommands.length} commands`,
            `${components.length} components`,
            `${middlewares.length} middleware`,
            `${entries.filter((entry) => entry.kind === ECoreEntryKind.Event).length} events`,
            `${commandGraph.groups.length} groups`,
        ].join(", "),
    );
}

function writeInstances(): void {
    const output = createGeneratedOutput('import type { ICoreDefinition } from "@/core/definition";', instanceEntries);

    output.push('export const instances: ICoreDefinition["instances"] = [');
    writeArrayEntries(output, instanceEntries);
    output.push("];", "");

    writeGeneratedFile("instances.ts", output);
}

function writeCommands(commandGraph: ICoreCommandGraph, fileContext: IGeneratedFileContext): void {
    const commands = [...commandGraph.roots, ...commandGraph.subcommands];
    const commandEntries = commands.map((command) => command.entry);
    const output = createGeneratedOutput(
        'import { ECoreCommandKind, EInjectMode, EOptionType, type ICoreDefinition } from "@/core/definition";',
        [...commandEntries, ...fileContext.coreEntries],
        fileContext,
    );

    output.push('export const commands: ICoreDefinition["commands"] = [');

    for (const command of commandGraph.roots) {
        writeCommand(output, command, "Root");
    }

    for (const command of commandGraph.subcommands) {
        writeCommand(output, command, "Subcommand");
    }

    output.push("];", "");
    writeGeneratedFile("commands.ts", output);
}

function writeSubcommandGroups(groups: Array<ICoreSubcommandGroup>, fileContext: IGeneratedFileContext): void {
    const output = createGeneratedOutput(
        'import type { ICoreDefinition } from "@/core/definition";',
        [...fileContext.coreEntries],
        fileContext,
    );

    output.push('export const subcommandGroups: ICoreDefinition["subcommandGroups"] = [');

    for (const group of groups) {
        output.push(`    ${group.optionsExpression},`);
    }

    output.push("];", "");
    writeGeneratedFile("subcommandGroups.ts", output);
}

function writeComponents(components: Array<ICoreComponent>, fileContext: IGeneratedFileContext): void {
    const output = createGeneratedOutput(
        'import { EComponentType, type ICoreDefinition } from "@/core/definition";',
        [...components.map((component) => component.entry), ...fileContext.coreEntries],
        fileContext,
    );

    output.push('export const components: ICoreDefinition["components"] = [');

    for (const component of components) {
        output.push(
            "    {",
            `        target: ${component.entry.localName},`,
            `        options: ${component.optionsExpression},`,
            "    },",
        );
    }

    output.push("];", "");
    writeGeneratedFile("components.ts", output);
}

function writeMiddlewares(middlewares: Array<ICoreMiddleware>, fileContext: IGeneratedFileContext): void {
    const output = createGeneratedOutput(
        'import type { ICoreDefinition } from "@/core/definition";',
        [...middlewares.map((middleware) => middleware.entry), ...fileContext.coreEntries],
        fileContext,
    );

    output.push('export const middlewares: ICoreDefinition["middlewares"] = [');

    for (const middleware of middlewares) {
        output.push(
            "    {",
            `        target: ${middleware.entry.localName},`,
            `        options: ${middleware.optionsExpression},`,
            "    },",
        );
    }

    output.push("];", "");
    writeGeneratedFile("middlewares.ts", output);
}

function writeEvents(eventEntries: Array<ICoreEntry>): void {
    const output = createGeneratedOutput('import type { ICoreDefinition } from "@/core/definition";', eventEntries);

    output.push('export const events: ICoreDefinition["events"] = [');
    writeArrayEntries(output, eventEntries);
    output.push("];", "");

    writeGeneratedFile("events.ts", output);
}

function writeCoreImports(imports: Array<ICoreImport>): void {
    const classEntries = imports.flatMap((entry) => [entry.target, entry.dependency]);
    const output = createGeneratedOutput(
        'import { coreImport, type ICoreDefinition } from "@/core/definition";',
        classEntries,
    );

    output.push('export const imports: ICoreDefinition["imports"] = [');

    for (const entry of imports) {
        pushGeneratedCall(output, "coreImport", [
            entry.target.localName,
            entry.dependency.localName,
            JSON.stringify(entry.propertyKey),
        ]);
    }

    output.push("];", "");
    writeGeneratedFile("imports.ts", output);
}

function writeDispatchHandlers(dispatchHandlers: Array<ICoreDispatchHandler>): void {
    const output = createGeneratedOutput(
        'import { coreDispatchHandler, type ICoreDefinition } from "@/core/definition";',
        dispatchHandlers.map((handler) => handler.target),
    );

    output.push('export const dispatchHandlers: ICoreDefinition["dispatchHandlers"] = [');

    for (const handler of dispatchHandlers) {
        pushGeneratedCall(output, "coreDispatchHandler", [
            handler.target.localName,
            JSON.stringify(handler.domain),
            JSON.stringify(handler.event),
            JSON.stringify(handler.propertyKey),
        ]);
    }

    output.push("];", "");
    writeGeneratedFile("dispatchHandlers.ts", output);
}

function writeIndex(): void {
    writeGeneratedFile("index.ts", [
        generatedHeader,
        "",
        'import { defineCore } from "@/core/definition";',
        "",
        'import { commands } from "./commands.js";',
        'import { components } from "./components.js";',
        'import { dispatchHandlers } from "./dispatchHandlers.js";',
        'import { events } from "./events.js";',
        'import { imports } from "./imports.js";',
        'import { instances } from "./instances.js";',
        'import { middlewares } from "./middlewares.js";',
        'import { subcommandGroups } from "./subcommandGroups.js";',
        "",
        "export const core = defineCore({",
        "    instances,",
        "    commands,",
        "    subcommandGroups,",
        "    components,",
        "    middlewares,",
        "    events,",
        "    imports,",
        "    dispatchHandlers,",
        "});",
        "",
    ]);
}

function createGeneratedOutput(
    definitionImport: string,
    classEntries: ReadonlyArray<ICoreEntry> = [],
    fileContext?: IGeneratedFileContext,
): Array<string> {
    const imports: Array<string> = [];

    writeClassImports(imports, classEntries);

    if (fileContext) {
        writeGeneratedImports(imports, fileContext);
    }

    return [generatedHeader, "", definitionImport, ...(imports.length > 0 ? ["", ...imports] : []), ""];
}

function writeGeneratedFile(filename: string, output: Array<string>): void {
    fs.writeFileSync(path.join(generatedDirectory, filename), output.join("\n"), "utf8");
}

function pushGeneratedCall(output: Array<string>, name: string, args: ReadonlyArray<string>): void {
    const line = `    ${name}(${args.join(", ")}),`;

    if (line.length <= 120) {
        output.push(line);
        return;
    }

    output.push(`    ${name}(`);
    for (const arg of args) {
        output.push(`        ${arg},`);
    }
    output.push("    ),");
}

function writeCommand(
    output: Array<string>,
    command: ICoreRootCommand | ICoreSubcommand,
    kind: "Root" | "Subcommand",
): void {
    output.push(
        "    {",
        `        kind: ECoreCommandKind.${kind},`,
        `        target: ${command.entry.localName},`,
        `        options: ${command.optionsExpression},`,
    );

    if (command.categoryExpression) {
        output.push(`        category: ${command.categoryExpression},`);
    }

    output.push(`        guildOnly: ${command.guildOnly},`, `        noUserInstall: ${command.noUserInstall},`);

    if (command.help !== undefined) {
        output.push(`        help: ${JSON.stringify(command.help)},`);
    }

    if (command.examples !== undefined) {
        output.push(`        examples: ${JSON.stringify(command.examples)},`);
    }

    output.push("        userPermissions: [");

    for (const permission of command.userPermissions) {
        output.push(`            ${permission},`);
    }

    output.push("        ],", "        botPermissions: [");

    for (const permission of command.botPermissions) {
        output.push(`            ${permission},`);
    }

    output.push("        ],", "        properties: [");

    for (const property of command.properties) {
        output.push("            {");

        for (const [field, value] of property.fields) {
            output.push(`                ${field}: ${value},`);
        }

        output.push("            },");
    }

    output.push("        ],", "    },");
}

function writeArrayEntries(output: Array<string>, entries: ReadonlyArray<ICoreEntry>): void {
    for (const entry of entries) {
        output.push(`    ${entry.localName},`);
    }
}

function writeClassImports(output: Array<string>, entries: ReadonlyArray<ICoreEntry>): void {
    const modules = new Map<string, Array<ICoreEntry>>();
    const seen = new Set<ts.Symbol>();

    for (const entry of entries) {
        if (seen.has(entry.symbol)) {
            continue;
        }

        seen.add(entry.symbol);
        const values = modules.get(entry.importPath) ?? [];
        values.push(entry);
        modules.set(entry.importPath, values);
    }

    for (const [module, values] of [...modules].sort(([a], [b]) => a.localeCompare(b))) {
        const defaultEntry = values.find((entry) => entry.defaultExport);
        const named = values.filter((entry) => !entry.defaultExport);
        const namedParts = named.map((entry) =>
            entry.exportName === entry.localName ? entry.exportName : `${entry.exportName} as ${entry.localName}`,
        );

        const oneLineParts = [
            defaultEntry?.localName,
            namedParts.length > 0 ? `{ ${namedParts.join(", ")} }` : undefined,
        ]
            .filter((part): part is string => part !== undefined)
            .join(", ");
        const oneLine = `import ${oneLineParts} from ${JSON.stringify(module)};`;

        if (oneLine.length <= 120 || namedParts.length === 0) {
            output.push(oneLine);
            continue;
        }

        output.push(defaultEntry ? `import ${defaultEntry.localName}, {` : "import {");
        for (const part of namedParts) {
            output.push(`    ${part},`);
        }
        output.push(`} from ${JSON.stringify(module)};`);
    }
}

function writeGeneratedImports(output: Array<string>, fileContext: IGeneratedFileContext): void {
    const values = [...fileContext.generatedImports.values()].sort(
        (a, b) => a.module.localeCompare(b.module) || a.localName.localeCompare(b.localName),
    );

    for (const entry of values) {
        switch (entry.kind) {
            case EGeneratedImportKind.Named: {
                const imported = entry.importedName!;
                const line =
                    imported === entry.localName
                        ? `import { ${imported} } from ${JSON.stringify(entry.module)};`
                        : `import { ${imported} as ${entry.localName} } from ${JSON.stringify(entry.module)};`;

                output.push(line);
                break;
            }
            case EGeneratedImportKind.Default:
                output.push(`import ${entry.localName} from ${JSON.stringify(entry.module)};`);
                break;
            case EGeneratedImportKind.Namespace:
                output.push(`import * as ${entry.localName} from ${JSON.stringify(entry.module)};`);
                break;
        }
    }
}

//#endregion

function throwCoreError(node: ts.Node, message: string): never {
    const source = node.getSourceFile();
    const position = source.getLineAndCharacterOfPosition(node.getStart(source));
    const file = path.relative(root, source.fileName).replaceAll("\\", "/");
    throw new Error(`${file}:${position.line + 1}:${position.character + 1} - ${message}`);
}

function generate(): void {
    const commandContext = createGeneratedFileContext();
    const subcommandGroupContext = createGeneratedFileContext();
    const middlewareContext = createGeneratedFileContext();
    const componentContext = createGeneratedFileContext();

    const imports = instanceEntries.flatMap(collectImports);
    const dispatchHandlers = instanceEntries.flatMap(collectDispatchHandlers);
    const commandGraph = collectCommandGraph(entries, commandContext, subcommandGroupContext);
    const middlewares = collectMiddlewares(entries, middlewareContext);
    const components = collectComponents(entries, componentContext);

    write(entries, imports, dispatchHandlers, commandGraph, middlewares, components, {
        commands: commandContext,
        subcommandGroups: subcommandGroupContext,
        middlewares: middlewareContext,
        components: componentContext,
    });
}

generate();
