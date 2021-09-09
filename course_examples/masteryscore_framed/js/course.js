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

/**
 * Initialize a course player for display, navigation and learning capture behavior.
 *
 * @param  {Object}  opts          Course configuration parameters.
 * @param  {Array}   opts.pageList An array of page names that will be made available via navigation.
 * @param  {string}  opts.pageListQueryParam A comma-delimited list of page names that will be made available via navigation.
 * @param  {Object}  opts.trackingPlugin The learning standard plugin prototype containing methods for communicating with a learning standard.
 * @param  {boolean} opts.navigateOnLaunch When true, automatically take the learner to the first navigable content page at startup.
 * @param  {boolean} opts.navigationInjectIntoContent When true, add navigation markup as needed to content areas.
 * @param  {string}  opts.completionBehavior Indicates what learner actions cause the course to trigger a learning completion.
 * @param  {boolean} opts.enableBookmarking When true, allow course to load and save bookmarks.
 * @param  {boolean} opts.trackInteractions When true, allow learning standard storage of interaction data.
 */
function Course(opts) {
    // Make sure we know how to clean up correctly, even if we're being exited from a redirect or window closing event.
    window.addEventListener("beforeunload", event => {
        this.exit({isUnloading: true});
    });

    this.pageList = [];
    this.lastBookmark = "";
    if (opts.pageList) {
        this.pageList = opts.pageList;
    } else if (opts.pageListQueryParam) {
        this.pageList = opts.pageListQueryParam.split(",");
    } else {
        let tempPages = document.getElementsByClassName("contentpage");
        this.pageList = [];
        for (let i = 0; i < tempPages.length; i++) {
            this.pageList.push(tempPages[i].id.substr(4));
        }
    }
    this.pageViewedState = Array(this.pageList.length).fill(false);

    this.trackingPlugin = null;
    if (opts.trackingPlugin) {
        this.trackingPlugin = opts.trackingPlugin;
    } else {
        alert("A tracking plugin is required, unable to proceed. Course cannot operate, no results will be recorded.");
        return;
    }

    this.navigateOnLaunch = false;
    if (opts.hasOwnProperty("navigateOnLaunch")) {
        this.navigateOnLaunch = opts.navigateOnLaunch;
    }

    this.navigationInjectIntoContent = false;
    if (opts.hasOwnProperty("navigationInjectIntoContent")) {
        this.navigationInjectIntoContent = opts.navigationInjectIntoContent;
    }
    this.numQuestions = 0;

    this.completionBehavior = "launch";
    if (opts.completionBehavior) {
        this.completionBehavior = opts.completionBehavior;
    }

    this.enableBookmarking = false;
    if (opts.hasOwnProperty("enableBookmarking")) {
        this.enableBookmarking = opts.enableBookmarking;
    }

    this.trackInteractions = true;
    if (opts.hasOwnProperty("trackInteractions")) {
        this.trackInteractions = opts.trackInteractions;
    }

    this.currentPageIdx = 0;
    this.exitAttempted = false;
    this.passingScaledScore = 0.8;
    this.videoTrackingData = {};
    // If true, don't save interactions while saving the passed/completed, delay until explicit flush.
    this.trackingDelayInteractionSave = true;
    this.renderNavTree();

    this.trackingPlugin.initialize(this.postInit.bind(this), this.trackingActivityUpdate.bind(this));
}

/**
 * Upon the learning standard plugin indicating that the course has been correctly initialized, control is returned
 * to the course here to prepare for user engagement.  Bookmarking and launch completion both occur at this point.
 */
Course.prototype.postInit = function () {
    if (!this.trackingPlugin.canSave()) {
        document.body.classList.add("info-bar-visible");
    }

    if (this.enableBookmarking) {
        this.trackingPlugin.getBookmark().then(bookmark => {
            this.lastBookmark = bookmark;
            this.askBookmark();
        }).catch(() => {
            if (this.navigateOnLaunch) {
                this.gotoPage(0);
            }
        });
    } else if (this.navigateOnLaunch) {
        this.gotoPage(0);
    }

    if (this.completionBehavior === "launch") {
        this.pass();
    }
}

