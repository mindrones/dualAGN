
var data, filters;
var plot2, plot3;

var div_filters, div_focus;
var plot1_svg, plot1_g, plot1_xlabel, plot1_ylabel;
var plot2_svg, plot2_g, plot2_xlabel, plot2_ylabel;
var plot3_svg, plot3_g, plot3_xlabel, plot3_ylabel;

var extents;
var HAS_ADAPTIVE_RANGES = false;
var RANGE_X = [-2.5, 1.5];
var RANGE_Y = [-2.0, 2.5];
var RANGE_STEP = 0.5;

init();


function init() {
    d3.text('https://39b3fe24c6b2583d62db6bedbe45e61fefeb08b5.googledrive.com/host/0B5lt28Afi0VsMzRQZWVFSjNYcm8/data.csv', function(err, text) {
        if (err) {
            console.log('d3.text error: ', err);
            return;
        }
        data = d3.csv.parseRows(text);
        data_transform();
        
        filters_init();
        focus_init();
        plots_init();
        plot_1();
        plot_2();
        plot_3();
    });
}


function data_transform() {
//    0      1              2                       3        4     5          6         7         8        9
//    SDSSID Classification Peculiarity             Redshift Type  logOIII_Hb logNII_Ha logSII_Ha logOI_Ha SFR
//    string pp | as | ?    None | 2 | A | A2 | ?   number   2 | ? number     number    number    number   number
    
    filters = {
        classification: {},
        peculiarity: {},
        type: {},
    };
    
    if (HAS_ADAPTIVE_RANGES) {
        extents = {
            redshift: [],
            log_OIII_Hb: [],
            log_NII_Ha: [],
            log_SII_Ha: [],
            log_OI_Ha: [],
            SFR: []
        };
    }
    data =
        _.chain(data)
        .map(function(row) {
            var obj = {
                SDSS_ID: row[0],
                classification: row[1],
                peculiarity: row[2],
                redshift: +row[3],
                type: row[4],
                log_OIII_Hb: +row[5],
                log_NII_Ha: +row[6],
                log_SII_Ha: +row[7],
                log_OI_Ha: +row[8],
                SFR: +row[9],
                band: undefined
            };
            
            var x = obj.log_NII_Ha;
            var y = obj.log_OIII_Hb;
            if (y < stravinska_NII(x)) {
                obj.band = 'below_stravinska';
            } else if (y < kauffmann(x)) {
                obj.band = 'below_kauffmann';
            } else if (y < log_OIII_Hb_NII(x)) {
                obj.band = 'below_predicted';
            } else {
                obj.band = 'above_predicted';
            }
            
            if (HAS_ADAPTIVE_RANGES) {
                _.each(extents, function(value, key, _extents) {
                    _extents[key].push(obj[key]);
                });
            }
            _.each(filters, function(value, key, _filters) {
                // true = button pressed, values filtered in
                _filters[key][obj[key]] = true;
            });
            
            return obj;
        })
        .sortBy(function(item) {
            return -item.SFR;
        })
        .value()
        ;
    
    if (HAS_ADAPTIVE_RANGES) {
        _.each(extents, function(value, key, _extents) {
            _extents[key] = d3.extent(value);
        });
    }
}


