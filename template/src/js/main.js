import { Mod } from "shapez/mods/mod";

registerMod(() => {
    return class ModImpl extends Mod {
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

        init() {}
    };
});
