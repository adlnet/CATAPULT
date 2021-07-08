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
const Helpers = require("../lib/helpers"),
    {InvalidPackageError} = require("../lib/errors"),
    afterAllOutput = [];

afterAll(
    () => {
        if (afterAllOutput.length > 0) {
            console.log(afterAllOutput.join("\n"));
        }
    }
);

describe.each(
    [
        ["101-one-thousand-aus.xml", "6.1.0.0-2"],
        ["102-zip64.zip", "14.0.0.0-1"]
    ]
)(
    "Valid package is imported, Test package: %s (%s)",
    (pkgFile) => {
        //
        // only need to clean up the valid packages since the others shouldn't have been imported
        //
        afterEach(
            () => {
                return Helpers.cleanup();
            }
        );

        test("Package import", () => {
            return expect(Helpers.importPkg(pkgFile)).resolves.toBeDefined();
        });
    }
);

describe.each(
    [
        ["201-1-iris-course-id.xml", "3.0.0.0-1"],
        ["201-2-iris-block-id.xml", "3.0.0.0-1"],
        ["201-3-iris-au-id.xml", "3.0.0.0-1"],
        ["201-4-iris-objective-id.xml", "3.0.0.0-1"],
        ["202-1-relative-url-no-zip.xml", "14.2.0.0-1"],
        ["202-2-relative-url-no-zip.xml", "14.2.0.0-1"],
        ["202-3-relative-url-no-zip.xml", "14.2.0.0-1"],
        ["202-4-relative-url-no-zip.xml", "14.2.0.0-1"],
        ["202-5-relative-url-no-zip.xml", "14.2.0.0-1"],
        ["203-1-relative-url-no-reference.zip", "14.1.0.0-4"],
        ["204-query-string-conflict-endpoint.xml", "8.1.0.0-6"],
        ["205-1-duplicated-block.xml", "13.1.2.0-1"],
        ["205-2-duplicated-objective.xml", "13.1.3.0-1"],
        ["205-3-duplicated-au.xml", "13.1.4.0-1"],
        ["206-1-invalid-au-url.xml", "13.1.4.0-2"],
        ["207-1-invalid-courseStructure.xml", "13.2.0.0-1"],
        ["208-1-invalid-package.md", "14.0.0.0-1", {contentType: "text/markdown; charset=UTF-8"}],
        ["209-1-not-a-zip.zip", "14.1.0.0-1"],
        ["210-1-no-cmi5-xml.zip", "14.1.0.0-2"]
    ]
)(
    "Invalid package is rejected, Test package: %s (%s)",
    (pkgFile, reqId, {contentType, debug = false} = {}) => {
        test("Package import", async () => {
            //
            // Jest provides a more condensed way to check this kind of test, but
            // it is very hard to debug and doesn't provide the kind of information
            // needed by developers using the test system to validate, so switched
            // to the manual way, short looks like:
            //
            //    return expect(Helpers.importPkg(pkgFile)).rejects.toBeInstanceOf(InvalidPackageError);
            //
            try {
                const courseId = await Helpers.importPkg(pkgFile, contentType);

                throw new Error(`Expected failing package did not fail: ${pkgFile}`);
            }
            catch (ex) {
                if (! (ex instanceof InvalidPackageError)) {
                    console.log(ex.stack);
                }
                else if (debug) {
                    console.log(ex);
                }
                expect(ex).toBeInstanceOf(InvalidPackageError);
            }
        });
    }
);
