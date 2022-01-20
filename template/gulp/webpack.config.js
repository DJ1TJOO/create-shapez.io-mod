const fs = require("fs");
const path = require("path");
const webpack = require("webpack");

const CircularDependencyPlugin = require("circular-dependency-plugin");
const StringReplacePlugin = require("string-replace-webpack-plugin");
const WrapperPlugin = require("wrapper-webpack-plugin");

module.exports = ({
    watch = false,
    injectCss = true,
    injectAtlas = true,
    injectTranslations = true,
    injectThemes = true,
}) => {
    return {
        mode: watch ? "development" : "production",
        ...(watch ? { devtool: "hidden-source-map" } : {}),
        entry: {
            "mod.js": [path.resolve(__dirname, "../src/js/main.js")],
        },
        watch,
        context: path.resolve(__dirname, ".."),
        resolveLoader: {
            alias: {
                wrapper: path.join(__dirname, "./wrapper-loader.js"),
            },
        },
        plugins: [
            new StringReplacePlugin(),
            ...(watch
                ? [
                      new webpack.SourceMapDevToolPlugin({
                          filename: "[file].map",
                          publicPath: "http://localhost:3010/",
                      }),
                  ]
                : []),
            new webpack.DefinePlugin({
                assert: watch ? "window.assert" : "false && window.assert",
                assertAlways: "window.assert",
                MOD_METADATA: webpack.DefinePlugin.runtimeValue(
                    function () {
                        let info = {};
                        try {
                            const json = JSON.parse(
                                fs.readFileSync(path.resolve(__dirname, "../package.json"), {
                                    encoding: "utf-8",
                                })
                            );
                            info = {
                                name: `"${json["mod-info"].name}"`,
                                description: `"${json["mod-info"].description}"`,
                                website: `"${json["mod-info"].webiste}"`,
                                id: `"${json.name}"`,
                                version: `"${json.version}"`,
                                author: `"${json.author}"`,
                                settings: JSON.stringify(json["mod-info"].settings),
                            };
                        } catch (error) {}
                        return info;
                    },
                    ["../package.json"]
                ),
                CSS_MAIN: webpack.DefinePlugin.runtimeValue(
                    function () {
                        let css = "";
                        try {
                            css = fs.readFileSync(path.resolve(__dirname, "../build/main.css"), {
                                encoding: "utf-8",
                            });
                        } catch (error) {}
                        return "`" + css + "`";
                    },
                    ["../build/main.css"]
                ),
                ATLASES: webpack.DefinePlugin.runtimeValue(
                    function () {
                        const atlases = {};
                        const atlasJsons = new Map();
                        const atlasFiles = fs.readdirSync("../build/atlases");
                        for (let i = 0; i < atlasFiles.length; i++) {
                            const filename = atlasFiles[i];
                            const ext = path.extname(filename);
                            const name = path.basename(filename, ext).split("_")[1];
                            const readPath = path.join("../build/atlases", filename);

                            if (ext === ".png") {
                                atlases[name] =
                                    "data:image/png;base64," +
                                    Buffer.from(fs.readFileSync(readPath)).toString("base64");
                            } else if (ext === ".json") {
                                const json = JSON.parse(fs.readFileSync(readPath, "utf8"));
                                atlasJsons.set(name, JSON.stringify(json));
                            }
                        }

                        const atlasesObject = {};
                        for (const name in atlases) {
                            const src = atlases[name];
                            atlasesObject[name] = {
                                src: "`" + src + "`",
                                atlasData: "`" + atlasJsons.get(name) + "`",
                            };
                        }
                        return atlasesObject;
                    },
                    [
                        "../build/atlases/atlas0_hq.json",
                        "../build/atlases/atlas0_hq.png",
                        "../build/atlases/atlas0_mq.json",
                        "../build/atlases/atlas0_mq.png",
                        "../build/atlases/atlas0_lq.json",
                        "../build/atlases/atlas0_lq.png",
                    ]
                ),
                TRANSLATIONS: webpack.DefinePlugin.runtimeValue(
                    function () {
                        const translations = {};
                        const translationFiles = fs.readdirSync("../build/translations");
                        for (let i = 0; i < translationFiles.length; i++) {
                            const filename = translationFiles[i];
                            const ext = path.extname(filename);
                            const name = path.basename(filename, ext);
                            const readPath = path.join("../build/translations", filename);

                            if (ext === ".json") {
                                translations[name] = fs.readFileSync(readPath, "utf8");
                            }
                        }

                        return translations;
                    },
                    ["../build/translations/"]
                ),
                THEMES: webpack.DefinePlugin.runtimeValue(
                    function () {
                        if (!fs.existsSync("../src/themes")) {
                            fs.mkdirSync("../src/themes", {
                                recursive: true,
                            });
                        }

                        const themes = {};
                        const themeFiles = fs.readdirSync("../src/themes");
                        for (let i = 0; i < themeFiles.length; i++) {
                            const filename = themeFiles[i];
                            const ext = path.extname(filename);
                            const name = path.basename(filename, ext);
                            const readPath = path.join("../src/themes", filename);

                            if (ext === ".json") {
                                themes[name] = fs.readFileSync(readPath, "utf8");
                            }
                        }

                        return themes;
                    },
                    ["../src/themes/"]
                ),
            }),

            new CircularDependencyPlugin({
                // exclude detection of files based on a RegExp
                exclude: /node_modules/,

                // add errors to webpack instead of warnings
                failOnError: true,

                // allow import cycles that include an asyncronous import,
                // e.g. via import(/* webpackMode: "weak" */ './file.js')
                allowAsyncCycles: false,

                // set the current working directory for displaying module paths
                cwd: path.join(__dirname, "..", "src", "js"),
            }),

            new WrapperPlugin({
                test: /\.js$/,
                footer: () => {
                    if (watch) {
                        if (!fs.existsSync("../mods")) {
                            fs.mkdirSync("../mods", {
                                recursive: true,
                            });
                        }

                        const mods = [];
                        const modFiles = fs.readdirSync("../mods");
                        for (let i = 0; i < modFiles.length; i++) {
                            const filename = modFiles[i];
                            const ext = path.extname(filename);
                            const readPath = path.join("../mods", filename);

                            if (ext === ".js") {
                                mods.push(fs.readFileSync(readPath, "utf8"));
                            }
                        }

                        return mods.map(x => `\n(() => {${x}})()`).join();
                    } else {
                        return "";
                    }
                },
            }),
        ],
        module: {
            rules: [
                {
                    test: /\.json$/,
                    enforce: "pre",
                    use: ["./gulp/loader.compressjson"],
                    type: "javascript/auto",
                },
                { test: /\.(png|jpe?g|svg)$/, loader: "ignore-loader" },
                {
                    test: /\.md$/,
                    use: [
                        {
                            loader: "html-loader",
                        },
                        "markdown-loader",
                    ],
                },
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: "wrapper",
                            options: {
                                footer: source => {
                                    const matches = [
                                        ...source.matchAll(
                                            /class[\s]*?([a-zA-Z0-9_-]*?)[\s]*?extends[\s]*?Mod[\s]*?{[^]*?init[^]*?\([^]*?\)[^]*?{/gms
                                        ),
                                    ];

                                    if (matches.length > 0) {
                                        let variableName;
                                        for (const match of matches) {
                                            variableName = match[1];
                                        }
                                        return `\nconst METADATA = MOD_METADATA;\nwindow.$shapez_registerMod(${variableName}, METADATA);`;
                                    } else {
                                        return;
                                    }
                                },
                            },
                        },
                        StringReplacePlugin.replace({
                            replacements: [
                                ...(watch
                                    ? []
                                    : [
                                          {
                                              pattern: /[\n]?\/\/gulp-reload![\n]?/g,
                                              replacement: () => "",
                                          },
                                      ]),
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
                                    pattern: /extends[^]*?Mod[^]*?{[^]*?init[\s]*?\([^]*?\)[\s]*?{/gms,
                                    replacement: match => {
                                        const css = `this.modInterface.registerCss(CSS_MAIN);`;

                                        return injectCss ? `${match}\n${css}` : `${match}`;
                                    },
                                },
                                {
                                    pattern: /extends[^]*?Mod[^]*?{[^]*?init[\s]*?\([^]*?\)[\s]*?{/gms,
                                    replacement: match => {
                                        const atlases = `const importAtlases = ATLASES;\nfor (const key in importAtlases) {\nconst atlas=importAtlases[key];\nthis.modInterface.registerAtlas(atlas.src, atlas.atlasData);\n}`;

                                        return injectAtlas ? `${match}\n${atlases}` : `${match}`;
                                    },
                                },
                                {
                                    pattern: /extends[^]*?Mod[^]*?{[^]*?init[\s]*?\([^]*?\)[\s]*?{/gms,
                                    replacement: match => {
                                        const translations = `const importTranslations = TRANSLATIONS;\nfor (const translationId in importTranslations) {\nconst translation = importTranslations[translationId];\nthis.modInterface.registerTranslations(translationId, translation);\n}`;

                                        return injectTranslations ? `${match}\n${translations}` : `${match}`;
                                    },
                                },
                                {
                                    pattern: /extends[^]*?Mod[^]*?{[^]*?init[\s]*?\([^]*?\)[\s]*?{/gms,
                                    replacement: match => {
                                        const themes = `const importThemes = THEMES;\nfor (const themeId in importThemes) {\nconst themeMod = importThemes[themeId];\nif (shapez.THEMES[themeId]) {\nshapez.matchDataRecursive(shapez.THEMES[themeId], themeMod);\n} else {\nthis.modInterface.registerGameTheme({\nid: themeId,\nname: themeMod.name,\ntheme: themeMod,\n});\n}\n}`;

                                        return injectThemes ? `${match}\n${themes}` : `${match}`;
                                    },
                                },
                            ],
                        }),
                    ],
                },
                {
                    test: /\.ya?ml$/,
                    type: "json", // Required by Webpack v4
                    use: "yaml-loader",
                },
            ],
        },
        output: {
            filename: "mod.js",
            path: path.resolve(__dirname, "..", "build"),
        },
    };
};
