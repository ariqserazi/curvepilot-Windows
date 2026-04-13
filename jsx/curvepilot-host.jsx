var CurvePilotHost = CurvePilotHost || {}

CurvePilotHost._decodePayload = function (encodedPayload) {
    if (!encodedPayload) {
        return {}
    }
    return JSON.parse(decodeURIComponent(encodedPayload))
}

CurvePilotHost._result = function (ok, data, error) {
    return JSON.stringify({
        ok: ok,
        data: data || null,
        error: error || null
    })
}

CurvePilotHost._error = function (code, message, hint) {
    return {
        code: code,
        message: message,
        hint: hint || ""
    }
}

CurvePilotHost._normalize = function (value) {
    var stringValue = String(value || "").toLowerCase()
    stringValue = stringValue.replace(/^\s+|\s+$/g, "")
    stringValue = stringValue.replace(/\s+/g, " ")
    return stringValue
}

CurvePilotHost._collectionLength = function (collection) {
    if (!collection) {
        return 0
    }
    if (typeof collection.numItems === "number") {
        return collection.numItems
    }
    if (typeof collection.length === "number") {
        return collection.length
    }
    if (typeof collection.numTracks === "number") {
        return collection.numTracks
    }
    return 0
}

CurvePilotHost._clamp = function (value, min, max) {
    return Math.min(max, Math.max(min, value))
}

CurvePilotHost._round = function (value, precision) {
    var factor = Math.pow(10, precision || 3)
    return Math.round(value * factor) / factor
}

CurvePilotHost._lerp = function (start, end, amount) {
    return start + (end - start) * amount
}

CurvePilotHost._isArray = function (value) {
    return Object.prototype.toString.call(value) === "[object Array]"
}

CurvePilotHost._buildTimeFromSeconds = function (seconds) {
    var time = new Time()
    time.seconds = Math.max(0, seconds)
    return time
}

CurvePilotHost._safeNumber = function (value, fallback) {
    var numeric = Number(value)
    return isFinite(numeric) ? numeric : fallback
}

CurvePilotHost._sortTimes = function (times) {
    times.sort(function (left, right) {
        return left.seconds - right.seconds
    })
    return times
}

CurvePilotHost._getSelectedVideoClips = function (sequence) {
    var clips = []
    var trackCount = CurvePilotHost._collectionLength(sequence.videoTracks)
    var trackIndex
    var clipIndex
    var track
    var trackClips
    var clip

    for (trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
        track = sequence.videoTracks[trackIndex]
        trackClips = track.clips

        for (clipIndex = 0; clipIndex < CurvePilotHost._collectionLength(trackClips); clipIndex += 1) {
            clip = trackClips[clipIndex]

            if (!clip || !clip.isSelected || !clip.isSelected()) {
                continue
            }

            clips.push({
                trackIndex: trackIndex,
                clipIndex: clipIndex,
                name: clip.name || ("Clip " + (clipIndex + 1)),
                startSeconds: clip.start.seconds,
                endSeconds: clip.end.seconds,
                durationSeconds: clip.duration.seconds
            })
        }
    }

    return clips
}

CurvePilotHost._getClipRef = function (clipIdentity) {
    var sequence = app.project.activeSequence
    if (!sequence) {
        return null
    }

    if (!sequence.videoTracks || !sequence.videoTracks[clipIdentity.trackIndex]) {
        return null
    }

    var track = sequence.videoTracks[clipIdentity.trackIndex]
    if (!track.clips || !track.clips[clipIdentity.clipIndex]) {
        return null
    }

    return track.clips[clipIdentity.clipIndex]
}

CurvePilotHost._descriptorBlueprints = [
    {
        id: "motion.position",
        label: "Position",
        kind: "point",
        group: "Motion",
        componentHints: ["motion", "adbe motion"],
        propertyHints: ["position"]
    },
    {
        id: "motion.scale",
        label: "Scale",
        kind: "number",
        group: "Motion",
        componentHints: ["motion", "adbe motion"],
        propertyHints: ["scale"]
    },
    {
        id: "motion.rotation",
        label: "Rotation",
        kind: "number",
        group: "Motion",
        componentHints: ["motion", "adbe motion"],
        propertyHints: ["rotation"]
    },
    {
        id: "opacity.opacity",
        label: "Opacity",
        kind: "number",
        group: "Opacity",
        componentHints: ["opacity", "adbe opacity"],
        propertyHints: ["opacity"]
    }
]