function filters_init() {
    
    div_filters = d3.select('#filters');
    
//    filters = {
//        classification: {'pp': true, 'as': true},
//        peculiarity: {'2': true, 'A': true},
//        type: {'2': true},
//    };
    
    var filtersData =
        _.map(filters, function(values, key) {
            return _.chain(values)
                    .map(function(value, _key) {
                        return {filter: key, name: _key};
                    })
                    .sortBy(function(item) {
                        return item.name;
                    })
                    .value()
                    ;
        });
    
//    [
//     [{"filter":"classification","name":"pp"},{"filter":"classification","name":"as"}],
//     [{"filter":"peculiarity","name":"2"},{"filter":"peculiarity","name":"A"}],
//     [{"filter":"type","name":"2"}]
//     ]
    
    var filter_div =
        div_filters.selectAll('.filter')
            .data(filtersData)
            .enter()
            .append('div')
            .classed('filter', true);
        
    filter_div.append('div')
        .classed('label', true)
        .append('span')
        .text(function(d, i) { return d[0].filter });
        
    filter_div.selectAll('.value')
        .data(function(d, i) { return d })
        .enter()
        .append('div')
        .classed('value', true)
        .append('span')
        .attr('class', function(d, i) {
            var _class;
            var options = filters[d.filter];
            if (_.size(options) > 1) {
                _class = ['button'];
                if (options[d.name]) {_class.push('pressed');}
                _class = _class.join(' ');
            } else {
                _class = 'single'
            }
            return _class;
        })
        .text(function(d) { return d.name })
        .on('click', filterClick)
        ;
    
    // todo simplify: select buttons and singles, onclick only on buttons
};


//===============
// plot 1
//===============

function plots_init() {
    plot1_svg = d3.select('#plot1 svg');
    plot1_g = plot1_svg.append('g');
    plot1_xlabel = d3.select('#plot1>:last-child>:last-child span');
    plot1_ylabel = d3.select('#plot1>:first-child span');
    
    plot2_svg = d3.select('#plot2 svg');
    plot2_g = plot2_svg.append('g');
    plot2_xlabel = d3.select('#plot2>:last-child span');
    
    plot3_svg = d3.select('#plot3 svg');
    plot3_g = plot3_svg.append('g');
    plot3_xlabel = d3.select('#plot3>:last-child span');
}

