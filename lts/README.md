# LMS Test Suite

## Building the Package Library

This test suite is a CLI Node.js application. Install the test suite dependencies in the `lts/` directory by doing:

    npm ci

Then build the LMS test packages by doing:

    cd pkg
    npx webpack

## Running Manually

The test suite itself can then be executed manually by following the [documented test procedure (procedure.md)](procedure.md) using an LMS user interface and the package library.

## Running Automatically

To run this suite automatically or via CI the LMS needs to provide a custom LMS implementation library script. The LMS script should be modeled after the example found at `lib/lms.catapult-player.js`. Name the file `lib/lms.custom.js` to have it ignored in the repository by default. Once the library script has been written, create a `.env` file in the directory pointed to its location. For example:

    # path to LMS script (required)
    CATAPULT_LMS="./lib/lms.catapult-player.js"

    # any values leveraged by the referenced script (optional)
    CATAPULT_PLAYER_API_URL="http://localhost:3398/api/v1/"
    CATAPULT_PLAYER_KEY="my-key"
    CATAPULT_PLAYER_SECRET="my-keys-secret"
    LRS_ENDPOINT="http://localhost:8081/catapult/lrs/"
    LRS_KEY="my-lrs-key"
    LRS_SECRET="my-lrs-secret"

With those files in place the dependencies should be installed and then the tests can be run:

    npx jest

This will display the test output in the console and write a uniquely named JUnit formatted XML file to the `var/` directory.
