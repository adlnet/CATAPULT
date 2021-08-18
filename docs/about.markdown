---
layout: page
title: About CATAPULT
permalink: /about/
---

CATAPULT (cmi5 Advanced Testing Application and Player Underpinning Learning Technologies) is a project funded by ADL
to develop tools and resources to support the adoption of cmi5 and xAPI across the Department of Defense (DoD)
enterprise. The cornerstone tool within this project is the development and delivery of cmi5 Prototype Software (PTS)
including a cmi5 player test suite, a cmi5 player and a cmi5 Content Test Suite (CTS). The objectives for the PTS are
to provide to the DoD a conformance test suite to validate existing products and applications for cmi5 support (CTS)
and to enable DoD entities to develop and implement cmi5 using the cmi5 player.  The software design requirements
outlined in this document address what is required, at a minimum to, build and deliver the cmi5 PTS, and reflects the
input and requirements gathered from interviews with key DoD stakeholders (DSRs) and the cmi5 working group community.
Based on these inputs, and experience developing software that supports the cmi5 specification, we have outlined the
requirements necessary to develop a successful cmi5 PTS to achieve the following:

* Provide a cmi5 player that will enable DoD entities to develop and implement tools to play cmi5 content.
* Support DoD procurement efforts by providing a conformance test suite to validate existing products and applications
  conformance to the cmi5 specification to comply with DoD instruction 1322.26, in line with similar SCORM and xAPI
  conformance testing tools.
* Deliver a player test suite to allow DoD entities and LMS vendors assess and validate conformance to the cmi5
  specification.
* Deliver a content testing suite that provides a mechanism for content creators, publishers and rapid content
  development tools to test and validate that the content is conformant to the cmi5 specification.
* Provide resources to LMS vendors, content providers, and other industry members to incorporate support for cmi5 in
  their products and validation of conformance.

## Project Background

Developed nearly two decades ago, SCORM is a set of interoperability standards for packaging and delivering online
courses via web-browsers and Learning Management Systems (LMSs). However, SCORM is not extensible enough to support
the myriad of technologies used in modern learning environments and SCORM does not provide sufficient guidance for
capturing robust, interoperable learner performance data. Department of Defense (DoD) Instruction 1322.26
(“Distributed Learning”) recommends the Experience Application Programming Interface (xAPI) data specification as the
contemporary method for managing learner-performance data, and while xAPI and SCORM can be implemented together, a
more modern approach to content packaging and delivery is warranted.

The cmi5 specification defines a set of rules for how online courses are imported, launched, and tracked using an LMS
and xAPI. Technically, cmi5 is an xAPI Profile, which means it inherits all of the characteristics mandated by the
xAPI specification, but cmi5 also imposes additional requirements. These include interoperability rules for content
launch, authorization, session management, reporting, and course structuring. The cmi5 specification also enables the
packaging and delivery of distributed learning resources that sit outside of a web-browser (e.g., mobile apps,
simulation content). The cmi5 specification could play an important role in the DoD’s modernization, facilitating
progress from SCORM-based LMS-centric courseware to a distributed learning “ecosystem” that delivers diverse learning
opportunities across a range of federated platforms. However, the DoD has not yet acquired cmi5-based content because
(a) there are a lack of LMSs and authoring tools that support cmi5, and (b) there is no software conformance test
suite for validating whether courseware or platforms adhere to the cmi5 specification.
