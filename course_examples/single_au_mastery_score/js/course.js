function Course(opts) {
    this.pageList = [];
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

    this.trackingPlugin = null;
    if (opts.trackingPlugin) {
        this.trackingPlugin = opts.trackingPlugin;
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

    this.currentPageIdx = 0;
    this.passingScore = 0.8;
    this.videoTrackingData = {};
    this.renderNavTree();

    if (this.trackingPlugin) {
        this.trackingPlugin.initialize(this.postInit.bind(this));
    } else {
        this.postInit();
    }
}

Course.prototype.postInit = function () {
    if (this.trackingPlugin && this.enableBookmarking) {
        this.trackingPlugin.getBookmark().then(bookmark => {
            if (bookmark && confirm("Would you like to return to your bookmark?")) {
                this.gotoPage(this.pageList.indexOf(bookmark));
            } else if (this.navigateOnLaunch) {
                this.gotoPage(0);
            }
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

Course.prototype.testUUID = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

Course.prototype.addPerPageListeners = function () {
    // Waiting to make sure DOM has time to be correctly attached, even if all elements are not yet rendered.
    setTimeout(() => {
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
                });

                videoClosure.parentNode.querySelectorAll(".video-start-overlay").forEach(overlay => {
                    overlay.addEventListener("click", e => {
                        overlay.classList.add("hidden");
                        videoClosure.play();
                    });
                });

                videoClosure.addEventListener("click", e => {
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
                    });
                });
            })(vid);
        }
    }, 1);
}

Course.prototype.pass = function (scoreObj) {
    this.trackingPlugin.captureCompletionStatus(scoreObj, this.passingScore);
}

Course.prototype.renderNavTree = function () {
    let s = "";
    for (let i = 0; i < this.pageList.length; i++) {
        let title = document.getElementById("page" + this.pageList[i]).dataset.title;
        s += '<li class="navmenuitem" data-pageidx="' + i + '">' + title + '</li>';
    }
    document.getElementById("navmenuitems").innerHTML = s;
}

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

Course.prototype._postNavigate = function () {
    window.scrollTo(0, 0);
    let content = document.getElementById("content");
    content.scrollTo(0, 0);
    content.classList.remove("changePage");
}

Course.prototype.gotoPage = function (pageIdx) {
    this.currentPageIdx = pageIdx;
    this._navigatePage(course.currentPageIdx);
    this._postNavigate();
}

Course.prototype.previousPage = function () {
    this.currentPageIdx--;
    this._navigatePage(course.currentPageIdx);
    this._postNavigate();
}

Course.prototype.nextPage = function () {
    this.currentPageIdx++;
    this._navigatePage(course.currentPageIdx);
    this._postNavigate();
}

Course.prototype.submitAnswers = function () {
    let correct = 0;
    let pageName = this.pageList[this.currentPageIdx];
    let page = document.getElementById("page" + pageName);

    for (let i = 0; i < this.numQuestions; i++) {
        if (this.checkAndSave(page.dataset.quizId, "q" + i)) {
            correct += 1;
        }
    }
    let scaledScore = correct / this.numQuestions;
    let rawScore = Math.floor(scaledScore * 100);
    let scoreObj = {
        scaled: scaledScore,
        raw: rawScore,
        min: 0,
        max: 100
    };
    this.trackingPlugin.captureCompletionStatus(scoreObj, this.passingScore);
    document.getElementById("scorepanelscore").innerHTML = "" + Math.round(rawScore * 100.) / 100.;
    document.getElementById("scorepanel").classList.add("scorepanelvisible");
}

Course.prototype.checkAndSave = function (testId, name) {
    let nodes = document.getElementsByName(name);
    let success = false;

    if (nodes.length > 0) {
        if (nodes[0].type === "text") {
            let userAnswer = nodes[0].value;
            let correctAnswer = nodes[0].dataset.answer;
            if (userAnswer === correctAnswer) {
                success = true;
            }

            this.trackingPlugin.interactionCapture({
                testId: testId,
                interactionType: "fill-in",
                interactionId: name,
                userAnswers: [userAnswer],
                correctAnswers: [correctAnswer],
                name: document.getElementById(name + "-question").innerHTML,
                description: "",
                success: success
            });
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
            this.trackingPlugin.interactionCapture({
                testId: testId,
                interactionType: "choice",
                interactionId: name,
                userAnswers: userAnswers,
                correctAnswers: correctAnswers,
                choices: choices,
                name: document.getElementById(name + "-question").innerHTML,
                description: "",
                success: success
            });
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

            this.trackingPlugin.interactionCapture({
                testId: testId,
                interactionType: "choice",
                interactionId: name,
                userAnswers: userAnswers,
                correctAnswers: correctAnswers,
                choices: choices,
                name: document.getElementById(name + "-question").innerHTML,
                description: "",
                success: success
            });
        }
    }
    return success;
}

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

Course.prototype.exit = function () {
    if (this.trackingPlugin) {
        this.trackingPlugin.exit();
    } else {
        if (window.opener) {
            try {
                window.close();
            } catch (e) {
            }
        }
    }
}
