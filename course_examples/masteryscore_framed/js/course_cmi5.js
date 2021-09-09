/*
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
*/

const
    XAPI_VERSION = "1.0.3",
    SUSPEND_DATA_KEY = "suspendData",
    VERB_ANSWERED = "http://adlnet.gov/expapi/verbs/answered",
    VERB_EXPERIENCED_OBJ = {
        id: "http://adlnet.gov/expapi/verbs/experienced",
        display: {
            "en-US": "experienced"
        }
    },
    VERB_VIDEO_COMPLETED_OBJ = {
        "id": "http://adlnet.gov/expapi/verbs/completed",
        "display": {
            "en-US": "completed"
        }
    },
    VERB_VIDEO_INITIALIZED_OBJ = {
        "id": "http://adlnet.gov/expapi/verbs/initialized",
        "display": {
            "en-US": "initialized"
        }
    },
    VERB_VIDEO_PAUSED_OBJ = {
        "id": "https://w3id.org/xapi/video/verbs/paused",
        "display": {
            "en-US": "paused"
        }
    },
    VERB_VIDEO_PLAYED_OBJ = {
        "id": "https://w3id.org/xapi/video/verbs/played",
        "display": {
            "en-US": "played"
        }
    };

/**
 * Prepare the cmi5 tracking plugin.  This does not begin a cmi5 session.
 * @constructor
 */
function CourseCmi5Plugin() {
    this.cmi5 = null;
    this.passingScore = Number.NaN;
    this.activeStatements = 0;
    this.callbackOnStatementSend = null;
    this.launchMode = "";
    this.statementBatch = [];
}

/**
 * Begin a cmi5 session and send a learner "initialized" statement.
 *
 * @param {Function} callbackOnInit           Callback to call once initialization is complete.
 * @param {Function} callbackOnStatementSend  Callback to call whenever any xAPI or cmi5 statement is sent.
 */
CourseCmi5Plugin.prototype.initialize = function (callbackOnInit, callbackOnStatementSend) {
    // Cmi5.enableDebug();

    this.callbackOnStatementSend = callbackOnStatementSend;
    this.cmi5 = new Cmi5(document.location.href);
    if (!this.cmi5.getEndpoint()) {
        this.cmi5 = null;
    } else {
        this.cmi5.start({
            launchData: err => {
                if (err) {
                    console.log("error occurred fetching launchData", err);
                    alert("Unable to retrieve launch data, reason: " + err);
                }

                this.launchMode = this.cmi5.getLaunchMode();
                let masteryScore = this.cmi5.getMasteryScore();
                if (masteryScore !== null) {
                    this.passingScore = parseFloat(masteryScore);
                }
            },
            initializeStatement: err => {
                if (err) {
                    console.log("error occurred sending initialized statement", err);
                    alert("Unable to initialize, reason: " + err);
                } else {
                    callbackOnInit();
                }
            }
        });
    }
}

/**
 * If we're running in a mode where saving anything meaningful is allowed (more than initialized/terminated), return true.
 *
 * @returns {boolean} true if we can save most learner information, false if we can only initialize/terminate.
 */
CourseCmi5Plugin.prototype.canSave = function () {
    return this._shouldSendStatement();
}

/**
 * Get the xAPI endpoint for the current session.
 *
 * @return {string} URL representing the xAPI root to send xAPI data to.
 */
CourseCmi5Plugin.prototype.getEndpoint = function () {
    let endpoint = this.cmi5.getEndpoint();
    if (endpoint[endpoint.length - 1] !== "/") {
        endpoint = endpoint + "/";
    }
    return endpoint;
}

/**
 * Retrieve the activity state for this learner and registration at the given stateId.
 *
 * @param {string} stateId     The xAPI Activity State "stateId" value for the API call.
 * @return {Promise<Response>} The promise returned by the fetch call representing the xAPI request.
 */
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

/**
 * Store the data provided as an activity state for this learner and registration at the given stateId.
 *
 * @param {string} stateId     The xAPI Activity State "stateId" value for the API call.
 * @param data                 The data to store in this Activity State.
 * @return {Promise<Response>} The promise returned by the fetch call representing the xAPI request.
 */
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

/**
 * Get the learner's bookmark if one exists.
 *
 * @return {Promise<Response>} The learner's bookmark, or an empty string if no bookmark exists.
 */
CourseCmi5Plugin.prototype.getBookmark = function () {
    return this.getActivityState(SUSPEND_DATA_KEY).then(bookmarkObj => {
        if (bookmarkObj && bookmarkObj["bookmark"]) {
            return Promise.resolve(bookmarkObj["bookmark"]);
        } else {
            return Promise.resolve("");
        }
    });
}

