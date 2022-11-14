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
import Cmi5 from "@rusticisoftware/cmi5";
import Helpers from "../lib/helpers";

const execute = async () => {
    const cmi5 = await Helpers.initAU();

    if (! cmi5) {
        return;
    }

    //
    // create a set of statement templates that should be valid so that they can be used as is
    // or by altering them in some way to make them invalid to check that they are rejected
    //
    const stTemplates = {
        passed: JSON.stringify(
            cmi5.passedStatement()
        ),
        failed: JSON.stringify(
            cmi5.failedStatement()
        )
    };

    for (const stDef of [
        {
            // failed verb sent to succeed
            type: "failed",
            cfg: {
                shouldSucceed: true
            }
        },
        {
            // failed verb after failed has already occurred same session
            // Alo validates part of 9.3.0.0-2 (d)
            reqId: "9.3.0.0-2 (d)",
            type: "failed"
        },
        {
            // passed verb after failed has already occurred
            // Alo validates part of 9.3.0.0-2 (d)
            reqId: "9.3.0.0-3 (d)",
            type: "passed"
        }
    ]) {
        const st = JSON.parse(stTemplates[stDef.type]);

        // using the template in the way that this is doing so means there would be
        // the same statement id with all statements of a kind so generate a new one
        st.id = Cmi5.uuidv4();

        // eslint-disable-next-line no-await-in-loop
        if (! await Helpers.sendStatement(cmi5, st, stDef.reqId, stDef.cfg)) {
            return;
        }
    }

    await Helpers.closeAU(cmi5);

    Helpers.storeResult(true, false, {msg: "LMS rejected set of statements with 403 response status"});
};

execute();
