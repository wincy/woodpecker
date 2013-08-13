var asana = new Asana('/asana');
var logging = null;
var result = null;

function rejectHandler(error) {
    if (this.info) {
	console.log(this.info);
    }
    console.log(error);
    if (error && error.stack) {
	console.log(error.stack);
    } else {
	var trace = printStackTrace();
        console.log(trace.join('\n'));
    }
    throw error;
}

window.applicationCache.addEventListener('updateready', function() {
    console.log('update to newest');
    window.applicationCache.swapCache();
    location.reload();
});

window.applicationCache.addEventListener('error', function() {
    console.log('error when update cache');
});

setInterval(function() {
    console.log('flush expire cache');
    locache.cleanup();
}, 86400000);

function init_efficient_tags() {
    return asana.Workspace.get({
	name: 'Woodpecker',
    }).then(function (woodpecker) {
	if (!woodpecker) {
	    return new Promise(function(resolve, reject) {
		alert("Workspace 'Woodpecker' is not found, please create one.");
		reject("Workspace 'Woodpecker' is not found, please create one.");
	    });
	} else {
	    return woodpecker.Project.get({
		name: '.woodpecker',
	    }).then(function(dot_wp) {
		return RSVP.all([1, 2, 3].map(function(level) {
		    return woodpecker.Tag.get({
			name: '效率-' + level,
			notes: JSON.stringify({
			    used_times: 100000,
			})
		    }).then(function(tag) {
			return dot_wp.Task.get({
			    name: 'tags',
			    assignee: 'me',
			}).then(function(tags_container) {
			    return tags_container.addTag(tag);
			})
		    }, rejectHandler);
		}));
	    });
	}
    }, rejectHandler);
}