function plot_1() {
    
    // geometry
    
    var svg_css = getComputedStyle(plot1_svg.node(), null);
    var svg_width = parseInt(svg_css.width);
    var svg_height = parseInt(svg_css.height);
    var padding = {left: 30, right: 10, top: 10, bottom: 20};
    
    var g_width = svg_width - padding.left - padding.right;
    var g_height = svg_height - padding.top - padding.bottom;
    
//    plot1_svg
//        .attr('width', svg_width)
//        .attr('height', svg_height)
//        .attr('viewBox', "0 0 " + svg_width + "px " + svg_height + "px")
//    ;
    
    plot1_g.attr('transform', 'translate(' + padding.left + ',' + padding.top + ')');
    
    
    // scales
    
    var xPlotDomain, yPlotDomain;
    
    if (HAS_ADAPTIVE_RANGES) {
        
        var delta;
        
        delta = (extents.log_NII_Ha[1] - extents.log_NII_Ha[0]) / 10;
        xPlotDomain = [extents.log_NII_Ha[0] - delta, extents.log_NII_Ha[1] + delta];
        
        delta = (extents.log_OIII_Hb[1] - extents.log_OIII_Hb[0]) / 10;
        yPlotDomain = [extents.log_OIII_Hb[0] - delta, extents.log_OIII_Hb[1] + delta];
        
    } else {
        xPlotDomain = RANGE_X;
        yPlotDomain = RANGE_Y;
    }
    
    var x =
        d3.scale.linear()
        .domain(xPlotDomain)
        .range([0, g_width]);
    
    var y =
        d3.scale.linear()
        .domain(yPlotDomain)
        .range([g_height, 0]);
    
    
    // generators
    
    var line =
        d3.svg.line()
            .interpolate('basis')
            .x(function(d) { return x(d.x); })
            .y(function(d) { return y(d.y); });
    
    
    // axis
    
    var xAxis =
        d3.svg.axis()
            .scale(x)
            .innerTickSize(-6)
            .outerTickSize(-g_height)
            .tickValues(d3.range(xPlotDomain[0], xPlotDomain[1], RANGE_STEP).concat([xPlotDomain[1]]))
            ;
    
    // top
    plot1_g.append('g')
        .attr('class', 'x axis noticksvalue')
        .call(xAxis.orient('top'));
    
    // bottom
    plot1_g.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + g_height + ')')
        .call(xAxis.orient('bottom'))
        .selectAll('.tick text')
        .attr('dy', '1em')
        ;
    
    plot1_xlabel.text('log([N II] λ6584Å/Hα)');
    
    var yAxis =
        d3.svg.axis()
            .scale(y)
            .innerTickSize(-6)
            .outerTickSize(-g_width)
            .tickValues(d3.range(yPlotDomain[0], yPlotDomain[1], RANGE_STEP).concat([yPlotDomain[1]]))
            ;
    
    // left
    plot1_g.append('g')
        .attr('class', 'y axis')
        .call(yAxis.orient('left'))
        .selectAll('.tick text')
        .attr('dx', '-0.25em');
    
    // right
    plot1_g.append('g')
        .attr('class', 'y axis noticksvalue')
        .attr('transform', 'translate(' + g_width + ',0)')
        .call(yAxis.orient('right'));
    
    plot1_ylabel.text('log([O III] λ5007Å/Hβ)');

    
    // graphics
    
    var g1 = plot1_g.append('g');
        
    
    // eps curves
    
    _.each([-0.1, 0, 0.1], function(eps) {
        var xDomain = [
                       xPlotDomain[0],
                       _.min([xPlotDomain[1], log_OIII_Hb_NII_inverse(yPlotDomain[0], eps)])
                       ];
        
        var step = (xDomain[1] - xDomain[0]) / 50;
        var xRange = d3.range(xDomain[0], xDomain[1], step).concat([xDomain[1]]);
        
        var curvePoints =
            _.chain(xRange)
            .map(function(x) { return {x: x, y: log_OIII_Hb_NII(x, eps)} })
            .filter(function(point) { return point.y <= yPlotDomain[1]; })
            .value();
        
        g1
            .append('path')
            .classed({curve: true, eps: eps})
            .datum( curvePoints )
            .attr('d', line)
            ;
    });
    
    
    // kauffman curve
    
    var xDomainKauffmann = [
                            _.max([log_OIII_Hb_NII_kauffmann_intersection_X(0), xPlotDomain[0]]),
                            kauffmann_inverse(yPlotDomain[0])
                            ];
    var stepKauffmann = (xDomainKauffmann[1] - xDomainKauffmann[0]) / 50;
    var xRangeKauffmann = d3.range(xDomainKauffmann[0], xDomainKauffmann[1], stepKauffmann);
    xRangeKauffmann.push(xDomainKauffmann[1]);
    
    g1
    .append('path')
    .classed({curve: true, kauff: true})
    .datum( _.map(xRangeKauffmann, function(x) { return {x: x, y: kauffmann(x)} }) )
    .attr('d', line);
    
    
    // fill area
    
    var xDomainEps0 = [
                       log_OIII_Hb_NII_inverse(yPlotDomain[0]),
                       _.max([log_OIII_Hb_NII_kauffmann_intersection_X(0), xPlotDomain[0]]),
                       ];
    var step = (xDomainEps0[1] - xDomainEps0[0]) / 50;
    var xRangeEps0 = d3.range(xDomainEps0[0], xDomainEps0[1], step);
    xRangeEps0.push(xDomainEps0[1]);
    
    var path_d = line( _.map(xRangeKauffmann, function(x) { return {x: x, y: kauffmann(x)} }) );
    path_d += ' L' + x(log_OIII_Hb_NII_inverse(yPlotDomain[0])) + ',' + y(yPlotDomain[0]);
    path_d += line( _.map(xRangeEps0, function(x) { return {x: x, y: log_OIII_Hb_NII(x)} }) );
    path_d += ' L' + x(xRangeKauffmann[0]) + ',' + y(kauffmann(xRangeKauffmann[0]));
    path_d += 'Z';
    
    g1.insert('path', ":first-child")
        .classed({area: true})
        .attr('d', path_d);
    
    
    // stravinska_NII curve
    
    var xDomainStravinska = [
                            xPlotDomain[0],
                            find_stravinska_NII_intersection_X(yPlotDomain[0], xPlotDomain[0])
                            ];
    var stepStravinska = (xDomainStravinska[1] - xDomainStravinska[0]) / 50;
    var xRangeStravinska = d3.range(xDomainStravinska[0], xDomainStravinska[1], stepStravinska);
    xRangeStravinska.push(xDomainStravinska[1]);
    
    g1
    .append('path')
    .classed({curve: true, stravinska: true})
    .datum( _.map(xRangeStravinska, function(x) { return {x: x, y: stravinska_NII(x)} }) )
    .attr('d', line);
    
    
    // dots
    
    g1.selectAll('circle')
        .data(data)
        .enter()
        .append('circle')
