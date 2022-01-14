const fs = require("fs");
const path = require("path");
const webpack = require("webpack");

const CircularDependencyPlugin = require("circular-dependency-plugin");
const StringReplacePlugin = require("string-replace-webpack-plugin");

module.exports = ({
    watch = false,
    injectCss = true,
    injectAtlas = true,
    injectTranslations = true,
    injectThemes = true,
}) => {
    return {
        mode: "development",
        devtool: "cheap-source-map",
        entry: {
            "mod.js": [path.resolve(__dirname, "../src/js/main.js")],
        },
        watch,
        context: path.resolve(__dirname, ".."),
        plugins: [
            new StringReplacePlugin(),
            new webpack.DefinePlugin({
                CSS: webpack.DefinePlugin.runtimeValue(
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
                        const atlases = new Map();
                        const atlasJsons = new Map();
                        const atlasFiles = fs.readdirSync("../build/atlases");
                        for (let i = 0; i < atlasFiles.length; i++) {
                            const filename = atlasFiles[i];
                            const ext = path.extname(filename);
                            const name = path.basename(filename, ext).split("_")[1];
                            const readPath = path.join("../build/atlases", filename);

                            if (ext === ".png") {
                                atlases.set(
                                    name,
                                    "data:image/png;base64," +
                                        Buffer.from(fs.readFileSync(readPath)).toString("base64")
                                );
                            } else if (ext === ".json") {
                                const json = JSON.parse(fs.readFileSync(readPath, "utf8"));
                                json.sourceData = json.frames;
                                delete json.frames;
                                atlasJsons.set(name, JSON.stringify(json));
                            }
                        }

                        return {
                            hq: {
                                src: "`" + atlases.get("hq") + "`",
                                atlasData: atlasJsons.get("hq"),
                            },
                            mq: {
                                src: "`" + atlases.get("mq") + "`",
                                atlasData: atlasJsons.get("mq"),
                            },
                            lq: {
                                src: "`" + atlases.get("lq") + "`",
                                atlasData: atlasJsons.get("lq"),
                            },
                        };
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
                    enforce: "pre",
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: "webpack-strip-block",
                            options: {
                                start: "typehints:start",
                                end: "typehints:end",
                            },
                        },
                    ],
                },
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: [
                        StringReplacePlugin.replace({
                            replacements: [
                                {
                                    pattern:
                                        /import[ \n]*{([a-zA-Z0-9_$, \n]*)*}[ \n]*from[ \n]*[`|"|'](shapez\/[^]*?)[`|"|'];/gms,
                                    replacement: (match, variables, path) => {
                                        return `const {${variables}} = shapez["${path.replace(
                                            "shapez/",
                                            ""
                                        )}"];`;
                                    },
                                },
                                {
                                    pattern:
                                        /(const|var|let|[a-zA-Z0-9\.]*?)?[ \n]*([a-zA-Z0-9]*?)[ \n]*=[ \n]*(new )?[ \n]*([a-zA-Z0-9\.]*)?Mod\(([^]*?)\);/gms,
                                    replacement: (match, type, variableName) => {
                                        const css = `${variableName}.registerCss(CSS_MAIN);\n${variableName}.registerCss(CSS_RESOURCES);`;

                                        return injectCss ? `${match}\n${css}` : `${match}`;
                                    },
                                },
                                {
                                    pattern:
                                        /(const|var|let|[a-zA-Z0-9\.]*?)?[ \n]*([a-zA-Z0-9]*?)[ \n]*=[ \n]*(new )?[ \n]*([a-zA-Z0-9\.]*)?Mod\(([^]*?)\);/gms,
                                    replacement: (match, type, variableName) => {
                                        const atlases = `const atlases = ATLASES;\n${variableName}.registerAtlas(atlases.hq.src, atlases.hq.atlasData);\n${variableName}.registerAtlas(atlases.mq.src, atlases.mq.atlasData);\n${variableName}.registerAtlas(atlases.lq.src, atlases.lq.atlasData);`;

                                        return injectAtlas ? `${match}\n${atlases}` : `${match}`;
                                    },
                                },
                                {
                                    pattern:
                                        /(const|var|let|[a-zA-Z0-9\.]*?)?[ \n]*([a-zA-Z0-9]*?)[ \n]*=[ \n]*(new )?[ \n]*([a-zA-Z0-9\.]*)?Mod\(([^]*?)\);/gms,
                                    replacement: (match, type, variableName) => {
                                        const translations = `const translations = TRANSLATIONS;\nfor (const translationId in translations) {\nconst translation = translations[translationId];\n${variableName}.registerTranslation(translationId, translation, translation.name ? { name: translation.name, code: translationId, region: translation.region || "" } : null);\n}`;

                                        return injectTranslations ? `${match}\n${translations}` : `${match}`;
                                    },
                                },
                                {
                                    pattern:
                                        /(const|var|let|[a-zA-Z0-9\.]*?)?[ \n]*([a-zA-Z0-9]*?)[ \n]*=[ \n]*(new )?[ \n]*([a-zA-Z0-9\.]*)?Mod\(([^]*?)\);/gms,
                                    replacement: (match, type, variableName) => {
                                        const themes = `const themes = THEMES;\nfor (const themeId in themes) {\nconst theme = themes[themeId];\n${variableName}.registerTheme(theme);\n}`;

                                        return injectThemes ? `${match}\n${themes}` : `${match}`;
                                    },
                                },
                            ],
                        }),
                    ],
                },
                {
                    test: /\.worker\.js$/,
                    use: {
                        loader: "worker-loader",
                        options: {
                            fallback: false,
                            inline: true,
                        },
                    },
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
