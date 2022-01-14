const exec = require("child_process").exec;
const path = require("path");
const browserSync = require("browser-sync").create({});
const gulp = require("gulp");
const fs = require("fs");
const log = require("fancy-log");

// TODO: atlas and images

// Load other plugins dynamically
const $ = require("gulp-load-plugins")({
    scope: ["devDependencies"],
    pattern: "*",
});

const baseDir = path.join(__dirname, "..");
const folders = {
    src: path.join(baseDir, "src"),
    build: path.join(baseDir, "build"),
    shapezBuild: path.join(baseDir, "shapez"),
};

// Folders
if (!fs.existsSync(folders.build)) {
    fs.mkdirSync(folders.build);
}

// Utils
// Cleans up everything
gulp.task("utils.cleanBuildFolder", () => {
    return gulp.src(folders.build, { read: false, allowEmpty: true }).pipe($.clean({ force: true }));
});

gulp.task("utils.cleanShapezBuildFolder", () => {
    return gulp.src(folders.shapezBuild, { read: false, allowEmpty: true }).pipe($.clean({ force: true }));
});

gulp.task("utils.cleanup", gulp.series("utils.cleanBuildFolder", "utils.cleanShapezBuildFolder"));

// Serve
gulp.task("main.serve.shapez", function (cb) {
    browserSync.init({
        server: folders.shapezBuild,
        port: 3005,
        ghostMode: {
            clicks: false,
            scroll: false,
            location: false,
            forms: false,
        },
        logLevel: "info",
        logPrefix: "BS",
        online: false,
        xip: false,
        notify: false,
        reloadDebounce: 100,
        reloadOnRestart: true,
        watchEvents: ["add", "change"],
    });

    return cb();
});

gulp.task("main.serve.shapez.reload", function (cb) {
    browserSync.reload();
    return cb();
});

gulp.task("main.serve.mod", function (cb) {
    gulp.src(folders.build).pipe(
        $.webserver({
            livereload: {
                enable: true,
            },
            middleware: [
                (req, res, next) => {
                    res.setHeader("Access-Control-Allow-Origin", "*"); // eg.
                    next();
                },
            ],
            directoryListing: false,
            open: false,
            port: 3010,
        })
    );

    return cb();
});

gulp.task("main.serve", gulp.series("main.serve.shapez", "main.serve.mod"));

// Js
const js = require("./js");
js.gulptasksJS($, gulp, folders);

// Css
const css = require("./css");
css.gulptasksCSS($, gulp, folders);

// Atlases
const atlas = require("./atlas");
atlas.gulptasksAtlas($, gulp, folders);

// Translations
const translations = require("./translations");
translations.gulptasksTranslations($, gulp, folders);

// Builds
gulp.task(
    "main.build",
    // TODO: add builds
    gulp.series("utils.cleanBuildFolder", "translations", "atlas.allOptimized", "css.prod", "js")
);
gulp.task(
    "main.build.dev",
    // TODO: add builds
    gulp.series("utils.cleanBuildFolder", "translations", "atlas.allOptimized", "css.dev", "js.dev")
);

// Watch
function getGlobs(folder, customExtenstions = null) {
    const extensions = ["html", "js", "png", "gif", "jpg", "svg", "mp3", "ico", "woff2", "json", "scss"];
    return extensions.map(ext =>
        path.relative(__dirname, path.join(folder, "**", "*." + customExtenstions || ext)).replace(/\\/g, "/")
    );
}

gulp.task("main.watch.trigger", function (cb) {
    const main = path.relative(__dirname, path.join(folders.src, "js", "main.js"));
    fs.appendFileSync(main, "//gulp-reload!");
    setTimeout(() => {
        const mainFile = fs.readFileSync(main, "utf-8").replace(/[\n]?\/\/gulp-reload![\n]?/g, "");
        fs.writeFileSync(main, mainFile);
    }, 1000);

    return cb();
});

gulp.task("main.watch.themes", function () {
    // Watch the source folder and reload when anything changed
    const src = getGlobs(folders.src, ["json"]);
    return gulp.watch(src, gulp.series("main.watch.trigger", "main.serve.shapez.reload"));
});

gulp.task("main.watch.translations", function () {
    // Watch the source folder and reload when anything changed
    const src = getGlobs(folders.src, ["yaml"]);
    return gulp.watch(src, gulp.series("translations", "main.watch.trigger", "main.serve.shapez.reload"));
});

gulp.task("main.watch.atlas", function () {
    // Watch the source folder and reload when anything changed
    const src = getGlobs(folders.src, ["png"]);
    return gulp.watch(
        src,
        gulp.series("atlas.allOptimized", "main.watch.trigger", "main.serve.shapez.reload")
    );
});

gulp.task("main.watch.scss", function () {
    // Watch the source folder and reload when anything changed
    const src = getGlobs(folders.src, ["scss"]);
    return gulp.watch(src, gulp.series("css.dev", "main.watch.trigger", "main.serve.shapez.reload"));
});

gulp.task("main.watch.js", function () {
    // Watch the source folder and reload when anything changed
    const src = getGlobs(folders.src, ["js"]);
    return gulp.watch(src, gulp.series("main.serve.shapez.reload"));
});

gulp.task("main.watch.shapezBuildFolder", function () {
    // Watch the shapezBuildFolder and reload when anything changed
    const src = getGlobs(folders.shapezBuild);

    return gulp.watch(src, gulp.series("main.build.dev", "main.serve.shapez.reload"));
});

gulp.task(
    "main.watch.folders",
    gulp.parallel(
        "main.watch.scss",
        "main.watch.js",
        "main.watch.atlas",
        "main.watch.translations",
        "main.watch.themes",
        "main.watch.shapezBuildFolder"
    )
);

gulp.task("main.watch", gulp.series("main.build.dev", "main.serve", "main.watch.folders"));
gulp.task(
    "main.watch.mod",
    gulp.parallel(
        "main.build.dev",
        "main.serve.mod",
        "main.watch.scss",
        "main.watch.translations",
        "main.watch.themes",
        "main.watch.js",
        "main.watch.atlas"
    )
);

gulp.task("default", gulp.series("main.watch"));