//        .attr('r', 2)
        .attr('r', function(d) { return 1 + d.SFR / 20 })
        .attr('cx', function(d) { return x(d.log_NII_Ha) })
        .attr('cy', function(d) { return y(d.log_OIII_Hb) })
        .attr('class', function(d) { return d.band })
        .classed({dot: true})
        .on('mouseover', mouseover)
        .on('mouseout', mouseout)
        ;
}



// ===============
// plot 2
// ===============

function plot_2() {
    
    // geometry
    
    var svg_css = getComputedStyle(plot2_svg.node(), null);
    var svg_width = parseInt(svg_css.width);
    var svg_height = parseInt(svg_css.height);
    var padding = {left: 10, right: 10, top: 10, bottom: 20};
    
    var g_width = svg_width - padding.left - padding.right;
    var g_height = svg_height - padding.top - padding.bottom;
    
//    plot2_svg
//        .attr('width', svg_width)
//        .attr('height', svg_height)
//        .attr('viewBox', "0 0 " + svg_width + "px " + svg_height + "px")
//    ;
    
    plot2_g.attr('transform', 'translate(' + padding.left + ',' + padding.top + ')');
    
    
    // scales
    
    var xPlotDomain, yPlotDomain;
    
    if (HAS_ADAPTIVE_RANGES) {
        
        var delta;
        
        delta = (extents.log_SII_Ha[1] - extents.log_SII_Ha[0]) / 10;
        xPlotDomain = [extents.log_SII_Ha[0] - delta, extents.log_SII_Ha[1] + delta];
        
        delta = (extents.log_OIII_Hb[1] - extents.log_OIII_Hb[0]) / 10;
        yPlotDomain = [extents.log_OIII_Hb[0] - delta, extents.log_OIII_Hb[1] + delta];
        
    } else {
        xPlotDomain = RANGE_X;
        yPlotDomain = RANGE_Y;
    }
    
    var x =
        d3.scale.linear()
            .domain(xPlotDomain)
            .range([0, g_width]);
    
    var y =
        d3.scale.linear()
        .domain(yPlotDomain)
        .range([g_height, 0]);
    
    
    // generators
    
    var line =
        d3.svg.line()
            .interpolate('basis')
            .x(function(d) { return x(d.x); })
            .y(function(d) { return y(d.y); });
    
    
    // axis
    
    var xAxis =
        d3.svg.axis()
            .scale(x)
            .innerTickSize(-6)
            .outerTickSize(-g_height)
            .tickValues(d3.range(xPlotDomain[0], xPlotDomain[1], RANGE_STEP).concat([xPlotDomain[1]]))
            ;
    
    plot2_g.append('g')
        .attr('class', 'x axis noticksvalue')
        .call(xAxis.orient('top'));
    
    plot2_g.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + g_height + ')')
        .call(xAxis.orient('bottom'))
        .selectAll('.tick text')
        .attr('dy', '1em')
        ;
    
    plot2_xlabel.text('log([S II] λλ6716Å,6731Å/Hα)');
    
    var yAxis =
        d3.svg.axis()
            .scale(y)
            .innerTickSize(-6)
            .outerTickSize(-g_width)
            .tickValues(d3.range(yPlotDomain[0], yPlotDomain[1], RANGE_STEP).concat([yPlotDomain[1]]))
            ;
    
    plot2_g.append('g')
        .attr('class', 'y axis noticksvalue')
        .call(yAxis.orient('left'));
    
    plot2_g.append('g')
        .attr('class', 'y axis noticksvalue')
        .attr('transform', 'translate(' + g_width + ',0)')
        .call(yAxis.orient('right'));
    
    
    // graphics
    
    var g2 = plot2_g.append('g');
    
    
    // eps curves
    
    _.each([-0.1, 0, 0.1], function(eps) {
        var xDomain = [
                       xPlotDomain[0],
                       _.min([xPlotDomain[1], log_OIII_Hb_SII_inverse(yPlotDomain[0], eps)])
                       ];
        
        var step = (xDomain[1] - xDomain[0]) / 50;
        var xRange = d3.range(xDomain[0], xDomain[1], step).concat([xDomain[1]]);
        
        var curvePoints =
            _.chain(xRange)
            .map(function(x) { return {x: x, y: log_OIII_Hb_SII(x, eps)} })
            .filter(function(point) { return point.y <= yPlotDomain[1]; })
            .value();
        
        g2
            .append('path')
            .classed({curve: true, eps: eps})
            .datum( curvePoints )
            .attr('d', line)
            ;
    });
    
    
    // stravinska_SII curve
    var xDomainStravinska = [
                             _.min([stravinska_SII_inverse(yPlotDomain[0]), xPlotDomain[1]]),
                            xPlotDomain[0],
                            ];
    var stepStravinska = (xDomainStravinska[1] - xDomainStravinska[0]) / 50;
    var xRangeStravinska = d3.range(xDomainStravinska[0], xDomainStravinska[1], stepStravinska);
    xRangeStravinska.push(xDomainStravinska[1]);
    
    g2
    .append('path')
    .classed({curve: true, stravinska: true})
    .datum( _.map(xRangeStravinska, function(x) { return {x: x, y: stravinska_SII(x)} }) )
    .attr('d', line);
    
    
    // fill area
    
    var xDomainEps0 = [
                       xPlotDomain[0],
                       _.min([xPlotDomain[1], log_OIII_Hb_SII_inverse(yPlotDomain[0])])
                       ];
    var step = (xDomainEps0[1] - xDomainEps0[0]) / 50;
    var xRangeEps0 = d3.range(xDomainEps0[0], xDomainEps0[1], step);
    xRangeEps0.push(xDomainEps0[1]);
    
    var path_d = line( _.map(xRangeEps0, function(x) { return {x: x, y: log_OIII_Hb_SII(x)} }) );
    if (xDomainEps0[1] < log_OIII_Hb_SII_inverse(yPlotDomain[0])) {
        path_d += ' L' + x(xPlotDomain[1]) + ',' + y(yPlotDomain[0]);
    }
    path_d += ' L' + x(stravinska_SII_inverse(yPlotDomain[0])) + ',' + y(yPlotDomain[0]);
    path_d += line( _.map(xRangeStravinska, function(x) { return {x: x, y: stravinska_SII(x)} }) );
    path_d += ' L' + x(xPlotDomain[0]) + ',' + y(log_OIII_Hb_SII(xPlotDomain[0]));
    path_d += 'Z';
    
    g2.insert('path', ":first-child")
        .classed({area: true})
        .attr('d', path_d);
    
    // dots
    
    g2.selectAll('circle')
        .data(data)
        .enter()
        .append('circle')
        .attr('r', function(d) { return 1 + d.SFR / 20 })
        .attr('cx', function(d) { return x(d.log_SII_Ha) })
        .attr('cy', function(d) { return y(d.log_OIII_Hb) })
        .attr('class', function(d) { return d.band })
        .classed({dot: true})
        .on('mouseover', mouseover)
        .on('mouseout', mouseout)
        ;
}

