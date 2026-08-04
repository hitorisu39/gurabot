import { spawn } from "child_process";
import path from "path";
import fs from "fs";

const root = process.cwd();

function run(command: string, args: string[], cwd?: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, {
            stdio: "inherit",
            shell: true,
            cwd,
        });

        proc.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`${command} exited with code ${code}`));
            }
        });

        proc.on("error", reject);
    });
}

function getRuntime(): string {
    switch (process.platform) {
        case "win32":
            return "win-x64";
        case "linux":
            return "linux-x64";
        case "darwin":
            return "osx-x64";
        default:
            throw new Error(`Unsupported platform: ${process.platform}`);
    }
}

async function buildNativeCalculator(): Promise<void> {
    const calculatorDir = path.join(root, "calculator");
    const runtime = getRuntime();

    console.log("Building C# calculator...");

    await run(
        "dotnet",
        [
            "publish",
            "-c",
            "Release",
            "-r",
            runtime,
            "--self-contained",
            "true",
            "-p:PublishSingleFile=true",
            "-p:PublishTrimmed=false",
        ],
        calculatorDir,
    );
}

async function generateCalculatorTypes(): Promise<void> {
    const generatedDir = path.join(root, "generated", "calculator");

    fs.mkdirSync(generatedDir, { recursive: true });

    console.log("Generating TypeScript calculator types...");

    const extension = process.platform === "win32" ? ".cmd" : "";

    await run(
        "npx",
        [
            "protoc",
            `--plugin=./node_modules/.bin/protoc-gen-ts_proto${extension}`,
            `--ts_proto_out=${generatedDir}`,
            "--ts_proto_opt=esModuleInterop=true,outputServices=grpc-js",
            "-I",
            "./proto",
            "proto/calculator.proto",
        ],
        root,
    );
}

async function build(): Promise<void> {
    await buildNativeCalculator();
    await generateCalculatorTypes();

    console.log("Calculator build finished.");
}

async function execute(): Promise<void> {
    const releaseDir = path.join(root, "calculator", "bin", "Release");
    const netDir = fs.readdirSync(releaseDir).find((directory) => directory.startsWith("net"));

    if (!netDir) {
        throw new Error("Could not find calculator executable. Please build it first.");
    }

    const runtime = getRuntime();
    const name = process.platform === "win32" ? "Calculator.exe" : "Calculator";

    const publishDir = path.join(releaseDir, netDir, runtime, "publish");
    const bin = path.join(publishDir, name);

    if (!fs.existsSync(bin)) {
        throw new Error("Could not find calculator executable. Please build it first.");
    }

    const child = spawn(bin, {
        stdio: "inherit",
        cwd: publishDir,
    });

    child.on("exit", (code) => {
        process.exit(code ?? 1);
    });

    child.on("error", (error) => {
        console.error(error);
        process.exit(1);
    });
}

const command = process.argv[2];

switch (command) {
    case "build":
        build().catch(handleError);
        break;

    case "types":
        generateCalculatorTypes().catch(handleError);
        break;

    case "run":
    case undefined:
        execute().catch(handleError);
        break;

    default:
        console.error(`Unknown calculator command: ${command}`);
        process.exit(1);
}

function handleError(error: unknown): void {
    console.error(error);
    process.exit(1);
}