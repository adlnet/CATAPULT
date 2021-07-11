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
require("expect-puppeteer");

if (! process.env.CATAPULT_LMS) {
    throw new Error("empty CATAPULT_LMS variable");
}

try {
    global.LMS = require(process.env.CATAPULT_LMS);
}
catch (ex) {
    throw new Error(`Failed to load LMS script: ${ex}`);
}

expect.extend(
    {
        toContainObject (received, argument) {
            const pass = this.equals(
                received,
                expect.arrayContaining([
                    expect.objectContaining(argument)
                ])
            );

            if (pass) {
                return {
                    message: () => (`expected ${this.utils.printReceived(received)} not to contain object ${this.utils.printExpected(argument)}`),
                    pass: true
                };
            }
            else {
                return {
                    message: () => (`expected ${this.utils.printReceived(received)} to contain object ${this.utils.printExpected(argument)}`),
                    pass: false
                };
            }
        }
    }
);