// ===============
// plot 3
// ===============

function plot_3() {
    
    // geometry
    
    var svg_css = getComputedStyle(plot3_svg.node(), null);
    var svg_width = parseInt(svg_css.width);
    var svg_height = parseInt(svg_css.height);
    var padding = {left: 10, right: 10, top: 10, bottom: 20};
    
    var g_width = svg_width - padding.left - padding.right;
    var g_height = svg_height - padding.top - padding.bottom;
    
//    plot3_svg
//        .attr('width', svg_width)
//        .attr('height', svg_height)
//        .attr('viewBox', "0 0 " + svg_width + "px " + svg_height + "px")
//    ;
    
    plot3_g.attr('transform', 'translate(' + padding.left + ',' + padding.top + ')');
    
    // scales
    
    var xPlotDomain, yPlotDomain;
    
    if (HAS_ADAPTIVE_RANGES) {
        
        var delta;
        
        delta = (extents.log_OI_Ha[1] - extents.log_OI_Ha[0]) / 10;
        xPlotDomain = [extents.log_OI_Ha[0] - delta, extents.log_OI_Ha[1] + delta];
        
        delta = (extents.log_OIII_Hb[1] - extents.log_OIII_Hb[0]) / 10;
        yPlotDomain = [extents.log_OIII_Hb[0] - delta, extents.log_OIII_Hb[1] + delta];
        
    } else {
        xPlotDomain = RANGE_X;
        yPlotDomain = RANGE_Y;
    }
    
    var x =
        d3.scale.linear()
            .domain(xPlotDomain)
            .range([0, g_width]);
    
    var y =
        d3.scale.linear()
        .domain(yPlotDomain)
        .range([g_height, 0]);
    
    
    // generators
    
    var line =
        d3.svg.line()
            .interpolate('basis')
            .x(function(d) { return x(d.x); })
            .y(function(d) { return y(d.y); });
    
    
    // axis
    
    var xAxis =
        d3.svg.axis()
            .scale(x)
            .innerTickSize(-6)
            .outerTickSize(-g_height)
            .tickValues(d3.range(xPlotDomain[0], xPlotDomain[1], RANGE_STEP).concat([xPlotDomain[1]]))
            ;
    
    plot3_g.append('g')
        .attr('class', 'x axis noticksvalue')
        .call(xAxis.orient('top'));

    plot3_g.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + g_height + ')')
        .call(xAxis.orient('bottom'))
        .selectAll('.tick text')
        .attr('dy', '1em')
        ;
    
    plot3_xlabel.text('log([O I] λ6300Å/Hα)');
    
    var yAxis =
        d3.svg.axis()
            .scale(y)
            .innerTickSize(-6)
            .outerTickSize(-g_width)
            .tickValues(d3.range(yPlotDomain[0], yPlotDomain[1], RANGE_STEP).concat([yPlotDomain[1]]))
            ;
    
    plot3_g.append('g')
        .attr('class', 'y axis noticksvalue')
        .call(yAxis.orient('left'));

    plot3_g.append('g')
        .attr('class', 'y axis noticksvalue')
        .attr('transform', 'translate(' + g_width + ',0)')
        .call(yAxis.orient('right'));
    
    
    // graphics
    
    var g3 = plot3_g.append('g');
    
    // eps curves
    
    _.each([-0.1, 0, 0.1], function(eps) {
        var xDomain = [
                       xPlotDomain[0],
                       _.min([xPlotDomain[1], log_OIII_Hb_OI_inverse(yPlotDomain[0], eps)])
                       ];
        
        var step = (xDomain[1] - xDomain[0]) / 50;
        var xRange = d3.range(xDomain[0], xDomain[1], step).concat([xDomain[1]]);
        
        var curvePoints =
            _.chain(xRange)
            .map(function(x) { return {x: x, y: log_OIII_Hb_OI(x, eps)} })
            .filter(function(point) { return point.y <= yPlotDomain[1]; })
            .value();
        
        g3
            .append('path')
            .classed({curve: true, eps: eps})
            .datum( curvePoints )
            .attr('d', line)
            ;
    });
    
    
    // dots
    
    g3.selectAll('circle')
        .data(data)
        .enter()
        .append('circle')
        .attr('r', function(d) { return 1 + d.SFR / 20 })
        .attr('cx', function(d) { return x(d.log_OI_Ha) })
        .attr('cy', function(d) { return y(d.log_OIII_Hb) })
        .attr('class', function(d) { return d.band })
        .classed({dot: true})
        .on('mouseover', mouseover)
        .on('mouseout', mouseout)
        ;
}

