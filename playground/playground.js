var MakerJsPlayground;
(function (MakerJsPlayground) {
    //classes
    var QueryStringParams = (function () {
        function QueryStringParams(querystring) {
            if (querystring === void 0) { querystring = document.location.search.substring(1); }
            if (querystring) {
                var pairs = querystring.split('&');
                for (var i = 0; i < pairs.length; i++) {
                    var pair = pairs[i].split('=');
                    this[pair[0]] = decodeURIComponent(pair[1]);
                }
            }
        }
        return QueryStringParams;
    }());
    //private members
    var minDockSideBySide = 1024;
    var pixelsPerInch = 100;
    var iframe;
    var customizeMenu;
    var view;
    var viewSvgContainer;
    var paramsDiv;
    var progress;
    var preview;
    var checkFitToScreen;
    var margin;
    var processed = {
        error: '',
        html: '',
        kit: null,
        model: null,
        measurement: null,
        paramValues: []
    };
    var init = true;
    var errorMarker;
    var exportWorker = null;
    var paramActiveTimeout;
    var longHoldTimeout;
    var viewModelRootSelector = 'svg#drawing > g > g > g';
    var viewOrigin;
    var viewPanOffset = [0, 0];
    var keepEventElement = null;
    var renderInWorker = {
        requestId: 0,
        worker: null,
        hasKit: false
    };
    var setParamTimeoutId;
    var animationTimeoutId;
    var dockModes = {
        None: '',
        SideBySide: 'side-by-side',
        FullScreen: 'full-screen'
    };
    function isLandscapeOrientation() {
        return (Math.abs(window.orientation) == 90) || window.orientation == 'landscape';
    }
    function isHttp(url) {
        return "http" === url.substr(0, 4);
    }
    function isIJavaScriptErrorDetails(result) {
        if (!result)
            return false;
        var sample = {
            colno: 0,
            lineno: 0,
            message: '',
            name: ''
        };
        for (var key in sample) {
            if (!(key in result)) {
                return false;
            }
        }
        return true;
    }
    function populateParams(metaParameters) {
        var paramValues = [];
        var paramHtml = [];
        if (metaParameters) {
            var sliders = 0;
            for (var i = 0; i < metaParameters.length; i++) {
                var attrs = makerjs.cloneObject(metaParameters[i]);
                var id = 'slider_' + i;
                var label = new makerjs.exporter.XmlTag('label', { "for": id, title: attrs.title });
                label.innerText = attrs.title + ': ';
                var input = null;
                var numberBox = null;
                switch (attrs.type) {
                    case 'range':
                        sliders++;
                        attrs.title = attrs.value;
                        attrs['id'] = id;
                        attrs['onchange'] = 'this.title=this.value;MakerJsPlayground.setParam(' + i + ', makerjs.round(this.valueAsNumber, .001)); if (MakerJsPlayground.isSmallDevice()) { MakerJsPlayground.activateParam(this); MakerJsPlayground.deActivateParam(this, 1000); }';
                        attrs['ontouchstart'] = 'MakerJsPlayground.activateParam(this)';
                        attrs['ontouchend'] = 'MakerJsPlayground.deActivateParam(this, 1000)';
                        attrs['onmousedown'] = 'if (MakerJsPlayground.isSmallDevice()) { MakerJsPlayground.activateParam(this); }';
                        attrs['onmouseup'] = 'if (MakerJsPlayground.isSmallDevice()) { MakerJsPlayground.deActivateParam(this, 1000); }';
                        input = new makerjs.exporter.XmlTag('input', attrs);
                        //note: we could also apply the min and max of the range to the number field. however, the useage of the textbox is to deliberately "go out of bounds" when the example range is insufficient.
                        var numberBoxAttrs = {
                            "id": 'numberbox_' + i,
                            "type": 'number',
                            "step": 'any',
                            "value": attrs.value,
                            "onfocus": 'if (MakerJsPlayground.isSmallDevice()) { MakerJsPlayground.activateParam(this.parentElement); }',
                            "onblur": 'if (MakerJsPlayground.isSmallDevice()) { MakerJsPlayground.deActivateParam(this.parentElement, 0); }',
                            "onchange": 'MakerJsPlayground.setParam(' + i + ', makerjs.round(this.value, .001))'
                        };
                        var formAttrs = {
                            "action": 'javascript:void(0);',
                            "onsubmit": 'MakerJsPlayground.setParam(' + i + ', makerjs.round(this.elements[0].value, .001))'
                        };
                        numberBox = new makerjs.exporter.XmlTag('form', formAttrs);
                        numberBox.innerText = new makerjs.exporter.XmlTag('input', numberBoxAttrs).toString();
                        numberBox.innerTextEscaped = true;
                        paramValues.push(attrs.value);
                        label.attrs['title'] = 'click to toggle slider / textbox for ' + label.attrs['title'];
                        label.attrs['onclick'] = 'MakerJsPlayground.toggleSliderNumberBox(this, ' + i + ')';
                        break;
                    case 'bool':
                        var checkboxAttrs = {
                            type: 'checkbox',
                            onchange: 'MakerJsPlayground.setParam(' + i + ', this.checked)'
                        };
                        if (attrs.value) {
                            checkboxAttrs['checked'] = true;
                        }
                        input = new makerjs.exporter.XmlTag('input', checkboxAttrs);
                        paramValues.push(attrs.value);
                        break;
                    case 'select':
                        var selectAttrs = {
                            onchange: 'MakerJsPlayground.setParam(' + i + ', JSON.parse(this.options[this.selectedIndex].innerText))'
                        };
                        input = new makerjs.exporter.XmlTag('select', selectAttrs);
                        var options = '';
                        for (var j = 0; j < attrs.value.length; j++) {
                            var option = new makerjs.exporter.XmlTag('option');
                            option.innerText = JSON.stringify(attrs.value[j]);
                            options += option.toString();
                        }
                        input.innerText = options;
                        input.innerTextEscaped = true;
                        paramValues.push(attrs.value[0]);
                        break;
                    case 'text':
                        attrs['onchange'] = 'MakerJsPlayground.setParam(' + i + ', this.value)';
                        input = new makerjs.exporter.XmlTag('input', attrs);
                        paramValues.push(attrs.value);
                        break;
                }
                if (!input)
                    continue;
                var div = new makerjs.exporter.XmlTag('div');
                div.innerText = label.toString() + input.toString();
                if (numberBox) {
                    div.innerText += numberBox.toString();
                }
                div.innerTextEscaped = true;
                paramHtml.push(div.toString());
            }
        }
        processed.paramValues = paramValues;
        paramsDiv.innerHTML = paramHtml.join('');
        paramsDiv.setAttribute('disabled', 'true');
    }
    function generateCodeFromKit(id, kit) {
        var values = [];
        var comment = [];
        var code = [];
        var firstComment = "//" + id + " parameters: ";
        for (var i in kit.metaParameters) {
            comment.push(firstComment + kit.metaParameters[i].title);
            firstComment = "";
            var value = kit.metaParameters[i].value;
            if (kit.metaParameters[i].type === 'select') {
                value = value[0];
            }
            if (makerjs.isObject(value)) {
                values.push(JSON.stringify(value));
            }
            else {
                values.push(value);
            }
        }
        code.push("var makerjs = require('makerjs');");
        code.push("");
        code.push(comment.join(", "));
        code.push("");
        code.push("this.models = {");
        code.push("  my" + id + ": new makerjs.models." + id + "(" + values.join(', ') + ")");
        code.push("};");
        code.push("");
        return code.join('\n');
    }
    function resetDownload() {
        cancelExport();
        document.body.classList.remove('download-ready');
    }
    var Frown = (function () {
        function Frown() {
            this.paths = {
                head: new makerjs.paths.Circle([0, 0], 85),
                eye1: new makerjs.paths.Circle([-25, 25], 10),
                eye2: new makerjs.paths.Circle([25, 25], 10),
                frown: new makerjs.paths.Arc([0, -75], 50, 45, 135)
            };
        }
        return Frown;
    }());
    var Wait = (function () {
        function Wait() {
            var wireFrame = {
                paths: {
                    rim: new makerjs.paths.Circle([0, 0], 85),
                    hand1: new makerjs.paths.Line([0, 0], [40, 30]),
                    hand2: new makerjs.paths.Line([0, 0], [0, 60])
                }
            };
            this.models = {
                x: makerjs.model.expandPaths(wireFrame, 5)
            };
        }
        return Wait;
    }());
    function highlightCodeError(error) {
        var notes = '';
        if (error.lineno || error.colno) {
            notes = error.name + ' at line ' + error.lineno + ' column ' + error.colno + ' : ' + error.message;
            var editorLine = error.lineno - 1;
            var from = {
                line: editorLine, ch: error.colno - 1
            };
            var line = MakerJsPlayground.codeMirrorEditor.getDoc().getLine(editorLine);
            var to = {
                line: editorLine, ch: line ? line.length : 0
            };
            errorMarker = MakerJsPlayground.codeMirrorEditor.getDoc().markText(from, to, { title: error.message, clearOnEnter: true, className: 'code-error' });
        }
        else {
            notes = error.name + ' : ' + error.message;
        }
        MakerJsPlayground.viewScale = null;
        setProcessedModel(new Frown(), notes);
    }
    function dockEditor(newDockMode) {
        for (var modeId in dockModes) {
            var dm = dockModes[modeId];
            if (!dm)
                continue;
            if (newDockMode === dm) {
                document.body.classList.add(dm);
            }
            else {
                document.body.classList.remove(dm);
            }
        }
        if (newDockMode === dockModes.SideBySide) {
            var sectionEditor = document.querySelector('section.editor');
            var codeHeader = document.querySelector('.code-header');
            MakerJsPlayground.codeMirrorEditor.setSize(null, sectionEditor.offsetHeight - codeHeader.offsetHeight);
        }
        else {
            MakerJsPlayground.codeMirrorEditor.setSize(null, 'auto');
            MakerJsPlayground.codeMirrorEditor.refresh();
        }
        MakerJsPlayground.dockMode = newDockMode;
    }
    function arraysEqual(a, b) {
        if (!a || !b)
            return false;
        if (a.length != b.length)
            return false;
        for (var i = 0; i < a.length; ++i) {
            if (a[i] !== b[i])
                return false;
        }
        return true;
    }
    function lockToPath(path) {
        //trace back to root
        var root = viewSvgContainer.querySelector(viewModelRootSelector);
        var route = [];
        var element = path;
        while (element !== root) {
            var id = element.attributes.getNamedItem('id').value;
            route.unshift(id);
            if (element.nodeName == 'g') {
                route.unshift('models');
            }
            else {
                route.unshift('paths');
            }
            element = element.parentNode;
        }
        if (processed.lockedPath && arraysEqual(processed.lockedPath.route, route)) {
            processed.lockedPath = null;
            setNotesFromModelOrKit();
        }
        else {
            var crumb = 'this';
            for (var i = 0; i < route.length; i++) {
                if (i % 2 == 0) {
                    crumb += "." + route[i];
                }
                else {
                    crumb += '["' + route[i] + '"]';
                }
            }
            processed.lockedPath = {
                route: route,
                notes: "Path Info|\n---|---\nRoute|``` " + crumb + " ```\nJSON|"
            };
            updateLockedPathNotes();
        }
        render();
        if (MakerJsPlayground.onViewportChange) {
            MakerJsPlayground.onViewportChange();
        }
    }
    function getLockedPathSvgElement() {
        var root = viewSvgContainer.querySelector(viewModelRootSelector);
        var selector = '';
        for (var i = 0; i < processed.lockedPath.route.length - 2; i += 2) {
            selector += " g[id='" + processed.lockedPath.route[i + 1] + "']";
        }
        selector += " [id='" + processed.lockedPath.route[processed.lockedPath.route.length - 1] + "']";
        return root.querySelector(selector);
    }
    function getLockedPathAndOffset() {
        if (!processed.lockedPath)
            return null;
        var ref = processed.model;
        var origin = processed.model.origin || [0, 0];
        var route = processed.lockedPath.route.slice();
        while (route.length) {
            var prop = route.shift();
            ref = ref[prop];
            if (!ref)
                return null;
            if (ref.origin && route.length) {
                origin = makerjs.point.add(origin, ref.origin);
            }
        }
        return {
            path: ref,
            offset: origin
        };
    }
    function updateLockedPathNotes() {
        if (processed.model && processed.lockedPath) {
            var pathAndOffset = getLockedPathAndOffset();
            if (pathAndOffset) {
                setNotes(processed.lockedPath.notes + "``` " + JSON.stringify(pathAndOffset.path) + "```\nOffset|```" + JSON.stringify(pathAndOffset.offset) + "```");
            }
            else {
                setNotesFromModelOrKit();
            }
            return true;
        }
        return false;
    }
    function measureLockedPath() {
        var pathAndOffset = getLockedPathAndOffset();
        if (!pathAndOffset)
            return null;
        var measure = makerjs.measure.pathExtents(pathAndOffset.path);
        measure.high = makerjs.point.add(measure.high, pathAndOffset.offset);
        measure.low = makerjs.point.add(measure.low, pathAndOffset.offset);
        return measure;
    }
    function getModelNaturalSize() {
        var measure = processed.measurement;
        var modelWidthNatural = measure.high[0] - measure.low[0];
        var modelHeightNatural = measure.high[1] - measure.low[1];
        return [modelWidthNatural, modelHeightNatural];
    }
    function getViewSize() {
        var viewHeight = view.offsetHeight - 2 * margin[1];
        var viewWidth = view.offsetWidth - 2 * margin[0];
        var menuLeft = customizeMenu.offsetLeft - 2 * margin[0];
        var width = viewWidth;
        //view mode - left of menu
        if (!document.body.classList.contains('collapse-rendering-options') && menuLeft > 100) {
            width = menuLeft;
        }
        return [width, viewHeight];
    }
    function areSameHeightMeasurement(a, b) {
        return a.high[1] == b.high[1] && a.low[1] == b.low[1];
    }
    function initialize() {
        window.addEventListener('resize', onWindowResize);
        window.addEventListener('orientationchange', onWindowResize);
        MakerJsPlayground.pointers = new Pointer.Manager(view, '#pointers', margin, getZoom, setZoom, onPointerClick, onPointerReset);
        if (MakerJsPlayground.onInit) {
            MakerJsPlayground.onInit();
        }
    }
    function onPointerClick(srcElement) {
        if (!keepEventElement && srcElement && srcElement.tagName && srcElement.tagName == 'text') {
            var text = srcElement;
            var path = text.previousSibling;
            lockToPath(path);
        }
    }
    function onPointerReset() {
        if (keepEventElement) {
            view.removeChild(keepEventElement);
        }
        keepEventElement = null;
    }
    function getZoom() {
        //expects pixels
        var scale = 1;
        if (MakerJsPlayground.renderUnits) {
            scale = makerjs.units.conversionScale(MakerJsPlayground.renderUnits, makerjs.unitType.Inch) * pixelsPerInch;
        }
        return {
            origin: makerjs.point.scale(viewOrigin, scale),
            pan: viewPanOffset,
            zoom: MakerJsPlayground.viewScale
        };
    }
    function setZoom(panZoom) {
        var svgElement = viewSvgContainer.children[0];
        if (!svgElement)
            return;
        checkFitToScreen.checked = false;
        viewPanOffset = panZoom.pan;
        if (panZoom.zoom == MakerJsPlayground.viewScale) {
            //just pan
            //no need to re-render, just move the margin
            svgElement.style.marginLeft = viewPanOffset[0] + 'px';
            svgElement.style.marginTop = viewPanOffset[1] + 'px';
        }
        else {
            //zoom and pan
            if (!keepEventElement) {
                keepEventElement = svgElement;
                viewSvgContainer.removeChild(keepEventElement);
                keepEventElement.style.visibility = 'hidden';
                this.view.appendChild(keepEventElement);
            }
            MakerJsPlayground.viewScale = panZoom.zoom;
            updateZoomScale();
            render();
        }
    }
    function setProcessedModel(model, error, doInit) {
        processed.model = model;
        processed.measurement = null;
        processed.error = error;
        if (!error) {
            if (errorMarker) {
                errorMarker.clear();
                errorMarker = null;
            }
        }
        if (model) {
            onProcessed(doInit);
        }
    }
    function onProcessed(doInit) {
        if (doInit === void 0) { doInit = true; }
        //now safe to render, so register a resize listener
        if (init && doInit) {
            init = false;
            initialize();
        }
        //todo: find minimum viewScale
        if (processed.model) {
            processed.measurement = makerjs.measure.modelExtents(processed.model);
            if (!processed.measurement) {
                processed.model = null;
                return;
            }
            if (!MakerJsPlayground.viewScale || checkFitToScreen.checked) {
                fitOnScreen();
            }
            else if (MakerJsPlayground.renderUnits != processed.model.units) {
                fitNatural();
            }
        }
        render();
        if (processed.error) {
            setNotes(processed.error);
            //sync notes and checkbox
            document.getElementById('check-notes').checked = true;
            document.body.classList.remove('collapse-notes');
        }
        else if (!updateLockedPathNotes()) {
            setNotesFromModelOrKit();
        }
        if (MakerJsPlayground.onViewportChange) {
            MakerJsPlayground.onViewportChange();
        }
    }
    function constructOnMainThread() {
        try {
            var model = makerjs.kit.construct(processed.kit, processed.paramValues);
            setProcessedModel(model);
        }
        catch (e) {
            var error = e;
            var errorDetails = {
                colno: 0,
                lineno: 0,
                message: 'Parameters=' + JSON.stringify(processed.paramValues),
                name: e.toString()
            };
            //try to get column number and line number from stack
            var re = /([0-9]{1,9999})\:([0-9]{1,9999})/;
            var matches = re.exec(error.stack);
            if (matches && matches.length == 3) {
                errorDetails.lineno = parseInt(matches[1]);
                errorDetails.colno = parseInt(matches[2]);
            }
            processResult('', errorDetails);
        }
    }
    function constructInWorker(javaScript, orderedDependencies, successHandler, errorHandler) {
        var orderedSrc;
        renderInWorker.hasKit = false;
        if (renderInWorker.worker) {
            renderInWorker.worker.terminate();
        }
        renderInWorker.worker = new Worker('worker/render-worker.js');
        renderInWorker.worker.onmessage = function (ev) {
            var response = ev.data;
            if (response.error) {
                errorHandler();
            }
            else {
                renderInWorker.hasKit = true;
                successHandler(response.model);
            }
        };
        orderedSrc = {};
        for (var i = 0; i < orderedDependencies.length; i++) {
            //add extra path traversal for worker subfolder
            orderedSrc[orderedDependencies[i]] = '../' + filenameFromRequireId(orderedDependencies[i], true);
        }
        var options = {
            requestId: 0,
            javaScript: javaScript,
            orderedDependencies: orderedSrc,
            paramValues: processed.paramValues
        };
        //tell the worker to process the job
        renderInWorker.worker.postMessage(options);
    }
    function reConstructInWorker(successHandler, errorHandler) {
        if (!renderInWorker.hasKit)
            return;
        renderInWorker.worker.onmessage = function (ev) {
            var response = ev.data;
            if (response.requestId == renderInWorker.requestId) {
                if (response.error) {
                    errorHandler();
                }
                else if (response.model) {
                    successHandler(response.model);
                }
            }
        };
        renderInWorker.requestId = new Date().valueOf();
        var options = {
            requestId: renderInWorker.requestId,
            paramValues: processed.paramValues
        };
        //tell the worker to process the job
        renderInWorker.worker.postMessage(options);
    }
    function selectParamSlider(index) {
        var div = document.querySelectorAll('#params > div')[index];
        if (!div)
            return;
        var slider = div.querySelector('input[type=range]');
        var numberBox = div.querySelector('input[type=number]');
        return {
            classList: div.classList,
            slider: slider,
            numberBox: numberBox
        };
    }
    function throttledSetParam(index, value) {
        //sync slider / numberbox
        var div = selectParamSlider(index);
        var slider = div.slider;
        var numberBox = div.numberBox;
        if (slider && numberBox) {
            if (div.classList.contains('toggle-number')) {
                //numberbox is master
                slider.value = numberBox.value;
            }
            else {
                //slider is master
                numberBox.value = slider.value;
            }
        }
        resetDownload();
        processed.paramValues[index] = value;
        if (MakerJsPlayground.renderOnWorkerThread && Worker) {
            reConstructInWorker(setProcessedModel, constructOnMainThread);
        }
        else {
            constructOnMainThread();
        }
    }
    function setNotesFromModelOrKit() {
        setNotes(processed.model.notes || (processed.kit ? processed.kit.notes : ''));
    }
    MakerJsPlayground.codeMirrorOptions = {
        lineNumbers: true,
        theme: 'twilight',
        viewportMargin: Infinity
    };
    MakerJsPlayground.relativePath = '';
    MakerJsPlayground.svgStrokeWidth = 2;
    MakerJsPlayground.svgFontSize = 14;
    MakerJsPlayground.renderOnWorkerThread = true;
    function runCodeFromEditor() {
        setProcessedModel(new Wait());
        processed.kit = null;
        populateParams(null);
        if (iframe) {
            document.body.removeChild(iframe);
        }
        iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        var scripts = ['require-iframe.js', '../external/bezier-js/bezier.js', '../external/opentype/opentype.js'];
        iframe.contentWindow.document.open();
        iframe.contentWindow.document.write('<html><head>' + scripts.map(function (src) { return '<script src="' + src + '"></script>'; }).join() + '</head><body></body></html>');
        iframe.contentWindow.document.close();
    }
    MakerJsPlayground.runCodeFromEditor = runCodeFromEditor;
    function setNotes(value) {
        var markdown = '';
        if (typeof value === 'string') {
            markdown = value;
        }
        else {
            markdown = JSON.stringify(value);
        }
        var html = '';
        if (markdown) {
            html = marked(markdown);
        }
        html += cleanHtml(processed.html);
        setNotesHtml(html);
    }
    MakerJsPlayground.setNotes = setNotes;
    function setNotesHtml(html) {
        var className = 'no-notes';
        if (html) {
            document.body.classList.remove(className);
        }
        else {
            document.body.classList.add(className);
        }
        document.getElementById('notes').innerHTML = html;
    }
    function updateZoomScale() {
        var z = document.getElementById('zoom-display');
        z.innerText = '(' + (MakerJsPlayground.viewScale * (MakerJsPlayground.renderUnits ? 100 : 1)).toFixed(0) + '%)';
    }
    MakerJsPlayground.updateZoomScale = updateZoomScale;
    function processResult(html, result, orderedDependencies) {
        resetDownload();
        processed.html = html;
        setProcessedModel(null);
        //see if output is either a Node module, or a MakerJs.IModel
        if (typeof result === 'function') {
            processed.kit = result;
            populateParams(processed.kit.metaParameters);
            function enableKit() {
                paramsDiv.removeAttribute('disabled');
            }
            function setKitOnMainThread() {
                constructOnMainThread();
                enableKit();
            }
            if (MakerJsPlayground.renderOnWorkerThread && Worker) {
                constructInWorker(MakerJsPlayground.codeMirrorEditor.getDoc().getValue(), orderedDependencies, function (model) {
                    enableKit();
                    setProcessedModel(model);
                }, setKitOnMainThread);
            }
            else {
                setKitOnMainThread();
            }
        }
        else if (makerjs.isModel(result)) {
            processed.kit = null;
            populateParams(null);
            setProcessedModel(result);
        }
        else if (isIJavaScriptErrorDetails(result)) {
            //render script error
            highlightCodeError(result);
            if (MakerJsPlayground.onViewportChange) {
                MakerJsPlayground.onViewportChange();
            }
        }
        else {
            render();
            if (MakerJsPlayground.onViewportChange) {
                MakerJsPlayground.onViewportChange();
            }
        }
    }
    MakerJsPlayground.processResult = processResult;
    function setParam(index, value) {
        clearTimeout(setParamTimeoutId);
        setParamTimeoutId = setTimeout(function () {
            throttledSetParam(index, value);
        }, 50);
    }
    MakerJsPlayground.setParam = setParam;
    function animate(paramIndex, milliSeconds, steps) {
        if (paramIndex === void 0) { paramIndex = 0; }
        if (milliSeconds === void 0) { milliSeconds = 150; }
        if (steps === void 0) { steps = 20; }
        clearInterval(animationTimeoutId);
        var div = selectParamSlider(paramIndex);
        if (!div)
            return;
        if (!div.slider) {
            animate(paramIndex + 1);
            return;
        }
        var max = parseFloat(div.slider.max);
        var min = parseFloat(div.slider.min);
        do {
            var step = Math.floor((max - min) / steps);
            steps /= 2;
        } while (step === 0);
        div.slider.value = min.toString();
        animationTimeoutId = setInterval(function () {
            var currValue = parseFloat(div.slider.value);
            if (currValue < max) {
                var newValue = currValue + step;
                div.slider.value = newValue.toString();
                throttledSetParam(paramIndex, newValue);
            }
            else {
                animate(paramIndex + 1);
            }
        }, milliSeconds);
    }
    MakerJsPlayground.animate = animate;
    function toggleSliderNumberBox(label, index) {
        var id;
        if (toggleClass('toggle-number', label.parentElement)) {
            id = 'slider_' + index;
            //re-render according to slider value since numberbox may be out of limits
            var slider = document.getElementById(id);
            slider.onchange(null);
        }
        else {
            id = 'numberbox_' + index;
        }
        label.htmlFor = id;
    }
    MakerJsPlayground.toggleSliderNumberBox = toggleSliderNumberBox;
    function activateParam(input, onLongHold) {
        if (onLongHold === void 0) { onLongHold = false; }
        function activate() {
            document.body.classList.add('param-active');
            input.parentElement.classList.add('active');
            clearTimeout(paramActiveTimeout);
        }
        if (onLongHold) {
            longHoldTimeout = setTimeout(activate, 200);
        }
        else {
            activate();
        }
    }
    MakerJsPlayground.activateParam = activateParam;
    function deActivateParam(input, delay) {
        clearTimeout(longHoldTimeout);
        clearTimeout(paramActiveTimeout);
        paramActiveTimeout = setTimeout(function () {
            document.body.classList.remove('param-active');
            input.parentElement.classList.remove('active');
        }, delay);
    }
    MakerJsPlayground.deActivateParam = deActivateParam;
    function fitNatural() {
        MakerJsPlayground.pointers.reset();
        if (!processed.measurement)
            return;
        var size = getViewSize();
        var halfWidth = size[0] / 2;
        var modelNaturalSize = getModelNaturalSize();
        MakerJsPlayground.viewScale = 1;
        viewPanOffset = [0, 0];
        checkFitToScreen.checked = false;
        MakerJsPlayground.renderUnits = processed.model.units || null;
        if (processed.model.units) {
            //from pixels, to inch, then to units
            var widthToInch = size[0] / pixelsPerInch;
            var toUnits = makerjs.units.conversionScale(makerjs.unitType.Inch, processed.model.units) * widthToInch;
            halfWidth = toUnits / 2;
        }
        halfWidth -= modelNaturalSize[0] / 2 + processed.measurement.low[0];
        viewOrigin = [halfWidth, processed.measurement.high[1]];
        updateZoomScale();
    }
    MakerJsPlayground.fitNatural = fitNatural;
    function fitOnScreen() {
        if (MakerJsPlayground.pointers)
            MakerJsPlayground.pointers.reset();
        if (!processed.measurement)
            return;
        var size = getViewSize();
        var halfWidth = size[0] / 2;
        var modelNaturalSize = getModelNaturalSize();
        MakerJsPlayground.viewScale = 1;
        viewPanOffset = [0, 0];
        checkFitToScreen.checked = true;
        MakerJsPlayground.renderUnits = null;
        if (processed.model.units) {
            //cast into inches, then to pixels
            MakerJsPlayground.viewScale *= makerjs.units.conversionScale(processed.model.units, makerjs.unitType.Inch) * pixelsPerInch;
        }
        var modelPixelSize = makerjs.point.rounded(makerjs.point.scale(modelNaturalSize, MakerJsPlayground.viewScale), .1);
        var scaleHeight = size[1] / modelPixelSize[1];
        var scaleWidth = size[0] / modelPixelSize[0];
        MakerJsPlayground.viewScale *= Math.min(scaleWidth, scaleHeight);
        halfWidth -= (modelNaturalSize[0] / 2 + processed.measurement.low[0]) * MakerJsPlayground.viewScale;
        viewOrigin = [halfWidth, processed.measurement.high[1] * MakerJsPlayground.viewScale];
        updateZoomScale();
    }
    MakerJsPlayground.fitOnScreen = fitOnScreen;
    function browserIsMicrosoft() {
        var clues = ['Edge/', 'Trident/'];
        for (var i = 0; i < clues.length; i++) {
            if (navigator.userAgent.indexOf(clues[i]) > 0) {
                return true;
            }
        }
        return false;
    }
    MakerJsPlayground.browserIsMicrosoft = browserIsMicrosoft;
    function cleanHtml(html) {
        var div = document.createElement('div');
        div.innerHTML = html;
        var svg = div.querySelector('svg');
        if (svg) {
            div.removeChild(svg);
            return div.innerHTML;
        }
        return html;
    }
    function render() {
        viewSvgContainer.innerHTML = '';
        var html = '';
        var unitScale = MakerJsPlayground.renderUnits ? makerjs.units.conversionScale(MakerJsPlayground.renderUnits, makerjs.unitType.Inch) * pixelsPerInch : 1;
        var strokeWidth = MakerJsPlayground.svgStrokeWidth / (browserIsMicrosoft() ? unitScale : 1);
        if (processed.model) {
            var fontSize = MakerJsPlayground.svgFontSize / unitScale;
            var renderOptions = {
                origin: viewOrigin,
                annotate: true,
                svgAttrs: {
                    "id": 'drawing',
                    "style": 'margin-left:' + viewPanOffset[0] + 'px; margin-top:' + viewPanOffset[1] + 'px'
                },
                strokeWidth: strokeWidth + 'px',
                fontSize: fontSize + 'px',
                scale: MakerJsPlayground.viewScale,
                useSvgPathOnly: false
            };
            var renderModel = {
                models: {
                    ROOT: processed.model
                }
            };
            if (MakerJsPlayground.renderUnits) {
                renderModel.units = MakerJsPlayground.renderUnits;
            }
            var size = getModelNaturalSize();
            var multiplier = 10;
            renderModel.paths = {
                'crosshairs-vertical': new makerjs.paths.Line([0, size[1] * multiplier], [0, -size[1] * multiplier]),
                'crosshairs-horizontal': new makerjs.paths.Line([size[0] * multiplier, 0], [-size[0] * multiplier, 0])
            };
            html += makerjs.exporter.toSVG(renderModel, renderOptions);
        }
        viewSvgContainer.innerHTML = html;
        if (processed.lockedPath) {
            var path = getLockedPathSvgElement();
            if (path) {
                path.setAttribute('class', 'locked');
                path.style.strokeWidth = (2 * strokeWidth) + 'px';
            }
        }
    }
    MakerJsPlayground.render = render;
    function filenameFromRequireId(id, bustCache) {
        var filename = MakerJsPlayground.relativePath + id + '.js';
        if (bustCache) {
            filename += '?' + new Date().valueOf();
        }
        return filename;
    }
    MakerJsPlayground.filenameFromRequireId = filenameFromRequireId;
    function downloadScript(url, callback) {
        var timeout = setTimeout(function () {
            x.onreadystatechange = null;
            var errorDetails = {
                colno: 0,
                lineno: 0,
                message: 'Could not load script "' + url + '". Possibly a network error, or the file does not exist.',
                name: 'Load module failure'
            };
            processResult('', errorDetails);
        }, 5000);
        var x = new XMLHttpRequest();
        x.open('GET', url, true);
        x.onreadystatechange = function () {
            if (x.readyState == 4 && x.status == 200) {
                clearTimeout(timeout);
                callback(x.responseText);
            }
        };
        x.send();
    }
    MakerJsPlayground.downloadScript = downloadScript;
    function toggleClassAndResize(name) {
        toggleClass(name);
        onWindowResize();
    }
    MakerJsPlayground.toggleClassAndResize = toggleClassAndResize;
    function toggleClass(name, element) {
        if (element === void 0) { element = document.body; }
        var c = element.classList;
        var result;
        if (c.contains(name)) {
            c.remove(name);
            result = true;
        }
        else {
            c.add(name);
            result = false;
        }
        return result;
    }
    MakerJsPlayground.toggleClass = toggleClass;
    function getExport(ev) {
        var response = ev.data;
        progress.style.width = response.percentComplete + '%';
        if (response.percentComplete == 100 && response.text) {
            //allow progress bar to render
            setTimeout(function () {
                var fe = MakerJsPlaygroundExport.formatMap[response.request.format];
                var encoded = encodeURIComponent(response.text);
                var uriPrefix = 'data:' + fe.mediaType + ',';
                var filename = (MakerJsPlayground.querystringParams['script'] || 'my-drawing') + '.' + fe.fileExtension;
                var dataUri = uriPrefix + encoded;
                //create a download link
                var a = new makerjs.exporter.XmlTag('a', { href: dataUri, download: filename });
                a.innerText = 'download ' + response.request.formatTitle;
                document.getElementById('download-link-container').innerHTML = a.toString();
                preview.value = response.text;
                document.getElementById('download-filename').innerText = filename;
                //put the download ui into ready mode
                toggleClass('download-generating');
                toggleClass('download-ready');
            }, 300);
        }
    }
    function downloadClick(a, format) {
        var request = {
            format: format,
            formatTitle: a.innerText,
            model: processed.model
        };
        //initialize a worker - this will download scripts into the worker
        if (!exportWorker) {
            exportWorker = new Worker('worker/export-worker.js?' + new Date().valueOf());
            exportWorker.onmessage = getExport;
        }
        //put the download ui into generation mode
        progress.style.width = '0';
        toggleClass('download-generating');
        //tell the worker to process the job
        exportWorker.postMessage(request);
    }
    MakerJsPlayground.downloadClick = downloadClick;
    function copyToClipboard() {
        preview.select();
        document.execCommand('copy');
    }
    MakerJsPlayground.copyToClipboard = copyToClipboard;
    function cancelExport() {
        if (exportWorker) {
            exportWorker.terminate();
            exportWorker = null;
        }
        document.body.classList.remove('download-generating');
    }
    MakerJsPlayground.cancelExport = cancelExport;
    function isSmallDevice() {
        return document.body.clientWidth < 540;
    }
    MakerJsPlayground.isSmallDevice = isSmallDevice;
    function onWindowResize() {
        if (checkFitToScreen.checked) {
            fitOnScreen();
            render();
        }
        if (MakerJsPlayground.fullScreen) {
            dockEditor(dockModes.FullScreen);
        }
        else if (document.body.offsetWidth < minDockSideBySide) {
            dockEditor(dockModes.None);
        }
        else {
            dockEditor(dockModes.SideBySide);
        }
    }
    MakerJsPlayground.onWindowResize = onWindowResize;
    //execution
    window.onload = function (ev) {
        if (window.orientation === void 0) {
            window.orientation = 'landscape';
        }
        //hide the customize menu when booting on small screens
        //if (document.body.clientWidth < 540) {
        //    document.body.classList.add('collapse-rendering-options');
        //}
        customizeMenu = document.getElementById('rendering-options-menu');
        view = document.getElementById('view');
        paramsDiv = document.getElementById('params');
        progress = document.getElementById('download-progress');
        preview = document.getElementById('download-preview');
        checkFitToScreen = document.getElementById('check-fit-on-screen');
        viewSvgContainer = document.getElementById('view-svg-container');
        margin = [viewSvgContainer.offsetLeft, viewSvgContainer.offsetTop];
        var pre = document.getElementById('init-javascript-code');
        MakerJsPlayground.codeMirrorOptions.value = pre.innerText;
        MakerJsPlayground.codeMirrorEditor = CodeMirror(function (elt) {
            pre.parentNode.replaceChild(elt, pre);
        }, MakerJsPlayground.codeMirrorOptions);
        if (MakerJsPlayground.fullScreen) {
            dockEditor(dockModes.FullScreen);
        }
        else if (document.body.offsetWidth >= minDockSideBySide) {
            dockEditor(dockModes.SideBySide);
        }
        setProcessedModel(new Wait(), '', false);
        MakerJsPlayground.querystringParams = new QueryStringParams();
        var parentLoad = MakerJsPlayground.querystringParams['parentload'];
        if (parentLoad) {
            var fn = parent[parentLoad];
            var loadCode = fn();
            MakerJsPlayground.codeMirrorEditor.getDoc().setValue(loadCode);
            runCodeFromEditor();
        }
        else {
            var scriptname = MakerJsPlayground.querystringParams['script'];
            if (scriptname && !isHttp(scriptname)) {
                if ((scriptname in makerjs.models) && scriptname !== 'Text') {
                    var code = generateCodeFromKit(scriptname, makerjs.models[scriptname]);
                    MakerJsPlayground.codeMirrorEditor.getDoc().setValue(code);
                    runCodeFromEditor();
                }
                else {
                    downloadScript(filenameFromRequireId(scriptname), function (download) {
                        MakerJsPlayground.codeMirrorEditor.getDoc().setValue(download);
                        runCodeFromEditor();
                    });
                }
            }
            else {
                runCodeFromEditor();
            }
        }
    };
})(MakerJsPlayground || (MakerJsPlayground = {}));
//# sourceMappingURL=playground.js.map