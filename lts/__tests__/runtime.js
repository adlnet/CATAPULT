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
    afterAllOutput = [];

beforeAll(
    async () => {
        try {
            await Helpers.setupLMS("runtime");
        }
        catch (ex) {
            throw new Error(`Failed to setup LMS: ${ex}`);
        }
    }
);

afterAll(
    async () => {
        await Helpers.teardownLMS();

        if (afterAllOutput.length > 0) {
            console.log(afterAllOutput.join("\n"));
        }
    }
);

afterEach(
    () => {
        return Helpers.cleanup();
    }
);

describe(
    "Test package: 001-essentials.zip",
    () => {
        let result;

        test("AU execution", async () => {
            result = await Helpers.importAndRunAU("001-essentials.zip", 0);

            afterAllOutput.push(`${Helpers.describeReq(result.reqId)}: ${result.msg}`);

            expect(result.isError).toBe(false);
            expect(result.success).toBe(true);

            afterAllOutput.pop();
        });

        describe(
            "Post execution validation",
            () => {
                let regStatements,
                    sessionId;

                beforeAll(async () => {
                    try {
                        regStatements = await Helpers.fetchStatements({registration: result.registration});
                        sessionId = result.sessionId;
                    }
                    catch (ex) {
                        throw new Error(`Failed to do post session verification: ${ex}`);
                    }
                });

                //
                // check for multiple launch statements, in theory this should be restrained to the session, but
                // we can assume there is only one launch session for this registration
                //
                test(Helpers.describeReq("9.3.1.0-2"), () => {
                    expect(regStatements.filter((s) => s.verb.id === "http://adlnet.gov/expapi/verbs/launched").length).toBe(1);
                });

                //
                // check that first statement for this registration (which is new itself) is
                // a launched statement
                //
                test(Helpers.describeReq("9.3.1.0-1"), () => {
                    expect(regStatements[0].verb.id).toBe("http://adlnet.gov/expapi/verbs/launched");
                });

                test(Helpers.describeReq("9.6.2.1-1"), () => {
                    for (const stIndex of [0, 4, 5]) {
                        expect(regStatements[stIndex].context.contextActivities.category).toContainObject(
                            {
                                id: "https://w3id.org/xapi/cmi5/context/categories/cmi5"
                            }
                        );
                    }
                });

                // validate elements of the launched statement
                test(Helpers.describeReq("9.6.3.1-3"), () => {
                    expect(regStatements[0].context.extensions["https://w3id.org/xapi/cmi5/context/extensions/sessionid"]).toBe(sessionId);
                });
                test(Helpers.describeReq("9.6.3.2-1"), () => {
                    expect(regStatements[0].context.extensions["https://w3id.org/xapi/cmi5/context/extensions/masteryscore"]).toBe(result.masteryScore);
                });
                test(Helpers.describeReq("9.6.3.3-1"), () => {
                    expect(regStatements[0].context.extensions["https://w3id.org/xapi/cmi5/context/extensions/launchmode"]).toBe(result.launchMode);
                });
                test(Helpers.describeReq("9.6.3.4-1"), () => {
                    const launchUrlFromSession = new URL(result.launchString),
                        launchUrlFromStatement = new URL(regStatements[0].context.extensions["https://w3id.org/xapi/cmi5/context/extensions/launchurl"]);

                    expect(launchUrlFromStatement.origin).toBe(launchUrlFromSession.origin);
                    expect(launchUrlFromStatement.pathname).toBe(launchUrlFromSession.pathname);
                    expect(launchUrlFromStatement.searchParams.get("paramA")).toBe("1");
                    expect(launchUrlFromStatement.searchParams.get("paramB")).toBe("2");
                });
                test(Helpers.describeReq("9.6.3.6-1"), () => {
                    expect(regStatements[0].context.extensions["https://w3id.org/xapi/cmi5/context/extensions/moveon"]).toBe(result.moveOn);
                });
                test(Helpers.describeReq("9.6.3.7-1"), () => {
                    expect(regStatements[0].context.extensions["https://w3id.org/xapi/cmi5/context/extensions/launchparameters"]).toBe(result.launchParameters);
                });

                // the moveOn must be CompletedAndPassed so that the satisfied statements are in the correct order
                // Tests: 9.3.3.0-3 and 9.3.4.0-4 for moveOn of CompletedAndPassed

                test(Helpers.describeReq("9.3.9.0-1"), () => {
                    expect(regStatements[4].verb.id).toBe("https://w3id.org/xapi/adl/verbs/satisfied");
                });
                test(Helpers.describeReq("9.3.9.0-2"), () => {
                    expect(regStatements[4].object.definition.type).toBe("https://w3id.org/xapi/cmi5/activitytype/block");
                });
                test(Helpers.describeReq("9.3.9.0-4"), () => {
                    expect(regStatements[4].object.id).not.toBe("https://w3id.org/xapi/cmi5/catapult/lts/block/001-essentials");
                });
                test(Helpers.describeReq("9.3.9.0-5"), () => {
                    expect(regStatements[5].verb.id).toBe("https://w3id.org/xapi/adl/verbs/satisfied");
                });
                test(Helpers.describeReq("9.3.9.0-6"), () => {
                    expect(regStatements[5].object.definition.type).toBe("https://w3id.org/xapi/cmi5/activitytype/course");
                });
                test(Helpers.describeReq("9.3.9.0-8"), () => {
                    expect(regStatements[5].object.id).not.toBe("https://w3id.org/xapi/cmi5/catapult/lts/course/001-essentials");
                });
                test(Helpers.describeReq("9.3.9.0-9"), () => {
                    expect(regStatements[4].context.extensions["https://w3id.org/xapi/cmi5/context/extensions/sessionid"]).toBe(sessionId);
                    expect(regStatements[5].context.extensions["https://w3id.org/xapi/cmi5/context/extensions/sessionid"]).toBe(sessionId);
                });
                test(Helpers.describeReq("9.6.2.3-2"), () => {
                    expect(regStatements[4].context.contextActivities.grouping).toContainObject(
                        {
                            id: "https://w3id.org/xapi/cmi5/catapult/lts/block/001-essentials"
                        }
                    );
                    expect(regStatements[5].context.contextActivities.grouping).toContainObject(
                        {
                            id: "https://w3id.org/xapi/cmi5/catapult/lts/course/001-essentials"
                        }
                    );
                });
            }
        );
    }
);

