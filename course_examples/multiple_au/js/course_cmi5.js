const
    XAPI_VERSION = "1.0.3",
    SUSPEND_DATA_KEY = "suspendData";

function CourseCmi5Plugin() {
    this.cmi5 = null;
    this.passingScore = Number.NaN;
}

CourseCmi5Plugin.prototype.initialize = function (callbackOnInit) {
    // Cmi5.enableDebug();

    this.cmi5 = new Cmi5(document.location.href);
    if (!this.cmi5.getEndpoint()) {
        this.cmi5 = null;
    } else {
        this.cmi5.start({
            launchData: function (err) {
                if (err) {
                    console.log("error occurred fetching launchData", err);
                    alert("Unable to retrieve launch data, reason: " + err);
                }

                let masteryScore = this.cmi5.getMasteryScore();
                if (masteryScore !== null) {
                    this.passingScore = parseFloat(masteryScore);
                }
            }.bind(this),
            initializeStatement: function (err) {
                if (err) {
                    console.log("error occurred sending initialized statement", err);
                    alert("Unable to initialize, reason: " + err);
                } else {
                    callbackOnInit();
                }
            }.bind(this)
        });
    }
}

CourseCmi5Plugin.prototype.getEndpoint = function () {
    let endpoint = this.cmi5.getEndpoint();
    if (endpoint[endpoint.length - 1] !== "/") {
        endpoint = endpoint + "/";
    }
    return endpoint;
}

CourseCmi5Plugin.prototype.getActivityState = function (stateId) {
    return fetch(
        this.getEndpoint() + "activities/state?" + new URLSearchParams(
        {
            stateId: stateId,
            activityId: this.cmi5.getActivityId(),
            agent: JSON.stringify(this.cmi5.getActor()),
            registration: this.cmi5.getRegistration()
        }
        ),
        {
            mode: "cors",
            method: "get",
            headers: {
                "X-Experience-API-Version": XAPI_VERSION,
                Authorization: this.cmi5.getAuth()
            }
        }
    ).then(response => {
        if (response.status === 200) {
            return response.json();
        } else {
            return Promise.resolve("");
        }
    }).catch(ex => {
        throw new Error(`Failed to GET activity state: ${ex}`);
    });
}

