define("logging", ["when", "locache", "asana"], function() {
    Logging = function(date) {
	this.key = 'logs-' + date;
    }

    Logging.prototype = {
	clear: function() {
	    locache.remove(this.key);
	},
	log: function(log) {
	    var logs = locache.get(this.key);
	    if (! logs) {
		logs = [];
	    }
	    logs.push(log);
	    locache.set(this.key, logs);
	},
	apply_all: function() {
	    return this._apply_all(locache.get(this.key));
	},
	_apply_all: function(logs) {
	    if (!logs || logs.length == 0) {
		return true;
	    }
	    var log = logs.shift();
	    if (log) {
		return this.apply(log).then(function() {
		    return this._apply_all(logs);
		}.bind(this));
	    } else {
		return true;
	    }
	},
	apply: function(log) {
	    var ret = null;
	    switch (log.type) {
	    case 'check-in':
		var ts = new Date(Date.parse(log.args.ts));
		Woodpecker.timeline._add_check_in(ts);
		ret = true;
		break
	    case 'check-out':
		var ts = new Date(Date.parse(log.args.ts));
		Woodpecker.timeline._add_check_out(ts);
		ret = true;
		break
	    case 'set-tasks':
		var start = log.args.start && new Date(Date.parse(log.args.start)) || log.args.start;
		var end = log.args.end && new Date(Date.parse(log.args.end)) || log.args.end;
		var record = Woodpecker.timeline.content.filter(function(record) {
		    return ((record.start == start || 
			     record.start && start &&
			     record.start.getTime() == start.getTime()) &&
			    (record.end == end || 
			     record.end && end &&
			     record.end.getTime() == end.getTime()))
		})[0];
		if (record) {
		    ret = when.all(log.args.tasks.map(function(id) {
			return Asana.Task.create({id: id}).load();
		    })).then(function(tasks) {
			record.set_tasks(tasks);
			return tasks;
		    });
		} else {
		    console.log('record not found when applying log:',
				JSON.stringify(log));
		}
		break
	    case 'set-tags':
		var start = log.args.start && new Date(Date.parse(log.args.start)) || log.args.start;
		var end = log.args.end && new Date(Date.parse(log.args.end)) || log.args.end;
		var record = Woodpecker.timeline.content.filter(function(record) {
		    return ((record.start == start || 
			     record.start && start &&
			     record.start.getTime() == start.getTime()) &&
			    (record.end == end || 
			     record.end && end &&
			     record.end.getTime() == end.getTime()))
		})[0];
		if (record) {
		    ret = when.all(log.args.tags.map(function(id) {
			return Asana.Tag.create({id: id}).load();
		    })).then(function(tags) {
			record.set('tags', tags);
			return tags;
		    });
		} else {
		    console.log('record not found when applying log:',
				JSON.stringify(log));
		}
		break
	    case 'comment':
		var start = log.args.start && new Date(Date.parse(log.args.start)) || log.args.start;
		var end = log.args.end && new Date(Date.parse(log.args.end)) || log.args.end;
		var record = Woodpecker.timeline.content.filter(function(record) {
		    return ((record.start == start || 
			     record.start && start &&
			     record.start.getTime() == start.getTime()) &&
			    (record.end == end || 
			     record.end && end &&
			     record.end.getTime() == end.getTime()))
		})[0];
		if (record) {
		    var task = record.tasks.filter(function(task) {
			return task.id == log.args.task;
		    })[0];
		    if (task) {
			var idx = record.tasks.indexOf(task);
			record.comments[idx].set('content', log.args.content);
			ret = true;
		    } else {
			console.log('task not found when applying log:',
				    JSON.stringify(log));
		    }
		} else {
		    console.log('record not found when applying log:',
				JSON.stringify(log));
		}
		break
	    case 'set-start':
		var start = log.args.start && new Date(Date.parse(log.args.start)) || log.args.start;
		var end = log.args.end && new Date(Date.parse(log.args.end)) || log.args.end;
		var record = Woodpecker.timeline.content.filter(function(record) {
		    return ((record.start == start || 
			     record.start && start &&
			     record.start.getTime() == start.getTime()) &&
			    (record.end == end || 
			     record.end && end &&
			     record.end.getTime() == end.getTime()))
		})[0];
		if (record) {
		    var ts = new Date(Date.parse(log.args.ts));
		    record.set('start', ts);
		} else {
		    console.log('record not found when applying log:',
				JSON.stringify(log));
		}
		break
	    case 'set-end':
		var start = log.args.start && new Date(Date.parse(log.args.start)) || log.args.start;
		var end = log.args.end && new Date(Date.parse(log.args.end)) || log.args.end;
		var record = Woodpecker.timeline.content.filter(function(record) {
		    return ((record.start == start || 
			     record.start && start &&
			     record.start.getTime() == start.getTime()) &&
			    (record.end == end || 
			     record.end && end &&
			     record.end.getTime() == end.getTime()))
		})[0];
		if (record) {
		    var ts = new Date(Date.parse(log.args.ts));
		    record.set('end', ts);
		} else {
		    console.log('record not found when applying log:',
				JSON.stringify(log));
		}
		break
	    }
	    return when.all([ret]);
	}
    }
    return Logging;
});