describe(
    "Test package: 002-allowed.zip",
    () => {
        let result;

        test("AU execution", async () => {
            result = await Helpers.importAndRunAU("002-allowed.zip", 0);

            afterAllOutput.push(`${Helpers.describeReq(result.reqId)}: ${result.msg}`);

            expect(result.isError).toBe(false);
            expect(result.success).toBe(true);

            afterAllOutput.pop();
        });

        describe(
            "Post execution validation",
            () => {
                let regStatements;

                beforeAll(async () => {
                    try {
                        regStatements = await Helpers.fetchStatements({registration: result.registration});
                    }
                    catch (ex) {
                        throw new Error(`Failed to do post session verification: ${ex}`);
                    }
                });

                test(Helpers.describeReq("9.3.0.0-9"), () => {
                    expect(regStatements[2].verb.id).toBe("http://adlnet.gov/expapi/verbs/experienced");
                });
            }
        );
    }
);

describe(
    "Test package: 003-launchMethod-OwnWindow.zip",
    () => {
        let result;

        test("AU execution", async () => {
            result = await Helpers.importAndRunAU("003-launchMethod-OwnWindow.zip", 0);

            afterAllOutput.push(`${Helpers.describeReq(result.reqId)}: ${result.msg}`);

            expect(result.isError).toBe(false);
            expect(result.success).toBe(true);

            afterAllOutput.pop();
        });
    }
);

describe.each(
    [
        ["004-1-moveOn-Completed.zip", "004-1-moveOn-Completed"],
        ["004-2-moveOn-CompletedOrPassed.zip", "004-2-moveOn-CompletedOrPassed"]
    ]
)(
    "Test package: %s",
    (pkgFile, idEnd, auIndex = 0) => {
        let result;

        test("AU execution", async () => {
            result = await Helpers.importAndRunAU(pkgFile, auIndex);

            afterAllOutput.push(`${Helpers.describeReq(result.reqId)}: ${result.msg}`);

            expect(result.isError).toBe(false);
            expect(result.success).toBe(true);

            afterAllOutput.pop();
        });

        describe(
            "Post execution validation",
            () => {
                let regStatements;

                beforeAll(async () => {
                    try {
                        regStatements = await Helpers.fetchStatements({registration: result.registration});
                    }
                    catch (ex) {
                        throw new Error(`Failed to do post session verification: ${ex}`);
                    }
                });

                test(Helpers.describeReq("9.3.3.0-3"), () => {
                    expect(regStatements[3].verb.id).toBe("https://w3id.org/xapi/adl/verbs/satisfied");
                    expect(regStatements[4].verb.id).toBe("https://w3id.org/xapi/adl/verbs/satisfied");
                });
                test(Helpers.describeReq("9.6.2.3-2"), () => {
                    expect(regStatements[3].context.contextActivities.grouping).toContainObject(
                        {
                            id: `https://w3id.org/xapi/cmi5/catapult/lts/block/${idEnd}`
                        }
                    );
                    expect(regStatements[4].context.contextActivities.grouping).toContainObject(
                        {
                            id: `https://w3id.org/xapi/cmi5/catapult/lts/course/${idEnd}`
                        }
                    );
                });
            }
        );
    }
);