/**
 * If bookmarking is available and a bookmark exists, present the learner with a request to resume.
 * Otherwise, navigate the learner into the learning experience.
 */
Course.prototype.askBookmark = function () {
    if (this.lastBookmark) {
        document.querySelector("#bookmark-overlay .restart-button").addEventListener("click", _ => {
            this.ignoreBookmark();
        });
        document.querySelector("#bookmark-overlay .resume-button").addEventListener("click", _ => {
            this.followBookmark();
        });
        document.getElementById("bookmark-overlay").classList.add("full-overlay-visible");
    } else if (this.navigateOnLaunch) {
        this.gotoPage(0);
    }
}

/**
 * Navigate the learner to the course page represented by the bookmark from the tracking plugin.
 */
Course.prototype.followBookmark = function () {
    this.gotoPage(this.pageList.indexOf(this.lastBookmark));
    this._resolveBookmark();
}

/**
 * Perform no further bookmark actions, and start the course normally.
 */
Course.prototype.ignoreBookmark = function () {
    if (this.navigateOnLaunch) {
        this.gotoPage(0);
    }
    this._resolveBookmark();
}

Course.prototype._resolveBookmark = function () {
    document.getElementById("bookmark-overlay").classList.remove("full-overlay-visible");
}

/**
 * Helper method for generating (weak) v4 UUIDs.  Only for use to establish non-cryptographic identifiers.
 */
Course.prototype.testUUID = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Whenever the tracking plugin has a change in transmitted data, this callback will be executed and any
 * course-specific UI updates can occur.
 *
 * @param result Any successful tracking behaviors.
 * @param error  Any unsuccessful tracking behaviors.
 * @param activeStatementCount The number of outstanding tracking behaviors yet to resolve.
 */
Course.prototype.trackingActivityUpdate = function (result, error, activeStatementCount) {
    document.querySelectorAll(".exit-button").forEach(el => {
        if (activeStatementCount > 0) {
            el.disabled = "disabled";
        } else {
            el.disabled = "";
        }
    });
}

/**
 * As part of preparing a page for learner engagement, sets up all useful page-specific event behaviors.
 */
Course.prototype.addPerPageListeners = function () {
    // Waiting to make sure DOM has time to be correctly attached, even if all elements are not yet rendered.
    setTimeout(() => {
        // For every video on the page, bind a series of listeners and interaction trackers.
        let videos = document.getElementsByTagName("video");
        for (let i = 0; i < videos.length; i++) {
            let vid = videos[i];

            (videoClosure => {
                let vidName = videoClosure.dataset.name,
                    vidObject = videoClosure.dataset.objectid,
                    session = this.testUUID();

                this.videoTrackingData[vidObject] = {
                    playedSegments: [],
                    lastSeen: -1,
                    initializedTime: new Date(),
                    finished: false,
                    session: session
                };

                this.trackingPlugin.videoInitialize({
                    name: vidName,
                    objectId: vidObject,
                    currentTime: 0
                }).catch(e => {
                    this.trackingError("Unable to save video initialized statement: " + String(e));
                });

                videoClosure.parentNode.querySelectorAll(".video-start-overlay").forEach(overlay => {
                    overlay.addEventListener("click", () => {
                        overlay.classList.add("hidden");
                        videoClosure.play();
                    });
                });

                videoClosure.addEventListener("click", () => {
                    if (!this.videoTrackingData[vidObject].finished) {
                        if (videoClosure.paused) {
                            videoClosure.play();
                        } else {
                            videoClosure.pause();
                        }
                    }
                });

                videoClosure.addEventListener("play", e => {
                    this.videoTrackingData[vidObject].lastSeen = e.target.currentTime;
                    this.trackingPlugin.videoPlay({
                        name: vidName,
                        objectId: vidObject,
                        currentTime: e.target.currentTime,
                        videoLength: e.target.duration,
                        session: session
                    }).catch(e => {
                        this.trackingError("Unable to save video played statement: " + String(e));
                    });
                });

                videoClosure.addEventListener("pause", e => {
                    if (e.target.currentTime !== e.target.duration) {
                        this.videoTrackingData[vidObject].playedSegments.push([
                            this.videoTrackingData[vidObject].lastSeen, e.target.currentTime]);
                        this.trackingPlugin.videoPause({
                            name: vidName,
                            objectId: vidObject,
                            currentTime: e.target.currentTime,
                            playedSegments: this.videoTrackingData[vidObject].playedSegments,
                            progress: +(e.target.currentTime / e.target.duration).toFixed(3),
                            videoLength: e.target.duration,
                            session: session
                        }).catch(e => {
                            this.trackingError("Unable to save video paused statement: " + String(e));
                        });
                    }
                });

                videoClosure.addEventListener("ended", e => {
                    this.videoTrackingData[vidObject].playedSegments.push([
                        this.videoTrackingData[vidObject].lastSeen, e.target.currentTime]);
                    videoClosure.parentNode.querySelectorAll(".video-complete-overlay").forEach(overlay => {
                        overlay.classList.remove("hidden");
                    });
                    this.trackingPlugin.videoCompleted({
                        name: vidName,
                        objectId: vidObject,
                        currentTime: e.target.currentTime,
                        progress: 1,
                        playedSegments: this.videoTrackingData[vidObject].playedSegments,
                        completion: true,
                        duration: "PT" + e.target.currentTime + "S",
                        completionThreshold: 1.0,
                        videoLength: e.target.duration,
                        session: session
                    }).catch(e => {
                        this.trackingError("Unable to save video completed statement: " + String(e));
                    });
                });
            })(vid);
        }
    }, 1);
}