//===============
// interaction
//===============


function filterClick(d, i) {
    
    // toggle
    filters[d.filter][d.name] = !filters[d.filter][d.name];
    d3.select(this).classed('pressed', filters[d.filter][d.name]);
    
    _.each([plot1_g, plot2_g, plot3_g], function(plot_g) {
        plot_g.selectAll('circle')
            .classed({
                hidden: function(_d) {
                    var is_shown = true;
                    _.each(filters, function(value, filter) {
                        is_shown = is_shown && filters[filter][_d[filter]];
                    });
                    return !is_shown;
                },
            })
            ;
    });
}


function focus_init() {
    div_focus = d3.select('#focus');
    focus_showmessage();
}


function focus_showdata(d) {
    div_focus
        .selectAll('*')
        .remove();
    
    div_focus
        .append('span')
        .classed('focus', true)
        .text(d.SDSS_ID);
    
    div_focus
        .append('span')
        .text(' (z = ' + d.redshift + ', SFR: ' + d.SFR + ' M');
    
    div_focus.append('sub')
        .text('⨀'); // http://en.wikipedia.org/wiki/Solar_mass
    
    div_focus.append('span')
        .text('/yr)');
}


function focus_showmessage() {
    div_focus
        .selectAll('*')
        .remove();
    
    div_focus
        .append('span')
        .classed('dimmed', true)
        .text('Please hover the items to show their SDSSID, redshift and SFR');
}