window.Woodpecker = Ember.Application.create({
    ready: function () {
	Woodpecker.loader = Ember.ObjectController.create();
	Woodpecker.loader.view = Ember.View.create({
	    tagName: 'i',
	    classNames: ['loader icon-refresh'],
	    isVisible: false,
	});
	Woodpecker.date = Ember.ObjectController.create();
	Woodpecker.date.view = Ember.View.create({
	    tagName: 'h3',
	    template: Ember.Handlebars.compile('{{Woodpecker.timeline.date}}'),
	    touchStart: function() {
		Woodpecker.selector.type = 'set-dates';
		Woodpecker.selector.set('content', Woodpecker.selector.dates);
		Woodpecker.selector.view.set('scroll', window.scrollY);
		Woodpecker.selector.view.set('isVisible', true);
	    },
	    click: function() {
		Woodpecker.selector.type = 'set-dates';
		Woodpecker.selector.set('content', Woodpecker.selector.dates);
		Woodpecker.selector.view.set('scroll', window.scrollY);
		Woodpecker.selector.view.set('isVisible', true);
	    },
	});
	Woodpecker.selector = Woodpecker.Selector.create();
	Woodpecker.selector.load_dates();
	Woodpecker.selector.view = Woodpecker.PopupView.create({
	    childViews: [
		Ember.CollectionView.create({
		    templateName: 'selector',
		    controllerBinding: 'Woodpecker.selector',
		    contentBinding: 'controller.content',
		    itemViewClass: Woodpecker.Selector.OptionView,
		}),
		Ember.CollectionView.create({
		    itemViewClass: Woodpecker.ButtonView,
		    content: [
			Woodpecker.Button.create({
			    text: "Cancel",
			    hit: function() {
				Woodpecker.selector.view.set('isVisible', false);
			    },
			}),
			Woodpecker.Button.create({
			    text: "Confirm",
			    hit: function() {
				var selected = Woodpecker.selector.get_selected();
				switch(Woodpecker.selector.type) {
				case 'set-dates':
				    Woodpecker.timeline.set('date', selected[0].name);
				    logging.key = 'logs-' + selected[0].name;
				    break;
				case 'set-tasks':
				    logging.log({
					'type': Woodpecker.selector.type,
					'args': {
					    start: Woodpecker.selector.target.start,
					    end: Woodpecker.selector.target.end,
					    'tasks': selected.map(function(element) {
						return element.id;
					    }),
					},
				    });
				    Woodpecker.selector.target.set_tasks(selected);
				    break;
				case 'set-tags':
				    logging.log({
					'type': Woodpecker.selector.type,
					'args': {
					    start: Woodpecker.selector.target.start,
					    end: Woodpecker.selector.target.end,
					    'tags': selected.map(function(element) {
						return element.id;
					    }),
					},
				    });
				    Woodpecker.selector.target.set('tags', selected);
				    break;
				case 'statistics-tags':
				    var tags = Woodpecker.selector.get_selected();
				    stat_by_tags(tags);
				    Woodpecker.statistics.view.set('scroll', window.scrollY);
				    Woodpecker.statistics.view.set('isVisible', true);
				    break;
				default:
				    console.log('selector type error');
				}
				Woodpecker.selector.view.set('isVisible', false);
			    }
			}),
			Woodpecker.Button.create({
			    text: "Load",
			    hit: function() {
				Woodpecker.selector.set('content', []);
				switch(Woodpecker.selector.type) {
				case 'set-tasks':
				    Woodpecker.loader.view.set('isVisible', true);
				    asana.sync([Asana.Project]).then(function() {
					Woodpecker.selector.load_tasks()
					    .then(function() {
						Woodpecker.selector.set(
						    'content', Woodpecker.selector.tasks);
						Woodpecker.loader.view.set(
						    'isVisible', false);
					});
				    });
				    break;
				case 'set-tags':
				    Woodpecker.loader.view.set('isVisible', true);
				    asana.sync([Asana.Workspace]).then(function() {
					Woodpecker.selector.load_tags()
					    .then(function() {
						Woodpecker.selector.set(
						    'content', Woodpecker.selector.tags);
						Woodpecker.loader.view.set(
						    'isVisible', false);
					    });
				    });
				    break;
				default:
				    console.log('selector load unknown type');
				}
			    },
			}),
		    ],
		}),
	    ],
	});
	Woodpecker.timepicker = Woodpecker.Timepicker.create();
	Woodpecker.timepicker.cursors = Woodpecker.Timepicker.Cursors.create();
	Woodpecker.timepicker.numpad_buttons = Woodpecker.Timepicker.NumpadButtons.create();
	Woodpecker.timepicker.view = Woodpecker.PopupView.create({
	    childViews: [
		Ember.View.create({
		    tagName: 'h4',
		    template: Ember.Handlebars.compile('{{Woodpecker.timepicker.pretty_date}}'),
		}),
		Ember.CollectionView.create({
		    classNames: ['clearfix'],
		    controllerBinding: 'Woodpecker.timepicker.cursors',
		    contentBinding: 'controller.content',
		    itemViewClass: Woodpecker.Timepicker.CursorView,
		}),
		Ember.CollectionView.create({
		    classNames: ['timepicker-numpad'],
		    controllerBinding: 'Woodpecker.timepicker.numpad_buttons',
		    contentBinding: 'controller.content',
		    itemViewClass: Woodpecker.Timepicker.NumpadButtonView,
		}),
		Ember.CollectionView.create({
		    itemViewClass: Woodpecker.ButtonView,
		    content: [
			Woodpecker.Button.create({
			    text: "Cancel",
			    hit: function() {
				Woodpecker.timepicker.view.set('isVisible', false);
				Woodpecker.timepicker.removeObserver(
				    'value', Woodpecker.timepicker.target,
				    Woodpecker.timepicker.method);
			    },
			}),
			Woodpecker.Button.create({
			    text: "Confirm",
			    hit: function() {
				var ts = new Date(Woodpecker.timepicker.date);
				var hours = parseInt(Woodpecker.timepicker.cursors.mget(0, 2).join(''));
				var minutes = parseInt(Woodpecker.timepicker.cursors.mget(3, 5).join(''));
				ts.setHours(hours);
				ts.setMinutes(minutes);
				ts.setSeconds(0);
				ts.setMilliseconds(0);
				Woodpecker.timepicker.set('value', ts);
				Woodpecker.timepicker.view.set('isVisible', false);
			    },
			}),
		    ],
		}),
	    ],
	});
	Woodpecker.puncher = Woodpecker.Puncher.create();
	Woodpecker.puncher.buttons = Woodpecker.Puncher.Buttons.create();
	Woodpecker.puncher.view = Woodpecker.PopupView.create({
	    childViews: [
		Ember.CollectionView.create({
		    itemViewClass: Woodpecker.ButtonView,
		    content: [
			Woodpecker.Button.create({
			    text: "Save",
			    hit: function() {
				Woodpecker.loader.view.set('isVisible', true);
				Woodpecker.timeline.save().then(function() {
				    return logging.clear();
				}, rejectHandler).then(function() {
				    return asana.woodpecker.me.sync(new Date());
				}, rejectHandler).then(function() {
				    Woodpecker.loader.view.set('isVisible', false);
				}, rejectHandler);
				Woodpecker.puncher.view.set('isVisible', false);
			    },
			}),
			Woodpecker.Button.create({
			    text: "Load",
			    hit: function() {
				Woodpecker.loader.view.set('isVisible', true);
				Woodpecker.timeline.load().then(function() {
				    return logging.apply_all();
				}, rejectHandler).then(function() {
				    Woodpecker.loader.view.set('isVisible', false);
				});
				Woodpecker.puncher.view.set('isVisible', false);
			    },
			}),
			Woodpecker.Button.create({
			    text: "Check in",
			    hit: function() {
				Woodpecker.timeline.check_in();
				Woodpecker.puncher.view.set('isVisible', false);
			    },
			}),
			Woodpecker.Button.create({
			    text: "Check out",
			    hit: function() {
				Woodpecker.timeline.check_out();
				Woodpecker.puncher.view.set('isVisible', false);
			    },
			}),
			Woodpecker.Button.create({
			    text: "Add check in",
			    hit: function() {
				Woodpecker.timepicker.add_check_in();
				Woodpecker.puncher.view.set('isVisible', false);
			    },
			}),
			Woodpecker.Button.create({
			    text: "Add check out",
			    hit: function() {
				Woodpecker.timepicker.add_check_out();
				Woodpecker.puncher.view.set('isVisible', false);
			    },
			}),
			Woodpecker.Button.create({
			    text: "Flush date",
			    hit: function() {
				Woodpecker.loader.view.set('isVisible', true);
				Woodpecker.timeline.set_date();
				Woodpecker.timeline.load().then(function() {
				    Woodpecker.loader.view.set('isVisible', false);
				});
				Woodpecker.puncher.view.set('isVisible', false);
			    },
			}),
			Woodpecker.Button.create({
			    text: "Statistics",
			    hit: function() {
				$('.statistics').empty();
				Woodpecker.puncher.view.set('isVisible', false);
				Woodpecker.selector.select_statistics_tags();
			    },
			}),
			Woodpecker.Button.create({
			    text: "Sync",
			    hit: function() {
				Woodpecker.loader.view.set('isVisible', true);
				RSVP.all([
				    asana.sync([
					Asana.User,
					Asana.Workspace,
					Asana.Project,
					Asana.Tag,
				    ]),
				    asana.woodpecker.Tag.find().then(function(tags) {
					return RSVP.all(tags.map(function(tag) {
					    // force sync for notes
					    return tag.sync(new Date());
					}))
				    }),
				]).then(function() {
				    Woodpecker.loader.view.set('isVisible', false);
				});
				Woodpecker.puncher.view.set('isVisible', false);
			    },
			}),
			Woodpecker.Button.create({
			    text: "Clean",
			    hit: function() {
				Woodpecker.loader.view.set('isVisible', true);
				asana.woodpecker.me.Task.find().then(function(tasks) {
				    return RSVP.all(tasks.filter(function(task) {
					console.log(task.name, ':', (
					    Date.parse(Woodpecker.timeline.date) -
						Date.parse(task.name.split('#')[0]) >
						86400 * 1000 * 10));
					return (Date.parse(Woodpecker.timeline.date) -
						Date.parse(task.name.split('#')[0]) >
						86400 * 1000 * 10);
				    }).map(function(task) {
					return task.update({completed: true});
				    }));
				}, rejectHandler).then(function() {
				    Woodpecker.loader.view.set('isVisible', false);
				}, rejectHandler);
				Woodpecker.puncher.view.set('isVisible', false);
			    },
			}),
			Woodpecker.Button.create({
			    text: "Update Index",
			    hit: function() {
				Woodpecker.loader.view.set('isVisible', true);
				var index = new Index('task.name', 'task.id');
				return RSVP.all([
				    asana.woodpecker.me.Task.find()
					.then(function(tasks) {
					    return RSVP.all(tasks.map(function(task) {
						return index.set(task.name, task.id);
					    }));
					}, rejectHandler),
				]).then(function() {
				    Woodpecker.loader.view.set('isVisible', false);
				}, rejectHandler);
				Woodpecker.puncher.view.set('isVisible', false);
			    },
			}),
			Woodpecker.Button.create({
			    text: "Cancel",
			    hit: function() {
				Woodpecker.puncher.view.set('isVisible', false);
			    },
			}),
		    ],
		}),
	    ],
	    classNames: ["row-fluid"],
	});
	Woodpecker.timeline = Woodpecker.Timeline.create();
	Woodpecker.timeline.view = Ember.CollectionView.create({
	    tagName: 'tbody',
	    controllerBinding: 'Woodpecker.timeline',
	    contentBinding: 'controller.content',
	    itemViewClass: Woodpecker.Timeline.RecordView,
	});
	Woodpecker.timeline.set_date();
	Woodpecker.timepicker.set('date', new Date(Woodpecker.timeline.date));
	Woodpecker.comment_editor = Woodpecker.CommentEditor.create();
	Woodpecker.comment_editor.view = Woodpecker.PopupView.create({
	    childViews: [
		Ember.View.create({
		    tagName: 'h4',
		    template: Ember.Handlebars.compile('{{Woodpecker.comment_editor.target.task.name}}'),
		}),
		Ember.TextArea.create({
		    valueBinding: 'Woodpecker.comment_editor.content',
		}),
		Ember.CollectionView.create({
		    classNames: ['row-fluid'],
		    controllerBinding: 'Woodpecker.comment_editor',
		    itemViewClass: Woodpecker.ButtonView,
		    content: [
			Woodpecker.Button.create({
			    text: "Cancel",
			    hit: function() {
				Woodpecker.comment_editor.view.set('isVisible', false);
			    },
			}),
			Woodpecker.Button.create({
			    text: "Confirm",
			    hit: function() {
				Woodpecker.comment_editor.save();
				Woodpecker.comment_editor.view.set('isVisible', false);
			    },
			}),
		    ],
		}),
	    ],
	});
	Woodpecker.statistics = Ember.Object.create();
	Woodpecker.statistics.view = Woodpecker.PopupView.create({
	    childViews: [
		Ember.View.create({
		    classNames: ['statistics'],
		}),
		Ember.CollectionView.create({
		    itemViewClass: Woodpecker.ButtonView,
		    content: [
			Woodpecker.Button.create({
			    text: "Hide",
			    hit: function() {
				Woodpecker.statistics.view.set('isVisible', false);
			    },
			}),
		    ],
		}),
	    ],
	})
	Woodpecker.menu = Woodpecker.Menu.create();
	Woodpecker.loader.view.set('isVisible', true);
	asana.me = new Asana.User('me');
	result = RSVP.all([
	    init_efficient_tags(),
	    asana.Workspace.find()
		.then(function(workspaces) {
		    asana.workspaces = workspaces;
		    asana.woodpecker = workspaces.filter(function(workspace) {
			return workspace.name == 'Woodpecker';
		    })[0];
		    asana.workspaces.removeObject(asana.woodpecker);
		}, rejectHandler),
	    asana.me.load(),
	]).then(function (){
	    return asana.woodpecker.Project.find()
		.then(function(projects) {
		    return new RSVP.Promise(function(resolve, reject) {
			asana.woodpecker.me = projects.filter(function(project) {
			    return project.name == asana.me.name;
			})[0];
			if (asana.woodpecker.me) {
			    resolve(asana.woodpecker.me);
			} else {
			    reject('asana.woodpecker.me not found');
			}
		    })
		}, rejectHandler);
	}, rejectHandler).then(function() {
	    return Woodpecker.timeline.load();
	}, rejectHandler).then(function() {
	    return logging.apply_all();
	}, rejectHandler).then(function() {
	    return RSVP.all([
		Woodpecker.selector.load_tasks(),
		Woodpecker.selector.load_tags(),
	    ]);
	}, rejectHandler).then(function() {
	    Woodpecker.loader.view.set('isVisible', false);
	}, rejectHandler);
    },
});
Woodpecker.ApplicationController = Ember.Controller.extend({
    world: "world!",
});
Woodpecker.Button = Ember.ObjectController.extend({});
Woodpecker.ButtonView = Ember.View.extend({
    templateName: 'button',
    controllerBinding: 'content',
});
Woodpecker.PopupView = Ember.ContainerView.extend({
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
	Woodpecker.comment_editor.set('target',this);
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
	    return this.task.Story.create({text: this.content})
		.then(function(story) {
		    this.set('story', story);
		    return this;
		}.bind(this), rejectHandler);
	} else {
	    return this;
	}
    },
});
Woodpecker.Timeline = Ember.ArrayController.extend({
    id: null,
    content: [],
    save: function() {
	Woodpecker.loader.view.set('isVisible', true);
	return RSVP.all(this.content.map(function(record) {
	    return record.save_comments();
	})).then(function(records) {
	    return RSVP.all(Object.keys(records).map(function(idx) {
		return asana.woodpecker.me.Task.get({
		    name: sprintf('%s#%s', this.date, idx),
		    assignee: 'me',
		    assignee_status: 'today',
		}).then(function(task) {
		    var idx = parseInt(task.name.split('#')[1]);
		    var promises = [];
		    promises.push(task.update({notes: this.content[idx].toJSON()}));
		    var old_ids = task.tags.map(function(tag) {
			return tag.id;
		    });
		    var new_ids = this.content[idx].tags.map(function(tag) {
			return tag.id;
		    });
		    this.content[idx].tags.forEach(function(tag) {
			if (old_ids.indexOf(tag.id) == -1) {
			    promises.push(task.addTag(tag));
			    var meta = null;
			    try {
				meta = JSON.parse(tag.notes);
			    } catch (e) {
				meta = {
				    used_times: 0,
				};
			    }
			    meta.used_times += 1;
			    promises.push(tag.update({
				notes: JSON.stringify(meta),
			    }));
			}
		    });
		    task.tags.forEach(function(tag) {
			if (new_ids.indexOf(tag.id) == -1) {
			    promises.push(task.removeTag(tag));
			    var meta = null;
			    try {
				meta = JSON.parse(tag.notes);
			    } catch (e) {
				meta = {
				    used_times: 0,
				};
			    }
			    meta.used_times -= 1;
			    promises.push(tag.update({
				notes: JSON.stringify(meta),
			    }));
			}
		    });
		    return RSVP.all(promises);
		}.bind(this), rejectHandler);
	    }.bind(this)));
	}.bind(this), rejectHandler);
    },
    load: function() {
	this.set('content', []);
	return asana.woodpecker.me.Task.find()
	    .then(function(tasks) {
		return RSVP.all(
		    tasks.filter(function(task) {
			return RegExp(sprintf('^%s#\\d+$', this.date)).test(task.name);
		    }.bind(this)).map(function(task) {
			return task.load();
		    }));
	    }.bind(this), rejectHandler)
	    .then(function(tasks) {
		console.log(tasks);
		var sorted = tasks.sort(function(a, b) {
		    var idx_a = parseInt(a.name.split('#')[1]);
		    var idx_b = parseInt(b.name.split('#')[1]);
		    return idx_a - idx_b;
		});
		return RSVP.all(sorted.map(function(task) {
		    if (task.notes.length == 0) {
			console.log('cannot parse', task);
		    }
		    var record = Woodpecker.Timeline.Record.create();
		    record.tags = task.tags;
		    return record.load(JSON.parse(task.notes));
		})).then(function(records) {
		    this.set('content', records);
		    return records;
		}.bind(this));
	    }.bind(this), rejectHandler);
    },
    set_date: function(date) {
	if (date == undefined) {
	    date = new Date();
	}
	var date_str = sprintf('%d-%02d-%02d',
			       date.getFullYear(),
			       date.getMonth() + 1,
			       date.getDate());
	this.set('date', date_str);
	logging = new Logging(date_str);
    },
    check_in: function() {
	var now = new Date();
	now.setSeconds(0);
	now.setMilliseconds(0);
	logging.log({
	    'type': 'check-in',
	    'args': {ts: now},
	});
	this._add_check_in(now);
    },
    check_out: function() {
	var now = new Date();
	now.setSeconds(0);
	now.setMilliseconds(0);
	logging.log({
	    'type': 'check-out',
	    'args': {ts: now},
	});
	this._add_check_out(now);
    },
    add_check_in: function() {
	Woodpecker.timepicker.removeObserver('value', Woodpecker.timeline, 'add_check_in');
	logging.log({
	    'type': 'check-in',
	    'args': {ts: Woodpecker.timepicker.value},
	});
	this._add_check_in(Woodpecker.timepicker.value);
    },
    _add_check_in: function(ts) {
	var i = 0;
	while (true) {
	    if (i >= this.content.length) {
		var record = Woodpecker.Timeline.Record.create(
		    {start: ts,
		     end: null,
		     tasks: [],
		     comments: [],
		    });
		this.pushObject(record);
		break;
	    } else if (this.content[i].start == null) {
		if (this.content[i].end >= ts) {
		    this.objectAt(i).set('start', ts);
		    break;
		} else {
		    i = i + 1;
		}
	    } else if (this.content[i].start < ts) {
		if (this.content[i].end <= ts) {
		    i = i + 1;
		} else {
		    var record = Woodpecker.Timeline.Record.create({
			start: this.content[i].start,
			end: null,
			tasks: [],
			comments: [],
		    });
		    this.insertAt(i, record);
		    this.objectAt(i+1).set('start', ts);
		    break;
		}
	    } else if (this.content[i].start == ts) {
		break;
	    } else if (this.content[i].start > ts) {
		var record = Woodpecker.Timeline.Record.create({
		    start: ts,
		    end: null,
		    tasks: [],
		    comments: [],
		});
		this.insertAt(i, record);
		break;
	    } else {
		console.log('error');
		break;
	    }
	}
    },
    add_check_out: function() {
	Woodpecker.timepicker.removeObserver('value', Woodpecker.timeline, 'add_check_out');
	logging.log({
	    'type': 'check-out',
	    'args': {ts: Woodpecker.timepicker.value},
	});
	this._add_check_out(Woodpecker.timepicker.value);
    },
    _add_check_out: function(ts) {
	var i = this.content.length - 1;
	while (true) {
	    if (i < 0) {
		var record = Woodpecker.Timeline.Record.create({
		    start: null,
		    end: ts,
		    tasks: [],
		    comments: [],
		});
		this.insertAt(0, record);
		break;
	    } else if (this.content[i].end == null) {
		if (this.content[i].start <= ts) {
		    this.objectAt(i).set('end', ts);
		    break;
		} else {
		    i = i - 1;
		}
	    } else if (this.content[i].end > ts) {
		if (this.content[i].start > ts) {
		    i = i - 1;
		} else {
		    var record = Woodpecker.Timeline.Record.create({
			start: null,
			end: this.content[i].end,
			tasks: [],
			comments: [],
		    });
		    this.insertAt(i + 1, record);
		    this.objectAt(i).set('end', ts);
		    break;
		}
	    } else if (this.content[i].end == ts) {
		break;
	    } else if (this.content[i].end < ts) {
		var record = Woodpecker.Timeline.Record.create({
		    start: null,
		    end: ts,
		    tasks: [],
		    comments: [],
		});
		this.insertAt(i, record);
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
    tags: [],
    efficient: false,
    save_comments: function() {
	return RSVP.all(this.comments.map(function(comment) {
	    return comment.save();
	}));
    },
    save: function() {
    },
    load: function(data) {
	if (data.start) {
	    this.set('start', new Date(Date.parse(data.start)));
	}
	if (data.end) {
	    this.set('end', new Date(Date.parse(data.end)));
	}
	return RSVP.all(
	    data.tasks.map(function(id) {
		return new Asana.Task(id).load();
	    })).then(function(tasks) {
		this.tasks = tasks;
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
				var comment = Woodpecker.Comment.create({
				    content: story.text,
				    story: story,
				    task: tasks[idx],
				});
				comment.record = this;
				return comment;
			    } else {
				var comment = Woodpecker.Comment.create({
				    task: tasks[idx],
				});
				comment.record = this;
				return comment;
			    }
			}.bind(this));
			this.set('comments', comments);
			return this;
		    }.bind(this), rejectHandler);
	    }.bind(this), rejectHandler);
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
    set_start: function(sender, key) {
	if (sender == undefined) {
	    if (this.start) {
		Woodpecker.timepicker.set('date', this.start);
		Woodpecker.timepicker.cursors.mset(
		    0, 2, sprintf("%02d", this.start.getHours()));
		Woodpecker.timepicker.cursors.mset(
		    3, 2, sprintf("%02d", this.start.getMinutes()));
	    }
	    Woodpecker.timepicker.get_time(this, 'set_start');
	} else {
	    logging.log({
		type: 'set-start',
		args: {
		    start: this.start,
		    end: this.end,
		    ts: sender.get(key),
		},
	    });
	    this.set('start', sender.get(key));
	    Woodpecker.timepicker.removeObserver('value', this, 'set_start');
	}
    },
    set_end: function(sender, key) {
	if (sender == undefined) {
	    if (this.end) {
		Woodpecker.timepicker.set('date', this.end);
		Woodpecker.timepicker.cursors.mset(
		    0, 2, sprintf("%02d", this.end.getHours()));
		Woodpecker.timepicker.cursors.mset(
		    3, 2, sprintf("%02d", this.end.getMinutes()));
	    }
	    Woodpecker.timepicker.get_time(this, 'set_end');
	} else {
	    logging.log({
		type: 'set-end',
		args: {
		    start: this.start,
		    end: this.end,
		    ts: sender.get(key),
		},
	    });
	    this.set('end', sender.get(key));
	    Woodpecker.timepicker.removeObserver('value', this, 'set_end');
	}
    },
    select_tags: function() {
	Woodpecker.selector.type = 'set-tags';
	Woodpecker.selector.set('content', Woodpecker.selector.tags);
	Woodpecker.selector.set_selected(this.tags);
	Woodpecker.selector.target = this;
	Woodpecker.selector.view.set('scroll', window.scrollY);
	Woodpecker.selector.view.set('isVisible', true);
    },
    select_tasks: function() {
	Woodpecker.selector.type = 'set-tasks';
	Woodpecker.selector.set('content', Woodpecker.selector.tasks);
	Woodpecker.selector.set_selected(this.tasks);
	Woodpecker.selector.target = this;
	Woodpecker.selector.view.set('scroll', window.scrollY);
	Woodpecker.selector.view.set('isVisible', true);
    },
    set_tasks: function(tasks) {
	var comments = [];
	for (var i = 0; i < tasks.length; i++) {
	    var idx = this.tasks.indexOf(tasks[i]);
	    if (idx != -1) {
		comments.push(this.comments[idx]);
	    } else {
		var comment = Woodpecker.Comment.create({
		    task: tasks[i],
		});
		comment.record = this;
		comments.push(comment);
	    }
	}
	this.set('tasks', tasks);
	this.set('comments', comments);
    },
    toJSON: function() {
	var human_parts = [];
	human_parts.push(this.get('use_time'));
	for (var i = 0; i < this.tasks.length; i++) {
	    human_parts.push('https://app.asana.com/0/0/' + this.tasks[i].id);
	    human_parts.push(this.comments[i].content);
	}
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
	    start: this.start && this.start.toString() || this.start,
	    end: this.end && this.end.toString() || this.end,
	    efficient: this.efficient,
	    human: human_parts.join(' '),
	}, undefined, 2);
    },
});
Woodpecker.Timeline.RecordView = Ember.View.extend({
    tagName: 'tr',
    classNameBindings: ['efficient'],
    templateName: 'timeline-record',
    controllerBinding: 'content',
    swipeOptions: {
    	direction: Em.OneGestureDirection.Left | Em.OneGestureDirection.Right,
    	cancelPeriod: 100,
    	swipeThreshold: 15,
    },
    efficient: function() {
	return this.content.efficient;
    }.property('content.efficient'),
    swipeEnd: function(recognizer, evt) {
    	var direction = recognizer.get('swipeDirection');
    	if (direction === Em.OneGestureDirection.Right) {
	    this.controller.toggleProperty('efficient');
	    logging.log({
		type: 'set-efficient',
		args: {
		    start: this.controller.start,
		    end: this.controller.end,
		    value: this.controller.efficient,
		},
	    });
    	} else if (direction === Em.OneGestureDirection.Left) {
	    this.controller.toggleProperty('efficient');
	    logging.log({
		type: 'set-efficient',
		args: {
		    start: this.controller.start,
		    end: this.controller.end,
		    value: this.controller.efficient,
		},
	    });
    	}
    },
});
Woodpecker.Timepicker = Ember.ObjectController.extend({
    date: null,
    value: null,
    target: null,
    method: null,
    pretty_date: function() {
	return sprintf('%d-%02d-%02d',
		       this.date.getFullYear(),
		       this.date.getMonth() + 1,
		       this.date.getDate())
    }.property('date'),
    get_time: function(target, method) {
	Woodpecker.timepicker.view.set('scroll', window.scrollY);
	Woodpecker.timepicker.view.set('isVisible', true);
	this.target = target;
	this.method = method;
	this.addObserver('value', target, method);
    },
    add_check_in: function() {
	Woodpecker.timepicker.view.set('scroll', window.scrollY);
	Woodpecker.timepicker.view.set('isVisible', true);
	this.set('date', new Date(Woodpecker.timeline.date));
	this.addObserver('value', Woodpecker.timeline, 'add_check_in');
    },
    add_check_out: function() {
	Woodpecker.timepicker.view.set('scroll', window.scrollY);
	Woodpecker.timepicker.view.set('isVisible', true);
	this.set('date', new Date(Woodpecker.timeline.date));
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
    controllerBinding: 'content',
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
	case "-1d":
	    var date = new Date(Woodpecker.timepicker.date);
	    date.setDate(date.getDate() - 1);
	    Woodpecker.timepicker.set('date', date);
	    break;
	case "now":
	    var now = new Date();
	    Woodpecker.timepicker.set('date', now);
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
    controllerBinding: 'content',
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
		       {text: "-1d", type: "-1d"},
		       {text: "0", type: "set-single"},
		       {text: "now", type: "now"},
		       {text: ":00", type: "set-minutes"}].map(function (elem) {
			   return Woodpecker.Timepicker.NumpadButton.create(elem);
		       });
	this.set('content', buttons);
    },
});
Woodpecker.Puncher = Ember.ObjectController.extend({
});
Woodpecker.Puncher.Button = Woodpecker.Button.extend({
    hit: function() {
	switch (this.type) {
	case "save":
	    Woodpecker.timeline.save().then(function() {
		logging.clear();
	    }, rejectHandler).then(function() {
		Woodpecker.loader.view.set('isVisible', false);
	    });
	    Woodpecker.puncher.view.set('isVisible', false);
	    break;
	case "load":
	    Woodpecker.timeline.load().then(function() {
		return logging.apply_all();
	    }, rejectHandler).then(function() {
	    	Woodpecker.loader.view.set('isVisible', false);
	    });
	    Woodpecker.puncher.view.set('isVisible', false);
	    break;
	case "check-in":
	    Woodpecker.timeline.check_in();
	    Woodpecker.puncher.view.set('isVisible', false);
	    break;
	case "check-out":
	    Woodpecker.timeline.check_out();
	    Woodpecker.puncher.view.set('isVisible', false);
	    break;
	case "add-check-in":
	    Woodpecker.timepicker.add_check_in();
	    Woodpecker.puncher.view.set('isVisible', false);
	    break;
	case "add-check-out":
	    Woodpecker.timepicker.add_check_out();
	    Woodpecker.puncher.view.set('isVisible', false);
	    break;
	case "flush-date":
	    Woodpecker.timeline.set_date();
	    Woodpecker.loader.view.set('isVisible', true);
	    Woodpecker.timeline.load().then(function() {
		Woodpecker.loader.view.set('isVisible', false);
	    });
	    Woodpecker.puncher.view.set('isVisible', false);
	    break;
	case "cancel":
	    Woodpecker.puncher.view.set('isVisible', false);
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
	    {text: "Flush date", type: "flush-date"},
	    {text: "Statistics", type: "statistics"},
	    {text: "Sync", type: "sync"},
	    {text: "Cancel", type: "cancel"},
	].map(function (elem) {
	    return Woodpecker.Puncher.Button.create(elem);
	});
	this.set('content', buttons);
    },
});


