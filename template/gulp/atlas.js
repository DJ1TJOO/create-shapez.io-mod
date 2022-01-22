const { existsSync } = require("fs");
const fs = require("fs");
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

async function createAtlas(modFolder) {
    // Create base atlas
    const config = JSON.stringify("./atlas.json");
    const source = JSON.stringify(`../src/${modFolder}/res`);
    const dest = JSON.stringify(`../build/${modFolder}/atlases/`);

    // Create build folder
    if (fs.existsSync(`../build/${modFolder}/atlases/`)) {
        fs.rmdirSync(`../build/${modFolder}/atlases/`, {
            recursive: true,
        });
    }

    fs.mkdirSync(`../build/${modFolder}/atlases/`, {
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

        execute(`java -jar runnable-texturepacker.jar ${source} ${dest} atlas0 ${config}`);
    } catch (error) {
        console.warn("Building atlas failed. Java not found / unsupported version?");
    }

    // Convert atlas information
    atlasToJson.convert(`../build/${modFolder}/atlases/`);

    // Minify image with lossy options
    await imagemin([`../build/${modFolder}/atlases/*.{png}`], {
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
    }

    apply(compiler) {
        compiler.hooks.compile.tap("CreateAtlas_compile", async () => {
            for (let i = 0; i < this.mods.length; i++) {
                await createAtlas(this.mods[i]);
            }
        });
    }
}

module.exports = { CreateAtlas };