describe.each(
    [
        ["004-3-moveOn-Passed.zip", "004-3-moveOn-Passed"],
        ["004-4-moveOn-CompletedOrPassed.zip", "004-4-moveOn-CompletedOrPassed"]
    ]
)(
    "Test package: %s",
    (pkgFile, idEnd, auIndex = 0) => {
        let result;

        test("AU execution", async () => {
            result = await Helpers.importAndRunAU(pkgFile, auIndex);

            afterAllOutput.push(`${Helpers.describeReq(result.reqId)}: ${result.msg}`);

            expect(result.isError).toBe(false);
            expect(result.success).toBe(true);

            afterAllOutput.pop();
        });

        describe(
            "Post execution validation",
            () => {
                let regStatements;

                beforeAll(async () => {
                    try {
                        regStatements = await Helpers.fetchStatements({registration: result.registration});
                    }
                    catch (ex) {
                        throw new Error(`Failed to do post session verification: ${ex}`);
                    }
                });

                test(Helpers.describeReq("9.3.4.0-4"), () => {
                    expect(regStatements[3].verb.id).toBe("https://w3id.org/xapi/adl/verbs/satisfied");
                    expect(regStatements[4].verb.id).toBe("https://w3id.org/xapi/adl/verbs/satisfied");
                });
                test(Helpers.describeReq("9.6.2.3-2"), () => {
                    expect(regStatements[3].context.contextActivities.grouping).toContainObject(
                        {
                            id: `https://w3id.org/xapi/cmi5/catapult/lts/block/${idEnd}`
                        }
                    );
                    expect(regStatements[4].context.contextActivities.grouping).toContainObject(
                        {
                            id: `https://w3id.org/xapi/cmi5/catapult/lts/course/${idEnd}`
                        }
                    );
                });
            }
        );
    }
);

describe.each(
    [
        ["004-5-moveOn-NotApplicable.zip"]
    ]
)(
    "Test package: %s",
    (pkgFile, auIndex = 0) => {
        let result;

        test("AU execution", async () => {
            //
            // this AU runs to trigger creation of a registration and to make
            // sure that the activityId is supplied, etc. the key is that at
            // the time of registration the moveOn criteria should be evaluated
            // and that the AU, block, and course should get marked as satisfied
            // *before* the AU is actually run
            //
            result = await Helpers.importAndRunAU(pkgFile, auIndex);

            afterAllOutput.push(`${Helpers.describeReq(result.reqId)}: ${result.msg}`);

            expect(result.isError).toBe(false);
            expect(result.success).toBe(true);

            afterAllOutput.pop();
        });

        describe(
            "Post execution validation",
            () => {
                let regStatements;

                beforeAll(async () => {
                    try {
                        regStatements = await Helpers.fetchStatements({registration: result.registration});
                    }
                    catch (ex) {
                        throw new Error(`Failed to do post session verification: ${ex}`);
                    }
                });

                test(Helpers.describeReq("9.6.1.1-3"), () => {
                    expect(regStatements[0].verb.id).toBe("https://w3id.org/xapi/adl/verbs/satisfied");
                    expect(regStatements[1].verb.id).toBe("https://w3id.org/xapi/adl/verbs/satisfied");
                });
                test(Helpers.describeReq("9.6.2.3-2"), () => {
                    expect(regStatements[0].context.contextActivities.grouping).toContainObject(
                        {
                            id: "https://w3id.org/xapi/cmi5/catapult/lts/block/004-5-moveOn-NotApplicable"
                        }
                    );
                    expect(regStatements[1].context.contextActivities.grouping).toContainObject(
                        {
                            id: "https://w3id.org/xapi/cmi5/catapult/lts/course/004-5-moveOn-NotApplicable"
                        }
                    );
                });
            }
        );
    }
);

describe.each(
    [
        ["005-1-invalid-au.zip"],
        ["005-2-invalid-au.zip"]
    ]
)(
    "Test package: %s",
    (pkgFile, auIndex = 0) => {
        test("AU execution", async () => {
            const result = await Helpers.importAndRunAU(pkgFile, auIndex);

            afterAllOutput.push(`${Helpers.describeReq(result.reqId)}: ${result.msg}`);

            expect(result.isError).toBe(false);
            expect(result.success).toBe(true);

            afterAllOutput.pop();
        });
    }
);

