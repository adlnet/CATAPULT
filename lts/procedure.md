# LMS Test Manual Test Procedure

All packages can be found in the package distribution directory, if building locally it will be `lts/pkg/dist/`. For most of the Runtime Verification tests access to the statements as stored in the LRS will be necessary.

## Package Import Verification

### Valid Package Import Verification

These test cases confirm that the LMS provides the minimum level of implementation fidelity to allow for specific package requirements.

For each of the following package files attempt to import them into the LMS and confirm that each package is imported correctly.

- [ ] `101-one-thousand-aus.xml`
- [ ] `102-zip64.zip`

### Invalid Package Rejection Verification

These test cases confirm that the LMS provides sufficient package validation such that it will not allow packages that do not conform to the package requirements.

For each of the following package files attempt to import them into the LMS and confirm that each package is rejected.

- [ ] `201-1-iris-course-id.xml`
- [ ] `201-2-iris-block-id.xml`
- [ ] `201-3-iris-au-id.xml`
- [ ] `201-4-iris-objective-id.xml`
- [ ] `202-1-relative-url-no-zip.xml`
- [ ] `202-2-relative-url-no-zip.xml`
- [ ] `202-3-relative-url-no-zip.xml`
- [ ] `202-4-relative-url-no-zip.xml`
- [ ] `202-5-relative-url-no-zip.xml`
- [ ] `203-1-relative-url-no-reference.zip`
- [ ] `204-query-string-conflict-endpoint.xml`
- [ ] `205-1-duplicated-block.xml`
- [ ] `205-2-duplicated-objective.xml`
- [ ] `205-3-duplicated-au.xml`
- [ ] `206-1-invalid-au-url.xml`
- [ ] `207-1-invalid-courseStructure.xml`
- [ ] `208-1-invalid-package.md` (should be imported with a `Content-Type` of `text/markdown`)
- [ ] `209-1-not-a-zip.zip`
- [ ] `210-1-no-cmi5-xml.zip`

## Runtime Verification

These test cases confirm runtime requirements of the LMS via executable AUs and in response to actions performed by the AU. NOTE: after each AU runs there may need to be some clean up of the state of the LMS, for instance, deleting the imported package and associated registrations.

All of the packages in this section should be considered valid packages by the LMS so the step of verifying import of the package is assumed for each case and should succeed for all packages listed here.

### 001-essentials.zip

- [ ] AU Execution - Launch AU 0 in the package
    - [ ] Confirm `success` is `true` in displayed result object
    - [ ] Confirm `isError` is `false` in displayed result object

- [ ] Post Execution Validation - Pull list of statements for `registration` seen in result object in ascending order
    - [ ] Confirm that there is only one statement with `verb.id` of `http://adlnet.gov/expapi/verbs/launched`
    - [ ] Confirm that the first statement has `verb.id` of `http://adlnet.gov/expapi/verbs/launched`
    - [ ] Confirm that the first statement contains an Activity object with `id` of `https://w3id.org/xapi/cmi5/context/categories/cmi5` in `context.contextActivities.category`
    - [ ] Confirm that the fifth statement contains an Activity object with `id` of `https://w3id.org/xapi/cmi5/context/categories/cmi5` in `context.contextActivities.category`
    - [ ] Confirm that the sixth statement contains an Activity object with `id` of `https://w3id.org/xapi/cmi5/context/categories/cmi5` in `context.contextActivities.category`
    - [ ] Confirm that the first statement contains a `context.extensions` property of `https://w3id.org/xapi/cmi5/context/extensions/sessionid` with a value equal to the `sessionId` from the displayed result object
    - [ ] Confirm that the first statement contains a `context.extensions` property of `https://w3id.org/xapi/cmi5/context/extensions/masteryscore` with a value equal to the `masteryScore` from the displayed result object
    - [ ] Confirm that the first statement contains a `context.extensions` property of `https://w3id.org/xapi/cmi5/context/extensions/launchmode` with a value equal to the `launchMode` from the displayed result object
    - [ ] Confirm that the first statement contains a `context.extensions` property of `https://w3id.org/xapi/cmi5/context/extensions/launchurl` with the following:
        - [ ] a URL with a domain portion equal to the domain portion of the `launchString` from the displayed result object
        - [ ] a URL with a path portion equal to the path portion of the `launchString` from the displayed result object
        - [ ] a URL that includes a query string parameter of `paramA` with a value of `"1"`
        - [ ] a URL that includes a query string parameter of `paramB` with a value of `"2"`
    - [ ] Confirm that the first statement contains a `context.extensions` property of `https://w3id.org/xapi/cmi5/context/extensions/moveon` with a value equal to the `moveOn` from the displayed result object
    - [ ] Confirm that the first statement contains a `context.extensions` property of `https://w3id.org/xapi/cmi5/context/extensions/launchparameters` with a value equal to the `launchParameters` from the displayed result object
    - [ ] Confirm that the fifth statement has a `verb.id` of `https://w3id.org/xapi/adl/verbs/satisfied`
    - [ ] Confirm that the fifth statement has an `object.definition.type` of `https://w3id.org/xapi/cmi5/activitytype/block`
    - [ ] Confirm that the fifth statement has an `object.id` that is not equal to `https://w3id.org/xapi/cmi5/catapult/lts/block/001-essentials`
    - [ ] Confirm that the sixth statement has a `verb.id` of `https://w3id.org/xapi/adl/verbs/satisfied`
    - [ ] Confirm that the sixth statement has an `object.definition.type` of `https://w3id.org/xapi/cmi5/activitytype/course`
    - [ ] Confirm that the sixth statement has an `object.id` that is not equal to `https://w3id.org/xapi/cmi5/catapult/lts/course/001-essentials`
    - [ ] Confirm that the fifth statement contains a `context.extensions` property of `https://w3id.org/xapi/cmi5/context/extensions/sessionid` with a value equal to the `sessionId` from the displayed result object
    - [ ] Confirm that the sixth statement contains a `context.extensions` property of `https://w3id.org/xapi/cmi5/context/extensions/sessionid` with a value equal to the `sessionId` from the displayed result object
    - [ ] Confirm that the fifth statement contains an Activity object with `id` of `https://w3id.org/xapi/cmi5/catapult/lts/block/001-essentials` in `context.contextActivities.grouping`
    - [ ] Confirm that the sixth statement contains an Activity object with `id` of `https://w3id.org/xapi/cmi5/catapult/lts/block/001-essentials` in `context.contextActivities.grouping`

