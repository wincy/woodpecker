function get_sleep_data() {
    var tag = asana.woodpecker.tags.filter(function(tag) {
	return tag.name == '睡眠';
    })[0];
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
		var date = task.name.split('#')[0];
		var record = JSON.parse(task.notes);
		if (!stat[date]) {
		    stat[date] = {length: 0};
		}
		if (record.start && record.end) {
		    stat[date].length += (Date.parse(record.end) -
					  Date.parse(record.start)) / 1000 / 60;
		}
	    });
	    return Object.keys(stat).sort().map(function(k) {
		return {date: k, length: stat[k].length};
	    });
	});
}

function sleep_stat() {
    get_sleep_data().then(function(data) {
	var margin = {top: 20, right: 20, bottom: 30, left: 50},
	width = 300 - margin.left - margin.right,
	height = 200 - margin.top - margin.bottom;

	var parseDate = d3.time.format("%Y-%m-%d").parse;

	var x = d3.time.scale()
	    .range([0, width]);

	var y = d3.scale.linear()
	    .range([height, 0]);

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

	data.forEach(function(d) {
	    d.date = parseDate(d.date);
	    d.length = +d.length;
	});

	x.domain(d3.extent(data, function(d) { return d.date; }));
	y.domain(d3.extent(data, function(d) { return d.length; }));

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

	svg.append("path")
	    .datum(data)
	    .attr("class", "line")
	    .attr("d", line);
    })
}
