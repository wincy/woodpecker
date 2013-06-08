function sleep_stat_data() {
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
	    return stat;
	});
}
