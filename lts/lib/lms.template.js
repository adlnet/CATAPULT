/*
    Copyright 2022 Rustici Software

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

/*
    Although any request library could be leveraged from this script the
    Wreck library is what the rest of the LMS test suite uses to send
    requests, so we are guaranteed to be able to load it. If a different
    request library is used it will be up to the user to make sure that
    dependency is made available within the test project and is largely
    dependendent on how it is installed, loaded, etc. If a different
    library is used the Wreck declaration line can be removed.

    Wreck API Documentation: https://hapi.dev/module/wreck

    The InvalidPackageError is an LMS test specific library that has to
    be loaded as it is part of the public interface of the `importCourse`
    function which needs to return objects of that type when a package
    intentionally fails to import.
*/
const Wreck = require("@hapi/wreck"),
    {InvalidPackageError} = require("./errors");

/*
    It is common practice to need additional variables that can be leveraged
    across the various function calls defined in this library, those variables
    most likely should be declared here.

    In the example script this includes values that are used to connect to the
    CATAPULT player such as an API object, the tenant ID and token used in
    requests, as well as values related to the configured LRS.
*/

/*
    The set of properties included in this object represent the public inteface
    that the automation portion of the LMS test suite expects to have implemented.
    Because the cmi5 specification does not specify the implementation specifics
    around the concept of package import, retrieval of launch URLs, and whether
    an LMS implements an automated way to waive AUs or abandon sessions, each
    LMS must implement these functions based on their own implementation specifics.

    Given the nature of the specification and that these are web technologies it
    is expected that any LMS will have the ability to implement these functions
    through automated means regardless of how well defined that LMS' public
    interface is. In other words this is intended to be a sufficient public
    interface rather than an easy one.

    In the cases where a simple return value is expected the choice to still
    require the function wrapper was intentional because there is no way to know
    ahead of time whether a particular LMS implementation will require some sort
    of complicated processing to determine the simple value. For example, the
    `hasWaive` property could be a simple boolean value, but for some LMS cases
    it might be necessary to check a particular tenant configuration for whether
    that tenant has been configured to allow waiving, etc. in which case more
    complicated logic is made possible via the function wrapper.
*/
module.exports = {
    /*
        The `setup` property contains an asynchronous arrow function expression
        that is run at the start of each test suite (`__tests__/package.js` and
        `__tests__/runtime.js`) and should be used to initialize any predetermined
        state in the LMS. For example the sample `setup` function creates and
        stores a local object used to call the player API, sends a request
        to create a new tenant record in the player application, sends a request
        to retrieve an API token based on that tenant information, and handles
        environment variables used to configure the execution of the library.

        This function should return nothing on success, throw an exception on
        failure, or it should return a Promise to meet the `async` interface.
    */
    setup: async (testName) => {
    },

    /*
        The `teardown` property contains an asynchronous arrow function expression
        that is run at the end of each test suite (`__tests__/package.js` and
        `__tests__/runtime.js`) and should be used to reset any predetermined
        state in the LMS. For example the sample `setup` function sends a request
        to delete a tenant record in the player application if one was created
        during the `setup` phase.

        This function should return nothing on success, throw an exception on
        failure, or it should return a Promise to meet the `async` interface.
    */
    teardown: async () => {
    },

    /*
        The `getLrsEndpoint` property contains an arrow function expression that
        is used to provide the URL to the LRS endpoint where xAPI requests are
        made to retrieve statements made by the LMS and AU for verification.

        This function should return a string containing the URL to the root path
        of the LRS endpoint.
    */
    getLrsEndpoint: () => "",

    /*
        The `getLrsAuthHeader` property contains an arrow function expression that
        is used to provide the Authorization header value needed when connecting
        to the LRS endpoint for statement verification purposes.

        This function should return a string containing the full value for the
        `Authorization` header used when making xAPI requests to the LRS endpoint.
    */
    getLrsAuthHeader: () => "",

    /*
        The `importCourse` property contains an asynchronous arrow function expression
        that is used to attempt to load packages into the LMS. Some packages are
        intentionally designed to not meet cmi5 specification requirements, these
        "negative" test cases require a specific return value from this function.
        Some packages will be loaded simply to test the LMS' validation of the
        package while others will then go on to be leveraged in launch scenarios.

        The function receives three arguments:

            * a ReadStream with the content that represents the package
            * a string containing the media type of the file (currently either
               `application/zip` or `text/xml`)
            * a string containing the base filename of the package (which is primarily
               intended to be used for debugging)

        This function should return an identifier for the imported course on success,
        throw an `InvalidPackageError` when the LMS detects an invalid package
        (one that violates a specification requirement), throw an exception on
        any other failure, or it should return a Promise to meet the `async` interface.
        The returned course identifier will be passed to `getLaunchUrl` when the
        test suite needs to launch one of the imported AUs. The sample `importCourse`
        function shows an example of constructing and throwing the `InvalidPackageError`
        and storing the course identifier locally to be used by the `cleanup` function.
    */
    importCourse: async (stream, contentType, filename) => {
    },

    /*
        The `getLaunchUrl` property contains an asynchronous arrow function expression
        that is used to retrieve a URL that can be used to launch the specified AU for
        the specified course given some other required pieces of information. The URL
        returned will be loaded into a headless browser context enabling the AU's
        functionality to run automatically to validate specification requirement(s)
        have been met by the LMS.

        The function receives four arguments:

            * the course identifier as returned by the `importCourse` function
            * the index of the AU based on its position in the course structure as
              described by the cmi5.xml (0 based)
            * an Object representing the xAPI Agent object that is to be used as the
              `actor` query string parameter value for the launch
            * an Object that includes optional additonal properties for the launch,
              the additional properties are:
                * registration: when provided contains a string that contains a UUID
                  that becomes the `registration` that is used in the query string
                  parameter and various xAPI context
                * launchMode: a string that contains one of the possible cmi5 launch
                  modes of `Normal`, `Browse`, or `Review` to be used as the launch
                  mode for the specific session

        This function should return a string containing the launch URL on success,
        throw an exception on failure, or it should return a Promise to meet the
        `async` interface.
    */
    getLaunchUrl: async (courseId, auIndex, actor, {registration, launchMode}) => {
    },

    /*
        The `cleanup` property contains an asynchronous arrow function expression
        that is run at the end of each test in a test suite and should be used
        to return the LMS to the expected state prior to the next test being executed.
        For example the sample `cleanup` function sends a request to delete any
        courses that were imported as part of a test.

        This function should return nothing on success, throw an exception on
        failure, or it should return a Promise to meet the `async` interface.
    */
    cleanup: async () => {
    },

    /*
        The `hasWaive` property contains an arrow function expression that
        is used to indicate whether the LMS provides an automatable way to
        waive an AU. The waive functionality defined in the cmi5 specification
        is optional in aggregate, but when such functionality is provided
        by the LMS implementation then there are a number of requirements
        that must be met by that implementation. Returning `true` from this
        function expression will activate additional tests that will verify
        that the waive requirements have been met.

        This function should return a boolean.

        If an asynchronous process is needed to determine whether automated
        waiving is available then the steps needed to complete that process
        should likely be completed as part of the `setup` so that this function
        can remain synchronous.
    */
    hasWaive: () => true,

    /*
        The `waiveAU` property contains an asynchronous arrow function expression
        that is used to indicate that a specific AU (based on index) should be
        waived for a specific registration.

        The function receives three arguments:

            * a string containing the UUID for the registration
            * the index of the AU based on its position in the course structure as
              described by the cmi5.xml (0 based)
            * a string containing the reason the AU is being waived

        This function should return nothing on success, throw an exception on
        failure, or it should return a Promise to meet the `async` interface.
    */
    waiveAU: async (registration, auIndex, reason) => {
    },

    /*
        The `hasAbandon` property contains an arrow function expression that
        is used to indicate whether the LMS provides an automatable way to
        abandon a session. The abandon functionality defined in the cmi5
        specification is optional in aggregate, but when such functionality
        is provided by the LMS implementation then there are a number of
        requirements that must be met by that implementation. Returning `true`
        from this function expression will activate additional tests that will
        verify that the abandon requirements have been met.

        This function should return a boolean.

        If an asynchronous process is needed to determine whether automated
        abandonment is available then the steps needed to complete that process
        should likely be completed as part of the `setup` so that this function
        can remain synchronous.
    */
    hasAbandon: () => true,

    /*
        The `abandonSession` property contains an asynchronous arrow function
        expression that is used to indicate that a specific session should be
        abandoned.

        The function receives one argument:

            * a string containing the UUID for the session to abandon

        This function should return nothing on success, throw an exception on
        failure, or it should return a Promise to meet the `async` interface.
    */
    abandonSession: async (sessionId) => {
    }
};
