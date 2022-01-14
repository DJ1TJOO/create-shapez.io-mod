const argv = require("yargs").argv;

function requireUncached(module) {
    delete require.cache[require.resolve(module)];
    return require(module);
}

function gulptasksJS($, gulp, folders) {
    gulp.task("js.dev", cb => {
        gulp.src("../src/js/main.js")
            .pipe(
                $.webpackStream(
                    requireUncached("./webpack.config.js")({
                        watch: true,
                        injectCss: argv["no-css"] === undefined,
                        injectAtlas: argv["no-atlas"] === undefined,
                        injectTranslations: argv["no-translations"] === undefined,
                        injectThemes: argv["no-themes"] === undefined,
                    })
                )
            )
            .pipe(gulp.dest(folders.build));

        return cb();
    });

    gulp.task("js", cb => {
        gulp.src("../src/js/main.js")
            .pipe(
                $.webpackStream(
                    requireUncached("./webpack.config.js")({
                        injectCss: argv["no-css"] === undefined,
                        injectAtlas: argv["no-atlas"] === undefined,
                        injectTranslations: argv["no-translations"] === undefined,
                        injectThemes: argv["no-themes"] === undefined,
                    })
                )
            )
            .pipe(gulp.dest(folders.build));
        return cb();
    });
}

module.exports = {
    gulptasksJS,
};
