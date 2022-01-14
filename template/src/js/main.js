registerMod(shapez => {
    return class ModImpl extends shapez.Mod {
        constructor(app, modLoader) {
            super(
                app,
                {
                    website: "mod_website",
                    author: "mod_author",
                    name: "mod_name",
                    version: "mod_version",
                    id: "mod_id",
                    description: "mod_description",
                },
                modLoader
            );
        }

        init() {
            //Add some custom css
            this.modInterface.registerCss(`
                 * {
                     font-family: "Comic Sans", "Comic Sans MS", Tahoma !important;
                 }
             `);
            

            // Modify the theme colors
            this.signals.preprocessTheme.add(({ theme }) => {
                
            });

            this.modInterface.registerTranslations("en", {
                ingame: {
                    interactiveTutorial: {
                        title: "Hello",
                        hints: {
                            "1_1_extractor": "World!",
                        },
                    },
                },
            });
        }
    };
});