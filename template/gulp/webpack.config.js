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
                    exclude: /node_modules/,
                    use: [
                        StringReplacePlugin.replace({
                            replacements: [
                                {
                                    pattern:
                                        /import[ \n]*{([a-zA-Z0-9_$, \n]*)*}[ \n]*from[ \n]*[`|"|'](shapez\/[^]*?)[`|"|'];/gms,
                                    replacement: (match, variables, path) => {
                                        return `const {${variables}} = shapez;`;
                                    },
                                },
                                {
                                    pattern: /extends[^]*?Mod[^]*?{[^]*?init[^]*?\([^]*?\)[^]*?{/gms,
                                    replacement: match => {
                                        const css = `this.modInterface.registerCss(CSS);`;

                                        return injectCss ? `${match}\n${css}` : `${match}`;
                                    },
                                },
                                {
                                    pattern: /extends[^]*?Mod[^]*?{[^]*?init[^]*?\([^]*?\)[^]*?{/gms,
                                    replacement: match => {
                                        const atlases = `const importAtlases = ATLASES;\nfor (const key in importAtlases) {\nconst atlas=importAtlases[key];\nthis.modInterface.registerAtlas(atlas.src, atlas.atlasData);\n}`;

                                        return injectAtlas ? `${match}\n${atlases}` : `${match}`;
                                    },
                                },
                                {
                                    pattern: /extends[^]*?Mod[^]*?{[^]*?init[^]*?\([^]*?\)[^]*?{/gms,
                                    replacement: match => {
                                        const translations = `const importTranslations = TRANSLATIONS;\nfor (const translationId in importTranslations) {\nconst translation = importTranslations[translationId];\nthis.modInterface.registerTranslations(translationId, translation);\n}`;

                                        return injectTranslations ? `${match}\n${translations}` : `${match}`;
                                    },
                                },
                                {
                                    pattern: /extends[^]*?Mod[^]*?{[^]*?init[^]*?\([^]*?\)[^]*?{/gms,
                                    replacement: match => {
                                        const themes = `const importThemes = THEMES;\nthis.signals.preprocessTheme.add(({ id, theme }) => {\nfor (const themeId in importThemes) {\nif (id !== themeId) continue;\nconst themeMod = importThemes[themeId];\nshapez.matchDataRecursive(theme, themeMod);\n}});`;

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
