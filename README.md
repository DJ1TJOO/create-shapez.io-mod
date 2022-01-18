<h1 align="center">Welcome to create-shapezio-mod 👋</h1>
<p>
  <a href="https://www.npmjs.com/package/create-shapezio-mod" target="_blank">
    <img alt="Version" src="https://img.shields.io/npm/v/create-shapezio-mod.svg">
  </a>
  <a href="https://www.gnu.org/licenses/gpl-3.0.txt" target="_blank">
    <img alt="License: GPLV3" src="https://img.shields.io/badge/License-GPLV3-yellow.svg" />
  </a>
</p>

> A cli for setting up and building a shapez.io mod

### 🏠 [Homepage](https://github.com/DJ1TJOO/create-shapez.io-mod)

# Usage
## CLI
### Creating a shapez.io mod
To setup a shapez.io mod run the following command. 
```sh
npx create-shapezio-mod init
```
It puts all project files in a new folder named after the mod id.
Next to running this command make sure that [java](#installing-java) is installed and added to path and when creating building textures [python](#installing-python) is installed.

### Updating shapez.io
When developing or updating a mod there is a chance the modloader or the cli changes to update your local shapez.io and cli you can run the following command in the working directory.
```sh
npx create-shapezio-mod upgrade
```
You can choose if you only want to update the build files or shapez.io.

### Updating shapez.io typings
When updating shapez.io a `types.d.ts` file is created to add type support. If this files somehow gets currupted you can fix it by running the following command in the working directory.
```sh
npx create-shapezio-mod typings
```
## Buildtools
### Requirements
- [nodejs v12.13.0+](#installing-nodejs)
- [yarn](#installing-nodejs)
- [java 8+](#installing-java)
- [python 3](#installing-python)
### Serving the mod
If you want to test your mod while making changes you can serve the mod with shapez.io.
```sh
yarn dev
```
It will automatically reload when you make a change to your mod. 

You can also choose to only generate and reload the `mod.js` file.
```sh
yarn devMod
```

### Building the mod
If your mod is finished and you want to share it you can run the following command in the working directory.
```sh
yarn build
```
This will generate a `build` folder with a `mod.js` in it. The mod.js is the file you need to share it has all your images, translations, themes and css build in. 

## Creating a mod
When everything is installed you should have a project with a `src` folder and in there some other directories: `js`, `css`, `translations`, `themes` and `res`. 
### Javascript
The `js` folder contains all the code for your script. In the `js` folder there is a `main.js` file this is the start of your mod. 
### Res
To change or add images or building sprites you can use the `res` folder. To change building sprites put them in the `sprites/buildings` folder. You can use the python script to generate the blueprint images or create them your self and put them in the `sprites/blueprints` folder.
### Css
It contains a default setup for a mod. The `css` folder contains a `main.scss` here you can use your scss or css to add to shapez. If you want to add images you can use `inline("icons/building1.png")` this will link to the icon in `res/icons/building1.png`.
### Translations
The translations folder can contain files with langauge codes as names and ending in yaml: `en.yaml`. In these files you can change translations or add translations. You can have a look at the [shapez.io translations](https://github.com/tobspr/shapez.io/blob/master/translations/base-en.yaml) to see how it works.

# Installing requirements
## Installing nodejs
- Download and install nodejs from the official nodejs website: https://nodejs.org/en/download/
- Check if nodejs is installed correctly by running `node --version`
  - If not try again or search on the internet

## Installing yarn
- After installing nodejs run the following command or install via yarn's official webiste: https://classic.yarnpkg.com/lang/en/docs/install
  ```sh
  npm install --global yarn
  ```

## Installing java
- Download and install java from the official java website: https://www.oracle.com/java/technologies/downloads/
- Check if java is installed correctly by running `java -version`
  - If not add java to path: https://www.java.com/en/download/help/path.html

## Installing python
- Download and install python from the official python website: https://www.python.org/downloads/

## Author

👤 **DJ1TJOO**

-   Github: [@DJ1TJOO](https://github.com/DJ1TJOO)

## Show your support

Give a ⭐️ if this project helped you!