describe.each(
    [
        ["006-launchMode.zip", "Browse"],
        ["006-launchMode.zip", "Review"]
    ]
)(
    "Statements sent by %s when in launchMode %s should fail",
    (pkgFileName, launchMode) => {
        test("AU execution", async () => {
            const courseId = await Helpers.importPkg(pkgFileName);

            const result = await Helpers.runAU(courseId, 0, pkgFileName, {launchMode});

            afterAllOutput.push(`${Helpers.describeReq(result.reqId)}: ${result.msg}`);

            expect(result.isError).toBe(false);
            expect(result.success).toBe(true);

            afterAllOutput.pop();
        });
    }
);

//
// these multi session tests use the State document to store information between
// sessions, and part of requesting to the State API document is to use the
// activityId from the launch, so this in effect tests that the LMS uses the same
// activityId for multiple launches of a registration which is requirement:
// 8.1.5.0-4
//
describe.each(
    [
        ["007-1-multi-session.zip", "Completed"],
        ["007-2-multi-session.zip", "Passed"]
    ]
)(
    "Statements sent in a subsequent session should fail based on those sent in the first session: %s (%s)",
    (pkgFileName) => {
        test("AU execution", async () => {
            const courseId = await Helpers.importPkg(pkgFileName);

            const firstRunResult = await Helpers.runAU(courseId, 0, pkgFileName);

            afterAllOutput.push(`${Helpers.describeReq(firstRunResult.reqId)}: ${firstRunResult.msg}`);

            expect(firstRunResult.isError).toBe(false);
            expect(firstRunResult.success).toBe(true);

            afterAllOutput.pop();

            const secondRunResult = await Helpers.runAU(courseId, 0, pkgFileName, {registration: firstRunResult.registration});

            expect(secondRunResult.isError).toBe(false);
            expect(secondRunResult.success).toBe(true);

            afterAllOutput.pop();
        });
    }
);

describe(
    "Test package: 008-1-abandoned.zip",
    () => {
        const run = Helpers.hasAbandon() ? test : test.skip;
        let result,
            sessionId;

        run("AU execution", async () => {
            const pkgFileName = "008-1-abandoned.zip",
                courseId = await Helpers.importPkg(pkgFileName);

            await Helpers.loadAU(courseId, 0, pkgFileName);

            //
            // once the AU has loaded and executed it will add a button to the DOM
            // with an id of "abandon", once that button appears then trigger
            // abandoning of the session directly with the LMS, and once that
            // completes then "click" the button to trigger the rest of what the AU
            // does to determine the test result which can then be checked
            //
            const abandonBtnElement = await page.waitForSelector("#abandon");

            sessionId = await page.evaluate("document.getElementById(\"abandon\").getAttribute(\"value\")");

            await Helpers.abandonSession(sessionId);

            await abandonBtnElement.click();

            result = await Helpers.getResult();

            afterAllOutput.push(`${Helpers.describeReq(result.reqId)}: ${result.msg}`);

            expect(result.isError).toBe(false);
            expect(result.success).toBe(true);

            afterAllOutput.pop();
        });

        describe(
            "Post execution validation",
            () => {
                let regStatements;

                if (Helpers.hasAbandon()) {
                    beforeAll(async () => {
                        try {
                            regStatements = await Helpers.fetchStatements({registration: result.registration});
                        }
                        catch (ex) {
                            throw new Error(`Failed to do post session verification: ${ex}`);
                        }
                    });
                }

                run(Helpers.describeReq("9.6.3.1-3"), () => {
                    expect(regStatements[2].context.extensions["https://w3id.org/xapi/cmi5/context/extensions/sessionid"]).toBe(sessionId);
                });
                run(Helpers.describeReq("9.6.2.1-1"), () => {
                    expect(regStatements[2].context.contextActivities.category).toContainObject(
                        {
                            id: "https://w3id.org/xapi/cmi5/context/categories/cmi5"
                        }
                    );
                });
                run(Helpers.describeReq("9.5.4.2-1"), () => {
                    expect(regStatements[2].result.duration).toBeDefined();
                });
                run("abandoned statement actor", () => {
                    if (typeof result.actor.objectType === "undefined") {
                        delete regStatements[2].actor.objectType;
                    }

                    expect(regStatements[2].actor).toEqual(result.actor);
                });
                run("abandoned statement verb", () => {
                    expect(regStatements[2].verb.id).toBe("https://w3id.org/xapi/adl/verbs/abandoned");
                });
                run("abandoned statement object", () => {
                    expect(regStatements[2].object.id).toBe(result.activityId);
                });
                run("abandoned statement registration", () => {
                    expect(regStatements[2].context.registration).toBe(result.registration);
                });
            }
        );
    }
);

