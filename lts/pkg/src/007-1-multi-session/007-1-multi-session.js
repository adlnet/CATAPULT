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
import Helpers from "../lib/helpers";

const execute = async () => {
    const cmi5 = await Helpers.initAU();

    if (! cmi5) {
        return;
    }

    //
    // this AU is intended to be run multiple times, at least twice,
    // such that the first time it is run it will capture a completed
    // statement, then store in the State that it has already been
    // run, so that the second (and after) time it will try to
    // capture another completed statement which is then expected
    // to be rejected where a non-rejection is a failed test
    //
    const stateContent = await Helpers.stateRequest(cmi5, "get", "007-1-multi-session");

    if (typeof stateContent === "undefined") {
        //
        // first run
        //
        if (! await Helpers.sendStatement(cmi5, cmi5.completedStatement(), "9.3.0.0-6 (d1)", {shouldSucceed: true})) {
            return;
        }

        if (! await Helpers.stateRequest(cmi5, "put", "007-1-multi-session", JSON.stringify({firstRun: true}))) {
            return;
        }

        Helpers.storeResult(true, false, {registration: cmi5.getRegistration(), msg: "First stage completed successfully"});
    }
    else {
        //
        // subsequent run
        //
        if (! await Helpers.sendStatement(cmi5, cmi5.completedStatement(), "9.3.0.0-6 (d2)")) {
            return;
        }

        Helpers.storeResult(true, false, {msg: "LMS rejected set of statements with 403 response status"});
    }

    await Helpers.closeAU(cmi5);
};

execute();