CourseCmi5Plugin.prototype.setActivityState = function (stateId, data) {
    return fetch(
        this.getEndpoint() + "activities/state?" + new URLSearchParams(
        {
            stateId: stateId,
            activityId: this.cmi5.getActivityId(),
            agent: JSON.stringify(this.cmi5.getActor()),
            registration: this.cmi5.getRegistration()
        }
        ),
        {
            mode: "cors",
            method: "put",
            headers: {
                "X-Experience-API-Version": XAPI_VERSION,
                Authorization: this.cmi5.getAuth(),
                Accept: "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        }
    ).then(response => {
        if (response.status === 200) {
            return response.json();
        }
        return Promise.resolve("");
    }).catch(ex => {
        throw new Error(`Failed to GET activity state: ${ex}`);
    });
}

CourseCmi5Plugin.prototype.getBookmark = function () {
    return this.getActivityState(SUSPEND_DATA_KEY).then(bookmarkObj => {
        if (bookmarkObj && bookmarkObj["bookmark"]) {
            return Promise.resolve(bookmarkObj["bookmark"]);
        } else {
            return Promise.resolve("");
        }
    });
}

CourseCmi5Plugin.prototype.setBookmark = function (bookmark) {
    return this.setActivityState(SUSPEND_DATA_KEY, {"bookmark": bookmark});
}

CourseCmi5Plugin.prototype.captureCompletionStatus = function (userScoreObj, passingScore) {
    if (!this.cmi5) {
        return;
    }

    if (!isNaN(this.passingScore)) {
        if (userScoreObj["scaled"] > this.passingScore) {
            this.cmi5.passed(userScoreObj).then(function () {
                this.cmi5.completed();
            }.bind(this));
        } else {
            this.cmi5.failed(userScoreObj).then(function () {
                this.cmi5.completed();
            }.bind(this));
        }
    } else {
        this.cmi5.passed(userScoreObj).then(function () {
            this.cmi5.completed();
        }.bind(this));
    }
}

CourseCmi5Plugin.prototype._exitRedirect = function () {
    if (this.cmi5.getReturnURL()) {
        document.location.href = this.cmi5.getReturnURL();
    }
}

CourseCmi5Plugin.prototype.exit = function () {
    if (this.cmi5) {
        this.cmi5.terminate().then(function () {
            if (window.opener) {
                try {
                    window.close();
                } catch (e) {
                    this._exitRedirect();
                }
            } else {
                this._exitRedirect();
            }
        }.bind(this));
    } else {
        if (window.opener) {
            try {
                window.close();
            } catch (e) {
            }
        }
    }
}

CourseCmi5Plugin.prototype.interactionCapture = function (interactionObj) {
    if (!this.cmi5) {
        return;
    }

    let stmt = this.cmi5.prepareStatement("http://adlnet.gov/expapi/verbs/answered");
    stmt.result = {
        response: interactionObj.userAnswers.join("[,]")
    }
    if (typeof interactionObj.success !== "undefined") {
        stmt.result.success = !!interactionObj.success;
    }
    stmt.object = {
        objectType: "Activity",
        id: this.cmi5.getActivityId() + "/test/" + interactionObj.testId + "/question/" + interactionObj.interactionId,
        definition: {
            type: "http://adlnet.gov/expapi/activities/cmi.interaction",
            interactionType: interactionObj.interactionType,
            name: {"en-US": interactionObj.name},
            correctResponsesPattern: [interactionObj.correctAnswers.join("[,]")]
        }
    };
    if (interactionObj.description) {
        stmt.object.definition.description = {"en-US": interactionObj.description};
    }
    if (interactionObj.choices) {
        stmt.object.definition.choices = interactionObj.choices;
    }
    this.cmi5.sendStatement(stmt);
}

CourseCmi5Plugin.prototype._videoMakeStatement = function (videoObj, verb) {
    let stmt = this.cmi5.prepareStatement(verb.id);
    if (verb.display) {
        stmt.verb.display = verb.display;
    }
    stmt.object = {
        "definition": {
            "type": "https://w3id.org/xapi/video/activity-type/video",
            "name": {
                "en-US": videoObj.name
            }
        },
        "id": videoObj.objectId,
        "objectType": "Activity"
    };
    stmt.result = stmt.result || {};
    stmt.result.extensions = stmt.result.extensions || {};
    stmt.context.contextActivities = stmt.context.contextActivities || {};
    stmt.context.contextActivities.category = stmt.context.contextActivities.category || [];
    stmt.context.contextActivities.category.push({"id": "https://w3id.org/xapi/video"});
    stmt.context.extensions = stmt.context.extensions || {};
    stmt.context.extensions["https://w3id.org/xapi/video/extensions/session-id"] = videoObj.session;
    stmt.context.extensions["https://w3id.org/xapi/video/extensions/length"] = videoObj.videoLength;

    if (videoObj.hasOwnProperty("currentTime")) {
        stmt["result"]["extensions"]["https://w3id.org/xapi/video/extensions/time"] = videoObj.currentTime;
    }
    if (videoObj.hasOwnProperty("progress")) {
        stmt["result"]["extensions"]["https://w3id.org/xapi/video/extensions/progress"] = videoObj.progress;
    }
    if (videoObj.hasOwnProperty("completion")) {
        stmt["result"]["completion"] = videoObj.completion;
    }
    if (videoObj.hasOwnProperty("duration")) {
        stmt["result"]["duration"] = videoObj.duration;
    }
    if (videoObj.hasOwnProperty("playedSegments")) {
        stmt["result"]["extensions"]["https://w3id.org/xapi/video/extensions/played-segments"] =
            videoObj.playedSegments.map(segment => segment[0] + "[.]" + segment[1]).join("[,]");
    }
    if (videoObj.hasOwnProperty("completionThreshold")) {
        stmt["context"]["extensions"]["https://w3id.org/xapi/video/extensions/completion-threshold"] = videoObj.completionThreshold;
    }
    return stmt;
}

CourseCmi5Plugin.prototype.videoCompleted = function (videoObj) {
    if (!this.cmi5) {
        return;
    }

    let stmt = this._videoMakeStatement(videoObj, {
        "id": "http://adlnet.gov/expapi/verbs/completed",
        "display": {
            "en-US": "completed"
        }
    });
    this.cmi5.sendStatement(stmt);
}

CourseCmi5Plugin.prototype.videoInitialize = function (videoObj) {
    if (!this.cmi5) {
        return;
    }

    // A video that's been loaded must be marked as initialized for the session, exactly once.
    let stmt = this._videoMakeStatement(videoObj, {
        "id": "http://adlnet.gov/expapi/verbs/initialized",
        "display": {
            "en-US": "initialized"
        }
    });
    this.cmi5.sendStatement(stmt);
}

CourseCmi5Plugin.prototype.videoPause = function (videoObj) {
    if (!this.cmi5) {
        return;
    }

    let stmt = this._videoMakeStatement(videoObj, {
        "id": "https://w3id.org/xapi/video/verbs/paused",
        "display": {
            "en-US": "paused"
        }
    });
    this.cmi5.sendStatement(stmt);
}

CourseCmi5Plugin.prototype.videoPlay = function (videoObj) {
    if (!this.cmi5) {
        return;
    }

    let stmt = this._videoMakeStatement(videoObj, {
        "id": "https://w3id.org/xapi/video/verbs/played",
        "display": {
            "en-US": "played"
        }
    });
    this.cmi5.sendStatement(stmt);
}
