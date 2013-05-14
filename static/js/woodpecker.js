var asana = new Asana('/asana');

Woodpecker = Ember.Application.create({
    //    LOG_TRANSITIONS: true,
    ready: function () {
	Woodpecker.selector = Woodpecker.Selector.create();
	Woodpecker.selector.control_buttons = Woodpecker.Selector.ControlButtons.create();
	Woodpecker.selector.view = Woodpecker.PopupView.create({
	    templateName: "selector",
	});
	Woodpecker.timepicker = Woodpecker.Timepicker.create();
	Woodpecker.timepicker.cursors = Woodpecker.Timepicker.Cursors.create();
	Woodpecker.timepicker.numpad_buttons = Woodpecker.Timepicker.NumpadButtons.create();
	Woodpecker.timepicker.control_buttons = Woodpecker.Timepicker.ControlButtons.create();
	Woodpecker.timepicker.view = Woodpecker.PopupView.create({
	    templateName: "timepicker",
	});
	Woodpecker.puncher = Woodpecker.Puncher.create();
	Woodpecker.puncher.buttons = Woodpecker.Puncher.Buttons.create();
	Woodpecker.puncher.view = Ember.View.create({
	    classNames: ["box", "row-fluid"],
	    templateName: "puncher",
	    isVisible: false,
	});
	Woodpecker.timeline = Woodpecker.Timeline.create();
	Woodpecker.timeline.flush_date();
	Woodpecker.timeline.view = Ember.View.create({
	    templateName: "timeline",
	});
	Woodpecker.comment_editor = Woodpecker.CommentEditor.create();
	Woodpecker.comment_editor.control_buttons = Woodpecker.CommentEditor.ControlButtons.create();
	Woodpecker.comment_editor.view = Woodpecker.PopupView.create({
	    templateName: "comment-editor",
	});
	Woodpecker.menu = Woodpecker.Menu.create();
	Woodpecker.menu.view = Ember.View.create({
	    controller: Woodpecker.menu,
	    templateName: 'menu',
	    classNames: ['menu'],
	});
	RSVP.all([
	    asana.Workspace.find()
		.then(function(workspaces) {
		    asana.workspaces = workspaces;
		    asana.personal = workspaces.filter(function(workspace) {
			return workspace.name == 'Personal';
		    })[0];
		    return true;
		}),
	    asana.Project.find()
		.then(function(projects) {
		    asana.woodpecker = projects.filter(function(project) {
			return project.name == '.woodpecker';
		    })[0];
		    return true;
		})
	]).then(function() {
	    Woodpecker.timeline.load();
	    Woodpecker.selector.load();
	});
	// $(".popup-1").affix();
    },
});
Woodpecker.ApplicationController = Ember.Controller.extend({
    world: "world!",
});
Woodpecker.Button = Ember.ObjectController.extend({});
Woodpecker.ButtonView = Ember.View.extend({
    templateName: 'button',
});
Woodpecker.PopupView = Ember.View.extend({
    classNames: ["popup"],
    isVisible: false,
    attributeBindings: ["style"],
    scroll: 0,
    style: function() {
	return "top:" + this.get('scroll') + "px";
    }.property('scroll'),
});
Woodpecker.Comment = Ember.ObjectController.extend({
    task: null,
    story: null,
    edit: function() {
	Woodpecker.comment_editor.set('target', this);
	if (! this.story) {
	    Woodpecker.comment_editor.set('content', this.content);
	} else {
	    Woodpecker.comment_editor.set('content', '');
	}
	Woodpecker.comment_editor.view.set('scroll', window.scrollY);
	Woodpecker.comment_editor.view.set('isVisible', true);
    },
    save: function() {
	if (! this.story && this.content && this.content.length > 0) {
	    return this.task.Story.create(this.content)
		.then(function(story) {
		    this.set('story', story);
		    return this;
		}.bind(this));
	} else {
	    return this;
	}
    },
});
Woodpecker.TimelineView = Ember.View.extend({
    templateName: "timeline",
});
Woodpecker.Timeline = Ember.ArrayController.extend({
    id: null,
    content: [],
    _get_task: function() {
	return asana.Task.find({
	    assignee: 'me',
	    workspace: asana.personal.id,
	})
	    .then(function(tasks) {
		var tasks = tasks.filter(function(task) {
		    return task.name == this.date;
		}.bind(this));
		if (tasks.length > 0) {
		    return new Asana.Task(tasks[0].id).load();
		} else {
		    return asana.personal.Task.create({
			name: this.date,
			'projects[0]': asana.woodpecker.id,
			assignee: 'me',
			assignee_status: 'today',
		    });
		}
	    }.bind(this));
    },
    save: function() {
	return RSVP.all(this.content.map(function(record) {
	    return record.save_comments();
	})).then(function() {
	    return this._get_task().then(function(today) {
		return today.update({notes: this.toJSON()});
	    }.bind(this));
	}.bind(this));
    },
    load: function() {
	this.set('content', []);
	return this._get_task().then(function(today) {
	    RSVP.all(
		JSON.parse(today.notes).map(function(raw) {
		    return Woodpecker.Timeline.Record.create().load(raw);
		}))
		.then(function(records) {
		    this.set('content', records);
		}.bind(this));
	}.bind(this));
    },
    toJSON: function() {
	return JSON.stringify(this.content.map(function(record) {
	    return JSON.parse(record.toJSON());
	}));
    },
    flush_date: function() {
	var now = new Date();
	var date = sprintf('%d-%02d-%02d',
			   now.getFullYear(),
			   now.getMonth() + 1,
			   now.getDate());
	this.set('date', date);
    },
    check_in: function() {
	var now = new Date();
	now.setSeconds(0);
	now.setMilliseconds(0);
	this._add_check_in(now);
    },
    check_out: function() {
	var now = new Date();
	now.setSeconds(0);
	now.setMilliseconds(0);
	this._add_check_out(now);
    },
    add_check_in: function() {
	Woodpecker.timepicker.removeObserver('value', Woodpecker.timeline, 'add_check_in');
	this._add_check_in(Woodpecker.timepicker.value);
    },
    _add_check_in: function(ts) {
	var i = 0;
	while (true) {
	    if (i >= this.content.length) {
		this.pushObject(Woodpecker.Timeline.Record.create(
		    {start: ts,
		     end: null,
		     tasks: [],
		     comments: [],
		    }));
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
		    break;
		}
	    } else if (this.content[i].start == ts) {
		break;
	    } else if (this.content[i].start > ts) {
		this.insertAt(i, Woodpecker.Timeline.Record.create({
		    start: ts,
		    end: null,
		    tasks: [],
		    comments: [],
		}));
		break;
	    } else {
		console.log('error');
		break;
	    }
	}
    },
    add_check_out: function() {
	Woodpecker.timepicker.removeObserver('value', Woodpecker.timeline, 'add_check_out');
	this._add_check_out(Woodpecker.timepicker.value);
    },
    _add_check_out: function(ts) {
	var i = this.content.length - 1;
	while (true) {
	    if (i < 0) {
		this.insertAt(0, Woodpecker.Timeline.Record.create({
		    start: null,
		    end: ts,
		    tasks: [],
		    comments: [],
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
			    tasks: [],
			    comments: [],
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
		    tasks: [],
		    comments: [],
		}));
		break;
	    } else {
		console.log('error');
		break;
	    }
	}
    },
});
Woodpecker.Timeline.Record = Ember.ObjectController.extend({
    start: null,
    end: null,
    tasks: [],
    comments: [],
    save_comments: function() {
	return RSVP.all(this.comments.map(function(comment) {
	    return comment.save();
	}));
    },
    load: function(data) {
	if (data.start) {
	    this.set('start', new Date(Date.parse(data.start)));
	}
	if (data.end) {
	    this.set('end', new Date(Date.parse(data.end)));
	}
	var load_tasks = RSVP.all(
	    data.tasks.map(function(id) {
		return new Asana.Task(id).load();
	    })).then(function(tasks) {
		this.set('tasks', tasks);
		return RSVP.all(
		    data.comments.map(function(id) {
			if (id) {
			    var story = new Asana.Story(id);
			    return story.load();
			} else {
			    return null;
			}
		    })).then(function(stories) {
			var comments = stories.toArray().map(function(story) {
			    var idx = stories.indexOf(story);
			    if (story) {
				return Woodpecker.Comment.create({
				    content: story.text,
				    story: story,
				    task: tasks[idx],
				});
			    } else {
				return Woodpecker.Comment.create({
				    task: tasks[idx],
				});
			    }
			}.bind(this));
			this.set('comments', comments);
			return this;
		    }.bind(this));
	    }.bind(this));
	return this;
    },
    start_short: function() {
	if (this.start) {
	    return sprintf("%02d:%02d", this.start.getHours(), this.start.getMinutes());
	} else {
	    return "";
	}
    }.property('start'),
    end_short: function() {
	if (this.end) {
	    return sprintf("%02d:%02d", this.end.getHours(), this.end.getMinutes());
	} else {
	    return "";
	}
    }.property('end'),
    use_time: function() {
	if (this.end && this.start) {
	    var diff = (this.end - this.start) / 1000;
	    return sprintf('%02d:%02d',
			   Math.floor(diff / 3600),
			   Math.floor(diff % 3600 / 60));
	} else {
	    return '00:00';
	}
    }.property('start', 'end'),
    select_tasks: function() {
	Woodpecker.selector.set_selected(this.tasks);
	Woodpecker.selector.target = this;
	Woodpecker.selector.view.set('scroll', window.scrollY);
	Woodpecker.selector.view.set('isVisible', true);
    },
    toJSON: function() {
	return JSON.stringify({
	    tasks: this.tasks.map(function(task) {
		return task.id;
	    }),
	    comments: this.comments.map(function(comment) {
		if (comment.story) {
		    return comment.story.id;
		} else {
		    return null;
		}
	    }),
	    start: this.start,
	    end: this.end,
	});
    },
});
Woodpecker.Timeline.RecordView = Ember.View.extend({
    templateName: "timeline-record",
});
Woodpecker.Timepicker = Ember.ObjectController.extend({
    value: null,
    add_check_in: function() {
	Woodpecker.timepicker.view.set('scroll', window.scrollY);
	Woodpecker.timepicker.view.set('isVisible', true);
	this.addObserver('value', Woodpecker.timeline, 'add_check_in');
    },
    add_check_out: function() {
	Woodpecker.timepicker.view.set('scroll', window.scrollY);
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
	    ts.setSeconds(0);
	    ts.setMilliseconds(0);
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
	case "save":
	    Woodpecker.timeline.save();
	    break;
	case "load":
	    Woodpecker.timeline.load();
	    break;
	case "check-in":
	    Woodpecker.timeline.check_in();
	    break;
	case "check-out":
	    Woodpecker.timeline.check_out();
	    break;
	case "add-check-in":
	    Woodpecker.timepicker.add_check_in();
	    break;
	case "add-check-out":
	    Woodpecker.timepicker.add_check_out();
	    break;
	case "flush-date":
	    Woodpecker.timeline.flush_date();
	    Woodpecker.timeline.load();
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
	    {text: "Save", type: "save"},
	    {text: "Load", type: "load"},
	    {text: "Check in", type: "check-in"},
	    {text: "Check out", type: "check-out"},
	    {text: "Add check in", type: "add-check-in"},
	    {text: "Add check out", type: "add-check-out"},
	    {text: "Flush date", type: "flush-date"}].map(function (elem) {
		return Woodpecker.Puncher.Button.create(elem);
	    });
	this.set('content', buttons);
    },
});