describe(
    "Test package: 009-1-waived.zip",
    () => {
        const run = Helpers.hasWaive() ? test : test.skip,
            reason = "Administrative";
        let result;

        //
        // the package has one AU that will be run once but does not satisfy
        // the AU based on the moveOn which means it is still able to be waived
        // so then waive it so that it and the course is satisfied
        //
        run("AU execution", async () => {
            const pkgFileName = "009-1-waived.zip";

            result = await Helpers.importAndRunAU(pkgFileName, 0);

            afterAllOutput.push(`${Helpers.describeReq(result.reqId)}: ${result.msg}`);

            expect(result.isError).toBe(false);
            expect(result.success).toBe(true);

            afterAllOutput.pop();

            //
            // once the AU has loaded and executed then the registration has been
            // created and the second AU needs to be waived
            //
            await Helpers.waiveAU(result.registration, 0, reason);
        });

        describe(
            "Post execution validation",
            () => {
                let regStatements;

                if (Helpers.hasWaive()) {
                    beforeAll(async () => {
                        try {
                            regStatements = await Helpers.fetchStatements({registration: result.registration});
                        }
                        catch (ex) {
                            throw new Error(`Failed to do post session verification: ${ex}`);
                        }
                    });
                }

                run(Helpers.describeReq("9.3.7.0-1"), () => {
                    expect(regStatements[3].verb.id).toBe("https://w3id.org/xapi/adl/verbs/waived");
                });
                run(Helpers.describeReq("9.3.7.0-2 (d)"), () => {
                    // Also validates: 9.5.5.2-1
                    expect(regStatements[3].result.extensions["https://w3id.org/xapi/cmi5/result/extensions/reason"]).toBe(reason);
                });
                run(Helpers.describeReq("9.3.7.0-3"), () => {
                    expect(regStatements[3].context.extensions["https://w3id.org/xapi/cmi5/context/extensions/sessionid"]).toBeDefined();
                });
                run(Helpers.describeReq("9.5.2.0-1 (d2)"), () => {
                    expect(regStatements[3].result.success).toBe(true);
                });
                run(Helpers.describeReq("9.5.3.0-1 (d2)"), () => {
                    expect(regStatements[3].result.completion).toBe(true);
                });
                run(Helpers.describeReq("9.6.2.1-1"), () => {
                    expect(regStatements[3].context.contextActivities.category).toContainObject(
                        {
                            id: "https://w3id.org/xapi/cmi5/context/categories/cmi5"
                        }
                    );
                });
                run(Helpers.describeReq("9.6.2.2-1 (d4)"), () => {
                    expect(regStatements[3].context.contextActivities.category).toContainObject(
                        {
                            id: "https://w3id.org/xapi/cmi5/context/categories/moveon"
                        }
                    );
                });

                run("waived statement actor", () => {
                    if (typeof result.actor.objectType === "undefined") {
                        delete regStatements[3].actor.objectType;
                    }

                    expect(regStatements[3].actor).toEqual(result.actor);
                });
                run("waived statement registration", () => {
                    expect(regStatements[3].context.registration).toBe(result.registration);
                });

                run("waived statement object", () => {
                    expect(regStatements[3].object.id).toBe(result.activityId);
                });

                run(Helpers.describeReq("9.6.2.1-1"), () => {
                    expect(regStatements[4].context.contextActivities.category).toContainObject(
                        {
                            id: "https://w3id.org/xapi/cmi5/context/categories/cmi5"
                        }
                    );
                });

                run("satisfied statement actor", () => {
                    if (typeof result.actor.objectType === "undefined") {
                        delete regStatements[4].actor.objectType;
                    }

                    expect(regStatements[4].actor).toEqual(result.actor);
                });

                run("satisfied statement verb", () => {
                    expect(regStatements[4].verb.id).toBe("https://w3id.org/xapi/adl/verbs/satisfied");
                });

                run("satisfied statement registration", () => {
                    expect(regStatements[4].context.registration).toBe(result.registration);
                });
                run("satisfied statement sessionid matches waived statement sessionid", () => {
                    expect(regStatements[4].context.extensions["https://w3id.org/xapi/cmi5/context/extensions/sessionid"]).toBe(regStatements[4].context.extensions["https://w3id.org/xapi/cmi5/context/extensions/sessionid"]);
                });
            }
        );
    }
);
