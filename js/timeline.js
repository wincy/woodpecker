function Timestamp(hours, minutes) {
    var now = new Date();
    if (typeof hours === "undefined" || hours === null) {
	hours = now.getHours();
    }
    if (typeof minutes === "undefined" || minutes === null) {
	minutes = now.getMinutes();
    }
    now.setHours(hours);
    now.setMinutes(minutes);
    this.content = now;
}

Timestamp.prototype = {
    set: function(hours, minutes) {
	this.content.setHours(hours);
	this.content.setMinutes(minutes);
	return this;
    },
    render: function() {
	return sprintf("%02d:%02d", this.content.getHours(), this.content.getMinutes())
    },
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

function Record(start, end, task, comment) {
    this.start = new Timestamp();
    this.end = new Timestamp();
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
    render: function() {
	return sprintf("<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td>",
		       time_format(this.start),
		       time_format(this.end),
		       this.task.render(),
		       this.comment.render());
    },
}

function Timeline(container) {
    this.container = container;
    this.history = [];
}

Timeline.prototype = {
    check_in: function() {
	var 
	$(this.container).push();
    },
    check_out: function() {
    },
    comment: function() {
    },
    task: function() {
    },
}