/**
 * Save the learner's bookmark.
 *
 * @param {string} bookmark The learner's bookmark data.
 * @return {Promise<Response>} The promise returned by the fetch call representing the xAPI request.
 */
CourseCmi5Plugin.prototype.setBookmark = function (bookmark) {
    return this.setActivityState(SUSPEND_DATA_KEY, {"bookmark": bookmark});
}

/**
 * Retrieve the AU's mastery score.

 * @return {number} The AU mastery score, or Number.NaN if one was not provided.
 */
CourseCmi5Plugin.prototype.getOverridePassingScaledScore = function () {
    return this.passingScore;
}

/**
 * Learner has failed the course material, send a cmi5 defined statement indicating failure.
 *
 * @param  {Object=} userScoreObj         The scored results of the learner's efforts, if relevant.
 * @param  {number}  userScoreObj.scaled  The learner's scaled score, between -1.0 and 1.0.
 * @param  {number}  userScoreObj.raw     The learner's raw score, between `min` and `max`.
 * @param  {number}  userScoreObj.min     The lowest possible raw score that can be achieved in this course.
 * @param  {number}  userScoreObj.max     The highest possible raw score that can be achieved in this course.
 */
CourseCmi5Plugin.prototype.fail = function (userScoreObj) {
    if (!this.cmi5) {
        return Promise.resolve(null);
    }

    if (this._shouldSendStatement()) {
        return this.cmi5.failed(userScoreObj);
    }
    return Promise.resolve(null);
}

/**
 * Learner has passed the course material, send two cmi5 defined statements indicating passed and completed.
 *
 * @param  {Object=} userScoreObj         The scored results of the learner's efforts, if relevant.
 * @param  {number}  userScoreObj.scaled  The learner's scaled score, between -1.0 and 1.0.
 * @param  {number}  userScoreObj.raw     The learner's raw score, between `min` and `max`.
 * @param  {number}  userScoreObj.min     The lowest possible raw score that can be achieved in this course.
 * @param  {number}  userScoreObj.max     The highest possible raw score that can be achieved in this course.
 */
CourseCmi5Plugin.prototype.passAndComplete = function (userScoreObj) {
    if (!this.cmi5) {
        return Promise.resolve(null);
    }

    if (this._shouldSendStatement()) {
        return this._sendStatementViaLibFunction(() => {
            return this.cmi5.passed(userScoreObj).then(() => this.cmi5.completed());
        })
    }
    return Promise.resolve(null);
}

/**
 * Handle cmi5-specific exit redirect rules here around the return URL, if available.
 * @private
 */
CourseCmi5Plugin.prototype._exitRedirect = function () {
    if (this.cmi5 && this.cmi5.getReturnURL()) {
        document.location.href = this.cmi5.getReturnURL();
    }
}

/**
 * Attempt to navigate the browser or close the current window relative to whatever way the course has been launched.
 * @private
 */
CourseCmi5Plugin.prototype._exit = function () {
    if (window.opener) {
        try {
            window.close();
        } catch (e) {
            this._exitRedirect();
        }
    } else {
        this._exitRedirect();
    }
}

/**
 * Perform any tracking behaviors necessary to exit the course safely, and then navigate away from the course.
 *
 * @param  {string} alreadyAttempted true if we've tried to exit before, to avoid doing tracking behaviors that should
 *                                   not be repeated.
 */
CourseCmi5Plugin.prototype.exit = function (alreadyAttempted) {
    if (this.cmi5 && !alreadyAttempted) {
        this.cmi5.terminate().finally(() => {
            this._exit();
        });
    } else {
        this._exit();
    }
}

/**
 * Generate an xAPI "experienced" statement, tagged with the current page information.
 *
 * @param  {string} pageId          The current page ID name the learner experienced.
 * @param  {string} name            The current page name the learner experienced.
 * @param  {number} overallProgress Value from 0-100 representing percentage of the course viewed.
 * @return {Promise}                The promise from the statement network call.
 */
CourseCmi5Plugin.prototype.experienced = function (pageId, name, overallProgress) {
    if (!this.cmi5) {
        return Promise.resolve(null);
    }

    let stmt = this.cmi5.prepareStatement(VERB_EXPERIENCED_OBJ.id);
    stmt.verb.display = VERB_EXPERIENCED_OBJ.display;
    stmt.object = {
        objectType: "Activity",
        id: this.cmi5.getActivityId() + "/slide/" + pageId,
        definition: {
            name: {"en-US": name},
        }
    };
    // If we can, also save the progress value, ignore values that are out of range.
    if (!Number.isNaN(overallProgress) && overallProgress > 0 && overallProgress < 100) {
        if (!stmt.result) {
            stmt.result = {};
        }
        if (!stmt.result.extensions) {
            stmt.result.extensions = {};
        }
        stmt.result.extensions["https://w3id.org/xapi/cmi5/result/extensions/progress"] = Math.round(overallProgress);
    }
    return this.sendStatement(stmt);
}