CurvePilotHost._propertySupportsKeyframes = function (property) {
    return Boolean(
        property &&
        property.getValueAtTime &&
        property.setTimeVarying &&
        property.setValueAtKey &&
        property.addKey &&
        property.getKeys
    )
}

CurvePilotHost._matchesHint = function (name, hints) {
    var normalized = CurvePilotHost._normalize(name)
    var index
    for (index = 0; index < hints.length; index += 1) {
        if (normalized.indexOf(hints[index]) !== -1) {
            return true
        }
    }
    return false
}

CurvePilotHost._inspectClipProperties = function (clipIdentity, includeAdvanced) {
    var clip = CurvePilotHost._getClipRef(clipIdentity)
    var discovered = {}
    var componentCount
    var componentIndex
    var propertyIndex
    var component
    var componentName
    var componentMatchName
    var properties
    var property
    var propertyName
    var sampleTime
    var sampleValue
    var blueprintIndex
    var blueprint
    var descriptorId

    if (!clip) {
        return discovered
    }

    componentCount = CurvePilotHost._collectionLength(clip.components)
    sampleTime = CurvePilotHost._buildTimeFromSeconds(clipIdentity.startSeconds)

    for (componentIndex = 0; componentIndex < componentCount; componentIndex += 1) {
        component = clip.components[componentIndex]
        componentName = component.displayName || component.name || ""
        componentMatchName = component.matchName || ""
        properties = component.properties

        for (propertyIndex = 0; propertyIndex < CurvePilotHost._collectionLength(properties); propertyIndex += 1) {
            property = properties[propertyIndex]
            propertyName = property.displayName || property.name || ("Property " + propertyIndex)

            for (blueprintIndex = 0; blueprintIndex < CurvePilotHost._descriptorBlueprints.length; blueprintIndex += 1) {
                blueprint = CurvePilotHost._descriptorBlueprints[blueprintIndex]

                if (!CurvePilotHost._matchesHint(componentMatchName || componentName, blueprint.componentHints)) {
                    continue
                }

                if (!CurvePilotHost._matchesHint(propertyName, blueprint.propertyHints)) {
                    continue
                }

                if (!CurvePilotHost._propertySupportsKeyframes(property)) {
                    continue
                }

                discovered[blueprint.id] = {
                    id: blueprint.id,
                    label: blueprint.label,
                    kind: blueprint.kind,
                    group: blueprint.group,
                    componentName: componentName,
                    componentMatchName: componentMatchName,
                    propertyName: propertyName,
                    keyCount: CurvePilotHost._getKeys(property).length
                }
            }

            if (!includeAdvanced) {
                continue
            }

            if (!CurvePilotHost._propertySupportsKeyframes(property)) {
                continue
            }

            try {
                sampleValue = property.getValueAtTime(sampleTime)
            } catch (sampleError) {
                sampleValue = null
            }

            if (typeof sampleValue !== "number") {
                continue
            }

            descriptorId = "advanced:" +
                CurvePilotHost._normalize(componentMatchName || componentName) +
                ":" +
                CurvePilotHost._normalize(propertyName)

            if (!discovered[descriptorId]) {
                discovered[descriptorId] = {
                    id: descriptorId,
                    label: componentName + " / " + propertyName,
                    kind: "number",
                    group: "Advanced",
                    componentName: componentName,
                    componentMatchName: componentMatchName,
                    propertyName: propertyName,
                    keyCount: CurvePilotHost._getKeys(property).length
                }
            }
        }
    }

    return discovered
}

