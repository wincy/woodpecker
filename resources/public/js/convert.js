asana.personal = asana.workspaces.filter(function(workspace) {
    return workspace.name == 'Personal';
})[0];

function save_records(records) {
    if (records.length > 0) {
	var ts = new Date();
	while (new Date() - ts < 1000) {
	}
	var record = records.shift();
	return save_record(record.name, record.idx, record.content).then(function() {
	    return save_records(records);
	});
    }
}

function save_record(name, idx, content) {
    return asana.Task.get({
	'assignee.id': asana.me.id,
	'workspace.id': asana.woodpecker.id,
	'projects.0.id': asana.woodpecker.me.id,
	'name': sprintf('%s#%s', name, idx),
	'assignee_status': 'today',
	'opt_fields': ['name','parent','assignee','notes',
		       'assignee_status','completed',
		       'projects','workspace'].join(','),
    }).then(function (task) {
	if (task.notes.length > 0) {
	    return task;
	} else {
	    return task.update({notes: content}).then(function(task) {
		console.log(task);
		return task;
	    });
	}
    });
}

function convert_days(days) {
    console.log(days);
    if (days.length > 0) {
	var todo = days.slice(0, 2);
	return RSVP.all(todo.map(function(day) {
	    return day.load().then(convert_day);
	})).then(function() {
	    return convert_days(days.slice(2, days.length));
	});
    }
}

function convert_day(day) {
    var records = JSON.parse(day.notes);
    return save_records(records.map(function(record) {
	return {name: day.name,
		idx: records.indexOf(record),
		content: JSON.stringify(record, undefined, 2)}
    }));
}

var result = asana.personal.Project.find().then(function(projects) {
    return projects.filter(function(project) {
	return project.name == '.woodpecker';
    })[0];
}).then(function(woodpecker) {
    woodpecker.Task.find().then(function(tasks) {
	return tasks.filter(function(task) {
	    return RegExp('\\d\\d\\d\\d-\\d\\d-\\d\\d').test(task.name);
	});
    }).then(convert_days);
});

function load_tasks(tasks) {
    if (tasks.length > 0) {
	var ts = new Date();
	while (new Date() - ts < 500) {
	}
	return RSVP.all(tasks.slice(0, 2).map(function(t) { return t.load() }))
	    .then(function() { return load_tasks(tasks.slice(2, tasks.length)) });
    }
}

function complete_tasks(tasks) {
    if (tasks.length > 0) {
	var ts = new Date();
	while (new Date() - ts < 500) {
	}
	return RSVP.all(tasks.slice(0, 2).map(function(t) { return t.load() }))
	    .then(function() { return load_tasks(tasks.slice(2, tasks.length)) });
    }
}
