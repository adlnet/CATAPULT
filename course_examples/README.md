<!---
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
--->

# Project CATAPULT Course Examples

The packages included with CATAPULT are a set of sample cmi5 packages that illustrate the technical principles of cmi5.
The cmi5 examples start with a set of basic HTML pages that contain instructional information about geology. The
instructional content is pulled from Wikipedia because the focus of these course templates is on the technical
components of cmi5 and not on course content or design.

All examples require ES6 or greater, and should work on the most recently released versions of Chrome, Firefox, Safari
and Edge.

Examples with an `_framed` suffix show a traditional scaling layout that attempts to fill the current browser window.
Examples with an `_responsive` suffix show a responsive layout that performs better in mobile environments. Not every
example will have both formats.

All packages use https://www.npmjs.com/package/@rusticisoftware/cmi5 version 3.1.0 as the JS implementation of the cmi5
AU runtime (found in `js/cmi5.min.js` in each package). Newer versions of these software dependencies may work with the
existing source code but were the latest provided working versions at the time of development. `course_cmi5.js` provides
a set of helpers to consolidate behaviors that might be used in traditional packages beyond the raw cmi5 requirements.

## How to Use an Example Package

1. Zip up the contents of an example.
    1. Be sure you are zipping them up such that cmi5.xml is at the root of the zip package, not inside a folder!  It
       works best if you enter the particular example directory you wish to view, select all the files and directories,
       and choose to zip from there.
    2. You must use a ZIP format package. RAR, 7z, or other formats will not work.
2. Upload ZIP package to a cmi5 conformant LMS, or into the CATAPULT CTS.

## Example Package Descriptions

### Simple Single AU (`single_au_basic_*`)

This example demonstrates a basic content package. The Course Structure contains only a single AU. The AU itself will be
treated by the LMS as `"Satisfied"` if the course submits either the completed or passed verbs by the
`moveOn="CompletedOrPassed"` setting. Completion occurs upon passing the quiz successfully with a score of 80% (scaled
score 0.8) or better.

Additional behaviors found in this package:

1. Bookmarking. This course template will store a “bookmark” at each navigation event, using the Activity State as
   described above. On relaunch of the course, the bookmark will be retrieved if available, and the learner presented
   with the option to return to that location in the course.
2. Video tracking: This course template has a playable video and generates xAPI statements per the xAPI video profile.
   The video uses custom controls that allow it to be played exactly once, to model the simplest possible video playing
   and tracking experience.

### "masteryScore" (`masteryscore_*`)

This example includes a simple quiz and requires a passing score of 30% (scaled score 0.3) to be achieved on the quiz to
receive a passed and completed statement. This value is specified in the Course Structure on the `masteryScore="0.3"`
attribute of the AU.

Additional behaviors found in this package:

1. During the quiz, several interactions are captured as xAPI Statements, including simple fill-in and multiple choice
   interactions.
2. This example specifies `launchMethod="OwnWindow"` in the Course Structure for the AU.

### Multiple Top-Level AU (`multi_au_*`)

This example takes the contents of the mastery score example and spreads them across several AUs, nested at the topmost
level of the course structure. The AUs have appropriate moveOn criteria for the contents nested inside them.

Additional behaviors found in this package:

1. The quiz AU requires both passed and completed for the LMS to consider it Satisfied, by using the
   `moveOn="CompletedAndPassed"` setting.
2. The URLs for each AU include query parameters which the course uses to configure display behavior.

### Pre-/Post-Test (`pre_post_test_*`)

This example demonstrates a Course Structure of Blocks with each Block containing a pre-test, content section, and
post-test AU (three AUs per Block). Core cmi5 does not include any prerequisite or dependency behavior, so in a standard
cmi5 implementation, this only provides organizational structure and potentially Satisfaction measurement for each
Block.

However, this package also includes an example of a cmi5 Extension, a way to extend the valid tags and attributes
allowed inside an XML Course Structure. In this case, we’ve used
a [requires](https://aicc.github.io/CMI-5_Spec_Current/extensions/requires.html) extension, which allows the course
author to indicate to the LMS what AUs must have met their moveOn criteria before the Block or AU parenting
the <require> tags is accessible to the learner. LMSs may choose not to implement this behavior as it is an extension
and not core to cmi5, so it is important to recognize that this approach to pre/post testing will not necessarily
perform equivalently on all cmi5-conformant platforms.
