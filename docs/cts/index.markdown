---
layout: page
title: CTS User Guide
---
<!--
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
-->

## Table of Contents
{:.no_toc}

* TOC
{:toc}

## Overview

The Catapult Content Test Suite (CTS) is a web application for content developers and testers who need to verify that
their content is conformant with the [cmi5 specification](https://aicc.github.io/CMI-5_Spec_Current/). This guide is
for those users. Other types of cmi5 users, particularly learners, do not need to use the CTS.

The [Tutorial](#tutorial) section will guide you through signing into the CTS for the first time, adding a course,
testing it, and downloading the test report. The [Reference](#reference) section goes into more details about
different parts of the application.

### Other Resources

* [cmi5 Resources](https://www.adlnet.gov/resources/cmi5-resources/) from ADL Initiative
* [cmi5 CATAPULT!](https://adlnet.gov/projects/cmi5-CATAPULT/)
* Best Practices Guide
* Example Content
* CTS Deployment Guide

## Tutorial

This tutorial will guide you through your first steps using the Catapult CTS. It covers signing in, importing a
course, starting a conformance test, and launching assignable units (AUs). Before working through this tutorial, you
should have access to an instance of the CTS web application. If there is not a hosted instance available for your
use, you may wish to host a local instance on your own computer. See the [CTS deployment guide](#) for more
information.

### Signing In

To use the Catapult CTS, you must first sign in. The username and password that you use to do this will depend on
whether you're using a local instance of the CTS on your own computer, or a hosted instance that someone else is
administering.

**If you are using a local instance of the CTS:** You will be prompted to provide a username and password the first
time that you attempt to sign in. Enter a new username and password, then click the "Initialize First User" button to
proceed to the sign in page.

<figure>
  <img src="{{ '/cts/img/first_user.png'| relative_url }}" />
  <figcaption>Creating an initial user.</figcaption>
</figure>

**If you are using a hosted instance of the CTS:** Your system administrator will provide you with a username and
password, and the address of the instance's sign in page.

**Once you have your username and password:**

1. Go to the sign in page URL in your web browser.
2. Enter your username and password.
3. Click the "Sign In" button.

<figure>
  <img src="{{ '/cts/img/sign_in.png'| relative_url }}" />
  <figcaption>Signing in to the CTS.</figcaption>
</figure>

After logging in, you should see a navigation bar at the top of the browser window. On the right side of the
navigation bar are three buttons: "New Course", "New Test", and the round "User" button.

<figure>
  <img src="{{ '/cts/img/navbar.png'| relative_url }}" />
  <figcaption>The top navigation bar.</figcaption>
</figure>

**To sign out of the Catapult CTS:** Click the round "User" button on the top navigation bar, then select "Sign Out"
from the drop-down menu.

<figure>
  <img src="{{ '/cts/img/sign_out.png'| relative_url }}" />
  <figcaption>Signing out of the CTS.</figcaption>
</figure>

### Adding a Course

After signing in, you're now able to add a course to the CTS for testing. To do this, click the "New Course" button on
the top navigation bar, which will open the New Course page. From here, you can upload a cmi5 course package or a
cmi5.xml course structure file.

<figure>
  <img src="{{ '/cts/img/new_course_view.png'| relative_url }}" />
  <figcaption>The New Course page.</figcaption>
</figure>

**If there are any problems with your course package or cmi5.xml file:** the CTS will display an error message with
details about the problem.

<figure>
  <img src="{{ '/cts/img/new_course_error.png'| relative_url }}" />
  <figcaption>An error message.</figcaption>
</figure>

**If your course imports successfully:** You'll be taken to the course details page for your new course. At the top of
the page, underneath the navigation bar, you'll find the course title and some metadata about the course. To the
right, you'll find "Test" and "Delete" buttons. Below, you'll find two tabs. On the first tab, called "Conformance
Tests", you'll find an empty table that will contain all of the test registrations that you create for this course.

<figure>
  <img src="{{ '/cts/img/course_details_no_tests.png'| relative_url }}" />
  <figcaption>A course details page, with the Conformance Tests tab visible.</figcaption>
</figure>

### Testing

**To start a test from the course details page:** Click the "Test" button in the upper right corner of the
screen. You'll be taken to a page where you can create the xAPI actor object for your test registration. Either
provide values for the form fields, or click the "Randomize" button to have the CTS generate values for you. When
you're done, click the "Continue" button.

<figure>
  <img src="{{ '/cts/img/new_test_registration.png'| relative_url }}" />
  <figcaption>Creating a new test registration with a random xAPI actor.</figcaption>
</figure>

On the Conformance Test page, you'll see information about the course and registration, followed by a configuration
section where you can adjust the cmi5 Agent Profile values. Underneath that you will find cards for each Assignable
Unit within the course. This is where you will launch or waive each AU, and see their cmi5 conformance status.

On the right side of the page, you'll see a Test Report. This will be filled in as you progress through each AU in the
course. When you're finished, you may click the "Download" button to download a file containing a record of your test
session.

<figure>
  <img src="{{ '/cts/img/test_session_initial.png' | relative_url }}" />
  <figcaption>A Conformance Test session, before any AUs have been launched.</figcaption>
</figure>

**To test an AU:** Under most circumstances, you can just click the "Launch" button in the AU's card. This will start
a normal launch with configuration settings from the course structure. If you need to launch the AU in "browse" or
"review" mode, or use different configuration settings, that is also possible. See [Test Details](#test-details) in
the Reference section for more information.

When you launch an AU, you'll see the content in an iframe or a new window (depending on the course structure and
configuration) alongside a running log of statements and other session events that will be updated as you progress
through the AU. You'll also see a "Close" button that will return you to the Conformance Test page, and an "Abandon"
button that will issue an abandoned statement and cause any subsequent statements from the AU to be rejected.

<figure>
  <img src="{{ '/cts/img/au_session.png' | relative_url }}" />
  <figcaption>An AU test session, showing the content and an event log.</figcaption>
</figure>

**After testing an AU:** If the AU performed all the required actions, and didn't do anything forbidden by the cmi5
specification, then a green checkmark will appear next to the AU's title in the Test Report, and in its card in the
Assignable Units list. Otherwise, a red X will appear instead. In either case, the Test Report's registration log will
have an "AU Launched" entry that you may click on to review the event log for the AU session.

<figure>
  <img src="{{ '/cts/img/test_session_passed.png' | relative_url }}" />
  <figcaption>A Conformance Test session, showing a conformant AU and course.</figcaption>
</figure>

**Next steps:** If your course consists of multiple AUs, then test each of them in the same manner. After you've
finished, click the Test Report's "Download" button to download a record of the conformance test. You may be asked to
provide this file as proof of the course's cmi5 conformance.

## Reference

This reference covers every aspect of the CTS user interface, starting with some common UI elements that are used
throughout the application, followed by descriptions of each of the application's sections.

### Common User Interface Elements

#### Navigation Bar

The navigation bar provides quick access to the CTS's home page, as well as the ability to add a new course or start a
new test from anywhere in the application. Its components are (from left to right):

- **Catapult Logo:** A bit of branding to visually identify the CTS as part of the Catapult project.
- **Home:** Clicking this link will take you to the [Course List](#course-list), where you can see a list of all
  imported courses and their cmi5 conformance status.
- **New Course:** Clicking this button will take you to the [New Course](#new-course) page, where you can upload a
  course package, or paste and edit cmi5 course structure XML.
- **New Test:** Clicking this button will open a course selector drop-down, which you can use to start a [new
  test](#new-test) from anywhere in the application. You can also start new tests from the [Course List](#course-list)
  and [Course Details](#course-details) pages.
- **User Button:** Clicking this round, light blue button will open a drop-down menu with options to view a list of
  cmi5 specification requirements, or to sign out of the CTS.

<figure>
  <img src="{{ '/cts/img/navbar.png'| relative_url }}" />
  <figcaption>The navigation bar, showing (from left to right) the Catapult logo, Home link, New Course button,
  New Test button, and User button.</figcaption>
</figure>

#### Test Result Indicators

The CTS used a combination of symbol, color, and (when space allows) text to indicate the result of conformance
testing for assignable units (AUs), blocks, and courses. These test result indicators are used by the [Course
List](#course-list) and [Test Details](#test-details) pages, among others. The different types of indicator are as
follows:

- **Conformant:** This test result indicator is a white checkmark on a green background. For AUs, it means that every
  requirement of the cmi5 specification has been met, and the AU as been satisfied according to its "moveOn"
  criteria. For blocks and courses, it means that all of the child AUs and blocks have been tested and are conformant.
- **Non-conformant:** This test result indicator is a white "X" on a red background. For AUs, it means that some
  requirement of the cmi5 specification was not met. For blocks and courses, it means that a child AU has been tested
  and was not conformant.
- **Not Started:** This test result indicator is a white "-" on a black background. For AUs, it means that the AU has
  not yet been tested. For blocks and courses, it means that no child AUs have been tested.
- **Result Pending:** This test result indicator is a white "?" on a black background. For AUs, it means that the AU
  has been launched and (so far) hasn't violated any of the cmi5 specification requirements, but also hasn't been
  satisfied according to its "moveOn" criteria. For blocks and courses, it means that at least one child AU has been
  launched, but more testing is required.
- **Unrecognized:** This test result indicator is a white "?" on a grey background. It means that there was a problem
  with loading the test status. If you see this on the Course List page, try using the "Reload" button. Otherwise, try
  refreshing the browser window.

<figure>
  <img src="{{ '/cts/img/test_results.png'| relative_url }}" />
  <figcaption>The different test result indicators, shown with labels.</figcaption>
</figure>

### Course Details

*Accessed by: clicking a course's title in the [Course List](#course-list), or creating a [New Course](#new-course).*

At the top of the Course Details page, you'll see a heading with the course's title, followed by its LMS ID (generated
by the CTS) and Publisher ID (from the course structure), and how long ago the course was imported into the CTS.

To the right of the title and metadata are two buttons:

- **Test**: Clicking this button will begin a [new test](#new-test) for the course.
- **Delete**: Clicking this button will open a confirmation message with a warning that deleting a course will also
  delete all associated test data, and options to continue or cancel.

<figure>
  <img src="{{ '/cts/img/course_details_tests.png'| relative_url }}" />
  <figcaption>Two tests on the Conformance Tests tab.</figcaption>
</figure>

<figure>
  <img src="{{ '/cts/img/course_details_structure.png' | relative_url }}" />
  <figcaption>The Course Structure tab, with an AU selected.</figcaption>
</figure>

### Course List

*Accessed by: clicking the "Home" link on the navigation bar.*

The Course List is the CTS's home page, and it shows you every course that you have imported. It gives summary
information about each course, as well as links to [Course Details](#course-details) and [Test
Details](#test-details). The list has the following columns:

- **Title:** The course's title, which is also a link to its [Course Details](#course-details) page.
- **Test Result:** The result of the course's most recent conformance test (or "Not Started").
- **Imported:** How long ago the course was imported.
- **Last Tested:** How long ago the course was last tested (or "Never"). If the course has been tested, then this will
  be a link to the [Test Details](#test-details) page.

Clicking any of those four column headers will sort the list. Clicking a second time will reverse the sort order.

<figure>
  <img src="{{ '/cts/img/course_list.png'| relative_url }}" />
  <figcaption>The Course List, sorted by title in ascending order.</figcaption>
</figure>

The list also has an "Actions" column with two buttons:

- **Test**: Clicking this button will begin a [new test](#new-test) for the course.
- **Delete**: Clicking this button will open a confirmation message with a warning that deleting a course will also
  delete all associated test data, and options to continue or cancel.

<figure>
  <img src="{{ '/cts/img/delete_course.png'| relative_url }}" />
  <figcaption>The confirmation message that is shown when you click a course's "Delete" button.</figcaption>
</figure>

Above the list itself, you'll find a drop-down selector to control how many courses appear on each page. If more than
the selected number of courses have been imported, a page selector will appear next to the drop-down. To the right of
the paging controls there is a "Reload" button that will refresh the course list with the most up-to-date information
from the server.

### New Course

*Accessed by: clicking the "New Course" button on the navigation bar.*

The New Course page has two tabs, one for each method of importing courses into the CTS.

**The File Upload tab:** This method is described in [the tutorial](#adding-a-course). The cmi5 specification
describes the types of files that may be imported ([Section 14.0 Course
Package](https://github.com/AICC/CMI-5_Spec_Current/blob/quartz/cmi5_spec.md#140-course-package)). In summary, the
file must be a standalone XML file, or a ZIP file with a cmi5.xml file in its root directory. The ZIP file may
optionally contain other course assets as well.

<figure>
  <img src="{{ '/cts/img/new_course_view.png'| relative_url }}" />
  <figcaption>The File Upload tab on the New Course page.</figcaption>
</figure>

If there is anything wrong with the uploaded file, or if the course structure is invalid, the CTS will let you know
with an error message.

**The XML Editor tab:** With this method, you can copy and paste course structure XML from another application (say, a
text editor) into a text field, then click the "Import" button. If the XML isn't valid, you'll see an error message
describing the problem, which you can then correct right in the CTS. *Note: When you import a course using the XML
editor, all AU launch URLS must be fully qualified.*

<figure>
  <img src="{{ '/cts/img/xml_editor_error.png'| relative_url }}" />
  <figcaption>The XML Editor tab on the New Course page, showing an error message.</figcaption>
</figure>

### New Test

*Accessed by: clicking the "New Test" button on the [navigation bar](#navigation-bar) and selecting a course from the
drop-down menu, clicking the "Test" button next to a course in the [Course List](#course-list), or clicking the "Test"
button on a [Course Details](#course-details) page.*

*To resume a test that you've previously started, see [Course Details](#course-details).*

At the top of the New Test page, you'll see a heading with the course's title, followed by its LMS ID (generated by
the CTS) and Publisher ID (from the course structure).

Beneath the heading and metadata is a form where you can provide values for the xAPI actor that will be used for the
test registration. Clicking the "Randomize" button will populate the form with valid values. If you wish to provide
your own values, the fields are as follows:

- **Name:** This is supposed to be the full name of the actor, but you may provide any value that you like. The name
  will appear in the test list on the [Course Details](#course-details) page.
- **Account homepage:** For cmi5 launches from a traditional LMS, this would be the canonical homepage URL for the
  system that the learner signs into. You may provide any valid URI.
- **Account name:** A unique ID or username for the account. As with the "Name" field, you may provide any value that
  you like.

<figure>
  <img src="{{ '/cts/img/new_test_registration.png'| relative_url }}" />
  <figcaption>Creating a new test registration with a random xAPI actor.</figcaption>
</figure>

After clicking the "Continue" button, you'll be taken to the [Test Details](#test-details) page for your new test.

### Requirements List

*Accessed by: clicking the round "User" button on the navigation bar, then selecting "Spec Requirements" from the
drop-down menu.*

The Requirements List provides in-app access to the cmi5 specification requirements. Each requirement has an
identifier based on the specification section that it comes from. For example, requirements 8.1.1.0-1 through
8.1.1.0-3 have to do with the "endpoint" launch parameter that is defined in [section
8.1.1](https://github.com/AICC/CMI-5_Spec_Current/blob/quartz/cmi5_spec.md#811-endpoint).

You may filter the list by identifier or by text.

<figure>
  <img src="{{ '/cts/img/requirements.png'| relative_url }}" />
  <figcaption>The Requirements List, filtered to show only requirements containing the text "AU MUST".</figcaption>
</figure>

### Test Details

#### AU Session
