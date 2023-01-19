const { createHash } = require("crypto");
const { existsSync } = require("fs");
const fs = require("fs");
const path = require("path");
const imagemin = require("imagemin");
const imageminGifsicle = require("imagemin-gifsicle");
const imageminJpegtran = require("imagemin-jpegtran");
const imageminOptipng = require("imagemin-optipng");
const imageminPngquant = require("imagemin-pngquant");
const atlasToJson = require("./atlas2json");

const execute = command =>
    require("child_process").execSync(command, {
        encoding: "utf-8",
    });

// Link to download LibGDX runnable-texturepacker.jar
const runnableTPSource = "https://libgdx.badlogicgames.com/ci/nightlies/runnables/runnable-texturepacker.jar";

async function computeMetaHash(folder, inputHash = null) {
    const hash = inputHash ? inputHash : createHash("sha256");
    const info = await fs.promises.readdir(folder, { withFileTypes: true });

    let files = 0;
    // construct a string from the modification date, the filename and the filesize
    for (let item of info) {
        const fullPath = path.join(folder, item.name);
        if (item.isFile()) {
            files++;
            const statInfo = await fs.promises.stat(fullPath);
            // compute hash string name:size:mtime
            const fileInfo = `${fullPath}:${statInfo.size}:${statInfo.mtimeMs}`;
            hash.update(fileInfo);
        } else if (item.isDirectory()) {
            // recursively walk sub-folders
            files += await computeMetaHash(fullPath, hash);
        }
    }
    // if not being called recursively, get the digest and return it as the hash result
    if (!inputHash) {
        return { hash: hash.digest(), files };
    } else {
        return files;
    }
}

async function createAtlas({ folder, id }, plugin) {
    // Create base atlas
    const config = "./atlas.json";
    const source = path.join("../", "src", folder, "res");
    const dest = path.join("../", "build", `${id}_atlases`);

    const filesHash = await computeMetaHash(source);
    if (filesHash.files < 1 || (plugin.cache[id] && plugin.cache[id].equals(filesHash.hash))) {
        return;
    }
    plugin.cache[id] = filesHash.hash;

    // Create build folder
    if (fs.existsSync(`../build/${id}_atlases/`)) {
        fs.rmdirSync(`../build/${id}_atlases/`, {
            recursive: true,
        });
    }

    fs.mkdirSync(`../build/${id}_atlases/`, {
        recursive: true,
    });

    try {
        // First check whether Java is installed
        execute("java -version");

        // Now check and try downloading runnable-texturepacker.jar (22MB)
        if (!existsSync("./runnable-texturepacker.jar")) {
            const safeLink = JSON.stringify(runnableTPSource);
            const commands = [
                // linux/macos if installed
                `wget -O runnable-texturepacker.jar ${safeLink}`,
                // linux/macos, latest windows 10
                `curl -o runnable-texturepacker.jar ${safeLink}`,
                // windows 10 / updated windows 7+
                "powershell.exe -Command (new-object System.Net.WebClient)" +
                    `.DownloadFile(${safeLink.replace(/"/g, "'")}, 'runnable-texturepacker.jar')`,
                // windows 7+, vulnerability exploit
                `certutil.exe -urlcache -split -f ${safeLink} runnable-texturepacker.jar`,
            ];

            while (commands.length) {
                try {
                    execute(commands.shift());
                    break;
                } catch {
                    if (!commands.length) {
                        throw new Error("Failed to download runnable-texturepacker.jar!");
                    }
                }
            }
        }

        execute(
            `java -jar runnable-texturepacker.jar ${JSON.stringify(source)} ${JSON.stringify(
                dest
            )} atlas0 ${JSON.stringify(config)}`
        );
    } catch (error) {
        console.warn("Building atlas failed. Java not found / unsupported version?");
    }

    // Convert atlas information
    atlasToJson.convert(`../build/${id}_atlases/`);

    // Minify image with lossy options
    await imagemin([`../build/${id}_atlases/*.{png}`], {
        plugins: [
            imageminJpegtran({
                quality: 80,
                maxMemory: 1024 * 1024 * 8,
            }),
            imageminPngquant({
                speed: 1,
                strip: true,
                quality: [0.65, 0.9],
                dithering: false,
                verbose: false,
            }),
            imageminOptipng({
                optimizationLevel: 3,
            }),
            imageminGifsicle({
                optimizationLevel: 3,
                colors: 128,
            }),
        ],
    });
}

class CreateAtlas {
    constructor(mods) {
        this.mods = mods;
        this.cache = {};
    }

    apply(compiler) {
        compiler.hooks.beforeCompile.tapPromise("CreateAtlas_compile", async () => {
            for (let i = 0; i < this.mods.length; i++) {
                await createAtlas(this.mods[i], this);
            }
        });
    }
}

module.exports = { CreateAtlas };