### 002-allowed.zip

- [ ] AU Execution - Launch AU 0 in the package
    - [ ] Confirm `success` is `true` in displayed result object
    - [ ] Confirm `isError` is `false` in displayed result object

- [ ] Post Execution Validation - Pull list of statements for `registration` seen in result object in ascending order
    - [ ] Confirm that the third statement has a `verb.id` of `http://adlnet.gov/expapi/verbs/experienced`

### 003-launchMethod-OwnWindow.zip

- [ ] AU Execution - Launch AU 0 in the package
    - [ ] Confirm `success` is `true` in displayed result object
    - [ ] Confirm `isError` is `false` in displayed result object

### 004-1-moveOn-Completed.zip

- [ ] AU Execution - Launch AU 0 in the package
    - [ ] Confirm `success` is `true` in displayed result object
    - [ ] Confirm `isError` is `false` in displayed result object

- [ ] Post Execution Validation - Pull list of statements for `registration` seen in result object in ascending order
    - [ ] Confirm that the fourth statement has a `verb.id` of `https://w3id.org/xapi/adl/verbs/satisfied`
    - [ ] Confirm that the fifth statement has a `verb.id` of `https://w3id.org/xapi/adl/verbs/satisfied`
    - [ ] Confirm that the fourth statement contains an Activity object with `id` of `https://w3id.org/xapi/cmi5/catapult/lts/block/004-1-moveOn-Completed` in `context.contextActivities.grouping`
    - [ ] Confirm that the fifth statement contains an Activity object with `id` of `https://w3id.org/xapi/cmi5/catapult/lts/course/004-1-moveOn-Completed` in `context.contextActivities.grouping`

### 004-2-moveOn-CompletedOrPassed.zip

- [ ] AU Execution - Launch AU 0 in the package
    - [ ] Confirm `success` is `true` in displayed result object
    - [ ] Confirm `isError` is `false` in displayed result object

- [ ] Post Execution Validation - Pull list of statements for `registration` seen in result object in ascending order
    - [ ] Confirm that the fourth statement has a `verb.id` of `https://w3id.org/xapi/adl/verbs/satisfied`
    - [ ] Confirm that the fifth statement has a `verb.id` of `https://w3id.org/xapi/adl/verbs/satisfied`
    - [ ] Confirm that the fourth statement contains an Activity object with `id` of `https://w3id.org/xapi/cmi5/catapult/lts/block/004-2-moveOn-CompletedOrPassed` in `context.contextActivities.grouping`
    - [ ] Confirm that the fifth statement contains an Activity object with `id` of `https://w3id.org/xapi/cmi5/catapult/lts/course/004-2-moveOn-CompletedOrPassed` in `context.contextActivities.grouping`

