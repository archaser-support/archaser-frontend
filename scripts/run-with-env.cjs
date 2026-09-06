#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

function parseArgs(args) {
    let env = process.env.APP_ENV;
    const remainingArgs = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith("--env=")) {
            env = arg.split("=")[1];
        } else if (arg === "--env" && i + 1 < args.length) {
            env = args[i + 1];
            i++; // skip next arg
        } else {
            remainingArgs.push(arg);
        }
    }

    return { env, remainingArgs };
}

function loadEnvFiles(envName) {
    let dotenv;
    try {
        dotenv = require("dotenv");
    } catch {
        return;
    }

    const cwd = process.cwd();
    const loadedFiles = [];

    const tryLoad = (filePath, override = false) => {
        if (fs.existsSync(filePath)) {
            dotenv.config({ path: filePath, override });
            loadedFiles.push(filePath);
            return true;
        }
        return false;
    };

    if (envName) {
        process.env.APP_ENV = envName;

        const envLocalPath = path.join(cwd, `.env.${envName}.local`);
        const envPath = path.join(cwd, `.env.${envName}`);

        const loadedLocal = tryLoad(envLocalPath, true);
        const loadedMain = tryLoad(envPath, true);

        if (!loadedLocal && !loadedMain) {
            console.warn(
                `\x1b[33m[env-loader] Warning: Requested environment '${envName}', but neither '.env.${envName}' nor '.env.${envName}.local' was found in ${cwd}. Falling back to base .env.\x1b[0m`
            );
        }
    }

    // Always attempt loading base .env.local and .env for fallback variables (without overriding)
    tryLoad(path.join(cwd, ".env.local"), false);
    tryLoad(path.join(cwd, ".env"), false);

    // Fallback check for backend folder in monorepo transition
    const beDir = path.resolve(cwd, "../be");
    if (envName) {
        tryLoad(path.join(beDir, `.env.${envName}`), false);
    }
    tryLoad(path.join(beDir, ".env"), false);

    if (loadedFiles.length > 0) {
        console.log(
            `\x1b[36m[env-loader] Loaded environment files: ${loadedFiles.map((f) => path.basename(f)).join(", ")}\x1b[0m`
        );
    }
}

function formatArg(arg) {
    if (/[\s"'`$<>&|;()]/.test(arg)) {
        return `'${arg.replace(/'/g, "'\\''")}'`;
    }
    return arg;
}

function main() {
    const rawArgs = process.argv.slice(2);
    const { env, remainingArgs } = parseArgs(rawArgs);

    if (remainingArgs.length === 0) {
        console.error("Usage: node run-with-env.cjs [--env=<environment>] <command> [...args]");
        process.exit(1);
    }

    loadEnvFiles(env);

    const fullCmd = remainingArgs.map(formatArg).join(" ");

    const child = spawn(fullCmd, {
        stdio: "inherit",
        shell: true,
        env: process.env,
    });

    child.on("exit", (code, signal) => {
        if (signal) {
            process.kill(process.pid, signal);
        } else {
            process.exit(code ?? 0);
        }
    });
}

main();