/**
 * Learner has failed the course material, perform appropriate tracking behaviors.
 *
 * @param  {Object=} scoreObj         The scored results of the learner's efforts, if relevant.
 * @param  {number}  scoreObj.scaled  The learner's scaled score, between -1.0 and 1.0.
 * @param  {number}  scoreObj.raw     The learner's raw score, between `min` and `max`.
 * @param  {number}  scoreObj.min     The lowest possible raw score that can be achieved in this course.
 * @param  {number}  scoreObj.max     The highest possible raw score that can be achieved in this course.
 */
Course.prototype.fail = function (scoreObj) {
    this.trackingPlugin.fail(scoreObj).then(() => {
        this.trackingPlugin.flushBatch();
    }).catch(e => {
        this.trackingError("Unable to save failed statement: " + String(e));
    });
}

/**
 * Learner has successfully completed the course material, perform appropriate tracking behaviors.
 *
 * @param  {Object=} scoreObj         The scored results of the learner's efforts, if relevant.
 * @param  {number}  scoreObj.scaled  The learner's scaled score, between -1.0 and 1.0.
 * @param  {number}  scoreObj.raw     The learner's raw score, between `min` and `max`.
 * @param  {number}  scoreObj.min     The lowest possible raw score that can be achieved in this course.
 * @param  {number}  scoreObj.max     The highest possible raw score that can be achieved in this course.
 */
Course.prototype.pass = function (scoreObj) {
    this.trackingPlugin.passAndComplete(scoreObj).then(() => {
        this.trackingPlugin.flushBatch();
    }).catch(e => {
        this.trackingError("Unable to save passed/completed statement: " + String(e));
    });
}

/**
 * Given a page name (not position in the page list), return the page's title.
 *
 * @param   {string} pageName  Page name (the id value without the "page" prefix).
 * @returns {string}           Page title.
 */
Course.prototype.getPageTitle = function (pageName) {
    let el = document.getElementById("page" + pageName);
    if (!el) {
        return "";
    }
    return el.dataset.title;
}

/**
 * Build the navigation menu from the existing list of pages.
 */
Course.prototype.renderNavTree = function () {
    let s = "";
    for (let i = 0; i < this.pageList.length; i++) {
        let title = this.getPageTitle(this.pageList[i]);
        s += '<li class="navmenuitem" data-pageidx="' + i + '">' + title + '</li>';
    }
    document.getElementById("navmenuitems").innerHTML = s;
}

/**
 * Do all the setup to inject the new page into the content DOM area, bind the appropriate events and do learning
 * standards tracking.
 *
 * @param    {number} pageIdx The current position in the page list to navigate to.
 * @private
 */
