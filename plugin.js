// JavaScript Document
//=========== PLUGIN :  CODE EDITOR ==============
(function (e) {
    e.codeEditor = function (customConfig) {

        //---------- CONFIGURATION -----------
        var config = {
            holder: '',
            height: '',
            data: [],
            value: '',
            bugsData: [],
            item_selector: '',
            originalFile: {},
            modifiedFile: {},
            language: 'javascript',
            callback: {},
            notify: {},
            inlineDiff: false
        };

        $.extend(config, customConfig);

        //---------- PRIVATE VARIABLES ------------
        var holder = config.holder;
        var value = config.value;
        var bugsData = config.bugsData;
        var originalModel;
        var modifiedModel;
        var editor;
        var originalFile = config.originalFile;
        var modifiedFile = config.modifiedFile;
        var originalDataSet = {};
        var modifiedDataSet = {};
        var originalDecorationIds = [],
            modifiedDecorationIds = [];
        var language = config.language;
        var renderFixedIssue = config.fixedIssueCheck;
        var issueCriticalityArray = ['critical', 'high', 'medium', 'low', 'uncategorised', 'info'];
        var counter = 0;
        let reWrapper = '';
        //---------- PRIVATE METHODS -----------

        //---------- INITIALIZE -------------
        var init = function () {
            originalDataSet = originalFile.markerSet;
            modifiedDataSet = modifiedFile.markerSet;
            $(document).off("click", '.webui-popover-content .tags_details_popover.tags_popover .code-issues_popup');
            renderEditor();
            handleEvents();
        };

        function renderEditor() {
            editor = null;
            originalModel = null;
            modifiedModel = null;

            require.config({
                paths: {
                    'vs': 'js/external/monaco'
                }
            });
            require(['vs/editor/editor.main'], function () {

                //split view
                originalModel = monaco.editor.createModel(originalFile.file, language);
                if (!_.isEmpty(modifiedFile)) {
                    modifiedModel = monaco.editor.createModel(modifiedFile.file, language);
                }
                //Pull request view
                if (modifiedModel != null) {
                    editor = monaco.editor.createDiffEditor(holder, {
                        // You can optionally disable the resizing
                        enableSplitViewResizing: true,
                        glyphMargin: true,
                        renderSideBySide: !config.inlineDiff,
                        readOnly: true,
                        hideCursorInOverviewRuler: true,
                        disableLayerHinting: true,
                        contextmenu: false,
                        automaticLayout: true,
                        scrollBeyondLastLine: false
                    });
                    editor.setModel({
                        original: originalModel,
                        modified: modifiedModel
                    });
                    editor.updateOptions({
                        "autoIndent": true,
                        "formatOnType": true,
                        "formatOnPaste": true
                    });
                    addDecorations();
                }
                //Commits view
                else {
                    editor = monaco.editor.create(holder, {
                        value: value,
                        language: g.active_language,
                        glyphMargin: true,
                        readOnly: true,
                        hideCursorInOverviewRuler: true,
                        disableLayerHinting: true,
                        contextmenu: false,
                        minimap: {
                            enabled: false
                        },
                        automaticLayout: true,
                        scrollBeyondLastLine: false
                    });
                    editor.updateOptions({
                        "autoIndent": true,
                        "formatOnType": true,
                        "formatOnPaste": true
                    });
                    let viewZoneId = null;
                    let commitData = [];
                    //Recommendation for multiple commits
                    $.each(bugsData, function (index, value) {
                        let reData = value.recos;
                        let startCommitLine = value.target_start;
                        let bugLength = value.target_length;
                        let endCommitLine = getBugLength(bugLength, startCommitLine);
                        //Recommendations for a particular commit
                        if (reData.length) {
                            commitData.push({
                                range: new monaco.Range(startCommitLine, 1, startCommitLine, 1),
                                options: {
                                    isWholeLine: true,
                                    glyphMarginClassName: 'marker-wrapper marker-id-' + startCommitLine,
                                }
                            });
                            commitData.push({
                                range: new monaco.Range(startCommitLine, 1, endCommitLine, 1),
                                options: {
                                    isWholeLine: true,
                                    className: 'commit-bug'
                                }
                            });
                        }
                        var wrapper = $('<div/>', {
                            class: 'wrapper bug-icon'
                        });
                        var bugsIssueWrapper = $('<div/>', {
                            class: 'bugs-issue-wrapper issue-wrapper ic-bugs-filled'
                        });
                        wrapper.append(bugsIssueWrapper);
                        displayBugIcon(startCommitLine, wrapper);
                        editor.onDidScrollChange(function () {
                            displayBugIcon(startCommitLine, wrapper);
                        });
                        editor.onMouseDown(function () {
                            displayBugIcon(startCommitLine, wrapper);
                        });

                        $('.suggestion-total-number').text(reData.length);
                        $('.suggestion-current-number').text(counter + 1);
                    });
                    var decorations = editor.deltaDecorations([], commitData);
                    editor.trigger("any", 'editor.action.formatDocument');
                    editor.getAction('editor.action.formatDocument').run()
                        .then(() => {
                            if (bugsData.length) {
                                let firstBugData = _.filter(bugsData, d => (d.recos.length > 0));
                                if (firstBugData.length) {
                                    let commitstart = firstBugData[0].target_start;
                                    let commitLength = firstBugData[0].target_length;
                                    let endBugLine = getBugLength(commitLength, commitstart);
                                    if (firstBugData) {
                                        displayRE(commitstart, endBugLine);
                                    }
                                }
                            }
                            adjustWidthInnerEditor();
                        });
                    editor.onDidScrollChange(function () {
                        setTimeout(function () {
                            $('.bugs-issue-wrapper.ic-bugs-filled').off("click").on("click", function () {
                                let bugLineNum = parseInt($(this).closest('.cgmr.marker-wrapper').siblings('.line-numbers').text());
                                let closeCurrentEditor = $(this).closest('.cgmr.marker-wrapper').parents('.overflow-guard').find('.re-container');
                                let closedBugLineNum = $(closeCurrentEditor).attr('data-start-line');
                                let bugLength = getBugDataByLineNum(bugLineNum);
                                let endBugLine = getBugLength(bugLength, bugLineNum);
                                let currentZoneId = $(closeCurrentEditor).attr('monaco-view-zone');
                                editor.changeViewZones(function (changeAccessor) {
                                    changeAccessor.removeZone(currentZoneId);
                                });
                                if (bugLineNum != closedBugLineNum) {
                                    displayRE(bugLineNum, endBugLine);
                                }
                            });
                            adjustWidthInnerEditor();
                        }, 400);
                    });
                }
            });
        }

        function displayBugIcon(startCommitLine, wrapper) {
            setTimeout(function () {
                $(".commit-re-view .margin-view-overlays  .marker-wrapper.marker-id-" + startCommitLine).html(wrapper);
            }, 400)
        }

        function getBugDataByLineNum(lineNum) {
            let currentBugData = _.filter(bugsData, function (d) {
                return d.target_start == lineNum
            });
            return currentBugData[0].target_length;
        }

        function getBugLength(bugLength, bugLineNum) {
            return (bugLength > 1) ? bugLength + bugLineNum - 1 : bugLineNum;
        }

        function displayRE(lineNumber, commitLength) {
            let getEditorWidth;
            $('#view' + lineNumber).empty();
            reWrapper = $('<div/>', {
                class: 're-container',
                id: 'inner-editor' + lineNumber,
                'data-start-line': lineNumber,
                'data-commit-length': commitLength
            });
            reWrapper.html(Template.recommandationPopup());
            $("#commit_details_view").append(reWrapper);
            let domNode = document.getElementById("inner-editor" + lineNumber);
            let bugWrapperView = $('<div/>', {
                id: 'view' + lineNumber,
                class: 're-diff-editor'
            });
            getEditorWidth = $('.commit-re-view').width() - 300;

            if ($(window).width() > 1900) {
                getEditorWidth = $('.commit-re-view').width() - 350;
            }

            // if ($(window).width() <2600) {
            //     getEditorWidth = $('.commit-re-view').width() - 250;
            // }

            bugWrapperView.width(getEditorWidth + 'px')
            let scrollableInnerEditor = ($('.commit-re-view .monaco-scrollable-element').width());
            $('.commit-re-view .monaco-scrollable-element .lines-content.monaco-editor-background').width(scrollableInnerEditor);
            adjustWidthInnerEditor();
            $(domNode).find('.recommandation .code-monaco-view').append(bugWrapperView);
            let currentBugData = _.filter(bugsData, function (d) {
                return d.target_start == lineNumber
            });
            let reDiffData = currentBugData[0].recos[0];
            let reDiffContainer = document.getElementById("view" + lineNumber);
            let viewZoneId = null;
            reDiff(reDiffData, reDiffContainer);
            let reRecos = currentBugData[0].recos;
            editor.changeViewZones(function (changeAccessor) {
                viewZoneId = changeAccessor.addZone({
                    afterLineNumber: commitLength,
                    heightInLines: 16,
                    domNode: domNode
                });
            });

            //Scroll to first bug
            editor.revealLineInCenter(lineNumber);
            $(domNode).find('.close-btn-wrapper .ic-close').on("click", function () {
                var currentZoneId = $(this).closest('.re-container').attr('monaco-view-zone');
                editor.changeViewZones(function (changeAccessor) {
                    changeAccessor.removeZone(currentZoneId);
                });
            });
            reViewDisplay(reRecos, lineNumber);
        }

        function adjustWidthInnerEditor() {
            assignDynamicWidth();
            editor.getAction('editor.action.formatDocument').run()
                .then(() => {
                    assignDynamicWidth();
                });
            editor.onDidScrollChange(function () {
                assignDynamicWidth();
            });
            editor.onDidChangeCursorSelection(function () {
                assignDynamicWidth();
            });
        }

        function assignDynamicWidth() {
            let editorScrollable = $('.commit-re-view .monaco-scrollable-element');
            let innerEditorWidth = editorScrollable.find('.lines-content.monaco-editor-background').width();
            editorScrollable.find('.view-zones').width(innerEditorWidth);
            editorScrollable.find('.view-overlays').width(innerEditorWidth);
            editorScrollable.find('.view-lines').width(innerEditorWidth);
        }

        function codeLaneDisplayRE(lineNumber) {
            if (!$('#inner-editor' + lineNumber).length) {
                if ($('.re-container').length) {
                    var previousZoneId = $('.re-container').attr('monaco-view-zone');
                    editor.changeViewZones(function (changeAccessor) {
                        changeAccessor.removeZone(previousZoneId);
                    });
                }
                let bugLength = getBugDataByLineNum(lineNumber);
                let endBugLine = getBugLength(bugLength, lineNumber);
                counter = 0;
                displayRE(lineNumber, endBugLine);
            }
        }

        function reViewDisplay(reRecos, lineNumber) {
            $('.suggestion-total-number').text(reRecos.length);
            $('.suggestion-current-number').text(counter + 1);
            $('.commit-id-info .id').text(reRecos[counter].commit_id.substring(0, 7));
            $('.commit-id-info .id').prop('title', reRecos[counter].commit_id);

            $('.issue-title-info .title').html('<b>' + reRecos[counter].project_name + ":</b> ");
            $('.issue-title-info .title').append(reRecos[counter].subject);
            $('.issue-title-info .title').prop('title', reRecos[counter].subject);
            if (reRecos[counter].classification) {
                for (let index = 0; index < reRecos[counter].classification.length; index++) {
                    if (reRecos[counter].classification[index] != 'unexpected') {
                        var classificationDiv = $('<div/>', {
                            class: 'classification-tag ellipsis',
                            title: reRecos[counter].classification[index]
                        }).text(reRecos[counter].classification[index]);
                        $('.issue-classification').append(classificationDiv);
                    }
                }
            }
            if (reRecos[counter].issue_key != '' && reRecos[counter].issue_key != null) {
                $('.issue-id-info').show();
                $('.issue-id-info .title').text('Related issue: ');
                $('.issue-id-info .pull-request-id').text(reRecos[counter].issue_key);
                $(".issue-id-info .pull-request-id").attr({
                    "href": reRecos[counter].issue_link,
                    'title': reRecos[counter].issue_key
                });
            }
            $(".ic-chevron-up-filled,.ic-chevron-down-filled").css('cursor', 'pointer');
            $(".ic-chevron-down-filled").data('move', 1);
            $(".ic-chevron-up-filled").data('move', -1);
            if ($(".suggestion-total-number").text() == 1) {
                $('.stepper .up, .stepper .down').addClass('disable');
            }
            $('.stepper .down').on("click", function () {

                $('.stepper .up').removeClass('disable');
                counter = (counter + 1) % reRecos.length;
                reStepperUIRendering(counter, reRecos, lineNumber);
                if (counter + 1 == reRecos.length) {
                    $(this).addClass('disable');
                }
            });
            $('.stepper .up').on("click", function () {
                $('.stepper .down').removeClass('disable');
                counter = (counter - 1) % reRecos.length;
                reStepperUIRendering(counter, reRecos, lineNumber);
                if (counter + 1 == 1) {
                    $(this).addClass('disable');
                }
            });
        }

        function reStepperUIRendering(counterRecommendations, reRecos, lineNumber) {
            $('.suggestion-current-number').text(counterRecommendations + 1);
            $('.commit-id-info .id').text(reRecos[counterRecommendations].commit_id.substring(0, 7));
            $('.commit-id-info .id').prop('title', reRecos[counterRecommendations].commit_id);
            $('.issue-title-info .title').html('<b>' + reRecos[counter].project_name + ":</b> ");
            $('.issue-title-info .title').append(reRecos[counterRecommendations].subject);
            $('.issue-title-info .title').prop('title', reRecos[counterRecommendations].subject);
            $('.issue-classification').html('');
            $("#view" + lineNumber).empty();
            let reDiffContainer = document.getElementById("view" + lineNumber);
            reDiff(reRecos[counterRecommendations], reDiffContainer);
            if (reRecos[counterRecommendations].classification) {
                for (let index = 0; index < reRecos[counterRecommendations].classification.length; index++) {
                    if (reRecos[counterRecommendations].classification[index] != 'unexpected') {
                        var classificationTag = $('<div/>', {
                            class: 'classification-tag ellipsis',
                            title: reRecos[counterRecommendations].classification[index]
                        }).text(reRecos[counterRecommendations].classification[index]);
                        $('.issue-classification').append(classificationTag);
                    }
                }
            }
            if (reRecos[counterRecommendations].issue_key != '' && reRecos[counterRecommendations].issue_key != null) {
                $('.issue-id-info').show();
                $('.issue-id-info .title').text('Related issue: ');
                $('.issue-id-info .pull-request-id').text(reRecos[counterRecommendations].issue_key);
                $(".issue-id-info .pull-request-id").attr({
                    "href": reRecos[counterRecommendations].issue_link,
                    'title': reRecos[counterRecommendations].issue_key
                });
            } else {
                $('.issue-id-info').hide();
            }
        }

        function reDiff(reDiffData, reDiffContainer) {
            var originalModelRE = monaco.editor.createModel(reDiffData.diff.prev_raw, g.active_language);
            var modifiedModelRE = monaco.editor.createModel(reDiffData.diff.curr_raw, g.active_language);
            var diffEditor = monaco.editor.createDiffEditor(reDiffContainer, {
                enableSplitViewResizing: false,
                automaticLayout: true,
                readOnly: true,
                hideCursorInOverviewRuler: true,
                disableLayerHinting: true,
                contextmenu: false,
                // Render the diff inline
                renderSideBySide: true,
                // lineNumbers: "off",
                scrollBeyondLastLine: false,
            });
            diffEditor.updateOptions({
                "autoIndent": true,
                "formatOnType": true,
                "formatOnPaste": true
            });
            diffEditor.setModel({
                original: originalModelRE,
                modified: modifiedModelRE
            });
        }

        function addDecorations() {
            let rangeArrayOriginal = [];
            let rangeArrayModified = [];
            _.each(originalDataSet, function (val, key) {
                var lineNo = parseInt(key);
                var range = {
                    range: new monaco.Range(lineNo, 1, lineNo, 1),
                    options: {
                        isWholeLine: true,
                        glyphMarginClassName: 'marker-wrapper marker-id-' + lineNo,
                    },
                }
                rangeArrayOriginal.push(range);
            });

            _.each(modifiedDataSet, function (val, key) {
                var lineNo = parseInt(key);
                var range = {
                    range: new monaco.Range(lineNo, 1, lineNo, 1),
                    options: {
                        isWholeLine: true,
                        glyphMarginClassName: 'marker-wrapper marker-id-' + lineNo,
                    },
                }
                rangeArrayModified.push(range);
            });
            if (!_.isEmpty(originalDataSet)) {
                originalDecorationIds = originalModel.deltaDecorations([], rangeArrayOriginal);
            }
            if (!_.isEmpty(modifiedDataSet)) {
                modifiedDecorationIds = modifiedModel.deltaDecorations([], rangeArrayModified);
            }

            editor.getOriginalEditor().onDidChangeCursorSelection(() => {
                removePopOver().then(() => {
                    setTimeout(function () {
                        $(originalDecorationIds).each(function (k, decorationId) {
                            let currentRange = originalModel.getDecorationRange(decorationId);
                            addMarkerOnEachLine('.original', currentRange.endLineNumber, 1);
                        });
                    }, 100);
                });
            });

            editor.getOriginalEditor().onDidScrollChange(function () {
                removePopOver().then(() => {
                    setTimeout(function () {
                        $(originalDecorationIds).each(function (k, decorationId) {
                            let currentRange = originalModel.getDecorationRange(decorationId);
                            addMarkerOnEachLine('.original', currentRange.endLineNumber, 1);
                        });
                    }, 100);
                });
            });
            editor.getOriginalEditor().onMouseDown(function () {
                removePopOver().then(() => {
                    setTimeout(function () {
                        $(originalDecorationIds).each(function (k, decorationId) {
                            let currentRange = originalModel.getDecorationRange(decorationId);
                            addMarkerOnEachLine('.original', currentRange.endLineNumber, 1);
                        });
                    }, 100);
                });
            });
            editor.getOriginalEditor().trigger("any", 'editor.action.formatDocument');
            editor.getOriginalEditor().getAction('editor.action.formatDocument').run()
                .then(() => {
                    removePopOver().then(() => {
                        setTimeout(function () {
                            $(originalDecorationIds).each(function (k, decorationId) {
                                let currentRange = originalModel.getDecorationRange(decorationId);
                                addMarkerOnEachLine('.original', currentRange.endLineNumber, 1);
                            });
                        }, 3000);
                    });
                });

            editor.getModifiedEditor().onDidChangeCursorSelection(() => {
                removePopOver().then(() => {
                    setTimeout(function () {
                        $(modifiedDecorationIds).each(function (k, decorationId) {
                            let currentRange = modifiedModel.getDecorationRange(decorationId);
                            addMarkerOnEachLine('.modified', currentRange.endLineNumber, 2);
                        });
                    }, 100);
                });
            });

            editor.getModifiedEditor().onDidScrollChange(function () {
                removePopOver().then(() => {
                    setTimeout(function () {
                        $(modifiedDecorationIds).each(function (k, decorationId) {
                            let currentRange = modifiedModel.getDecorationRange(decorationId);
                            addMarkerOnEachLine('.modified', currentRange.endLineNumber, 2);
                        });
                    }, 100);
                });
            });
            editor.getModifiedEditor().onMouseDown(function () {
                removePopOver().then(() => {
                    setTimeout(function () {
                        $(modifiedDecorationIds).each(function (k, decorationId) {
                            let currentRange = modifiedModel.getDecorationRange(decorationId);
                            addMarkerOnEachLine('.modified', currentRange.endLineNumber, 2);
                        });
                    }, 100);
                });
            });
            editor.getModifiedEditor().trigger("any", 'editor.action.formatDocument');
            editor.getModifiedEditor().getAction('editor.action.formatDocument').run()
                .then(() => {
                    removePopOver().then(() => {
                        setTimeout(function () {
                            $(modifiedDecorationIds).each(function (k, decorationId) {
                                let currentRange = modifiedModel.getDecorationRange(decorationId);
                                addMarkerOnEachLine('.modified', currentRange.endLineNumber, 2);
                            });
                        }, 3000);
                    });
                });
        }

        function removePopOver() {
            return new Promise(function (resolve, reject) {
                $(".ic-code-quality-filled").webuiPopover('destroy');
                $(".webui-popover-tag-icon").remove();
                resolve('');
            });
        }

        function addMarkerOnEachLine(editorClass, markerId, editorIndex) {
            var wrapper = $('<div/>', {
                class: 'wrapper'
            });
            var fixedIssueWrapper = $('<div/>', {
                class: 'fixed-issue-wrapper-container issue-wrapper'
            });
            var vulnerabilityWrapper = $('<div/>', {
                class: 'vulnerability-wrapper issue-wrapper'
            });
            var designIssueWrapper = $('<div/>', {
                class: 'design-issue-wrapper issue-wrapper'
            });
            var codeIssueWrapper = $('<div/>', {
                class: 'code-issue-wrapper issue-wrapper'
            });
            var bugsIssueWrapper = $('<div/>', {
                class: 'bugs-issue-wrapper issue-wrapper'
            });
            var fixedCodeIssue = [],
                fixedDesignIssue = [], fixedVulnerability = [];
            // var newIssueWrapper = $('<div/>', { class: 'new-issue-wrapper issue-wrapper' });

            wrapper.append(fixedIssueWrapper, vulnerabilityWrapper, designIssueWrapper, codeIssueWrapper, bugsIssueWrapper);
            //wrapper.append(codeDesignIcon);
            var toBePlotObj = {};
            switch (editorIndex) {
                case 1:
                    toBePlotObj = originalDataSet[markerId];
                    break;
                case 2:
                    toBePlotObj = modifiedDataSet[markerId];
                    break;
                default:
                    break;
            }
            setTimeout(function () {
                if ($(".webui-popover-tag-icon").css("top") == "0px" && $(".webui-popover-tag-icon").css("left") == "10px") {
                    $(".webui-popover-tag-icon").remove();
                }
            }, 110);
            if (toBePlotObj && typeof toBePlotObj.vulnerabilities !== 'undefined') {
                let toBePlotObjVulnerabilities = toBePlotObj.vulnerabilities.set;
                fixedCodeIssue = _.filter(toBePlotObjVulnerabilities, function (item) {
                    item.issueType = 'vulnerability';
                    return item.type == "fixed"
                });
                renderVulnerabilities(toBePlotObjVulnerabilities, vulnerabilityWrapper);
            }

            if (toBePlotObj && typeof toBePlotObj.codeIssues !== 'undefined') {
                let toBePlotObjCodeIssues = toBePlotObj.codeIssues.set;
                fixedCodeIssue = _.filter(toBePlotObjCodeIssues, function (item) {
                    item.issueType = 'codeIssue';
                    return item.type == "fixed"
                });
                renderCodeIssues(toBePlotObjCodeIssues, codeIssueWrapper);
            }

            if (toBePlotObj && typeof toBePlotObj.designIssues !== 'undefined') {
                let toBePlotObjDesignIssues = toBePlotObj.designIssues.set;
                fixedDesignIssue = _.filter(toBePlotObjDesignIssues, function (item) {
                    item.issueType = 'designIssue';
                    return item.type == "fixed"
                });
                renderDesignIssues(toBePlotObjDesignIssues, designIssueWrapper);
            }

            let toBePlotObjFixedIssues = _.union(fixedCodeIssue, fixedDesignIssue);

            if (toBePlotObjFixedIssues.length > 0 && editorIndex == 1 && renderFixedIssue) {
                renderFixedIssues(toBePlotObjFixedIssues, fixedIssueWrapper);
            }
            $(".editor" + editorClass + " .margin-view-overlays  .marker-wrapper.marker-id-" + markerId).html(wrapper);

        }

        function getIssueCriticality(issueJson) {
            var mostCriticalType = 'critical';
            var selectedItem = {};
            var criticalityCheck = true;
            //get criticality
            $.each(issueCriticalityArray, function (key, item) {
                for (let index = 0; index < issueJson.length; index++) {
                    if (criticalityCheck && issueJson[index].criticality == item) {
                        selectedItem = item;
                        mostCriticalType = item;
                        criticalityCheck = false;
                        return;
                    }
                }
                if (!_.isEmpty(selectedItem)) {
                    mostCriticalType = selectedItem;
                    return false;
                }
            });
            return mostCriticalType;
        }

        function renderVulnerabilities(toBePlotObjVulnerabilities, vulnerabilityWrapper) {
            //$(".code-issue-wrapper").webuiPopover('destroy');
            var issueCriticality = getIssueCriticality(toBePlotObjVulnerabilities);
            var vulnerabilityIcon = $('<div/>', {
                class: 'ic-quality-gate-error'
            }).css({
                "color": e.gradient.getCategoryColor('gradient_rating', issueCriticality.toLowerCase()),
                'font-size': '16px'
            });
            var totalTagCount = $('<sub/>', {
                class: 'issue-count-sub'
            }).html(toBePlotObjVulnerabilities.length).css({
                "background": e.gradient.getCategoryColor('gradient_rating', issueCriticality.toLowerCase())
            });
            vulnerabilityWrapper.append(vulnerabilityIcon, totalTagCount);
            var popoverContent = $('<div/>', {
                class: 'popover_content tags_details_popover tags_popover'
            });
            //vulnerabilityIcon.webuiPopover('destroy');
            setTimeout(function () {
                vulnerabilityIcon.webuiPopover({
                    content: popoverContent,
                    placement: "auto",
                    width: "320",
                    trigger: 'hover',
                    animation: 'pop',
                    style: 'tag-icon'
                });
            }, 150);
            addTagData(popoverContent, toBePlotObjVulnerabilities, 'vulnerabilities', toBePlotObjVulnerabilities, 1);
        }

        function renderCodeIssues(toBePlotObjCodeIssues, codeIssueWrapper) {
            //$(".code-issue-wrapper").webuiPopover('destroy');
            var issueCriticality = getIssueCriticality(toBePlotObjCodeIssues);
            var codeIssueIcon = $('<div/>', {
                class: 'ic-code-quality-filled'
            }).css({
                "color": e.gradient.getCategoryColor('gradient_rating', issueCriticality.toLowerCase()),
                'font-size': '16px'
            });
            var totalTagCount = $('<sub/>', {
                class: 'issue-count-sub'
            }).html(toBePlotObjCodeIssues.length).css({
                "background": e.gradient.getCategoryColor('gradient_rating', issueCriticality.toLowerCase())
            });
            codeIssueWrapper.append(codeIssueIcon, totalTagCount);
            var popoverContent = $('<div/>', {
                class: 'popover_content tags_details_popover tags_popover'
            });
            //codeIssueIcon.webuiPopover('destroy');
            setTimeout(function () {
                codeIssueIcon.webuiPopover({
                    content: popoverContent,
                    placement: "auto",
                    width: "320",
                    trigger: 'hover',
                    animation: 'pop',
                    style: 'tag-icon'
                });
            }, 150);
            addTagData(popoverContent, toBePlotObjCodeIssues, 'code_issues', toBePlotObjCodeIssues, 1);
        }

        function renderDesignIssues(toBePlotObjDesignIssues, designIssueWrapper) {
            //$(".design_tag_icon").webuiPopover('destroy');
            var designIssueIcon = $('<div/>', {
                class: 'design_tag_icon tag_icon'
            });
            var triangleLeft = $('<div/>', {
                class: 'triangle_left float_left'
            });
            var squareMiddle = $('<div/>', {
                class: 'square_middle float_left fill_antipattern text_allign_center note semibold color_base'
            });
            var designIssueIconEle = $('<div/>', {
                class: 'ic-design-issues-filled'
            });
            var totalTagCount = $('<div/>').html(toBePlotObjDesignIssues.length);
            var triangleRight = $('<div/>', {
                class: 'triangle_right float_left'
            });
            squareMiddle.append(designIssueIconEle, totalTagCount);

            designIssueIcon.append(triangleLeft, squareMiddle, triangleRight);

            designIssueWrapper.append(designIssueIcon);
            var popoverContent = $('<div/>', {
                class: 'popover_content tags_details_popover tags_popover'
            });
            //designIssueIcon.webuiPopover('destroy');
            setTimeout(function () {
                designIssueIcon.webuiPopover({
                    content: popoverContent,
                    placement: "auto",
                    width: "320",
                    trigger: 'hover',
                    animation: 'pop',
                    style: 'tag-icon'
                });
            }, 150);
            addTagData(popoverContent, toBePlotObjDesignIssues, 'design_issues', toBePlotObjDesignIssues, 1);
        }

        function addTagData(popoverContent, tagJson, tagType, tagsData, editorIndex) {
            popoverContent.html('');
            var i, description, name, tagContent, type, designTagIcon, triangleLeft, squareMiddle, triangleRight, kpiContainer;
            var patternContent = $('<div/>', {
                class: 'tags-wrapper'
            });
            if (tagType == "design_issues") {
                if (tagsData.length > 0) {
                    for (i = 0; i < tagJson.length; i++) {
                        description = g.formatSynopsys(tagJson[i].synopsis);
                        name = tagJson[i].ruleKey;
                        tagContent = $('<div/>', {
                            class: 'tag_content_details',
                            id: 'antipatternsContents'
                        });
                        designTagIcon = $('<div/>', {
                            class: 'tag_icon'
                        });
                        triangleLeft = $('<div/>', {
                            class: 'triangle_left float_left'
                        });
                        squareMiddle = $('<div/>', {
                            class: 'square_middle float_left fill_antipattern text_allign_center note semibold color_base'
                        }).html(name);
                        triangleRight = $('<div/>', {
                            class: 'triangle_right float_left'
                        });
                        designTagIcon.append(triangleLeft, squareMiddle, triangleRight);
                        tagContent.append(designTagIcon);
                        tagContent.append($('<div/>', {
                            class: 'description'
                        }).html(description));
                        patternContent.append(tagContent);
                        popoverContent.append(patternContent);
                    }
                }
            } else if (tagType == 'code_issues') {
                if (tagsData.length > 0) {
                    for (i = 0; i < tagJson.length; i++) {
                        tagContent = $('<div/>', {
                            class: 'tag_content_details code-issues_popup pull-request-code-issues',
                            type: tagJson[i].criticality,
                            'data-module_name': tagJson[i].module,
                            'data-rule_key': tagJson[i].ruleKey,
                            'data-issue_id': tagJson[i].issue_id,
                            'data-rule_index': editorIndex
                        });
                        type = tagJson[i].criticality;
                        if (tagJson[i].synopsis == "") {
                            description = g.formatSynopsys(tagJson[i].ruleKey);
                        } else if ((tagJson[i].synopsis).match("^GammaContext:")) {
                            var arr = tagJson[i].synopsis.split('GammaContext:');
                            var synopsisVal = JSON.parse(arr[1]);
                            description = synopsisVal.synopsis;
                        } else {
                            description = g.formatSynopsys(tagJson[i].synopsis);
                        }
                        kpiContainer = $('<div/>', {
                            class: 'kpi-container'
                        });
                        kpiContainer.html(Template.issuesKpi({
                            'issues_kpi': tagJson[i].kpi,
                            'issues_tags': tagJson[i].tags,
                            'icon': 'ic-code-quality-filled',
                            'show_icon': true,
                            'show_module_name': false
                        }));
                        kpiContainer.find('.kpi-tag').each(function () {
                            if ($(this).find('.kpi-tag-count').text() == '') {
                                $(this).find('.kpi-tag-name').addClass('no-tag-count');
                            } else {
                                $(this).find('.kpi-tag-name').removeClass('no-tag-count');
                            }
                        });
                        kpiContainer.find('.tag_icon').css('color', e.gradient.getCategoryColor('gradient_rating', type));
                        tagContent.append(kpiContainer);
                        tagContent.append($('<div/>', {
                            class: 'description'
                        }).html(description));
                        popoverContent.append(patternContent);
                        patternContent.append(tagContent);
                    }
                }
            } else if (tagType == 'vulnerabilities') {
                if (tagsData.length > 0) {
                    for (i = 0; i < tagJson.length; i++) {
                        tagContent = $('<div/>', {
                            class: 'tag_content_details code-issues_popup pull-request-code-issues',
                            type: tagJson[i].criticality,
                            'data-module_name': tagJson[i].module,
                            'data-rule_key': tagJson[i].ruleKey,
                            'data-issue_id': tagJson[i].issue_id,
                            'data-rule_index': editorIndex
                        });
                        type = tagJson[i].criticality;
                        if (tagJson[i].synopsis == "") {
                            description = g.formatSynopsys(tagJson[i].ruleKey);
                        } else if ((tagJson[i].synopsis).match("^GammaContext:")) {
                            var arr = tagJson[i].synopsis.split('GammaContext:');
                            var synopsisVal = JSON.parse(arr[1]);
                            description = synopsisVal.synopsis;
                        } else {
                            description = g.formatSynopsys(tagJson[i].synopsis);
                        }
                        kpiContainer = $('<div/>', {
                            class: 'kpi-container'
                        });
                        kpiContainer.html(Template.issuesKpi({
                            'issues_kpi': tagJson[i].kpi,
                            'issues_tags': tagJson[i].tags,
                            'icon': 'ic-quality-gate-error',
                            'show_icon': true,
                            'show_module_name': false
                        }));
                        kpiContainer.find('.kpi-tag').each(function () {
                            if ($(this).find('.kpi-tag-count').text() == '') {
                                $(this).find('.kpi-tag-name').addClass('no-tag-count');
                            } else {
                                $(this).find('.kpi-tag-name').removeClass('no-tag-count');
                            }
                        });
                        kpiContainer.find('.tag_icon').css('color', e.gradient.getCategoryColor('gradient_rating', type));
                        tagContent.append(kpiContainer);
                        tagContent.append($('<div/>', {
                            class: 'description'
                        }).html(description));
                        popoverContent.append(patternContent);
                        patternContent.append(tagContent);
                    }
                }
            }
        }

        function renderFixedIssues(toBePlotObjFixedIssues, fixedIssueWrapperContainer) {
            var issueStatusTag = $('<div/>', {
                class: 'issue-status'
            });

            //$(".issue-status").webuiPopover('destroy');
            fixedIssueWrapperContainer.append(issueStatusTag);
            var issueStatusCount = $('<div/>', {
                class: 'issue-status-count ic-check',
                'data-issue_count': toBePlotObjFixedIssues.length
            });
            issueStatusTag.append(issueStatusCount);

            var fixedIssuesWrapper = $('<div/>', {
                class: 'fixed-issues-wrapper'
            });
            var groupedIssues = _.groupBy(toBePlotObjFixedIssues, function (item) {
                return item.issueType;
            });

            if (groupedIssues.codeIssue) {
                var codeIssueText = groupedIssues.codeIssue.length > 1 ? 'issues' : 'issue';
                var fixedCodeIssues = $('<div/>', {
                    class: 'fixed-code-issues'
                }).text(groupedIssues.codeIssue.length + ' code ' + codeIssueText + ' fixed.');
            }
            if (groupedIssues.designIssue) {
                var designIssuesText = groupedIssues.designIssue.length > 1 ? 'issues' : 'issue';
                var fixedDesignIssues = $('<div/>', {
                    class: 'fixed-design-issues'
                }).text(groupedIssues.designIssue.length + ' design ' + designIssuesText + ' fixed.');
            }
            fixedIssuesWrapper.append(fixedCodeIssues, fixedDesignIssues);
            //issueStatusTag.webuiPopover('destroy');
            setTimeout(function () {
                issueStatusTag.webuiPopover({
                    content: fixedIssuesWrapper,
                    placement: "auto",
                    width: "200",
                    trigger: 'hover',
                    animation: 'pop',
                    style: 'tag-icon'
                });
            }, 150);
        }

        function scrollTo(pos) {
            editor.revealLineInCenter(parseInt(pos));
        }
        init();

        function clearMemory() {
            config = null;
            holder = null;
            originalModel = null;
            modifiedModel = null;
            editor = null;
            originalFile = null;
            modifiedFile = null;
            originalDataSet = null;
            modifiedDataSet = null;
            originalDecorationIds = null, modifiedDecorationIds = null;
            language = null;
            renderFixedIssue = null;
            issueCriticalityArray = null;
        }

        //---------- HANDLE EVENTS -------------
        function handleEvents() {

        }

        function toggleDiffView(option) {
            editor.updateOptions({
                renderSideBySide: !option
            });
        }

        function updateMarkers(markerSet, fixedIssueFlag) {
            renderFixedIssue = fixedIssueFlag;
            $('#diff_view .marker-wrapper').remove();
            originalDecorationIds = [];
            originalDataSet = markerSet.marker1;
            modifiedDecorationIds = [];
            modifiedDataSet = markerSet.marker2;
            addDecorations();
            setTimeout(scrollTo(1), 100);
        }

        //---------- PUBLIC METHODS -----------
        return {

            clearMemory: function () {
                clearMemory();
            },
            handleEvents: function () {
                handleEvents();
            },
            scrollTo: function (pos) {
                scrollTo(pos);
            },
            toggleDiffView: function (option) {
                toggleDiffView(option);
            },
            updateMarkers: function (markerSet, fixedIssueFlag) {
                updateMarkers(markerSet, fixedIssueFlag);
            },
            codeLaneDisplayRE: function (lineNumber) {
                codeLaneDisplayRE(lineNumber);
            }
        };
    };
    return e;
})(e);