CurvePilotHost._getCommonProperties = function (selectedClips, includeAdvanced) {
    var propertyMaps = []
    var commonDescriptors = []
    var clipIndex
    var map
    var ids
    var idIndex
    var candidateId
    var allContain
    var minKeyCount

    if (!selectedClips.length) {
        return []
    }

    for (clipIndex = 0; clipIndex < selectedClips.length; clipIndex += 1) {
        propertyMaps.push(CurvePilotHost._inspectClipProperties(selectedClips[clipIndex], includeAdvanced))
    }

    ids = []
    for (candidateId in propertyMaps[0]) {
        if (propertyMaps[0].hasOwnProperty(candidateId)) {
            ids.push(candidateId)
        }
    }

    for (idIndex = 0; idIndex < ids.length; idIndex += 1) {
        candidateId = ids[idIndex]
        allContain = true
        minKeyCount = propertyMaps[0][candidateId].keyCount || 0

        for (clipIndex = 1; clipIndex < propertyMaps.length; clipIndex += 1) {
            map = propertyMaps[clipIndex]
            if (!map[candidateId]) {
                allContain = false
                break
            }
            minKeyCount = Math.min(minKeyCount, map[candidateId].keyCount || 0)
        }

        if (allContain) {
            propertyMaps[0][candidateId].keyCount = minKeyCount
            propertyMaps[0][candidateId].endpointReady = minKeyCount >= 2
            commonDescriptors.push(propertyMaps[0][candidateId])
        }
    }

    commonDescriptors.sort(function (left, right) {
        if ((left.endpointReady ? 1 : 0) !== (right.endpointReady ? 1 : 0)) {
            return (right.endpointReady ? 1 : 0) - (left.endpointReady ? 1 : 0)
        }

        if ((left.keyCount || 0) !== (right.keyCount || 0)) {
            return (right.keyCount || 0) - (left.keyCount || 0)
        }

        return String(left.label).localeCompare(String(right.label))
    })

    return commonDescriptors
}

CurvePilotHost._resolvePropertyRef = function (clipIdentity, descriptorId, includeAdvanced) {
    var clip = CurvePilotHost._getClipRef(clipIdentity)
    var componentCount
    var componentIndex
    var component
    var componentName
    var componentMatchName
    var properties
    var propertyIndex
    var property
    var propertyName
    var blueprintIndex
    var blueprint
    var generatedDescriptorId

    if (!clip) {
        throw new Error("Selected clip could not be resolved in the active sequence.")
    }

    componentCount = CurvePilotHost._collectionLength(clip.components)

    for (componentIndex = 0; componentIndex < componentCount; componentIndex += 1) {
        component = clip.components[componentIndex]
        componentName = component.displayName || component.name || ""
        componentMatchName = component.matchName || ""
        properties = component.properties

        for (propertyIndex = 0; propertyIndex < CurvePilotHost._collectionLength(properties); propertyIndex += 1) {
            property = properties[propertyIndex]
            propertyName = property.displayName || property.name || ("Property " + propertyIndex)

            for (blueprintIndex = 0; blueprintIndex < CurvePilotHost._descriptorBlueprints.length; blueprintIndex += 1) {
                blueprint = CurvePilotHost._descriptorBlueprints[blueprintIndex]
                if (descriptorId !== blueprint.id) {
                    continue
                }

                if (!CurvePilotHost._matchesHint(componentMatchName || componentName, blueprint.componentHints)) {
                    continue
                }

                if (!CurvePilotHost._matchesHint(propertyName, blueprint.propertyHints)) {
                    continue
                }

                return {
                    property: property,
                    kind: blueprint.kind,
                    label: blueprint.label
                }
            }

            if (includeAdvanced) {
                generatedDescriptorId = "advanced:" +
                    CurvePilotHost._normalize(componentMatchName || componentName) +
                    ":" +
                    CurvePilotHost._normalize(propertyName)

                if (generatedDescriptorId === descriptorId) {
                    return {
                        property: property,
                        kind: "number",
                        label: componentName + " / " + propertyName
                    }
                }
            }
        }
    }

    throw new Error("Target property is no longer available on the selected clip.")
}

CurvePilotHost._getKeys = function (property) {
    var keys = property.getKeys ? property.getKeys() : []
    if (!keys || keys === 0) {
        return []
    }
    return CurvePilotHost._sortTimes(keys)
}

CurvePilotHost._getKeysInSpan = function (property, startTime, endTime) {
    var keys = CurvePilotHost._getKeys(property)
    var results = []
    var index
    for (index = 0; index < keys.length; index += 1) {
        if (keys[index].seconds >= startTime.seconds && keys[index].seconds <= endTime.seconds) {
            results.push(keys[index])
        }
    }
    return results
}

