---
layout: page
title: CTS User Guide
---

## Table of Contents
{:.no_toc}

* TOC
{:toc}

## Overview

The Catapult Content Test Suite (CTS) is a web application for content developers and testers who need to verify that their content is conformant with the [cmi5 specification](https://aicc.github.io/CMI-5_Spec_Current/). This guide is for those users. Other types of cmi5 users, particularly learners, do not need to use the CTS.

The [Tutorial](#tutorial) section will guide you through signing into the CTS for the first time, adding a course, testing it, and downloading the test report. The [Reference](#reference) section goes into more details about different parts of the application.

### Other Resources

* [cmi5 Resources](https://www.adlnet.gov/resources/cmi5-resources/) from ADL Initiative
* [cmi5 CATAPULT!](https://adlnet.gov/projects/cmi5-CATAPULT/)
* Best Practices Guide
* Example Content
* CTS Deployment Guide

## Tutorial

This tutorial will guide you through your first steps using the Catapult CTS. It covers signing in, importing a course, starting a conformance test, and launching assignable units (AUs). Before working through this tutorial, you should have access to an instance of the CTS web application. If there is not a hosted instance available for your use, you may wish to host a local instance on your own computer. See the [CTS deployment guide](#) for more information.

### Signing In

To use the Catapult CTS, you must first sign in. The username and password that you use to do this will depend on whether you're using a local instance of the CTS on your own computer, or a hosted instance that someone else is administering.

**If you are using a local instance of the CTS:** You will be prompted to provide a user name and password the first time that you attempt to sign in. Enter a new username and password, then click the "Initialize First User" button to proceed to the sign in page.

<figure>
  <img src="{{ '/cts/img/first_user.png'| relative_url }}" />
  <figcaption>Creating an initial user.</figcaption>
</figure>

**If you are using a hosted instance of the CTS:** Your system administrator will provide you with a username and password, and the address of the instance's sign in page.

**Once you have your username and password:**

1. Go to the sign in page URL in your web browser.
2. Enter your user name and password.
3. Click the "Continue" button.

<figure>
  <img src="{{ '/cts/img/sign_in.png'| relative_url }}" />
  <figcaption>Signing in to the CTS.</figcaption>
</figure>

After logging in, you should see a navigation bar at the top of the browser window. On the right side of the navigation bar are three buttons: "New Course", "New Test", and the round user button.

<figure>
  <img src="{{ '/cts/img/navbar.png'| relative_url }}" />
  <figcaption>The top navigation bar.</figcaption>
</figure>

**To sign out of the Catapult CTS:** Click the round user button on the top navigation bar, then select "Sign Out" from the dropdown menu.

### Adding a Course

After signing in, you're now able to add a course to the CTS for testing. To do this, click the "New Course" button on the top navigation bar, which will open the New Course view. From here, you can upload a cmi5 course package or a cmi5.xml course structure file.

<figure>
  <img src="{{ '/cts/img/new_course_view.png'| relative_url }}" />
  <figcaption>The New Course view.</figcaption>
</figure>

If there are any problems with your course package or cmi5.xml file, the CTS will display an error message with details about the problem.

<figure>
  <img src="{{ '/cts/img/new_course_error.png'| relative_url }}" />
  <figcaption>An error message.</figcaption>
</figure>

Otherwise, you'll be taken to the course details page for your new course. On the first tab, called "Conformance Tests", you'll see an empty table that will contain all of the test registrations that you create for this course. On the second tab, called "Course Structure", you'll see a tree view of the blocks and assignable units that make up the course. Clicking on those elements will show you details from the course structure.

### Testing

While you're on the course details page, click the "Test" button in the upper right corner of the screen. You'll be taken to a page where you can create the xAPI actor object for your test registration. Either provide values for the form fields, or click the "Randomize" button to have the CTS generate values for you. When you're done, click the "Continue" button.

On the Conformance Test page, you'll see information about the course and registration, followed by a configuration section where you can adjust the cmi5 Agent Profile values. Underneath that you will find cards for each Assignable Unit within the course. This is where you will launch or waive each AU, and see their cmi5 conformance status.

On the right side of the page, you'll see a Test Report. This will be filled in as you progress through each AU in the course. When you're finished, click the "Download" button to download a file containing a record of your test session.

## Reference

### The Course List

### Course Details

### Tests