### 004-3-moveOn-Passed.zip

- [ ] AU Execution - Launch AU 0 in the package
    - [ ] Confirm `success` is `true` in displayed result object
    - [ ] Confirm `isError` is `false` in displayed result object

- [ ] Post Execution Validation - Pull list of statements for `registration` seen in result object in ascending order
    - [ ] Confirm that the fourth statement has a `verb.id` of `https://w3id.org/xapi/adl/verbs/satisfied`
    - [ ] Confirm that the fifth statement has a `verb.id` of `https://w3id.org/xapi/adl/verbs/satisfied`
    - [ ] Confirm that the fourth statement contains an Activity object with `id` of `https://w3id.org/xapi/cmi5/catapult/lts/block/004-3-moveOn-Passed` in `context.contextActivities.grouping`
    - [ ] Confirm that the fifth statement contains an Activity object with `id` of `https://w3id.org/xapi/cmi5/catapult/lts/course/004-3-moveOn-Passed` in `context.contextActivities.grouping`

### 004-4-moveOn-CompletedOrPassed.zip

- [ ] AU Execution - Launch AU 0 in the package
    - [ ] Confirm `success` is `true` in displayed result object
    - [ ] Confirm `isError` is `false` in displayed result object

- [ ] Post Execution Validation - Pull list of statements for `registration` seen in result object in ascending order
    - [ ] Confirm that the fourth statement has a `verb.id` of `https://w3id.org/xapi/adl/verbs/satisfied`
    - [ ] Confirm that the fifth statement has a `verb.id` of `https://w3id.org/xapi/adl/verbs/satisfied`
    - [ ] Confirm that the fourth statement contains an Activity object with `id` of `https://w3id.org/xapi/cmi5/catapult/lts/block/004-4-moveOn-CompletedOrPassed` in `context.contextActivities.grouping`
    - [ ] Confirm that the fifth statement contains an Activity object with `id` of `https://w3id.org/xapi/cmi5/catapult/lts/course/004-4-moveOn-CompletedOrPassed` in `context.contextActivities.grouping`

### 004-5-moveOn-NotApplicable.zip

- [ ] AU Execution - Launch AU 0 in the package
    - [ ] Confirm `success` is `true` in displayed result object
    - [ ] Confirm `isError` is `false` in displayed result object

- [ ] Post Execution Validation - Pull list of statements for `registration` seen in result object in ascending order
    - [ ] Confirm that the first statement has a `verb.id` of `https://w3id.org/xapi/adl/verbs/satisfied`
    - [ ] Confirm that the second statement has a `verb.id` of `https://w3id.org/xapi/adl/verbs/satisfied`
    - [ ] Confirm that the first statement contains an Activity object with `id` of `https://w3id.org/xapi/cmi5/catapult/lts/block/004-5-moveOn-NotApplicable` in `context.contextActivities.grouping`
    - [ ] Confirm that the second statement contains an Activity object with `id` of `https://w3id.org/xapi/cmi5/catapult/lts/course/004-5-moveOn-NotApplicable` in `context.contextActivities.grouping`

### 005-1-invalid-au.zip

- [ ] AU Execution - Launch AU 0 in the package
    - [ ] Confirm `success` is `true` in displayed result object
    - [ ] Confirm `isError` is `false` in displayed result object

### 005-2-invalid-au.zip

- [ ] AU Execution - Launch AU 0 in the package
    - [ ] Confirm `success` is `true` in displayed result object
    - [ ] Confirm `isError` is `false` in displayed result object

### 006-launchMode.zip (Browse)

- [ ] AU Execution - Launch AU 0 in the package with a `launchMode` of `Browse`
    - [ ] Confirm `success` is `true` in displayed result object
    - [ ] Confirm `isError` is `false` in displayed result object

### 006-launchMode.zip (Review)

- [ ] AU Execution - Launch AU 0 in the package with a `launchMode` of `Review`
    - [ ] Confirm `success` is `true` in displayed result object
    - [ ] Confirm `isError` is `false` in displayed result object

### 007-1-multi-session.zip

- [ ] AU Execution - Launch AU 0 in the package
    - [ ] Confirm `success` is `true` in displayed result object
    - [ ] Confirm `isError` is `false` in displayed result object

- [ ] AU Execution - Launch AU 0 in the package again using the same `registration`
    - [ ] Confirm `success` is `true` in displayed result object
    - [ ] Confirm `isError` is `false` in displayed result object