CurvePilotHost._buildSpan = function (clipIdentity, property, state) {
    var startPercent
    var endPercent
    var keys
    var startSeconds
    var endSeconds

    if (state.applyMode === "clipBounds") {
        return {
            startTime: CurvePilotHost._buildTimeFromSeconds(clipIdentity.startSeconds),
            endTime: CurvePilotHost._buildTimeFromSeconds(clipIdentity.endSeconds),
            spanLabel: "Clip bounds",
            autoCreatedEndpoints: false
        }
    }

    if (state.applyMode === "endpointKeys") {
        keys = CurvePilotHost._getKeys(property)
        if (keys.length < 2) {
            return {
                startTime: CurvePilotHost._buildTimeFromSeconds(clipIdentity.startSeconds),
                endTime: CurvePilotHost._buildTimeFromSeconds(clipIdentity.endSeconds),
                spanLabel: "Clip bounds (auto-created endpoints)",
                autoCreatedEndpoints: true
            }
        }

        return {
            startTime: keys[0],
            endTime: keys[keys.length - 1],
            spanLabel: "Existing endpoint keyframes",
            autoCreatedEndpoints: false
        }
    }

    startPercent = CurvePilotHost._clamp(Number(state.customStartPercent) / 100, 0, 1)
    endPercent = CurvePilotHost._clamp(Number(state.customEndPercent) / 100, 0, 1)

    if (endPercent <= startPercent) {
        throw CurvePilotHost._error(
            "INVALID_CUSTOM_SPAN",
            "Custom normalized span end must be greater than the start."
        )
    }

    startSeconds = clipIdentity.startSeconds + clipIdentity.durationSeconds * startPercent
    endSeconds = clipIdentity.startSeconds + clipIdentity.durationSeconds * endPercent

    return {
        startTime: CurvePilotHost._buildTimeFromSeconds(startSeconds),
        endTime: CurvePilotHost._buildTimeFromSeconds(endSeconds),
        spanLabel: Math.round(startPercent * 100) + "% to " + Math.round(endPercent * 100) + "%",
        autoCreatedEndpoints: false
    }
}

CurvePilotHost._resolveSampleCount = function (mode, customCount) {
    if (mode === "custom") {
        var parsed = Number(customCount)
        if (!isFinite(parsed)) {
            return 72
        }
        return Math.max(2, Math.min(180, Math.round(parsed)))
    }

    if (mode === "low") {
        return 10
    }
    if (mode === "high") {
        return 48
    }
    return 24
}

CurvePilotHost._sanitizeCurve = function (curve) {
    var cp1 = curve && curve.cp1 ? curve.cp1 : { x: 0.32, y: 0.12 }
    var cp2 = curve && curve.cp2 ? curve.cp2 : { x: 0.68, y: 0.88 }

    return {
        cp1: {
            x: CurvePilotHost._clamp(CurvePilotHost._safeNumber(cp1.x, 0.32), 0, 1),
            y: CurvePilotHost._clamp(CurvePilotHost._safeNumber(cp1.y, 0.12), -0.35, 1.35)
        },
        cp2: {
            x: CurvePilotHost._clamp(CurvePilotHost._safeNumber(cp2.x, 0.68), 0, 1),
            y: CurvePilotHost._clamp(CurvePilotHost._safeNumber(cp2.y, 0.88), -0.35, 1.35)
        }
    }
}

CurvePilotHost._cubicCoordinate = function (t, a1, a2) {
    var u = 1 - t
    return 3 * u * u * t * a1 + 3 * u * t * t * a2 + t * t * t
}

CurvePilotHost._cubicDerivative = function (t, a1, a2) {
    return 3 * (1 - t) * (1 - t) * a1 + 6 * (1 - t) * t * (a2 - a1) + 3 * t * t * (1 - a2)
}

