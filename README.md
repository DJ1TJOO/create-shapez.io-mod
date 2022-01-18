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