Course.prototype._navigatePage = function (pageIdx) {
    this.swapPageContents(pageIdx);
    this.addPerPageListeners();

    let lis = document.getElementById("navmenu").getElementsByTagName("li");
    for (let i = 0; i < lis.length; i++) {
        lis[i].classList.remove("current");
    }
    lis[pageIdx].classList.add("current");

    this.numQuestions = document.getElementById("page" + this.pageList[pageIdx]).dataset.questions;

    // If we're using completion behavior of "visited last page", then perform any standard-specific completion actions.
    if (this.completionBehavior === "last") {
        if (pageIdx >= this.pageList.length - 1) {
            this.pass();
        }
    }

    // Set the bookmark
    if (this.enableBookmarking) {
        this.trackingPlugin.setBookmark(this.pageList[pageIdx]);
    }

    // Control navigation visibility for views that require it.
    if (document.getElementById("next")) {
        if (pageIdx >= this.pageList.length - 1) {
            document.getElementById("next").classList.add("navdisabled");
            document.getElementById("next").disabled = "disabled";
        } else {
            document.getElementById("next").classList.remove("navdisabled");
            document.getElementById("next").disabled = undefined;
        }
    }
    if (document.getElementById("prev")) {
        if (pageIdx <= 0) {
            document.getElementById("prev").classList.add("navdisabled");
            document.getElementById("prev").disabled = "disabled";
        } else {
            document.getElementById("prev").classList.remove("navdisabled");
            document.getElementById("prev").disabled = undefined;
        }
    }
}

/**
 * Inject a page into the content area DOM.
 *
 * @param {number} pageIdx The current position in the page list to navigate to.
 */
Course.prototype.swapPageContents = function (pageIdx) {
    let pageName = this.pageList[pageIdx];
    let page = document.getElementById("page" + pageName);
    let s = "";
    if (this.navigationInjectIntoContent) {
        if (pageIdx > 0) {
            s += '<div class="homebar">&uarr; Previous Section</div>';
        }
    }
    s += page.innerHTML;
    if (this.navigationInjectIntoContent) {
        if (pageIdx < this.pageList.length - 1) {
            s += '<div class="footerbar">Next Section &darr;</div>';
        }
    }
    document.getElementById("content").innerHTML = s;
}

/**
 * Calculate the learner's current navigated progress through the course.  This is not related to scoring or status.
 *
 * @returns {number} A progress measure value from 0 to 100.
 */
Course.prototype.getCourseProgress = function () {
    return Math.round((this.pageViewedState.filter(x => x === true).length / this.pageViewedState.length) * 100);
}

/**
 * Perform post-navigation actions before presenting the current page to the learner.
 * @private
 */
Course.prototype._postNavigate = function () {
    window.scrollTo(0, 0);
    let content = document.getElementById("content");
    content.scrollTo(0, 0);
    content.classList.remove("changePage");

    this.pageViewedState[this.currentPageIdx] = true;
    if (document.getElementById("footer-progress-value")) {
        document.getElementById("footer-progress-value").innerHTML = String(this.getCourseProgress());
    }
    document.querySelectorAll(".navmenuitem")[this.currentPageIdx].classList.add("seen");
    this.trackingPlugin.experienced(
        this.currentPageIdx,
        this.getPageTitle(this.pageList[this.currentPageIdx]),
        this.getCourseProgress()
    ).catch(e => {
        this.trackingError("Unable to save experienced statement: " + String(e));
    });
}

/**
 * Navigate directly to the specified page index in the page list.
 *
 * @param {number} pageIdx The page index in the page list.
 */
Course.prototype.gotoPage = function (pageIdx) {
    this.currentPageIdx = pageIdx;
    this._navigatePage(this.currentPageIdx);
    this._postNavigate();
}

/**
 * Navigate to the previous available page.
 */
Course.prototype.previousPage = function () {
    this.currentPageIdx--;
    this._navigatePage(this.currentPageIdx);
    this._postNavigate();
}

/**
 * Navigate to the next available page.
 */
