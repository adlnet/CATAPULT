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
    // this AU is intended to be run with a launchMode of Browse or
    // Review such that when it is run the completed, passed, and
    // failed statements are expected to be rejected where a
    // non-rejection is a failed test
    //
    if (cmi5.getLaunchMode() !== "Browse" && cmi5.getLaunchMode() !== "Review") {
        Helpers.storeResult(false, true, {msg: `Expected launchMode to be Browse or Review but received: ${cmi5.getLaunchMode()}`});

        return;
    }

    //
    // Also validates: 10.2.2.0-5 (d)
    //
    const reqId = cmi5.getLaunchMode() === "Browse" ? "10.2.2.0-2 (d)" : "10.2.2.0-3 (d)";

    if (! await Helpers.sendStatement(cmi5, cmi5.completedStatement(), reqId)) {
        return;
    }
    if (! await Helpers.sendStatement(cmi5, cmi5.failedStatement(), reqId)) {
        return;
    }
    if (! await Helpers.sendStatement(cmi5, cmi5.passedStatement(), reqId)) {
        return;
    }

    Helpers.storeResult(true, false, {msg: "LMS rejected set of statements with 403 response status"});

    await Helpers.closeAU(cmi5);
};

execute();