CurvePilotHost._solveTForX = function (x, curve) {
    var safeX = CurvePilotHost._clamp(x, 0, 1)
    var t = safeX
    var index
    var currentX
    var slope
    var lower
    var upper

    for (index = 0; index < 8; index += 1) {
        currentX = CurvePilotHost._cubicCoordinate(t, curve.cp1.x, curve.cp2.x) - safeX
        slope = CurvePilotHost._cubicDerivative(t, curve.cp1.x, curve.cp2.x)

        if (Math.abs(currentX) < 0.000001) {
            return t
        }

        if (Math.abs(slope) < 0.000001) {
            break
        }

        t -= currentX / slope
    }

    lower = 0
    upper = 1
    t = safeX

    for (index = 0; index < 12; index += 1) {
        currentX = CurvePilotHost._cubicCoordinate(t, curve.cp1.x, curve.cp2.x)
        if (Math.abs(currentX - safeX) < 0.000001) {
            return t
        }

        if (currentX < safeX) {
            lower = t
        } else {
            upper = t
        }

        t = (lower + upper) / 2
    }

    return t
}

CurvePilotHost._evaluateBezier = function (curve, x) {
    var safeCurve = CurvePilotHost._sanitizeCurve(curve)
    var t = CurvePilotHost._solveTForX(x, safeCurve)
    return CurvePilotHost._cubicCoordinate(t, safeCurve.cp1.y, safeCurve.cp2.y)
}

CurvePilotHost._removeKeysInSpan = function (property, startTime, endTime) {
    var keys = CurvePilotHost._getKeysInSpan(property, startTime, endTime)
    var index
    for (index = keys.length - 1; index >= 0; index -= 1) {
        property.removeKey(keys[index])
    }
    return keys.length
}

CurvePilotHost._setInterpolationIfPossible = function (property, keyTime, interpolationMode) {
    if (!property.setInterpolationTypeAtKey) {
        return
    }

    try {
        property.setInterpolationTypeAtKey(keyTime, interpolationMode, interpolationMode)
    } catch (interpolationError) {
    }
}

CurvePilotHost._addOrUpdateKey = function (property, time, value, updateUI) {
    if (!property.isTimeVarying()) {
        property.setTimeVarying(true)
    }

    if (property.addKey) {
        property.addKey(time)
    }

    property.setValueAtKey(time, value, updateUI)
}

CurvePilotHost._valueIsFlat = function (startValue, endValue) {
    if (typeof startValue === "number" && typeof endValue === "number") {
        return Math.abs(startValue - endValue) < 0.0001
    }

    if (CurvePilotHost._isArray(startValue) && CurvePilotHost._isArray(endValue) && startValue.length === endValue.length) {
        var index
        for (index = 0; index < startValue.length; index += 1) {
            if (Math.abs(Number(startValue[index]) - Number(endValue[index])) >= 0.0001) {
                return false
            }
        }
        return true
    }

    return false
}

CurvePilotHost._getApplyModeLabel = function (mode) {
    if (mode === "endpointKeys") {
        return "Existing endpoint keyframes"
    }
    if (mode === "customSpan") {
        return "Custom normalized span"
    }
    return "Clip bounds"
}

CurvePilotHost.getContext = function (encodedPayload) {
    try {
        var payload = CurvePilotHost._decodePayload(encodedPayload)
        var project = app.project
        var sequence = project ? project.activeSequence : null
        var selectedClips = sequence ? CurvePilotHost._getSelectedVideoClips(sequence) : []
        var availableProperties = sequence ? CurvePilotHost._getCommonProperties(selectedClips, payload.advancedMode) : []
        var warningText = ""

        if (!project) {
            warningText = "Open a Premiere project before using CurvePilot."
        } else if (!sequence) {
            warningText = "Open an active sequence to target clip properties."
        } else if (!selectedClips.length) {
            warningText = "Select one or more video clips in the active sequence."
        } else if (!availableProperties.length) {
            warningText = "The current selection does not expose a shared supported Motion or numeric effect property set."
        }

        return CurvePilotHost._result(true, {
            projectName: project && project.name ? project.name : "",
            sequenceName: sequence && sequence.name ? sequence.name : "",
            selectedClips: selectedClips,
            availableProperties: availableProperties,
            warningText: warningText
        }, null)
    } catch (error) {
        return CurvePilotHost._result(false, null, CurvePilotHost._error(
            "CONTEXT_FAILED",
            error.message || "Unable to inspect the active Premiere selection."
        ))
    }
}

