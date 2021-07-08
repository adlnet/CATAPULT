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
    //
    // this AU is launched just to make sure a registration is generated
    // but the AU itself should have already been satisfied because of
    // the NotApplicable moveOn which must be handled at registration
    // creation
    //
    const cmi5 = await Helpers.initAU();

    if (! cmi5) {
        return;
    }

    await Helpers.closeAU(cmi5);

    Helpers.storeResult(
        true,
        false,
        {
            actor: cmi5.getActor(),
            registration: cmi5.getRegistration(),
            activityId: cmi5.getActivityId(),
            msg: "Session start/end for NotApplicable moveOn"
        }
    );
};

execute();
