const fs = require("fs");
const path = require("path");

const CircularDependencyPlugin = require("circular-dependency-plugin");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const { DefinePlugin } = require("webpack");
const { CreateAtlas } = require("./atlas");
const { SourceMapDevToolPlugin } = require("webpack");

function getModFolder(filePath, mods) {
    const dirs = path.dirname(filePath).replace(/\\/g, "/").split("/");
    return mods.find(x => x.folder === dirs[dirs.indexOf("src") + 1]);
}

module.exports = async ({ watch = false }) => {
    /**
     * @type {Array<{
     *   entry: string,
     *   id: string,
     *   version: string,
     *   name: string,
     *   description: string,
     *   website: string,
     *   settings: Object,
     *   folder: string,
     * }>}
     */
    const mods = [];
    const modDirs = fs.readdirSync("../src");
    for (let i = 0; i < modDirs.length; i++) {
        const modFolder = modDirs[i];
        try {
            if (!fs.existsSync(path.join("../src", modFolder, "translations"))) {
                fs.mkdirSync(path.join("../src", modFolder, "translations"));
            }
            if (!fs.existsSync(path.join("../src", modFolder, "themes"))) {
                fs.mkdirSync(path.join("../src", modFolder, "themes"));
            }
            const mod = JSON.parse(fs.readFileSync(path.join("../src", modFolder, "mod.json")));
            if (!mod.disabled) mods.push({ folder: modFolder, ...mod });
        } catch (error) {
            console.log(`Could not find mod.json for '${modFolder}'`);
        }
    }

    mods.sort((a, b) => {
        if (a.id < b.id) {
            return -1;
        }
        if (a.id > b.id) {
            return 1;
        }
        return 0;
    });

    // Update shapez config
    const externalMods = [];

    if (!fs.existsSync(path.join("..", "mods"))) {
        fs.mkdirSync(path.join("..", "mods"));
    }

    const externalModDir = fs.readdirSync("../mods");

    if (!fs.existsSync(path.join("..", "build"))) {
        fs.mkdirSync(path.join("..", "build"));
    }

    for (let i = 0; i < externalModDir.length; i++) {
        const file = externalModDir[i];

        // Copy to build
        fs.copyFileSync(path.join("..", "mods", file), path.join("..", "build", file));

        // Add to list
        externalMods.push(file);
    }

    const shapezMods = [
        ...externalMods.map(x => `http://localhost:3010/${x}`),
        ...mods.map(x => `http://localhost:3010/${x.id}@${x.version}.js`),
    ];

    // Store in shapez config
    const configPath = path.join(__dirname, "..", "shapez", "src", "js", "core", "config.local.js");
    let config = fs.readFileSync(configPath, "utf-8");
    config = config.replace(
        /(\/\/|\n)?[\s]*externalModUrl:[^]*?,[\s]*?\/\//gms,
        `\nexternalModUrl: [${shapezMods.map(x => `"${x}"`).join(", ")}],\n//`
    );
    fs.writeFileSync(configPath, config);

    const entries = mods.reduce(
        (obj, x) => ({
            ...obj,
            [x.id]: path.resolve(__dirname, "..", "src", x.folder, "js", x.entry),
        }),
        {}
    );

    return {
        mode: watch ? "development" : "production",
        ...(watch ? { devtool: "hidden-source-map" } : {}),
        entry: entries,
        watch,
        resolve: {
            extensions: [".ts", ".js"],
        },
        resolveLoader: {
            alias: {
                "wrapper-loader": path.join(__dirname, "./wrapper-loader.js"),
                "replace-loader": path.join(__dirname, "./replace-loader.js"),
            },
        },
        devServer: {
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            static: {
                directory: path.join(__dirname, "..", "build"),
            },
            compress: false,
            port: 3010,
            open: false,
        },
        plugins: [
            new NodePolyfillPlugin(),
            ...(watch
                ? [
                      new SourceMapDevToolPlugin({
                          filename: "[file].map",
                          publicPath: "http://localhost:3010/",
                      }),
                  ]
                : []),
            new DefinePlugin({
                assert: watch ? "window.assert" : "false && window.assert",
                assertAlways: "window.assert",
            }),
            new CreateAtlas(mods),
            // new StringReplacePlugin(),

            new CircularDependencyPlugin({
                // exclude detection of files based on a RegExp
                exclude: /node_modules/,

                // add errors to webpack instead of warnings
                failOnError: true,

                // allow import cycles that include an asyncronous import,
                // e.g. via import(/* webpackMode: "weak" */ './file.js')
                allowAsyncCycles: false,

                // set the current working directory for displaying module paths
                cwd: path.join(__dirname, "..", "src"),
            }),
        ],
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_module/,
                    use: {
                        loader: "ts-loader",
                        options: {
                            // Ignores typescript errors
                            ignoreDiagnostics: watch
                                ? [1005, 1011, 1068, 1109, 1128, 1131, 1181, 2345, 2451]
                                : [],
                        },
                    },
                },
                {
                    test: /\.s[ac]ss$/i,
                    use: [
                        // Translates CSS into CommonJS
                        {
                            loader: "css-loader",
                            options: {
                                exportType: "string",
                            },
                        },
                        // Compiles Sass to CSS
                        "sass-loader",
                    ],
                },
                { test: /\.(png|svg)$/, type: "asset/inline" },
                {
                    test: /\.ya?ml$/,
                    type: "json",
                    use: "yaml-loader",
                },
                {
                    test: /(^.?|\.[^d]|[^.]d|[^.][^d])\.[jt]s$/,
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: "wrapper-loader",
                            options: {
                                footer(source) {
                                    const matches = [
                                        ...source.matchAll(
                                            /class[\s]*?([a-zA-Z0-9_-]*?)[\s]*?extends[\s]*?Mod[\s]*?{[^]*?init[^]*?\([^]*?\)[^]*?{/gms
                                        ),
                                    ];

                                    const modFolder = getModFolder(this.resourcePath, mods);

                                    if (matches.length > 0) {
                                        let variableName;
                                        for (const match of matches) {
                                            variableName = match[1];
                                        }

                                        // Get mod info from package.json
                                        const json = JSON.parse(
                                            fs.readFileSync(
                                                path.resolve(
                                                    __dirname,
                                                    "..",
                                                    "src",
                                                    modFolder.folder,
                                                    "mod.json"
                                                ),
                                                {
                                                    encoding: "utf-8",
                                                }
                                            )
                                        );

                                        return `\nwindow.$shapez_registerMod(${variableName}, ${JSON.stringify(
                                            json
                                        )});`;
                                    } else {
                                        return "";
                                    }
                                },
                            },
                        },
                        {
                            loader: "replace-loader",
                            options: {
                                replacements: [
                                    {
                                        pattern: /import {([^{}]*?)} from "shapez\/([^{}";]*?)";/gms,
                                        replacement: (match, variables, path) => {
                                            return `const {${variables.replace(
                                                /([^,\s]\s*) as(\s+[^,])/g,
                                                "$1:$2"
                                            )}} = shapez;`;
                                        },
                                    },
                                    {
                                        pattern: /extends[\s]*?Mod[\s]*?{[^]*?init[^]*?\([^]*?\)[^]*?{/gms,
                                        replacement: match => {
                                            const css = `this.modInterface.registerCss(require("../css/main.scss").default);`;
                                            return `${match}\n${css}`;
                                        },
                                    },
                                    {
                                        pattern: /extends[\s]*?Mod[\s]*?{[^]*?init[^]*?\([^]*?\)[^]*?{/gms,
                                        replacement(match) {
                                            const modFolder = getModFolder(this.resourcePath, mods);
                                            if (
                                                !fs.existsSync(
                                                    path.join(
                                                        "..",
                                                        "build",
                                                        modFolder.id + "_atlases",
                                                        "atlas0_hq.png"
                                                    )
                                                )
                                            ) {
                                                return match;
                                            }

                                            const atlases = `this.modInterface.registerAtlas(
                                                            require("../../../build/${modFolder.id}_atlases/atlas0_hq.png"),
                                                            JSON.stringify(require("../../../build/${modFolder.id}_atlases/atlas0_hq.json"))
                                                        );
                                                        this.modInterface.registerAtlas(
                                                            require("../../../build/${modFolder.id}_atlases/atlas0_mq.png"),
                                                            JSON.stringify(require("../../../build/${modFolder.id}_atlases/atlas0_mq.json"))
                                                        );
                                                        this.modInterface.registerAtlas(
                                                            require("../../../build/${modFolder.id}_atlases/atlas0_lq.png"),
                                                            JSON.stringify(require("../../../build/${modFolder.id}_atlases/atlas0_lq.json"))
                                                        );`;
                                            return `${match}\n${atlases}`;
                                        },
                                    },
                                    {
                                        pattern: /extends[\s]*?Mod[\s]*?{[^]*?init[^]*?\([^]*?\)[^]*?{/gms,
                                        replacement(match) {
                                            const modFolder = getModFolder(this.resourcePath, mods);

                                            const files = fs.readdirSync(
                                                path.resolve(
                                                    __dirname,
                                                    "..",
                                                    "src",
                                                    modFolder.folder,
                                                    "translations"
                                                )
                                            );

                                            let translations = "";

                                            const dirRelative = "../translations";
                                            for (let i = 0; i < files.length; i++) {
                                                const fileName = files[i];
                                                translations += `this.modInterface.registerTranslations("${
                                                    fileName.split(".")[0]
                                                }", require("${dirRelative}/${fileName}"));`;
                                            }

                                            return `${match}\n${translations}`;
                                        },
                                    },
                                    {
                                        pattern: /extends[\s]*?Mod[\s]*?{[^]*?init[^]*?\([^]*?\)[^]*?{/gms,
                                        replacement(match) {
                                            const modFolder = getModFolder(this.resourcePath, mods);

                                            const files = fs.readdirSync(
                                                path.resolve(
                                                    __dirname,
                                                    "..",
                                                    "src",
                                                    modFolder.folder,
                                                    "themes"
                                                )
                                            );

                                            let themes = "";

                                            const dirRelative = "../themes";
                                            for (let i = 0; i < files.length; i++) {
                                                const fileName = files[i];
                                                const name = fileName.split(".")[0];
                                                themes += `const theme${name}Json = require("${dirRelative}/${fileName}");
                                                        if (shapez.THEMES["${name}"]) {
                                                            shapez.matchDataRecursive(shapez.THEMES["${name}"], theme${name}Json);
                                                        } else {
                                                            this.modInterface.registerGameTheme({ id: "${name}", name: theme${name}Json.name, theme: theme${name}Json });
                                                        }`;
                                            }
                                            return `${match}\n${themes}`;
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                },
            ],
        },
        output: {
            filename: (pathData, assetInfo) => {
                const mod = mods.find(x => x.id === pathData.chunk.name);
                return `${pathData.chunk.name}@${mod.version}.js`;
            },
            path: path.resolve(__dirname, "..", "build"),
        },
    };
};