function mouseover(d, i) {
    focus_showdata(d);
    
    _.each([plot1_g, plot2_g, plot3_g], function(plot_g) {
        plot_g.selectAll('circle')
            .classed({
                focused: function(_d) {
                    return _d.SDSS_ID === d.SDSS_ID;
                },
                dimmed: function(_d) {
                    return _d.SDSS_ID != d.SDSS_ID;
                },
            })
            ;
    });
}

function mouseout(d, i) {
    focus_showmessage();
    
    _.each([plot1_g, plot2_g, plot3_g], function(plot_g) {
        plot_g.selectAll('circle')
            .classed({focused: false, dimmed: false})
            ;
    });
}


//=================
// graph 1 curves
//=================

function log_OIII_Hb_NII(n, eps) {
    eps = _.isUndefined(eps) ? 0 : eps;
    return 1.19 + eps + 0.61 / (n - eps - 0.47);
};

function log_OIII_Hb_NII_inverse(y, eps) {
    eps = _.isUndefined(eps) ? 0 : eps;
    return 0.47 + eps + 0.61 / (y - eps - 1.19);
};


function kauffmann(n, eps) {
    eps = _.isUndefined(eps) ? 0 : eps;
    var result = 1.3 + eps + 0.61 /(n - eps - 0.05);
    return n > eps + 0.05 ? -2 : result;
};

function kauffmann_inverse(y, eps) {
    eps = _.isUndefined(eps) ? 0 : eps;
    return 0.05 + eps + 0.61 /(y - eps - 1.3);
};

function log_OIII_Hb_NII_kauffmann_intersection_X(eps) {
    /*
      log_OIII_Hb_NII
         y = (1.19 + eps) + 0.61 / (n - (eps + 0.47));
         y =       a      + b    / (n -      c      );
      kauffmann
         y = (1.30 + eps) + 0.61 / (n - (eps + 0.05));
         y =       d      + e    / (n -      f      );
     */
    var a = 1.19 + eps;
    var b = 0.61;
    var c = 0.47 + eps;
    var d = 1.30 + eps;
    var e = 0.61;
    var f = 0.05 + eps;
    
    var A = a - d;
    var B = b - e - (c + f) * (a - d);
    var C = e * c - b * f + c * f * (a - d);
    
    var xIntersection = (-B + Math.sqrt(Math.pow(B, 2) - 4 * A * C)) / (2 * A);
    
    return xIntersection
};

