const exec = require("child_process").exec;
const path = require("path");
const gulp = require("gulp");
const fs = require("fs");
const webpack = require("webpack");
const WebpackDevServer = require("webpack-dev-server");

// Serve
gulp.task("main.serve.shapez", function (cb) {
    if (fs.existsSync("../shapez/")) {
        const shapez = exec("yarn dev", {
            cwd: "../shapez/",
        });
        shapez.stdout.setEncoding("utf8");
        shapez.stdout.on("data", function (data) {
            console.log("shapez log: " + data);
        });

        shapez.stderr.setEncoding("utf8");
        shapez.stderr.on("data", function (data) {
            console.log("shapez error: " + data);
        });

        shapez.on("close", function (code) {
            console.log("closing shapez");
        });
    }

    return cb();
});

gulp.task("main.serve.shapez.standalone", function (cb) {
    if (fs.existsSync("../shapez/")) {
        const shapez = exec("yarn devStandalone", {
            cwd: "../shapez/",
        });
        shapez.stdout.setEncoding("utf8");
        shapez.stdout.on("data", function (data) {
            console.log("shapez log: " + data);
        });

        shapez.stderr.setEncoding("utf8");
        shapez.stderr.on("data", function (data) {
            console.log("shapez error: " + data);
        });

        shapez.on("close", function (code) {
            console.log("closing shapez");
        });
    }

    return cb();
});

gulp.task("main.serve.shapez.electron", function (cb) {
    if (fs.existsSync("../shapez/")) {
        const shapez = exec("yarn startDev", {
            cwd: "../shapez/electron/",
        });
        shapez.stdout.setEncoding("utf8");
        shapez.stdout.on("data", function (data) {
            console.log("shapez log: " + data);
        });

        shapez.stderr.setEncoding("utf8");
        shapez.stderr.on("data", function (data) {
            console.log("shapez error: " + data);
        });

        shapez.on("close", function (code) {
            console.log("closing shapez");
        });
    }

    return cb();
});

function reloadShapez() {
    if (fs.existsSync("../shapez/")) {
        const mainPath = path.relative(__dirname, path.join("../shapez", "src", "js", "main.js"));
        let mainFile = fs.readFileSync(mainPath, "utf-8");
        const regex = /[\n]?\/\/gulp-reload![\n]?/g;
        if (regex.test(mainFile)) {
            mainFile = mainFile.replace(regex, "");
        } else {
            mainFile += "//gulp-reload!";
        }

        fs.writeFileSync(mainPath, mainFile);
    }
}

gulp.task("main.serve.standalone", gulp.series("main.serve.shapez.standalone", "main.serve.shapez.electron"));

// Builds
gulp.task("main.build", async cb => {
    const webpackConfig = await require("./webpack.config.js")({});
    const compiler = webpack(webpackConfig);
    compiler.run((err, result) => {
        if (err) console.error(err);
        cb();
    });
});
gulp.task("main.build.dev", async cb => {
    const webpackConfig = await require("./webpack.config.js")({ watch: true });
    const compiler = webpack(webpackConfig);
    compiler.hooks.afterCompile.tap("reloadShapez", () => {
        reloadShapez();
    });
    const devServerOptions = { ...webpackConfig.devServer, open: true };
    const server = new WebpackDevServer(devServerOptions, compiler);

    const runServer = async () => {
        console.log("Starting server...");
        await server.start();
        cb();
    };

    runServer();
});

// Watch
function getGlobs(folder, customExtenstions = []) {
    return customExtenstions.map(ext =>
        path.relative(__dirname, path.join(folder, "**", "*." + ext)).replace(/\\/g, "/")
    );
}

gulp.task("main.watch", gulp.series("main.build.dev", "main.serve.shapez"));
gulp.task("main.watch.standalone", gulp.series("main.serve.standalone", "main.watch"));

gulp.task("default", gulp.series("main.watch"));
