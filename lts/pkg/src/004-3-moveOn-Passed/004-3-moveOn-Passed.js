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

    const moveOn = cmi5.getMoveOn();

    if (moveOn !== "Passed") {
        Helpers.storeResult(false, false, {msg: `Unexpected moveOn, expected "Passed", received: ${moveOn}`});

        return;
    }

    try {
        await cmi5.passed();
    }
    catch (ex) {
        Helpers.storeResult(false, true, {msg: `Failed call to passed: ${ex}`});

        return;
    }

    await Helpers.closeAU(cmi5);

    Helpers.storeResult(
        true,
        false,
        {
            registration: cmi5.getRegistration(),
            msg: "Passed stateement for AU with Passed moveOn"
        }
    );
};

execute();