// Selector
Woodpecker.Selector = Ember.ArrayController.extend({
    content: [],
    load: function() {
	Woodpecker.selector.set('content', []);
	for (var i = 0; i < asana.workspaces.length; i++) {
	    asana.Task
		.find({
		    workspace: asana.workspaces[i].id,
		    assignee: 'me',
		    opt_fields: "name,parent,assignee,assignee_status,completed,projects"
		})
		.then(function(tasks) {
		    for (var j = 0; j < tasks.length; j++) {
			if (tasks[j].assignee_status == 'today' &&
			    tasks[j].completed == false &&
			    tasks[j].name[0] != '.') {
			    Woodpecker.selector.pushObject(
				Woodpecker.Selector.Option.create(
				    {content: tasks[j]}));
			}
		    }
		});
	}
    },
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
	case "load":
	    Woodpecker.selector.load();
	    break;
	case "cancel":
	    Woodpecker.selector.view.set('isVisible', false);
	    break;
	case "confirm":
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
		       {text: "Confirm", type: "confirm"},
		       {text: "Load", type: "load"}].map(function(elem) {
		return Woodpecker.Selector.ControlButton.create(elem);
	    });
	this.set('content', buttons);
    }
});
Woodpecker.Selector.ControlButtonView = Woodpecker.ButtonView.extend({
    templateName: 'button',
});

// Comment Editor
Woodpecker.CommentEditor = Ember.ObjectController.extend({
    target: null,
    content: null,
    save: function() {
	this.target.set('content', this.content);
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
Woodpecker.Menu = Ember.ObjectController.extend({
    hit: function() {
	var visible = Woodpecker.puncher.view.isVisible;
	Woodpecker.puncher.view.set('isVisible', ! visible);
    },
});
