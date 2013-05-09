function gtime(ts) {
    var now = new Date();
    var hours = parseInt(ts.slice(0, 2));
    var minutes = parseInt(ts.slice(3, 5));
    now.setHours(hours);
    now.setMinutes(minutes);
    return now;
}

var asana = new Asana('/asana');

Woodpecker = Ember.Application.create({
    //    LOG_TRANSITIONS: true,
    ready: function () {
	Woodpecker.timepicker = Woodpecker.Timepicker.create();
	Woodpecker.timepicker.cursors = Woodpecker.Timepicker.Cursors.create();
	Woodpecker.timepicker.numpad_buttons = Woodpecker.Timepicker.NumpadButtons.create();
	Woodpecker.timepicker.control_buttons = Woodpecker.Timepicker.ControlButtons.create();
	Woodpecker.timepicker.view = Ember.View.create({
	    templateName: "timepicker",
	    isVisible: false,
	});
	Woodpecker.puncher = Woodpecker.Puncher.create();
	Woodpecker.puncher.buttons = Woodpecker.Puncher.Buttons.create();
	Woodpecker.puncher.view = Ember.View.create({
	    templateName: "puncher",
	});
	Woodpecker.timeline = Woodpecker.Timeline.create();
	Woodpecker.timeline.view = Ember.View.create({
	    templateName: "timeline",
	});
	Woodpecker.comment_editor = Woodpecker.CommentEditor.create();
	Woodpecker.comment_editor.control_buttons = Woodpecker.CommentEditor.ControlButtons.create();
	Woodpecker.comment_editor.view = Ember.View.create({
	    templateName: "comment-editor",
	    isVisible: false,
	});
	asana.Workspace
	    .find()
	    .then(function(workspaces) {
		Woodpecker.selector.set('content', []);
		for (var i = 0; i < workspaces.length; i++) {
		    asana.Task
			.find({
			    workspace: workspaces[i].id,
			    assignee: 'me',
			    opt_fields: "name,parent,assignee,assignee_status,completed"
			})
			.then(function(tasks) {
			    for (var j = 0; j < tasks.length; j++) {
				tasks[j]
				    .load()
				    .then(function(task) {
					if (task.assignee_status == 'today' &&
					    task.completed == false &&
					    task.name[0] != '.') {
					    console.log(task);
					    Woodpecker.selector.pushObject(
						Woodpecker.Selector.Option.create(
						    {content: task}));
					}
				    });
			    }
			});
		}
	    });
    },
});
Woodpecker.Store = DS.Store.extend({
    revision: 12,
    adapter: DS.RESTAdapter,
});
Woodpecker.ApplicationController = Ember.Controller.extend({
    world: "world!",
});
Woodpecker.Button = Ember.ObjectController.extend({});
Woodpecker.ButtonView = Ember.View.extend({
    templateName: 'button',
});
Woodpecker.PopupView = Ember.View.extend({
    layoutName: 'popup'
});
Woodpecker.Task = Ember.ObjectController.extend({
});
Woodpecker.Comment = Ember.ObjectController.extend({
    task: null,
    edit: function() {
	console.log('write comment for ' + this.task);
	Woodpecker.comment_editor.set('target', this);
	Woodpecker.comment_editor.view.set('isVisible', true);
    },
    save: function(content) {
	console.log(this.task.name);
	console.log(this.task.id);
	console.log(this.task.Story.create);
	this.task.Story.create(content)
	    .then(function(story) {
		this.set('content', story);
	    }.bind(this));
    },
});
Woodpecker.CommentView = Ember.View.extend({
    templateName: "comment",
});
Woodpecker.TimelineView = Ember.View.extend({
    templateName: "timeline",
});
Woodpecker.Timeline = Ember.ArrayController.extend({
    id: null,
    date: null,
    content: [],
    // init: function() {
    // 	var timeline = this.timeline;
    // 	this._super();
    // 	var date = this.get('date');
    // 	console.log('load timeline:' + date);
    // 	if (! asana.timelines[date]) {
    // 	    asana.post_tasks(
    // 		{workspace: asana.workspaces('.woodpecker').id,
    // 		 name: date,
    // 		 assignee: asana.me},
    // 	    function(task) {
    // 		timeline.id = task.id;
    // 	    })
    // 	}
    // 	asana.get_workspace_tasks(
    // 	    asana.timelines[date].id,
    // 	    {"opt_fields": "name,parent,assignee,assignee_status,completed"},
    // 	    function(tasks) {
    // 		tasks
    // 	    }
    // 	);
    // },
    check_in: function() {
	var now = new Date();
	now.setSeconds(0);
	this._add_check_in(now);
    },
    check_out: function() {
	var now = new Date();
	now.setSeconds(0);
	this._add_check_out(new Date());
    },
    add_check_in: function() {
	Woodpecker.timepicker.removeObserver('value', Woodpecker.timeline, 'add_check_in');
	this._add_check_in(Woodpecker.timepicker.value);
    },
    _add_check_in: function(ts) {
	var i = 0;
	while (true) {
	    console.log(i);
	    if (i >= this.content.length) {
		this.pushObject(Woodpecker.Timeline.Record.create(
		    {start: ts,
		     end: null,
		     tasks: [Woodpecker.Task.create()],
		     comments: [Woodpecker.Comment.create()],
		    }));
		console.log(this.content);
		break;
	    } else if (this.content[i].start == null) {
		if (this.content[i].end >= ts) {
		    this.replaceContent(
			i, 1, [Woodpecker.Timeline.Record.create({
			    start: ts,
			    end: this.content[i].end,
			    tasks: this.content[i].tasks,
			    comments: this.content[i].comments,
			})]);
		    break;
		} else {
		    i = i + 1;
		}
	    } else if (this.content[i].start < ts) {
		if (this.content[i].end <= ts) {
		    i = i + 1;
		} else {
		    this.insertAt(
			i + 1, Woodpecker.Timeline.Record.create({
			    start: ts,
			    end: this.content[i].end,
			    tasks: this.content[i].tasks,
			    comments: this.content[i].comments,
			}));
		    this.replaceContent(
			i, 1, [Woodpecker.Timeline.Record.create({
			    start: this.content[i].start,
			    end: null,
			    tasks: this.content[i].tasks,
			    comments: this.content[i].comments,
			})]);
		    console.log(this.content);
		    break;
		}
	    } else if (this.content[i].start == ts) {
		break;
	    } else if (this.content[i].start > ts) {
		this.insertAt(i, Woodpecker.Timeline.Record.create({
		    start: ts,
		    end: null,
		    tasks: [Woodpecker.Task.create()],
		    comments: [Woodpecker.Comment.create()],
		}));
		console.log(this.content);
		break;
	    } else {
		console.log('error');
	    }
	}
    },
    add_check_out: function() {
	Woodpecker.timepicker.removeObserver('value', Woodpecker.timeline, 'add_check_out');
	this._add_check_out(Woodpecker.timepicker.value);
    },
    _add_check_out: function(ts) {
	console.log(ts);
	var i = this.content.length - 1;
	while (true) {
	    console.log(i);
	    if (i < 0) {
		this.insertAt(0, Woodpecker.Timeline.Record.create({
		    start: null,
		    end: ts,
		    tasks: [Woodpecker.Task.create()],
		    comments: [Woodpecker.Comment.create()],
		}));
		break;
	    } else if (this.content[i].end == null) {
		if (this.content[i].start <= ts) {
		    this.replaceContent(
			i, 1, [Woodpecker.Timeline.Record.create({
			    start: this.content[i].start,
			    end: ts,
			    tasks: this.content[i].tasks,
			    comments: this.content[i].comments,
			})]);
		    break;
		} else {
		    i = i - 1;
		}
	    } else if (this.content[i].end > ts) {
		if (this.content[i].start > ts) {
		    i = i - 1;
		} else {
		    this.insertAt(
			i + 1, Woodpecker.Timeline.Record.create({
			    start: null,
			    end: this.content[i].end,
			    tasks: [Woodpecker.Task.create()],
			    comments: [Woodpecker.Comment.create()],
			}));
		    this.replaceContent(
			i, 1, [Woodpecker.Timeline.Record.create({
			    start: this.content[i].start,
			    end: ts,
			    tasks: this.content[i].tasks,
			    comments: this.content[i].comments,
			})]);
		    break;
		}
	    } else if (this.content[i].end == ts) {
		break;
	    } else if (this.content[i].end < ts) {
		this.insertAt(i, Woodpecker.Timeline.Record.create({
		    start: null,
		    end: ts,
		    tasks: [Woodpecker.Task.create()],
		    comments: [Woodpecker.Comment.create()],
		}));
		break;
	    } else {
		console.log('error');
	    }
	}
    },
});
Woodpecker.Timeline.Record = Ember.ObjectController.extend({
    start: null,
    end: null,
    tasks: [],
    comments: [],
    start_short: function() {
	if (this.start) {
	    return sprintf("%02d:%02d", this.start.getHours(), this.start.getMinutes());
	} else {
	    return "";
	}
    }.property(),
    end_short: function() {
	if (this.end) {
	    return sprintf("%02d:%02d", this.end.getHours(), this.end.getMinutes());
	} else {
	    return "";
	}
    }.property(),
    select_tasks: function() {
	console.log(this.tasks);
	Woodpecker.selector.set_selected(this.tasks);
	Woodpecker.selector.target = this;
	Woodpecker.selector.view.set('isVisible', true);
    },
});
Woodpecker.Timeline.RecordView = Ember.View.extend({
    templateName: "timeline-record",
});
Woodpecker.Timepicker = Ember.ObjectController.extend({
    value: null,
    add_check_in: function() {
	Woodpecker.timepicker.view.set('isVisible', true);
	this.addObserver('value', Woodpecker.timeline, 'add_check_in');
    },
    add_check_out: function() {
	Woodpecker.timepicker.view.set('isVisible', true);
	this.addObserver('value', Woodpecker.timeline, 'add_check_out');
    },
});
Woodpecker.Timepicker.Cursor = Woodpecker.Button.extend({
    hit: function() {
	Woodpecker.timepicker.cursors.jump(this);
    },
});
Woodpecker.Timepicker.CursorView = Ember.View.extend({
    templateName: 'timepicker-cursor',
});
Woodpecker.Timepicker.NumpadButton = Woodpecker.Button.extend({
    hit: function() {
	switch (this.type) {
	case "set-single":
	    Woodpecker.timepicker.cursors.set_current(this.text);
	    Woodpecker.timepicker.cursors.next();
	    break;
	case "set-minutes":
	    Woodpecker.timepicker.cursors.mset(3, 2, this.text.slice(1));
	    break;
	case "reset":
	    Woodpecker.timepicker.cursors.reset();
	    break;
	case "now":
	    var now = new Date();
	    Woodpecker.timepicker.cursors.mset(0, 2, sprintf("%02d", now.getHours()));
	    Woodpecker.timepicker.cursors.mset(3, 2, sprintf("%02d", now.getMinutes()));
	    break;
	default:
	    console.log('unhandled event');
	}
    },
});
Woodpecker.Timepicker.NumpadButtonView = Ember.View.extend({
    templateName: 'timepicker-button',
});
Woodpecker.Timepicker.ControlButton = Woodpecker.Button.extend({
    hit: function() {
	switch (this.type) {
	case "cancel":
	    Woodpecker.timepicker.view.set('isVisible', false);
	    break;
	case "confirm":
	    var ts = new Date();
	    var hours = parseInt(Woodpecker.timepicker.cursors.mget(0, 2).join(''));
	    var minutes = parseInt(Woodpecker.timepicker.cursors.mget(3, 5).join(''));
	    ts.setHours(hours);
	    ts.setMinutes(minutes);
	    Woodpecker.timepicker.set('value', ts);
	    Woodpecker.timepicker.view.set('isVisible', false);
	    break;
	default:
	    console.log('unhandled event');
	}
    },
});
Woodpecker.Timepicker.ControlButtonView = Woodpecker.ButtonView.extend({
    templateName: 'button',
});
Woodpecker.Timepicker.Cursors = Ember.ArrayController.extend({
    content: [],
    current: 0,
    init: function() {
	this._super();
	var cursors = [{fixed: false, current: true, value: "1"},
		       {fixed: false, current: false, value: "2"},
		       {fixed: true, current: false, value: ":"},
		       {fixed: false, current: false, value: "3"},
		       {fixed: false, current: false, value: "4"}].map(function (elem) {
			   return Woodpecker.Timepicker.Cursor.create(elem);
		       });
	this.set('content', cursors);
    },
    reset: function() {
	var variables = this.content.filter(function (elem) {
	    return elem.fixed == false;
	});
	this.jump(variables[0]);
    },
    set_current: function(value) {
	this.content[this.current].set('value', value);
    },
    mget: function(start, offset) {
	return this.content.slice(start, offset).map(function (elem) {
	    return elem.value;
	});
    },
    mset: function(start, offset, values) {
	for (var i = 0; i < offset; i++) {
	    this.content[start + i].set('value', values[i]);
	}
    },
    next: function() {
	var variables = this.content.filter(function (elem) {
	    return elem.fixed == false;
	});
	var idx = (variables.indexOf(this.content[this.current]) + 1) % variables.length;
	this.jump(variables[idx]);
    },
    jump: function(to_cursor) {
	this.content[this.current].set('current', false);
	to_cursor.set('current', true);
	this.set('current', this.content.indexOf(to_cursor));
    },
});
Woodpecker.Timepicker.NumpadButtons = Ember.ArrayController.extend({
    content: [],
    init: function() {
	this._super();
	var buttons = [{text: "1", type: "set-single"},
		       {text: "2", type: "set-single"},
		       {text: "3", type: "set-single"},
		       {text: ":15", type: "set-minutes"},
		       {text: "4", type: "set-single"},
		       {text: "5", type: "set-single"},
		       {text: "6", type: "set-single"},
		       {text: ":30", type: "set-minutes"},
		       {text: "7", type: "set-single"},
		       {text: "8", type: "set-single"},
		       {text: "9", type: "set-single"},
		       {text: ":45", type: "set-minutes"},
		       {text: "reset", type: "reset"},
		       {text: "0", type: "set-single"},
		       {text: "now", type: "now"},
		       {text: ":00", type: "set-minutes"}].map(function (elem) {
			   return Woodpecker.Timepicker.NumpadButton.create(elem);
		       });
	this.set('content', buttons);
    },
});
Woodpecker.Timepicker.ControlButtons = Ember.ArrayController.extend({
    content: [],
    init: function() {
	this._super();
	var buttons = [{text: "Cancel", type: "cancel"},
		       {text: "Confirm", type: "confirm"}].map(function(elem) {
			   return Woodpecker.Timepicker.ControlButton.create(elem);
		       });
	this.set('content', buttons);
    }
});
Woodpecker.Puncher = Ember.ObjectController.extend({
});
Woodpecker.Puncher.ButtonView = Ember.View.extend({
    templateName: 'button',
});
Woodpecker.Puncher.Button = Woodpecker.Button.extend({
    hit: function() {
	switch (this.type) {
	case "check-in":
	    Woodpecker.timeline.check_in()
	    break;
	case "check-out":
	    Woodpecker.timeline.check_out()
	    break;
	case "add-check-in":
	    Woodpecker.timepicker.add_check_in()
	    break;
	case "add-check-out":
	    Woodpecker.timepicker.add_check_out()
	    break;
	default:
	    console.log('unhandled event');
	}
    },
}),
Woodpecker.Puncher.Buttons = Ember.ArrayController.extend({
    content: [],
    init: function() {
	this._super();
	var buttons = [
	    {text: "Check in", type: "check-in"},
	    {text: "Check out", type: "check-out"},
	    {text: "Add check in", type: "add-check-in"},
	    {text: "Add check out", type: "add-check-out"}].map(function (elem) {
		return Woodpecker.Puncher.Button.create(elem);
	    });
	this.set('content', buttons);
    },
});


