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
            if (code === 0) resolve();
            else reject(new Error(`${command} exited with code ${code}`));
        });
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

async function generate() {
    const calculatorDir = path.join(root, "calculator");
    const generatedDir = path.join(root, "generated", "calculator");
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

    console.log("Generating TypeScript from proto...");

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

    console.log("Build finished.");
}

async function execute() {
    const releaseDir = path.join(root, "calculator", "bin", "Release");
    const netDir = fs.readdirSync(releaseDir).find((d) => d.startsWith("net"));
    if (!netDir) throw new Error("Could not find calculator executable. Please build it first.");

    const runtime = getRuntime();
    const name = process.platform === "win32" ? "Calculator.exe" : "Calculator";

    const publishDir = path.join(releaseDir, netDir, runtime, "publish");
    const bin = path.join(publishDir, name);

    if (!fs.existsSync(bin)) throw new Error("Could not find calculator executable. Please build it first.");

    const child = spawn(bin, { stdio: "inherit", cwd: publishDir });
    child.on("exit", (code) => process.exit(code));
}

if (process.argv.includes("build")) {
    generate().catch((err) => {
        console.error(err);
        process.exit(1);
    });
} else {
    execute().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
