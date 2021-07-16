# @cmi5/requirements

This package is intended to track the requirements of the [cmi5 specification](https://github.com/AICC/CMI-5_Spec_Current) in a JSON file. There are two types of requirements in the file--explicit and derived. Explicit requirements are numbered based on their section in the specification followed by an ordered index of where the requirement is positioned in the section. (Note: due to potential changes in the specification over time the index order may not be true to the specification beyond the initial starting point.) Derived requirements are numbered based on the explicit requirement from which they are derived followed by a suffix of ` (d#)`.

## Install

    npm install @cmi5/requirements

## Usage

The `requirements.json` JSON file provides a structure with an object at the top level. That object contains a property for each requirement (and derived requirements) that have as their value an object with a single `txt` property that is the wording from the specification itself.