CurvePilotHost.previewApply = function (encodedPayload) {
    try {
        var payload = CurvePilotHost._decodePayload(encodedPayload)
        var project = app.project
        var sequence = project ? project.activeSequence : null
        var state = payload.state || {}
        var selectedClips = sequence ? CurvePilotHost._getSelectedVideoClips(sequence) : []
        var selectedPropertyIds = payload.selectedPropertyIds || []
        var estimatedAdds = 0
        var existingKeysInSpan = 0
        var propertyLabels = []
        var flatSpanWarning = false
        var autoCreatedEndpoints = false
        var clipIndex
        var propertyIndex
        var clipIdentity
        var propertyRef
        var span
        var startValue
        var endValue

        if (!sequence || !selectedClips.length) {
            return CurvePilotHost._result(true, {
                clipsCount: 0,
                propertyLabels: [],
                estimatedAdds: 0,
                existingKeysInSpan: 0,
                denseWarning: false,
                flatSpanWarning: false,
                applyModeLabel: CurvePilotHost._getApplyModeLabel(state.applyMode),
                sampleCount: CurvePilotHost._resolveSampleCount(state.sampleDensity, state.customSampleCount)
            }, null)
        }

        for (clipIndex = 0; clipIndex < selectedClips.length; clipIndex += 1) {
            clipIdentity = selectedClips[clipIndex]

            for (propertyIndex = 0; propertyIndex < selectedPropertyIds.length; propertyIndex += 1) {
                propertyRef = CurvePilotHost._resolvePropertyRef(clipIdentity, selectedPropertyIds[propertyIndex], state.advancedMode)
                span = CurvePilotHost._buildSpan(clipIdentity, propertyRef.property, state)
                if (span.autoCreatedEndpoints) {
                    autoCreatedEndpoints = true
                }
                estimatedAdds += CurvePilotHost._resolveSampleCount(state.sampleDensity, state.customSampleCount)
                existingKeysInSpan += CurvePilotHost._getKeysInSpan(propertyRef.property, span.startTime, span.endTime).length
                startValue = propertyRef.property.getValueAtTime(span.startTime)
                endValue = propertyRef.property.getValueAtTime(span.endTime)

                if (CurvePilotHost._valueIsFlat(startValue, endValue)) {
                    flatSpanWarning = true
                }

                if (propertyLabels.indexOf(propertyRef.label) === -1) {
                    propertyLabels.push(propertyRef.label)
                }
            }
        }

        return CurvePilotHost._result(true, {
            clipsCount: selectedClips.length,
            propertyLabels: propertyLabels,
            estimatedAdds: estimatedAdds,
            existingKeysInSpan: existingKeysInSpan,
            denseWarning: existingKeysInSpan >= Math.max(12, selectedClips.length * Math.max(1, selectedPropertyIds.length) * 8),
            flatSpanWarning: flatSpanWarning,
            autoCreatedEndpoints: autoCreatedEndpoints,
            applyModeLabel: CurvePilotHost._getApplyModeLabel(state.applyMode),
            sampleCount: CurvePilotHost._resolveSampleCount(state.sampleDensity, state.customSampleCount)
        }, null)
    } catch (error) {
        return CurvePilotHost._result(false, null, CurvePilotHost._error(
            error.code || "PREVIEW_FAILED",
            error.message || "CurvePilot could not build the dry-run preview.",
            error.hint || ""
        ))
    }
}

CurvePilotHost._interpolationMap = {
    LINEAR: 1,
    HOLD: 0,
    BEZIER: 5
}