/**
 * Generate an xAPI "answered" statement that represents the details of the learner's interaction, including success.
 *
 * @param  {Array}  interactionList A list of interaction details.
 * @param  {Object} opts            Configuration around the storage and sending of the interaction.
 * @return {Promise}                The promise from the statement network call.
 */
CourseCmi5Plugin.prototype.captureInteractions = function (interactionList, opts) {
    if (!this.cmi5) {
        return Promise.resolve(null);
    }

    if (!opts) {
        opts = {}
    }
    if (!opts.hasOwnProperty("queue")) {
        opts.queue = false;
    }

    let stmts = [];
    interactionList.forEach(interactionObj => {
        let stmt = this.cmi5.prepareStatement(VERB_ANSWERED);
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
        stmts.push(stmt);
    });
    return this.sendStatements(stmts, opts);
}

/**
 * Build a cmi5 statement that matches the xAPI video profile.
 *
 * @param  {Object} videoObj  The learner details about the video element interaction.
 * @param  {Object} verb      The video profile verb action the learner performed with the video.
 * @return {Object}           An xAPI video profile statement.
 * @private
 */
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

/**
 * Mark the current video being watched as completed.
 *
 * @param  {Object} videoObj  The learner details about the video element interaction.
 * @return {Promise}          The promise from the statement network call.
 */
CourseCmi5Plugin.prototype.videoCompleted = function (videoObj) {
    if (!this.cmi5) {
        return Promise.resolve(null);
    }

    let stmt = this._videoMakeStatement(videoObj, VERB_VIDEO_COMPLETED_OBJ);
    return this.sendStatement(stmt);
}

/**
 * Initialize the current video watching session.
 *
 * @param  {Object} videoObj  The learner details about the video element interaction.
 * @return {Promise}          The promise from the statement network call.
 */
CourseCmi5Plugin.prototype.videoInitialize = function (videoObj) {
    if (!this.cmi5) {
        return Promise.resolve(null);
    }

    // A video that's been loaded must be marked as initialized for the (video) session, exactly once.
    let stmt = this._videoMakeStatement(videoObj, VERB_VIDEO_INITIALIZED_OBJ);
    return this.sendStatement(stmt);
}

/**
 * Mark the current video being watched as paused.
 *
 * @param  {Object} videoObj  The learner details about the video element interaction.
 * @return {Promise}          The promise from the statement network call.
 */
CourseCmi5Plugin.prototype.videoPause = function (videoObj) {
    if (!this.cmi5) {
        return Promise.resolve(null);
    }

    let stmt = this._videoMakeStatement(videoObj, VERB_VIDEO_PAUSED_OBJ);
    return this.sendStatement(stmt);
}

/**
 * Mark the current video being watched as played.
 *
 * @param  {Object} videoObj  The learner details about the video element interaction.
 * @return {Promise}          The promise from the statement network call.
 */
CourseCmi5Plugin.prototype.videoPlay = function (videoObj) {
    if (!this.cmi5) {
        return Promise.resolve(null);
    }

    let stmt = this._videoMakeStatement(videoObj, VERB_VIDEO_PLAYED_OBJ);
    return this.sendStatement(stmt);
}

/**
 * Answers if the current state of the course should save cmi5 statements to a backend in the general case.
 *
 * @param  {Object=} opts
 * @return {boolean} true if the tracking plugin should save statements, false otherwise.
 * @private
 */
CourseCmi5Plugin.prototype._shouldSendStatement = function (opts) {
    if (!opts) {
        opts = {};
    }
    if (!opts.forceSend) {
        opts.forceSend = false;
    }
    return this.launchMode.toLowerCase() === "normal" || opts.forceSend;
}

/**
 * If there are buffered statements waiting to be sent, begin sending them.
 */
CourseCmi5Plugin.prototype.flushBatch = function () {
    return this._sendStatements(this.statementBatch);
}

/**
 * Buffer a cmi5 statement to be sent in the future.
 *
 * @param  {Object}  statement A cmi5 statement to save.
 * @param  {Object=} opts
 * @return {Promise} Does nothing, provided for matching interface with sendStatement.
 */
CourseCmi5Plugin.prototype.batchStatement = function (statement, opts) {
    this.statementBatch.push(statement);
    return Promise.resolve(null);
}

/**
 * Buffer cmi5 statements to be sent in the future.
 *
 * @param  {Array}   statements cmi5 statements to save.
 * @param  {Object=} opts
 * @return {Promise} Does nothing, provided for matching interface with sendStatement.
 */