// Selector
Woodpecker.Selector = Ember.ArrayController.extend({
    content: [],
    get_selected: function() {
	return this.content.filter(function (elem) {
	    return elem.marked;
	}).map(function (elem) {
	    return elem.content;
	});
    },
    set_selected: function(options) {
	for (var i = 0; i < this.content.length; i++) {
	    if (options.indexOf(this.objectAt(i).content) != -1) {
		this.objectAt(i).set('marked', true);
	    } else {
		this.objectAt(i).set('marked', false);
	    }
	}
    },
});
Woodpecker.Selector.Option = Ember.ObjectController.extend({
    content: null,
    marked: false,
    classNameBindings: ["marked:marked"],
    mark: function() {
	this.set("marked", true);
    },
    unmark: function() {
	this.set("marked", false);
    },
    toggle: function() {
	this.set("marked", !this.marked);
    },
});
Woodpecker.Selector.OptionView = Ember.View.extend({
    templateName: "selector-option",
});
Woodpecker.Selector.ControlButton = Woodpecker.Button.extend({
    hit: function() {
	switch (this.type) {
	case "cancel":
	    Woodpecker.selector.view.set('isVisible', false);
	    break;
	case "confirm":
	    console.log(Woodpecker.selector.get_selected());
	    var tasks = Woodpecker.selector.target.tasks;
	    var comments = Woodpecker.selector.target.comments;
	    var new_tasks = Woodpecker.selector.get_selected();
	    var new_comments = [];
	    for (var i = 0; i < new_tasks.length; i++) {
		var idx = tasks.indexOf(new_tasks[i]);
		if (idx != -1) {
		    new_comments.push(comments[idx]);
		} else {
		    new_comments.push(Woodpecker.Comment.create({
			task: new_tasks[i],
		    }));
		}
	    }
	    Woodpecker.selector.target.set('tasks', new_tasks);
	    Woodpecker.selector.target.set('comments', new_comments);
	    Woodpecker.selector.view.set('isVisible', false);
	    break;
	default:
	    console.log('unhandled event');
	}
    },
});
Woodpecker.Selector.ControlButtons = Ember.ArrayController.extend({
    content: [],
    init: function() {
	this._super();
	var buttons = [{text: "Cancel", type: "cancel"},
		       {text: "Confirm", type: "confirm"}].map(function(elem) {
			   return Woodpecker.Selector.ControlButton.create(elem);
		       });
	this.set('content', buttons);
    }
});
Woodpecker.Selector.ControlButtonView = Woodpecker.ButtonView.extend({
    templateName: 'button',
});
Woodpecker.selector = Woodpecker.Selector.create();
Woodpecker.selector.control_buttons = Woodpecker.Selector.ControlButtons.create();
Woodpecker.selector.view = Ember.View.create({
    templateName: "selector",
    isVisible: false,
});
Woodpecker.TaskView = Ember.View.create({
    templateName: "task",
});

// Comment Editor
Woodpecker.CommentEditor = Ember.ObjectController.extend({
    target: null,
    content: null,
    save: function() {
	console.log(this.content);
	this.target.save(this.content);
    },
});
Woodpecker.CommentEditor.ControlButton = Woodpecker.Button.extend({
    hit: function() {
	switch (this.type) {
	case "cancel":
	    Woodpecker.comment_editor.view.set('isVisible', false);
	    break;
	case "confirm":
	    Woodpecker.comment_editor.save();
	    Woodpecker.comment_editor.view.set('isVisible', false);
	    break;
	default:
	    console.log('unhandled event');
	}
    },
});
Woodpecker.CommentEditor.ControlButtons = Ember.ArrayController.extend({
    content: [],
    init: function() {
	this._super();
	var buttons = [{text: "Cancel", type: "cancel"},
		       {text: "Confirm", type: "confirm"}].map(function(elem) {
			   return Woodpecker.CommentEditor.ControlButton.create(elem);
		       });
	this.set('content', buttons);
    }
});
Woodpecker.CommentEditor.ControlButtonView = Woodpecker.ButtonView.extend({
    templateName: 'button',
});