//https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/tanh#Polyfill
function tanh(x) {
    if(x === Infinity) {
        return 1;
    } else if (x === -Infinity) {
        return -1;
    } else {
        var y = Math.exp(2 * x);
        return (y - 1) / (y + 1);
    }
}

function stravinska_NII(n) {
    return ( (-30.787 + 1.1358 * n + 0.27297 * Math.pow(n, 2)) * tanh(5.7409 * n) ) - 31.093;
};


function find_stravinska_NII_intersection_X(y1, x0) {
    var deltaX = 0.1;
    var errY = 0.1;
    
    var y0 = stravinska_NII(x0);
    var x, y;
    var x_ = x0;
    var y_ = y0;
    
    var pre;
    
    // reach
    
    y = stravinska_NII(x0);
    while (Math.abs(y - y1) > errY) {
        x = x_ + deltaX;
        y = stravinska_NII(x);
        
        if (Math.abs(y - y_) >= errY) {
            while (Math.abs(y - y_) >= errY) {
                deltaX *= 0.9;
                x = x_ + deltaX;
                y = stravinska_NII(x);
            }
        } else {
            while (Math.abs(y - y_) < errY) {
                deltaX *= 1.1;
                x = x_ + deltaX;
                y = stravinska_NII(x);
            }
        }
        
        x_ = x;
        y_ = y;
        
        if (y > y1) {
            pre = {x: x_, y: y_};
        }
    }
    
    // refine
    
    errY /= 20;
    deltaX /= 10;
    
    x_ = pre.x;
    y_ = pre.y;
    y = pre.y;
    
    while (Math.abs(y - y1) > errY) {
        x = x_ + deltaX;
        y = stravinska_NII(x);
        
        if (Math.abs(y - y_) >= errY) {
            while (Math.abs(y - y_) >= errY) {
                deltaX *= 0.9;
                x = x_ + deltaX;
                y = stravinska_NII(x);
            }
        } else {
            while (Math.abs(y - y_) < errY) {
                deltaX *= 1.1;
                x = x_ + deltaX;
                y = stravinska_NII(x);
            }
        }
        
        x_ = x;
        y_ = y;
        
        if (y > y1) {
            pre = {x: x_, y: y_};
        }
    }
    
    return pre.x;
}


//=================
// graph 2 curves
//=================

function log_OIII_Hb_SII(n, eps) {
    eps = _.isUndefined(eps) ? 0 : eps;
    return 1.30 + eps + 0.72 / (n - eps - 0.32);
};

function log_OIII_Hb_SII_inverse(y, eps) {
    eps = _.isUndefined(eps) ? 0 : eps;
    return 0.32 + eps + 0.72 / (y - eps - 1.3);
};

function stravinska_SII(n, eps) {
    eps = _.isUndefined(eps) ? 0 : eps;
    return 1.2 + eps + 0.61 / (n - eps + 0.2)
};


function stravinska_SII_inverse(y, eps) {
    eps = _.isUndefined(eps) ? 0 : eps;
    return -0.2 + eps + 0.61 / (y - eps - 1.2);
};


//=================
// graph 3 curves
//=================

function log_OIII_Hb_OI(n, eps) {
    eps = _.isUndefined(eps) ? 0 : eps;
    return 1.33 + eps + 0.73 / (n - eps + 0.59);
};

function log_OIII_Hb_OI_inverse(y, eps) {
    eps = _.isUndefined(eps) ? 0 : eps;
    return -0.59 + eps + 0.73 / (y - eps - 1.33);
};
