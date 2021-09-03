# Project CATAPULT

This repository contains the artifacts of ADL's Project CATAPULT. The resources here are intended to increase the adoption of [cmi5](https://github.com/AICC/CMI-5_Spec_Current) by providing resources and tools needed by developers, instructional designers, and procurement personnel.

## Player

The `player/` houses the implementation of a prototype web service intended to be integrated into an LMS to provide the cmi5 launching system capabilities. It leverages an external LRS for xAPI requirement handling, but otherwise provides all validation, import, launch and other required functionality.

## Content Test Suite

The `cts/` contains the implementation of a web service and web browser UI application that when used together enables end user testing of cmi5 packages. This application is targeted at instructional designers, content authoring tool developers, and learning content procurers. It also provides an example integration with the Player prototype.

## LMS Test Suite

The `lts/` contains the implementation of a test suite used to validate the implementation of a cmi5 launching system within an LMS system. It contains a package library, manual test procedure document, and an automatable tool for LMS developers to use via their CI system.

## Requirements

The artifact of `requirements/` is a JSON file that can be leveraged by systems to easily map from requirement identifiers to the specification language. It is made publicly available via [npm's public registry](https://www.npmjs.com/package/@cmi5/requirements).

## Course Examples

The `course_examples/` is a collection of cmi5 course packages modelling potential approaches to various aspects of cmi5 implementation for content.

## Documentation

The `docs/` contains the source files for building the [documentation site](https://adlnet.github.io/CATAPULT/). It contains user guides for using the tools, etc.
