define("asana/model", ["jquery", "when", "when/pipeline", "when/guard", "qunit", "persistent", "lock", "index", "underscore.string", "asana/remote", "sprintf"], function($, when, pipeline, guard, QUnit, Persistent, Lock, Index, _, Remote, sprintf) {
    CONCURRENCY = 50;

    when.pipeline = pipeline;
    when.guard = guard;

    function array_joint_reduce(s, l) {
	var result = [];
	l.forEach(function(i) {
	    if (s.indexOf(i) != -1) {
		result.push(i);
	    }
	})
	return result;
    }

    function Model(id) {
	this.id = id;
	this.INDEX_FIELDS = [];
    }

    Model.Field = function(type, index) {
	this.type = type;
	this.index = index;
    }

    Model.extend = function(names, fields) {
	var model = function(id) {
	    Model.call(this, id);
	    for (var name in this.fields) {
		if (!this.fields[name] instanceof Model.Field) {
		    continue;
		}
		if (this.fields[name].type instanceof Function) {
		    this[name] = {};
		    for (var key in Model.fn) {
			this[name][key] = Model.fn[key].bind(
			    null, this.fields[name].type, this._plural + '/' + this.id);
		    }
		} else if (this.fields[name].type == "string") {
		    if (this.fields[name].index) {
			this.INDEX_FIELDS.push(name);
		    }
		}
	    }
	}
	model.prototype = new Model();
	model.prototype.constructor = model;
	model.prototype._singular = names[0];
	model.prototype._plural = names[1];
	model.prototype.fields = fields;
	for (var name in fields) {
	    if (fields[name] instanceof Model.Field) {
		continue;
	    }
	    model.prototype[name] = fields[name];
	}
	for (var key in Model.fn) {
	    model[key] = Model.fn[key].bind(null, model, null);
	}
	return model;
    };

    Model.prototype = {
	sync: function(force) {
	    return when.pipeline([
		function() {
		    if (force) {
			return true;
		    } else {
			return new Persistent(this._plural)
			    .outdated(this.id, new Date(Date.parse(this.modified_at)));
		    }
		}.bind(this),
		function(outdated) {
		    if (outdated) {
			return when.pipeline([
			    function() {
				return true;
			    },
			    this.index.bind(this),
			    function() {
				return new Remote(this._plural).get(this.id);
			    }.bind(this),
			    function(data) {
				return new Persistent(this._plural)
				    .set(this.id, JSON.stringify(data));
			    }.bind(this),
			    this.index.bind(this),
			]);
		    } else {
			return null;
		    }
		}.bind(this),
	    ]);
	},
	load: function() {
	    return new Persistent(this._plural)
		.get(this.id).then(JSON.parse)
		.then(function(item) {
		    return $.extend(this, item);
		}.bind(this));
	},
	update: function(data) {
	    return new Remote(this._plural).update(this.id, data)
		.then(function(data) {
		    return new Persistent(this._plural).set(this.id, JSON.stringify(data));
		}.bind(this))
		.then(function() {
		    return this.index();
		}.bind(this))
		.then(function() {
		    return this.load();
		}.bind(this));
	},
	remove: function() {
	    return new Remote(this._plural).remove(this.id);
	},
	find: function(load) {
	    return new Persistent(this._plural)
		.get(this.id).then(JSON.parse).then(function(items) {
		    return when.all(when.map(items, when.guard(when.guard.n(CONCURRENCY), function(item) {
			if (load == true) {
			    return this.load();
			} else {
			    return $.extend(this, item);
			}
		    }.bind(this))));
		}.bind(this));
	},
	index: function(reverse) {
	    return new Persistent(this._plural)
		.get(this.id).then(function(data) {
		    var result = null;
		    try {
			result = JSON.parse(data);
		    } catch (e) {
			console.error(sprintf('index %s %s error', this._plural, this.id));
		    }
		    return result;
		}.bind(this))
		.then(function(item) {
		    return when.all(when.map(Object.keys(item), function(key) {
			if (this.INDEX_FIELDS.indexOf(key) != -1) {
			    if (reverse == true) {
				return new Index(this._singular + '.' + key,
						 this._singular + '.ids')
				    .srem(item[key], item.id);
			    } else {
				return new Index(this._singular + '.' + key,
						 this._singular + '.ids')
				    .sadd(item[key], item.id);
			    }
			} else {
			    return true;
			}
		    }.bind(this)));
		}.bind(this));
	},
    };

    Model.fn = {
	sync: function(klass, ns) {
	    return when.pipeline([
		function() {
		    if (!ns) {
			return new Remote().get(klass.prototype._plural);
		    } else {
			return new Remote(ns)
			    .get(klass.prototype._plural);
		    }
		},
		function(data) {
		    if (!ns) {
			return new Persistent()
			    .set(klass.prototype._plural, JSON.stringify(data));
		    } else {
			return new Persistent(ns)
			    .set(klass.prototype._plural, JSON.stringify(data));
		    }
		},
	    ]);
	},
	create: function(klass, ns, data) {
	    return when.pipeline([
		function() {
		    if (!ns) {
			return new Remote().create(klass.prototype._plural, data);
		    } else {
			return new Remote(ns)
			    .create(klass.prototype._plural, data);
		    }
		},
		function(data) {
		    return new Persistent(klass.prototype._plural)
			.set(data.id, JSON.stringify(data))
			.then(function() {
			    return new klass(data.id);
			});
		},
		function(item) {
		    return when.pipeline([
			item.index.bind(item),
			item.load.bind(item),
		    ]);
		},
	    ]);
	},
	find: function(klass, ns, load) {
	    return new Persistent(ns)
		.get(klass.prototype._plural).then(JSON.parse)
		.then(function(items) {
		    return when.all(when.map(items, when.guard(when.guard.n(CONCURRENCY), function(item) {
			if (load == true) {
			    return new klass(item.id).load();
			} else {
			    return $.extend(new klass(item.id), item);
			}
		    })));
		});
	},
	filter: function(klass, ns, conditions, load) {
	    return new Persistent(ns)
		.get(klass.prototype._plural).then(JSON.parse)
		.then(function(items) {
		    return when.reduce(when.map(
			Object.keys(conditions),
			function(key) {
			    return new Index(klass.prototype._singular + '.' + key,
					     klass.prototype._singular + '.' + 'ids')
				.smembers(conditions[key]);
			}), array_joint_reduce, items.map(function(item) {
			    return item.id;
			}))
			.then(function(ids) {
			    var result = ids.map(function(id) {
				return new klass(id);
			    });
			    if (load == true) {
				return when.all(when.map(result, function(item) {
				    return item.load();
				}));
			    } else {
				return result;
			    }
			});
		});
	},
	get: function(klass, ns, conditions) {
	    return new Persistent(ns)
		.get(klass.prototype._plural).then(JSON.parse)
		.then(function(items) {
		    return when.reduce(when.map(
			Object.keys(conditions),
			function(key) {
			    return new Index(klass.prototype._singular + '.' + key,
					     klass.prototype._singular + '.' + 'ids')
				.smembers(conditions[key]);
			}), array_joint_reduce, items.map(function(item) {
			    return item.id;
			}))
			.then(function(ids) {
			    if (ids.length == 1) {
				return new klass(ids[0]).load();
			    } else {
				console.log(sprintf("%s %s filtered",
						    ids.length,
						    klass.prototype._singular));
				return null;
			    }
			});
		});
	}
    };

    Model.test = function() {
	QUnit.asyncTest('Model testing', function() {
	    User = Model.extend(
		['user', 'users'], {
		    name: new Model.Field("string", true),
		    email: new Model.Field("string", true),
		});
	    Task = Model.extend(
		['task', 'tasks'], {
		    name: new Model.Field("string", true),
		});
	    Workspace = Model.extend(
		['workspace', 'workspaces'], {
		    name: new Model.Field("string", true),
		    User: new Model.Field(User),
		    Task: new Model.Field(Task),
		});
	    return when.pipeline([
	    	// check User
	    	User.sync,
	    	User.find,
	    	function(users) {
	    	    ok(users.length >= 1, 'users sync');
	    	    return users;
	    	},
	    	// check single sync
	    	function(users) {
	    	    return when.all(when.map(users, function(user) {
	    		return when.pipeline([
	    		    user.sync.bind(user),
	    		    user.load.bind(user),
	    		]).then(function(user) {
	    		    ok(user.name, sprintf('user %s sync & load', user.name));
	    		});
	    	    }))
	    	},
	    	// check index
	    	function() {
		    var me = new User('me')
	    	    return me.sync().then(function() {
			return me.load();
		    });
	    	},
	    	function(me) {
	    	    return me.index().then(function() {
	    		return me;
	    	    });
	    	},
	    	function(me) {
	    	    return when.pipeline([
	    		me.sync.bind(me),
	    		me.load.bind(me),
	    		function(me) {
	    		    return when.all([
	    			User.filter({name: me.name}).then(function(users) {
	    			    equal(users.length, 1, 'filter user me by index');
	    			}),
	    			User.get({name: me.name}).then(function(user) {
	    			    ok(user, 'get user me by index');
	    			}),
	    		    ]);
	    		},
	    	    ]);
	    	},
		// check Workspace
		Workspace.sync,
		Workspace.find,
		function(workspaces) {
		    return when.all(when.map(workspaces, function(workspace) {
			return when.pipeline([
			    workspace.sync.bind(workspace),
			    workspace.load.bind(workspace),
			]).then(function(workspace) {
			    ok(workspace, sprintf('workspace %s sync & load',
						  workspace.name));
			});
		    })).then(function() {
			return workspaces;
		    });
		},
		function(workspaces) {
		    return when.all(when.map(workspaces.slice(0,1), function(workspace) {
			ok(workspace, sprintf('workspaces %s loaded',
					      workspace.name));
			return when.pipeline([
			    workspace.User.sync,
			    workspace.User.find,
			    function(users) {
				ok(users.length > 0,
				   sprintf('users in workspace %s loaded',
					   workspace.name));
				return users[0].load();
			    },
			    function(user) {
			    	return user.index().then(function() {
			    	    return user;
			    	});
			    },
			    function(user) {
			    	return workspace.User.filter({name: user.name})
			    	    .then(function(users) {
			    		ok(users.length == 1, 'filter one user out');
			    		return user;
			    	    });
			    },
			    function(user) {
			    	return workspace.User.get({name: user.name})
			    	    .then(function(got) {
			    		deepEqual(got, user, 'match got user');
			    	    });
			    },
			]);
		    }));
		},
		// check task
		function() {
		    return Workspace.get({name: 'Test'})
		},
		function(workspace) {
		    return workspace.Task.create({
			name: 'task test',
			notes: 'task test notes',
			assignee: 'me',
		    }).then(function(task) {
			return when.pipeline([
			    task.index.bind(task),
			    workspace.Task.sync,
			]).then(function() {
			    equal(task.name, 'task test', 'check created task name');
			    equal(task.notes, 'task test notes', 'check created task notes');
			    return workspace;
			});
		    });
		},
		function(workspace) {
		    return workspace.Task.get({name: 'task test'}).then(function(task) {
			ok(task, 'newly created task from index');
			return task;
		    });
		},
		function(task) {
		    var notes_updated = 'task test notes updated';
		    return task.update({notes: notes_updated})
			.then(function(task) {
			    equal(task.notes, notes_updated, 'update task notes');
			    return task;
			});
		},
		function(task) {
		    return task.remove();
		},
		function() {
		    return Workspace.get({name: 'Test'})
		},
		function(workspace) {
		    return when.pipeline([
			workspace.Task.sync,
			function() {
			    return workspace.Task.filter({name: 'task test'});
			},
			function(tasks) {
			    ok(tasks.length == 0, 'task test removed');
			},
		    ]);
		},
		function() {},
	    	start,
	    ]);
	});
    };

    return Model;
});