Course.prototype.nextPage = function () {
    this.currentPageIdx++;
    this._navigatePage(this.currentPageIdx);
    this._postNavigate();
}

/**
 * With the current page's form, determine the success or failure of the interactions contained in it.
 * Perform any related tracking behaviors surrounding interactions and completions.
 */
Course.prototype.submitAnswers = function () {
    let correct = 0;
    const pageName = this.pageList[this.currentPageIdx];
    const page = document.getElementById("page" + pageName);

    let interactionTrackingData = [];
    for (let i = 0; i < this.numQuestions; i++) {
        let statusAndData = this.checkAndPrepare(page.dataset.quizId, "q" + i);
        if (statusAndData.data) {
            interactionTrackingData.push(statusAndData.data);
        }
        if (statusAndData.isCorrect) {
            correct += 1;
        }
    }
    const scaledScore = correct / this.numQuestions;
    const rawScore = Math.floor(scaledScore * 100);
    const scoreObj = {
        scaled: scaledScore,
        raw: rawScore,
        min: 0,
        max: 100
    };

    let actualPassingScaledScore = this.passingScaledScore;
    let tmpPassingScaledScore = this.trackingPlugin.getOverridePassingScaledScore();
    if (!Number.isNaN(tmpPassingScaledScore)) {
        actualPassingScaledScore = tmpPassingScaledScore;
    }

    document.getElementById("score-panel-score").innerHTML = "" + Math.round(rawScore * 100.) / 100.;
    document.getElementById("score-panel").classList.add("full-overlay-visible");
    if (scoreObj["scaled"] >= actualPassingScaledScore) {
        document.getElementById("score-passed").classList.add("visible");
        this.pass(scoreObj);
    } else {
        document.getElementById("score-failed").classList.add("visible");
        this.fail(scoreObj);
    }

    this.trackingPlugin.captureInteractions(interactionTrackingData, {queue: this.trackingDelayInteractionSave});
}

/**
 * Given a single question/interaction on a page form, determine if it was answered correctly, and perform
 * tracking behaviors around it if appropriate.
 * @param {string} testId A unique identifier for the current page's test element, for tracking.
 * @param {string} name   The identifier of the current question.
 * @returns {Object}      isCorrect: Whether the question was answered correctly.
 *                        interactionData: Any useful data about the interaction, null if none.
 */
Course.prototype.checkAndPrepare = function (testId, name) {
    let nodes = document.getElementsByName(name);
    let success = false;
    let interactionData = null;

    if (nodes.length > 0) {
        if (nodes[0].type === "text") {
            let userAnswer = nodes[0].value;
            let correctAnswer = nodes[0].dataset.answer;
            if (userAnswer === correctAnswer) {
                success = true;
            }

            interactionData = {
                testId: testId,
                interactionType: "fill-in",
                interactionId: name,
                userAnswers: [userAnswer],
                correctAnswers: [correctAnswer],
                name: document.getElementById(name + "-question").innerHTML,
                description: "",
                success: success
            };
        } else if (nodes[0].type === "radio") {
            let failedMatch = false;
            let userAnswers = [];
            let correctAnswers = [];
            let choices = [];
            for (let i = 0; i < nodes.length; i++) {
                choices.push({
                    id: nodes[i].value,
                    description: {
                        "en-US": nodes[i].nextSibling.innerHTML
                    }
                })
                if ((nodes[i].dataset.correct === "yes" && !nodes[i].checked) ||
                    (nodes[i].dataset.correct !== "yes" && nodes[i].checked)) {
                    failedMatch = true;
                }
                if (nodes[i].checked) {
                    userAnswers.push(nodes[i].value);
                }
                if (nodes[i].dataset.correct === "yes") {
                    correctAnswers.push(nodes[i].value);
                }
            }
            if (!failedMatch) {
                success = true;
            }
            interactionData = {
                testId: testId,
                interactionType: "choice",
                interactionId: name,
                userAnswers: userAnswers,
                correctAnswers: correctAnswers,
                choices: choices,
                name: document.getElementById(name + "-question").innerHTML,
                description: "",
                success: success
            };
        } else if (nodes[0].tagName.toLowerCase() === "select") {
            let failedMatch = false;
            let userAnswers = [];
            let correctAnswers = [];
            let choices = [];
            for (let option of nodes[0].options) {
                choices.push({
                    id: option.value,
                    description: {
                        "en-US": option.innerHTML
                    }
                })
                if ((option.dataset.correct === "yes" && !option.selected) ||
                    (option.dataset.correct !== "yes" && option.selected)) {
                    failedMatch = true;
                }
                if (option.selected) {
                    userAnswers.push(option.value);
                }
                if (option.dataset.correct === "yes") {
                    correctAnswers.push(option.value);
                }
            }
            if (!failedMatch) {
                success = true;
            }

            interactionData = {
                testId: testId,
                interactionType: "choice",
                interactionId: name,
                userAnswers: userAnswers,
                correctAnswers: correctAnswers,
                choices: choices,
                name: document.getElementById(name + "-question").innerHTML,
                description: "",
                success: success
            };
        }
    }
    return {isCorrect: success, data: interactionData};
}