### 007-2-multi-session.zip

- [ ] AU Execution - Launch AU 0 in the package
    - [ ] Confirm `success` is `true` in displayed result object
    - [ ] Confirm `isError` is `false` in displayed result object

- [ ] AU Execution - Launch AU 0 in the package again using the same `registration`
    - [ ] Confirm `success` is `true` in displayed result object
    - [ ] Confirm `isError` is `false` in displayed result object

## Optional Runtime Verification

These test cases require implementation specific functionality that may not be made available from every LMS. If the LMS provides the ability to manually abandon a session or to manually waive an AU these tests should be completed.

### 008-1-abandoned.zip

- [ ] AU Execution - Launch AU 0 in the package
    - [ ] When the "Click when session has been abandoned" button appears, perform steps necessary to manually abandon the active session
    - [ ] Click the "Click when session has been abandoned" button
    - [ ] Confirm `success` is `true` in displayed result object
    - [ ] Confirm `isError` is `false` in displayed result object

- [ ] Post Execution Validation - Pull list of statements for `registration` seen in result object in ascending order
    - [ ] Confirm that the third statement contains a `context.extensions` property of `https://w3id.org/xapi/cmi5/context/extensions/sessionid` with a value equal to the `session` from the displayed result object
    - [ ] Confirm that the third statement contains an Activity object with `id` of `https://w3id.org/xapi/cmi5/context/categories/cmi5` in `context.contextActivities.category`
    - [ ] Confirm that the third statement has a value in `result.duration`
    - [ ] Confirm that the third statement has an `actor` with a value equal to the `actor` from the displayed result object
    - [ ] Confirm that the third statement has a `verb.id` of `https://w3id.org/xapi/adl/verbs/abandoned`
    - [ ] Confirm that the third statement has an `object.id` with a value equal to the `activityId` from the displayed result object
    - [ ] Confirm that the third statement has a `context.registration` with a value equal to the `registration` from the displayed result object

### 009-1-waived.zip

- [ ] AU Execution - Launch AU 0 in the package
    - [ ] Confirm `success` is `true` in displayed result object
    - [ ] Confirm `isError` is `false` in displayed result object
    - [ ] Perform steps necessary to manually waive the AU using the same `registration` as from the launch, suggested to use `Administrative` as the "reason"

- [ ] Post Execution Validation - Pull list of statements for `registration` seen in result object in ascending order
    - [ ] Confirm that the fourth statement has a `verb.id` of `https://w3id.org/xapi/adl/verbs/waived`
    - [ ] Confirm that the fourth statement contains a `result.extensions` property of `https://w3id.org/xapi/cmi5/result/extensions/reason` with a value equal to the "reason" given to the LMS when waiving the AU
    - [ ] Confirm that the fourth statement contains a `context.extensions` property of `https://w3id.org/xapi/cmi5/context/extensions/sessionid` with a unique string value
    - [ ] Confirm that the fourth statement has a `result.success` property with a value of `true`
    - [ ] Confirm that the fourth statement has a `result.completion` property with a value of `true`
    - [ ] Confirm that the fourth statement contains an Activity object with `id` of `https://w3id.org/xapi/cmi5/context/categories/cmi5` in `context.contextActivities.category`
    - [ ] Confirm that the fourth statement contains an Activity object with `id` of `https://w3id.org/xapi/cmi5/context/categories/moveon` in `context.contextActivities.category`
    - [ ] Confirm that the fourth statement has an `actor` with a value equal to the `actor` from the displayed result object
    - [ ] Confirm that the fourth statement has a `context.registration` with a value equal to the `registration` from the displayed result object
    - [ ] Confirm that the fourth statement has an `object.id` with a value equal to the `activityId` from the displayed result object
    - [ ] Confirm that the fifth statement contains an Activity object with `id` of `https://w3id.org/xapi/cmi5/context/categories/cmi5` in `context.contextActivities.category`
    - [ ] Confirm that the fifth statement has an `actor` with a value equal to the `actor` from the displayed result object
    - [ ] Confirm that the fifth statement has a `verb.id` of `https://w3id.org/xapi/adl/verbs/satisfied`
    - [ ] Confirm that the fifth statement has a `context.registration` with a value equal to the `registration` from the displayed result object
    - [ ] Confirm that the fifth statement contains a `context.extensions` property of `https://w3id.org/xapi/cmi5/context/extensions/sessionid` with a value equal to the value of the `context.extensions` property of `https://w3id.org/xapi/cmi5/context/extensions/sessionid` from the fourth statement