CourseCmi5Plugin.prototype.batchStatements = function (statements, opts) {
    this.statementBatch = this.statementBatch.concat(statements);
    return Promise.resolve(null);
}

/**
 * Send a cmi5 statement to the LRS.
 *
 * @param  {Object}  statement A cmi5 statement to save.
 * @param  {Object=} opts      Configuration around the sending parameters of a cmi5 statement.
 * @return {Promise}          The network call attempting to save the cmi5 statement.
 */
CourseCmi5Plugin.prototype.sendStatement = function (statement, opts) {
    if (!opts) {
        opts = {};
    }
    if (!opts.forceSend) {
        opts.forceSend = false;
    }
    if (!opts.hasOwnProperty("queue")) {
        opts.queue = false;
    }
    // forceSend sends the statement even if we're in browse/review mode.  Normally should only be used
    // for initialized/terminated statements.
    if (this._shouldSendStatement(opts)) {
        if (opts.queue) {
            return this.batchStatement(statement, opts);
        } else {
            return this._sendStatement(statement);
        }
    }
    return Promise.resolve(null);
}

/**
 * Send a list of cmi5 statements to the LRS.
 *
 * @param  {Array}   statements A cmi5 statement to save.
 * @param  {Object=} opts       Configuration around the sending parameters of a cmi5 statement.
 * @return {Promise}            The network call attempting to save the cmi5 statement.
 */
CourseCmi5Plugin.prototype.sendStatements = function (statements, opts) {
    if (!opts) {
        opts = {};
    }
    if (!opts.forceSend) {
        opts.forceSend = false;
    }
    if (!opts.hasOwnProperty("queue")) {
        opts.queue = false;
    }
    // forceSend sends the statement even if we're in browse/review mode.  Normally should only be used
    // for initialized/terminated statements.
    if (this._shouldSendStatement(opts)) {
        if (opts.queue) {
            return this.batchStatements(statements, opts);
        } else {
            return this._sendStatements(statements);
        }
    }
    return Promise.resolve(null);
}

/**
 * Statement tracker sending statements and waiting for statement network calls to end, responsible for updating the
 * main course adapter whenever there's a state change.
 *
 * @param  {Object} statement A cmi5 statement to save.
 * @return {Promise}          The network call attempting to save the cmi5 statement.
 * @private
 */
CourseCmi5Plugin.prototype._sendStatement = function (statement) {
    this.activeStatements += 1;
    this.callbackOnStatementSend(null, null, this.activeStatements);
    return this.cmi5.sendStatement(statement).then(result => {
        this.activeStatements -= 1;
        if (this.callbackOnStatementSend) {
            this.callbackOnStatementSend(result, null, this.activeStatements);
        }
    }).catch(error => {
        this.activeStatements -= 1;
        if (this.callbackOnStatementSend) {
            this.callbackOnStatementSend(null, error, this.activeStatements);
        }
    })
}

/**
 * Statement tracker sending statements and waiting for statement network calls to end, responsible for updating the
 * main course adapter whenever there's a state change.
 *
 * @param  {Array} statements A list of cmi5 statements to save.
 * @return {Promise}          The network call attempting to save the cmi5 statement.
 * @private
 */
CourseCmi5Plugin.prototype._sendStatements = function (statements) {
    this.activeStatements += 1;
    this.callbackOnStatementSend(null, null, this.activeStatements);
    return this.cmi5.sendStatements(statements).then(result => {
        this.activeStatements -= 1;
        if (this.callbackOnStatementSend) {
            this.callbackOnStatementSend(result, null, this.activeStatements);
        }
    }).catch(error => {
        this.activeStatements -= 1;
        if (this.callbackOnStatementSend) {
            this.callbackOnStatementSend(null, error, this.activeStatements);
        }
    })
}

/**
 * Some statements in the cmi5 library used by this tracking plugin are themselves function calls that manage their
 * own sending state.  Use these functions instead of directly sending statements here, but still manage the same
 * callbacks and communications as done in `_sendStatement`.
 *
 * @param  {Function} statementFn A function call that should trigger a statement save.
 * @return {Promise}              The network call attempting to save the cmi5 statement.
 * @private
 */
CourseCmi5Plugin.prototype._sendStatementViaLibFunction = function (statementFn) {
    this.activeStatements += 1;
    this.callbackOnStatementSend(null, null, this.activeStatements);
    return statementFn().then(result => {
        this.activeStatements -= 1;
        if (this.callbackOnStatementSend) {
            this.callbackOnStatementSend(result, null, this.activeStatements);
        }
    }).catch(error => {
        this.activeStatements -= 1;
        if (this.callbackOnStatementSend) {
            this.callbackOnStatementSend(null, error, this.activeStatements);
        }
    })
}