/**
 * Fill in all answers on the current page's form correctly.
 */
Course.prototype.autopass = function () {
    for (let i = 0; i < this.numQuestions; i++) {
        let nm = "q" + i;
        let nodes = document.getElementsByName(nm);
        if (nodes.length > 0) {
            if (nodes[0].type === "text") {
                nodes[0].value = nodes[0].dataset.answer;
            } else if (nodes[0].type === "radio") {
                for (let node of nodes) {
                    node.checked = node.dataset.correct === "yes";
                }
            } else if (nodes[0].tagName.toLowerCase() === "select") {
                for (let option of nodes[0].options) {
                    option.selected = option.dataset.correct === "yes";
                }
            }
        }
    }
}

/**
 * Fill in all answers on the current page's form incorrectly.
 */
Course.prototype.autofail = function () {
    for (let questionIdx = 0; questionIdx < this.numQuestions; questionIdx++) {
        let nm = "q" + questionIdx;
        let nodes = document.getElementsByName(nm);
        if (nodes.length > 0) {
            if (nodes[0].type === "text") {
                nodes[0].value = Math.floor(Math.random() * 199);
            } else if (nodes[0].type === "radio") {
                for (let node of nodes) {
                    if (node.dataset.correct !== "yes") {
                        node.checked = true;
                        break;
                    } else {
                        node.checked = false;
                    }
                }
            } else if (nodes[0].tagName.toLowerCase() === "select") {
                for (let option of nodes[0].options) {
                    option.selected = option.dataset.correct !== "yes";
                }
            }
        }
    }
}

/**
 * Hide the error overlay.
 */
Course.prototype.hideErrorPanel = function () {
    document.getElementById("error-message-overlay").classList.remove("full-overlay-visible");
}

/**
 * Show the error overlay.
 */
Course.prototype.showErrorPanel = function () {
    document.getElementById("error-message-overlay").classList.add("full-overlay-visible");
}

/**
 * If an error occurs while performing tracking behaviors, record it and make it available on the error panel.
 *
 * @param {string} errorMsg The text of the error retrieved from a tracking call that errored.
 */
Course.prototype.trackingError = function (errorMsg) {
    if (document.getElementById("warning-icon")) {
        document.getElementById("warning-icon").classList.add("warning-icon-visible");
    }
    document.getElementById("error-content").innerHTML = errorMsg;
}

/**
 * Exit the course, performing any necessary exit tracking behaviors.
 */
Course.prototype.exit = function (opts) {
    if (!opts) {
        opts = {};
    }
    if (!opts.hasOwnProperty("isUnloading")) {
        opts.isUnloading = false;
    }

    if (this.trackingPlugin) {
        // If we've already done the exit procedure and the window is now unloading, don't do it again.
        if (!this.exitAttempted || (this.exitAttempted && !opts.isUnloading)) {
            const lastExitAttempted = this.exitAttempted;
            this.exitAttempted = true;
            this.trackingPlugin.exit(lastExitAttempted);
        }
    } else {
        if (window.opener) {
            try {
                window.close();
            } catch (e) {
            }
        }
    }
}
