/*
    Copyright 2021 Rustici Software

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/
"use strict";

const fs = require("fs"),
    path = require("path"),
    util = require("util"),
    HtmlWebpackPlugin = require("html-webpack-plugin"),
    CopyWebpackPlugin = require("copy-webpack-plugin"),
    ZipWebpackPlugin = require("zip-webpack-plugin"),
    ESLintWebPackPlugin = require("eslint-webpack-plugin"),
    fsreaddir = util.promisify(fs.readdir),
    fsaccess = util.promisify(fs.access),
    fscopyFile = util.promisify(fs.copyFile),
    fsmkdir = util.promisify(fs.mkdir),
    fsrm = util.promisify(fs.rm);

module.exports = async (env, argv) => {
    const srcPath = path.join(__dirname, "src"),
        destPath = path.join(__dirname, "dist"),
        files = await fsreaddir(srcPath, {withFileTypes: true}),
        result = [];

    let destExists;

    try {
        await fsaccess(destPath, fs.constants.F_OK);

        destExists = true;
    }
    catch (ex) {
        destExists = false;
    }

    if (destExists) {
        await fsrm(destPath, {force: true, recursive: true});
    }

    await fsmkdir(destPath);

    for (const file of files) {
        const name = file.name;

        if (["index.html", "empty.js", "lib"].includes(name)) {
            continue;
        }

        let item;

        if (file.isDirectory()) {
            item = {
                mode: "production",
                entry: {},
                plugins: [
                    new ESLintWebPackPlugin(),
                    new HtmlWebpackPlugin({
                        template: path.join(srcPath, "index.html"),
                        filename: "index.html",
                        inject: true,
                        title: `${name} - Project CATAPULT`
                    }),
                    new ZipWebpackPlugin({
                        path: destPath,
                        filename: `${name}.zip`,
                        fileOptions: {
                            forceZip64Format: name === "102-zip64" ? true : false
                        },
                        zipOptions: {
                            forceZip64Format: name === "102-zip64" ? true : false
                        }
                    })
                ],
                output: {
                    path: path.resolve(destPath, name),
                    filename: "[name].js"
                }
            };

            try {
                const srcFile = `${srcPath}/${name}/${name}.js`;

                await fsaccess(srcFile, fs.constants.F_OK);

                item.entry[name] = srcFile;
            }
            catch (ex) {
                item.entry[name] = "./src/empty.js";
            }

            try {
                const xmlFile = `${srcPath}/${name}/cmi5.xml`;

                await fsaccess(xmlFile, fs.constants.F_OK);

                item.plugins.unshift(
                    new CopyWebpackPlugin({
                        patterns: [
                            {
                                from: xmlFile
                            }
                        ]
                    })
                );
            }
            catch (ex) {
                // expected if file doesn't exist
            }

            result.push(item);
        }
        else {
            try {
                await fscopyFile(`${srcPath}/${name}`, `${destPath}/${name}`);
            }
            catch (ex) {
                console.log(`Failed to copy file from ${srcPath}/${name} to ${destPath}: ${ex}`);
            }
        }
    }

    return result;
};
