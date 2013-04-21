function Timestamp(container, ts) {
    this.container = container;
    this.content = ts;
}

Timestamp.prototype = {
    set_hours: function(hours) {
	this.content.setHours(hours);
    },
    set_minutes: function(minutes) {
	this.content.setMinutes(minutes);
    },
}

Date.prototype.render = function () {
    return sprintf("%02d:%02d", this.getHours(), this.getMinutes());
}

function Task(id) {
    this.id = id;
    this.tasks = [];
}

Task.prototype = {
    load: function() {
	$.get("/tasks/" + this.id,
	      function(data) {
		  this.tasks = data;
	      });
    },
    render: function() {
	if (this.id == null) {
	    return "";
	}
	var task = this.tasks[this.id];
	var result = task.name;
	while (task.parent) {
	    task = this.tasks[task.parent.id];
	    result = task.name + " &gt; " + result
	}
	return result;
    },
}

function Comment(id) {
    this.id = id;
    this.content = "";
}

Comment.prototype = {
    load: function() {
	$.get("/comments/" + this.id,
	      function(data) {
		  this.content = data;
	      });
    },
    render: function() {
	return this.content;
    },
}

function Record(container, start, end, task, comment) {
    this.container = container;
    this.start = start;
    this.end = end;
    this.task = new Task(task);
    this.comment = new Comment(comment);
}

Record.prototype = {
    set_start: function(ts) {
	this.start = ts;
    },
    set_end: function(ts) {
	this.end = ts;
    },
    set_task: function(id) {
	this.task = new Task(id);
    },
    set_comment: function(id) {
	this.comment = new Comment(id);
    },
    render: function(timepicker) {
	var start = $("<td>" + (this.start ? this.start.render() : "") + "</td>");
	var end = $("<td>" + (this.end ? this.end.render() : "") + "</td>");
	start.tap(function () {
	    timepicker.ask("Modify check out", function(ts) {
		this.start = ts;
	    });
	});
	return $(this.container)
	    .append(start)
	    .append(end)
	    .append("<td>" + this.task.render() + "</td>")
	    .append("<td>" + this.comment.render() + "</td>");
    },
}

function Timeline(container) {
    this.container = container;
    this.history = [];
}

Timeline.prototype = {
    check_in: function() {
	this.add_check_in(new Date());
    },
    check_out: function() {
	this.add_check_out(new Date());
    },
    add_check_in: function(ts) {
	var i = 0;
	while (true) {
	    console.log(i);
	    if (i >= this.history.length) {
		this.history.push(new Record(ts, null, null, null));
		break;
	    } else if (this.history[i].start == null) {
		if (this.history[i].end >= ts) {
		    this.history[i].start = ts;
		    break;
		} else {
		    i = i + 1;
		}
	    } else if (this.history[i].start < ts) {
		if (this.history[i].end <= ts) {
		    i = i + 1;
		} else {
		    this.history.splice(
			i + 1, 0, new Record(ts,
					     this.history[i].end,
					     this.history[i].task,
					     this.history[i].comment));
		    this.history[i].end = null;
		    break;
		}
	    } else if (this.history[i].start == ts) {
		break;
	    } else if (this.history[i].start > ts) {
		this.history.splice(i, 0, new Record(ts, null, null, null));
		break;
	    } else {
		console.log('error');
	    }
	}
	this.render();
    },
    add_check_out: function(ts) {
	console.log(ts);
	var i = this.history.length - 1;
	while (true) {
	    console.log(i);
	    if (i < 0) {
		this.history.splice(0, 0, new Record(null, ts, null, null));
		break;
	    } else if (this.history[i].end == null) {
		if (this.history[i].start <= ts) {
		    this.history[i].end = ts;
		    break;
		} else {
		    i = i - 1;
		}
	    } else if (this.history[i].end > ts) {
		if (this.history[i].start > ts) {
		    i = i - 1;
		} else {
		    this.history.splice(
			i + 1, 0, new Record(null, this.history[i].end, null, null));
		    this.history[i].end = ts;
		    break;
		}
	    } else if (this.history[i].end == ts) {
		break;
	    } else if (this.history[i].end < ts) {
		this.history.splice(i, 0, new Record(null, ts, null, null));
		break;
	    } else {
		console.log('error');
	    }
	}
	this.render();
    },
    comment: function() {
    },
    task: function() {
    },
    render: function() {
	$(this.container).empty();
	for (var i = 0; i < this.history.length; i++) {
	    $(this.container).append(this.history[i].render());
	}
    },
}