// Selector
Woodpecker.Selector = Ember.ArrayController.extend({
    content: [],
    dates: null,
    tasks: null,
    tags: null,
    type: null,
    load_dates: function() {
	var now = new Date();
	this.set('dates', [-1,0,1,2,3,4,5,6,7,8,9,11,12,13,14,15,16,17,18,19,20].map(function(offset) {
	    var day = new Date();
	    day.setTime(now.getTime() - 86400000 * offset);
	    return Woodpecker.Selector.Option.create({
		content: Ember.Object.create(
		    {name: sprintf('%d-%02d-%02d',
				   day.getFullYear(),
				   day.getMonth() + 1,
				   day.getDate())})
	    });
	}));
    },
    load_tasks: function() {
	return RSVP.all(asana.workspaces.map(function(workspace) {
	    return workspace.Project.find();
	})).then(function(projects_list) {
	    return RSVP.all(
		projects_list.reduce(function(s, a) {
		    return s.concat(a);
		}).map(function(project) {
		    return project.Task.find();
		}))
	}, rejectHandler).then(function(tasks_list) {
	    return RSVP.all(tasks_list.reduce(function(s, a) {
		var result = s.copy();
		a.forEach(function(task) {
		    if (!result.some(function(e) {
			return e.id == task.id;
		    })) {
			result.push(task);
		    }
		});
		return result;
	    }).filter(function(task) {
		return !task.completed;
	    }).map(function(task) {
		return new Asana.Task(task.id).load();
	    })).then(function(tasks) {
		return tasks.filter(function(task) {
		    return (task.assignee_status == 'today' &&
			    !task.completed &&
			    task.followers.map(function(follower) {
				return follower.id;
			    }).indexOf(asana.me.id) != -1);
		})
	    }, rejectHandler).then(function(tasks) {
		this.set('tasks', tasks.map(function(task) {
		    return Woodpecker.Selector.Option.create({content: task});
		}));
		return this;
	    }.bind(this), rejectHandler);
	}.bind(this), rejectHandler)
    },
    load_tags: function() {
	return asana.woodpecker.Tag.find()
	    .then(function(tags) {
		asana.woodpecker.tags = tags;
		this.set('tags', tags.sort(function(a, b) {
		    var ut1 = 0;
		    var ut2 = 0;
		    try {
			ut1 = JSON.parse(a.notes)['used_times'];
		    } catch (e) {
		    }
		    try {
			ut2 = JSON.parse(b.notes)['used_times'];
		    } catch (e) {
		    }
		    return ut2 - ut1;
		}).map(function(tag) {
		    return Woodpecker.Selector.Option.create({content: tag});
		}));
	    }.bind(this), rejectHandler);
    },
    select_statistics_tags: function() {
	Woodpecker.selector.type = 'statistics-tags';
	Woodpecker.selector.set('content', Woodpecker.selector.tags);
	Woodpecker.selector.view.set('scroll', window.scrollY);
	Woodpecker.selector.view.set('isVisible', true);
    },
    get_selected: function() {
	return this.content.filter(function (elem) {
	    return elem.marked;
	}).map(function (elem) {
	    return elem.content;
	});
    },
    set_selected: function(selected) {
	var ids = selected.map(function(element) {
	    return element.id;
	});
	for (var i = 0; i < this.content.length; i++) {
	    if (ids.indexOf(this.objectAt(i).content.id) != -1) {
		this.objectAt(i).set('marked', true);
	    } else {
		this.objectAt(i).set('marked', false);
	    }
	}
    },
    hit: function() {
	console.log(this);
	switch (this.type) {
	case "load":
	    this.load();
	    break;
	case "cancel":
	    this.view.set('isVisible', false);
	    break;
	case "confirm":
	    var selected = this.get_selected();
	    switch(this.type) {
	    case 'set-tasks':
		logging.log({
		    'type': this.type,
		    'args': {
			start: this.target.start,
			end: this.target.end,
			'tasks': selected.map(function(element) {
			    return element.id;
			}),
		    },
		});
		this.target.set_tasks(selected);
		break;
	    case 'set-tags':
		logging.log({
		    'type': this.type,
		    'args': {
			start: this.target.start,
			end: this.target.end,
			'tags': selected.map(function(element) {
			    return element.id;
			}),
		    },
		});
		this.target.set('tags', selected);
	    default:
		console.log('selector type error');
	    }
	    this.view.set('isVisible', false);
	    break;
	default:
	    console.log('unhandled event');
	}
    },
});
Woodpecker.Selector.Option = Ember.ObjectController.extend({
    content: null,
    marked: false,
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
    scroll: false,
    swipe: false,
    start: null,
    templateName: "selector-option",
    controllerBinding: 'content',
    classNameBindings: ["marked"],
    touchStart: function(evt) {
	this.scroll = false;
	this.swipe = false;
	this.start = {
	    x: evt.originalEvent.changedTouches[0].screenX,
	    y: evt.originalEvent.changedTouches[0].screenY,
	};
	this.current = null;
	this.origin = $(evt.currentTarget.firstElementChild).offset();
    },
    touchMove: function(evt) {
	if (!this.swipe && !this.scroll) {
	    if (Math.abs(evt.originalEvent.changedTouches[0].screenX
			 - this.start.x) > 8) {
		this.swipe = true;
		console.log('swipe');
		evt.preventDefault();
	    } else if (Math.abs(evt.originalEvent.changedTouches[0].screenY
				- this.start.y) > 10) {
		this.scroll = true;
		console.log('scroll');
	    }
	} else if (this.swipe) {
	    this.current = {
		left: (this.origin.left
		       + evt.originalEvent.changedTouches[0].screenX
		       - this.start.x),
	    };
	    $(evt.currentTarget.firstElementChild).offset(this.current);
	    console.log(evt);
	}
    },
    touchEnd: function(evt) {
	var prefix = null;
	if (this.current.left - this.origin.left >= 0) {
	    prefix = '-=';
	} else {
	    prefix = '+=';
	}
	$(evt.currentTarget.firstElementChild).animate({
	    left: prefix + Math.abs(this.current.left - this.origin.left) + 'px',
	}, 'fast');
	this.scroll = false;
	this.swipe = false;
	this.start = null;
    },
    touchCancel: function(evt) {
	var prefix = null;
	if (!this.current) {
	    return;
	}
	if (this.current.left - this.origin.left >= 0) {
	    prefix = '-=';
	} else {
	    prefix = '+=';
	}
	$(evt.currentTarget.firstElementChild).animate({
	    left: prefix + Math.abs(this.current.left - this.origin.left) + 'px',
	}, 'fast');
	this.scroll = false;
	this.swipe = false;
	this.start = null;
    },
});

// Comment Editor
Woodpecker.CommentEditor = Ember.ObjectController.extend({
    target: null,
    content: null,
    save: function() {
	logging.log({
	    'type': 'comment',
	    'args': {
		start: this.target.record.start,
		end: this.target.record.end,
		task: this.target.task.id,
		content: this.content,
	    },
	});
	this.target.set('content', this.content);
    },
});
Woodpecker.Menu = Ember.ObjectController.extend({
    hit: function() {
	Woodpecker.puncher.view.set('scroll', window.scrollY);
	Woodpecker.puncher.view.toggleProperty('isVisible');
    },
});
// Handlebars Helpers
Ember.Handlebars.registerHelper('wrap', function(property, options) {
    var content = Ember.get(this, property);
    if (content.length > 17) {
	return content.slice(0, 17) + '...';
    } else {
	return content;
    }
});