CurvePilotHost.applyCurve = function (encodedPayload) {
    try {
        var payload = CurvePilotHost._decodePayload(encodedPayload)
        var project = app.project
        var sequence = project ? project.activeSequence : null
        var state = payload.state || {}
        var selectedClips = sequence ? CurvePilotHost._getSelectedVideoClips(sequence) : []
        var selectedPropertyIds = payload.selectedPropertyIds || []
        var interpolation = CurvePilotHost._interpolationMap[state.interpolationMode] || CurvePilotHost._interpolationMap.BEZIER
        var clipIndex
        var propertyIndex
        var clipIdentity
        var propertyRef
        var span
        var sampleCount
        var startValue
        var endValue
        var spanSeconds
        var normalizedTime
        var progress
        var sampleSeconds
        var keyTime
        var nextValue
        var createdKeys
        var totalCreatedKeys = 0
        var autoCreatedEndpoints = false

        if (!sequence) {
            return CurvePilotHost._result(false, null, CurvePilotHost._error(
                "NO_SEQUENCE",
                "Open an active sequence before applying CurvePilot."
            ))
        }

        if (!selectedClips.length) {
            return CurvePilotHost._result(false, null, CurvePilotHost._error(
                "NO_CLIPS",
                "Select at least one video clip in the active sequence."
            ))
        }

        if (!selectedPropertyIds.length) {
            return CurvePilotHost._result(false, null, CurvePilotHost._error(
                "NO_PROPERTIES",
                "Pick at least one target property before applying."
            ))
        }

        sampleCount = CurvePilotHost._resolveSampleCount(state.sampleDensity, state.customSampleCount)

        for (clipIndex = 0; clipIndex < selectedClips.length; clipIndex += 1) {
            clipIdentity = selectedClips[clipIndex]

            for (propertyIndex = 0; propertyIndex < selectedPropertyIds.length; propertyIndex += 1) {
                propertyRef = CurvePilotHost._resolvePropertyRef(clipIdentity, selectedPropertyIds[propertyIndex], state.advancedMode)
                span = CurvePilotHost._buildSpan(clipIdentity, propertyRef.property, state)
                if (span.autoCreatedEndpoints) {
                    autoCreatedEndpoints = true
                }
                startValue = propertyRef.property.getValueAtTime(span.startTime)
                endValue = propertyRef.property.getValueAtTime(span.endTime)
                spanSeconds = span.endTime.seconds - span.startTime.seconds

                if (spanSeconds <= 0) {
                    return CurvePilotHost._result(false, null, CurvePilotHost._error(
                        "INVALID_SPAN",
                        "The chosen span is too short to generate easing keyframes."
                    ))
                }

                CurvePilotHost._removeKeysInSpan(propertyRef.property, span.startTime, span.endTime)
                createdKeys = 0

                for (var sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
                    normalizedTime = sampleCount === 1 ? 0 : sampleIndex / (sampleCount - 1)
                    progress = CurvePilotHost._evaluateBezier(state.curve, normalizedTime)
                    sampleSeconds = span.startTime.seconds + spanSeconds * normalizedTime
                    keyTime = CurvePilotHost._buildTimeFromSeconds(sampleSeconds)

                    if (propertyRef.kind === "point") {
                        nextValue = [
                            CurvePilotHost._lerp(Number(startValue[0]), Number(endValue[0]), progress),
                            CurvePilotHost._lerp(Number(startValue[1]), Number(endValue[1]), progress)
                        ]
                    } else {
                        nextValue = CurvePilotHost._lerp(Number(startValue), Number(endValue), progress)
                    }

                    CurvePilotHost._addOrUpdateKey(propertyRef.property, keyTime, nextValue, sampleIndex === sampleCount - 1 ? 1 : 0)
                    CurvePilotHost._setInterpolationIfPossible(propertyRef.property, keyTime, interpolation)
                    createdKeys += 1
                }

                totalCreatedKeys += createdKeys
            }
        }

        return CurvePilotHost._result(true, {
            clipsChanged: selectedClips.length,
            propertiesChanged: selectedPropertyIds.length,
            createdKeys: totalCreatedKeys,
            autoCreatedEndpoints: autoCreatedEndpoints
        }, null)
    } catch (error) {
        return CurvePilotHost._result(false, null, CurvePilotHost._error(
            error.code || "APPLY_FAILED",
            error.message || "CurvePilot could not apply the sampled easing curve.",
            error.hint || ""
        ))
    }
}

