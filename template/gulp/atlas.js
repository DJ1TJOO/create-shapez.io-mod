const { existsSync } = require("fs");
const path = require("path");
const atlasToJson = require("./atlas2json");

const execute = command =>
    require("child_process").execSync(command, {
        encoding: "utf-8",
    });

// Link to download LibGDX runnable-texturepacker.jar
const runnableTPSource = "https://libgdx.badlogicgames.com/ci/nightlies/runnables/runnable-texturepacker.jar";

function gulptasksAtlas($, gulp, folders) {
    // Lossless options
    const minifyImagesOptsLossless = () => [
        $.imageminJpegtran({
            progressive: true,
        }),
        $.imagemin.svgo({}),
        $.imagemin.optipng({
            optimizationLevel: 3,
        }),
        $.imageminGifsicle({
            optimizationLevel: 3,
            colors: 128,
        }),
    ];

    // Lossy options
    const minifyImagesOpts = () => [
        $.imagemin.mozjpeg({
            quality: 80,
            maxMemory: 1024 * 1024 * 8,
        }),
        $.imagemin.svgo({}),
        $.imageminPngquant({
            speed: 1,
            strip: true,
            quality: [0.65, 0.9],
            dithering: false,
            verbose: false,
        }),
        $.imagemin.optipng({
            optimizationLevel: 3,
        }),
        $.imageminGifsicle({
            optimizationLevel: 3,
            colors: 128,
        }),
    ];

    // Where the resources folder are
    const resourcesDestFolder = path.join(folders.build, "..", "build", "atlases");

    /**
     * Determines if an atlas must use lossless compression
     * @param {string} fname
     */
    function fileMustBeLossless(fname) {
        return fname.indexOf("lossless") >= 0;
    }

    gulp.task("atlas.buildAtlas", cb => {
        const config = JSON.stringify("./atlas.json");
        const source = JSON.stringify("../src/res");
        const dest = JSON.stringify("../build/atlases");

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
        } catch {
            console.warn("Building atlas failed. Java not found / unsupported version?");
        }
        cb();
    });

    // Converts .atlas LibGDX files to JSON
    gulp.task("atlas.atlasToJson", cb => {
        atlasToJson.convert("../build/atlases");
        cb();
    });

    // Copies the atlas to the final destination
    gulp.task("atlas.atlas", () => {
        return gulp.src(["../build/atlases/*.png"]).pipe(gulp.dest(resourcesDestFolder));
    });

    // Copies the atlas to the final destination after optimizing it (lossy compression)
    gulp.task("atlas.atlasOptimized", () => {
        return gulp
            .src(["../build/atlases/*.png"])
            .pipe(
                $.if(
                    fname => fileMustBeLossless(fname.history[0]),
                    $.imagemin(minifyImagesOptsLossless()),
                    $.imagemin(minifyImagesOpts())
                )
            )
            .pipe(gulp.dest(resourcesDestFolder));
    });

    // Copies all resources and optimizes them
    gulp.task(
        "atlas.allOptimized",
        gulp.parallel("atlas.buildAtlas", "atlas.atlasToJson", "atlas.atlasOptimized")
    );
}

module.exports = { gulptasksAtlas };
