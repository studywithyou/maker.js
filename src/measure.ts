﻿/// <reference path="model.ts" />

module Maker.Measure {

    /**
     * Interface to Math.min and Math.max functions.
     */
    interface IMathMinMax {
        (...values: number[]): number;
    }

    /**
     * Total angle of an arc between its start and end angles.
     * 
     * @param arc The arc to measure.
     * @returns Angle of arc.
     */
    export function ArcAngle(arc: IMakerPathArc): number {
        var endAngle = Angle.ArcEndAnglePastZero(arc);
        return endAngle - arc.startAngle;
    }

    /**
     * Calculates the distance between two points.
     * 
     * @param a First point.
     * @param b Second point.
     * @returns Distance between points.
     */
    export function PointDistance(a: IMakerPoint, b: IMakerPoint): number {
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function extremePoint(a: IMakerPoint, b: IMakerPoint, fn: IMathMinMax): IMakerPoint {
        return {
            x: fn(a.x, b.x),
            y: fn(a.y, b.y)
        };
    }

    /**
     * Calculates the smallest rectangle which contains a path.
     * 
     * @param path The path to measure.
     * @returns object with low and high points.
     */
    export function PathExtents(path: IMakerPath): IMakerMeasure {
        var map: IMakerPathFunctionMap = {};
        var measurement: IMakerMeasure = { low: null, high: null };

        map[PathType.Line] = function (line: IMakerPathLine) {
            measurement.low = extremePoint(line.origin, line.end, Math.min);
            measurement.high = extremePoint(line.origin, line.end, Math.max);
        }

        map[PathType.Circle] = function (circle: IMakerPathCircle) {
            var r = circle.radius;
            measurement.low = Point.Add(circle.origin, { x: -r, y: -r });
            measurement.high = Point.Add(circle.origin, { x: r, y: r });
        }

        map[PathType.Arc] = function (arc: IMakerPathArc) {
            var r = arc.radius;
            var startPoint = Point.FromPolar(Angle.ToRadians(arc.startAngle), r);
            var endPoint = Point.FromPolar(Angle.ToRadians(arc.endAngle), r);

            var startAngle = arc.startAngle;
            var endAngle = Angle.ArcEndAnglePastZero(arc);

            if (startAngle < 0) {
                startAngle += 360;
                endAngle += 360;
            }

            function extremeAngle(xAngle: number, yAngle: number, value: number, fn: IMathMinMax): IMakerPoint {
                var point = extremePoint(startPoint, endPoint, fn);

                if (startAngle < xAngle && xAngle < endAngle) {
                    point.x = value;
                }

                if (startAngle < yAngle && yAngle < endAngle) {
                    point.y = value;
                }

                return Point.Add(arc.origin, point);
            }

            measurement.low = extremeAngle(180, 270, -r, Math.min);
            measurement.high = extremeAngle(360, 90, r, Math.max);
        }

        var fn = map[path.type];
        if (fn) {
            fn(path);
        }

        return measurement;
    }

    /**
     * Measures the length of a path.
     * 
     * @param path The path to measure.
     * @returns Length of the path.
     */
    export function PathLength(path: IMakerPath): number {
        var map: IMakerPathFunctionMap = {};
        var value = 0;

        map[PathType.Line] = function (line: IMakerPathLine) {
            value = PointDistance(line.origin, line.end);
        }

        map[PathType.Circle] = function (circle: IMakerPathCircle) {
            value = 2 * Math.PI * circle.radius;
        }

        map[PathType.Arc] = function (arc: IMakerPathArc) {
            map[PathType.Circle](arc); //this sets the value var
            var pct = ArcAngle(arc) / 360;
            value *= pct;
        } 

        var fn = map[path.type];
        if (fn) {
            fn(path);
        }

        return value;
    }

    /**
     * Measures the smallest rectangle which contains a model.
     * 
     * @param model The model to measure.
     * @returns object with low and high points.
     */
    export function ModelExtents(model: IMakerModel): IMakerMeasure {
        var totalMeasurement: IMakerMeasure = { low: { x: null, y: null }, high: { x: null, y: null } };

        function lowerOrHigher(offsetOrigin: IMakerPoint, pathMeasurement: IMakerMeasure) {

            function getExtreme(a: IMakerPoint, b: IMakerPoint, fn: IMathMinMax) {
                var c = Point.Add(b, offsetOrigin);
                a.x = (a.x == null ? c.x : fn(a.x, c.x));
                a.y = (a.y == null ? c.y : fn(a.y, c.y));
            }

            getExtreme(totalMeasurement.low, pathMeasurement.low, Math.min);
            getExtreme(totalMeasurement.high, pathMeasurement.high, Math.max);
        }

        function measure(model: IMakerModel, offsetOrigin?: IMakerPoint) {

            var newOrigin = Point.Add(model.origin, offsetOrigin);

            if (model.paths) {
                for (var i = 0; i < model.paths.length; i++) {
                    lowerOrHigher(newOrigin, PathExtents(model.paths[i]));
                }
            }

            if (model.models) {
                for (var i = 0; i < model.models.length; i++) {
                    measure(model.models[i], newOrigin);
                }
            }
        }

        measure(model);

        return totalMeasurement;
    }

}