CurvePilotHost.clearKeys = function (encodedPayload) {
    try {
        var payload = CurvePilotHost._decodePayload(encodedPayload)
        var project = app.project
        var sequence = project ? project.activeSequence : null
        var state = payload.state || {}
        var selectedClips = sequence ? CurvePilotHost._getSelectedVideoClips(sequence) : []
        var selectedPropertyIds = payload.selectedPropertyIds || []
        var clipIndex
        var propertyIndex
        var clipIdentity
        var propertyRef
        var keys
        var keyIndex
        var removedKeys = 0

        if (!sequence) {
            return CurvePilotHost._result(false, null, CurvePilotHost._error(
                "NO_SEQUENCE",
                "Open an active sequence before clearing CurvePilot keyframes."
            ))
        }

        if (!selectedClips.length) {
            return CurvePilotHost._result(false, null, CurvePilotHost._error(
                "NO_CLIPS",
                "Select at least one video clip in the active sequence."
            ))
        }

        if (!selectedPropertyIds.length) {
            return CurvePilotHost._result(false, null, CurvePilotHost._error(
                "NO_PROPERTIES",
                "Pick at least one target property before clearing."
            ))
        }

        for (clipIndex = 0; clipIndex < selectedClips.length; clipIndex += 1) {
            clipIdentity = selectedClips[clipIndex]

            for (propertyIndex = 0; propertyIndex < selectedPropertyIds.length; propertyIndex += 1) {
                propertyRef = CurvePilotHost._resolvePropertyRef(clipIdentity, selectedPropertyIds[propertyIndex], state.advancedMode)
                keys = CurvePilotHost._getKeys(propertyRef.property)

                for (keyIndex = keys.length - 1; keyIndex >= 0; keyIndex -= 1) {
                    propertyRef.property.removeKey(keys[keyIndex])
                    removedKeys += 1
                }
            }
        }

        return CurvePilotHost._result(true, {
            clipsChanged: selectedClips.length,
            propertiesChanged: selectedPropertyIds.length,
            removedKeys: removedKeys
        }, null)
    } catch (error) {
        return CurvePilotHost._result(false, null, CurvePilotHost._error(
            error.code || "CLEAR_FAILED",
            error.message || "CurvePilot could not clear the selected keyframes.",
            error.hint || ""
        ))
    }
}

CurvePilotHost.importPresets = function () {
    try {
        var file = File.openDialog("Import CurvePilot presets", "*.json", false)
        var content
        var parsed
        var presets
        var index
        var imported = []

        if (!file) {
            return CurvePilotHost._result(true, [], null)
        }

        file.encoding = "UTF-8"
        if (!file.open("r")) {
            return CurvePilotHost._result(false, null, CurvePilotHost._error(
                "IMPORT_OPEN_FAILED",
                "CurvePilot could not open the selected preset file."
            ))
        }

        content = file.read()
        file.close()
        parsed = JSON.parse(content)
        presets = parsed && parsed.presets ? parsed.presets : []

        for (index = 0; index < presets.length; index += 1) {
            imported.push({
                id: presets[index].id || ("imported-" + index),
                name: presets[index].name || ("Imported " + (index + 1)),
                curve: presets[index].curve
            })
        }

        return CurvePilotHost._result(true, imported, null)
    } catch (error) {
        return CurvePilotHost._result(false, null, CurvePilotHost._error(
            "IMPORT_FAILED",
            error.message || "CurvePilot could not import the selected preset file."
        ))
    }
}

CurvePilotHost.exportPresets = function (encodedPayload) {
    try {
        var payload = CurvePilotHost._decodePayload(encodedPayload)
        var file = File.saveDialog("Export CurvePilot presets", "*.json")
        var targetFile = file
        var data

        if (!file) {
            return CurvePilotHost._result(true, { saved: false }, null)
        }

        if (String(file.name).toLowerCase().indexOf(".json") === -1) {
            targetFile = new File(file.fsName + ".json")
        }

        data = JSON.stringify({
            schema: "curvepilot.presets.v1",
            exportedAt: new Date().toUTCString(),
            presets: payload.presets || []
        }, null, 2)

        targetFile.encoding = "UTF-8"
        if (!targetFile.open("w")) {
            return CurvePilotHost._result(false, null, CurvePilotHost._error(
                "EXPORT_OPEN_FAILED",
                "CurvePilot could not open the chosen export path for writing."
            ))
        }

        targetFile.write(data)
        targetFile.close()

        return CurvePilotHost._result(true, {
            saved: true,
            path: targetFile.fsName
        }, null)
    } catch (error) {
        return CurvePilotHost._result(false, null, CurvePilotHost._error(
            "EXPORT_FAILED",
            error.message || "CurvePilot could not export the preset library."
        ))
    }
}
