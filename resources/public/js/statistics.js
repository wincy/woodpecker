function to_monday(date) {
    var d = new Date(Date.parse(date));
    d = new Date(d.getTime() - 86400 * 1000 * d.getDay());
    return sprintf('%d-%02d-%02d',
		   d.getFullYear(),
		   d.getMonth() + 1,
		   d.getDate())
}

function get_data_by_tags(tags) {
    return RSVP.all(tags.map(function(tag) {
	return tag.Task.find()
	    .then(function(tasks) {
		return RSVP.all(tasks.filter(function(task) {
		    return RegExp('^.*#.*$').test(task.name);
		}).map(function(task) {
		    return task.load();
		}));
	    }).then(function(tasks) {
		var stat = {};
		tasks.forEach(function(task) {
		    console.log(task);
		    var date = to_monday(task.name.split('#')[0]);
		    var record = JSON.parse(task.notes);
		    if (!stat[date]) {
			stat[date] = {};
			stat[date][tag.name] = 0;
		    }
		    if (record.start && record.end) {
			stat[date][tag.name] += (Date.parse(record.end) -
						 Date.parse(record.start)) / 1000 / 60;
		    }
		});
		return stat;
	    });
    })).then(function(stats) {
	var stat = stats.reduce(function(s, a) {
	    Object.keys(a).forEach(function(date) {
		$.extend(s[date], a[date]);
	    });
	    return s;
	});
	
	return Object.keys(stat).sort().map(function(date) {
	    tags.forEach(function(tag) {
		if (!stat[date][tag.name]) {
		    stat[date][tag.name] = 0;
		}
	    });
	    return $.extend(stat[date], {date: date});
	})
    });
}

function stat_by_tags(tags) {
    get_data_by_tags(tags).then(function(data) {
	console.log(data);
	var margin = {top: 20, right: 20, bottom: 30, left: 50},
	width = 300 - margin.left - margin.right,
	height = 500 - margin.top - margin.bottom;

	var parseDate = d3.time.format("%Y-%m-%d").parse;

	data.forEach(function(d) {
	    d.date = parseDate(d.date);
	});

	var x = d3.time.scale()
	    .range([0, width]);

	var y = d3.scale.linear()
	    .range([height, 0]);

	var color = d3.scale.category10();

	var xAxis = d3.svg.axis()
	    .scale(x)
	    .orient("bottom");

	var yAxis = d3.svg.axis()
	    .scale(y)
	    .orient("left");

	var line = d3.svg.line()
	    .x(function(d) { return x(d.date); })
	    .y(function(d) { return y(d.length); });

	// d3.select(".statistics").each(function(e) { e.remove(); });
	var svg = d3.select(".statistics").append("svg")
	    .attr("width", width + margin.left + margin.right)
	    .attr("height", height + margin.top + margin.bottom)
	    .append("g")
	    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	color.domain(d3.keys(data[0]).filter(function(key) { return key !== "date"; }));

	var categories = color.domain().map(function(name) {
	    return {
		name: name,
		values: data.map(function(d) {
		    return {date: d.date, length: +d[name]};
		})
	    };
	});

	x.domain(d3.extent(data, function(d) { return d.date; }));

	y.domain([
	    d3.min(categories, function(c) { return d3.min(c.values, function(v) { return v.length; }); }),
	    d3.max(categories, function(c) { return d3.max(c.values, function(v) { return v.length; }); })
	]);

	svg.append("g")
	    .attr("class", "x axis")
	    .attr("transform", "translate(0," + height + ")")
	    .call(xAxis);

	svg.append("g")
	    .attr("class", "y axis")
	    .call(yAxis)
	    .append("text")
	    .attr("transform", "rotate(-90)")
	    .attr("y", 6)
	    .attr("dy", ".71em")
	    .style("text-anchor", "end")
	    .text("Minutes");

	var category = svg.selectAll(".category")
	    .data(categories)
	    .enter().append("g")
	    .attr("class", "category");

	category.append("path")
	    .attr("class", "line")
	    .attr("d", function(d) { return line(d.values); })
	    .style("stroke", function(d) { return color(d.name); });

	var legend = svg.selectAll(".legend")
	    .data(color.domain().slice().reverse())
	    .enter().append("g")
	    .attr("class", "legend")
	    .attr("transform", function(d, i) { return "translate(0," + i * 20 + ")"; });

	legend.append("rect")
	    .attr("x", width - 18)
	    .attr("width", 18)
	    .attr("height", 18)
	    .style("fill", color);

	legend.append("text")
	    .attr("x", width - 24)
	    .attr("y", 9)
	    .attr("dy", ".35em")
	    .style("text-anchor", "end")
	    .text(function(d) { return d; });
    });
}
