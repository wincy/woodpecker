define("asana/model", ["jquery", "ember", "when", "when/pipeline", "when/guard", "qunit", "persistent", "lock", "index", "underscore.string", "asana/remote", "sprintf"], function($, Ember, when, pipeline, guard, QUnit, Persistent, Lock, Index, _, Remote, sprintf) {
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

    Model = Ember.Object.extend({
	id: null,
	INDEX_FIELDS: [],
    });

    Model.reopen({
	sync: function(force) {
	    return when.pipeline([
		function() {
		    if (force) {
			return true;
		    } else {
			return new Persistent(this.constructor._plural)
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
				return new Remote(this.constructor._plural).get(this.id);
			    }.bind(this),
			    function(data) {
				return new Persistent(this.constructor._plural)
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
	    return new Persistent(this.constructor._plural)
		.get(this.id).then(JSON.parse)
		.then(function(item) {
		    return $.extend(this, item);
		}.bind(this));
	},
	update: function(data) {
	    return new Remote(this.constructor._plural).update(this.id, data)
		.then(function(data) {
		    return new Persistent(this.constructor._plural)
			.set(this.id, JSON.stringify(data));
		}.bind(this))
		.then(function() {
		    return this.index();
		}.bind(this))
		.then(function() {
		    return this.load();
		}.bind(this));
	},
	remove: function() {
	    return new Remote(this.constructor._plural).remove(this.id);
	},
	find: function(load) {
	    return new Persistent(this.constructor._plural)
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
	    return new Persistent(this.constructor._plural).exists(this.id)
		.then(function(exists) {
		    if (!exists) {
			return;
		    }
		    return new Persistent(this.constructor._plural)
			.get(this.id).then(function(data) {
			    var result = null;
			    try {
				result = JSON.parse(data);
			    } catch (e) {
				console.error(sprintf('index %s %s error',
						      this.constructor._plural, this.id));
			    }
			    return result;
			}.bind(this))
			.then(function(item) {
			    return when.all(when.map(Object.keys(item), function(key) {
				if (this.INDEX_FIELDS.indexOf(key) != -1) {
				    if (reverse == true) {
					return new Index(this.constructor._singular + '.' + key,
							 this.constructor._singular + '.ids')
					    .srem(item[key], item.id);
				    } else {
					return new Index(this.constructor._singular + '.' + key,
							 this.constructor._singular + '.ids')
					    .sadd(item[key], item.id);
				    }
				} else {
				    return true;
				}
			    }.bind(this)));
			}.bind(this));
		}.bind(this));
	},
    });

    Model.reopenClass({
	Field: function(type, index) {
	    this.type = type;
	    this.index = index;
	},
    });

    Model.reopenClass({
	extends: function(names, fields) {
	    var model = Model.extend({
		init: function() {
		    this._super({id: this.get('id')});
		    for (var name in this.constructor.fields) {
			if (!this.constructor.fields[name] instanceof Model.Field) {
			    continue;
			}
			if (this.constructor.fields[name].type instanceof Function) {
			    var fns = {};
			    for (var key in Model.fn) {
				fns[key] = Model.fn[key].bind(
				    null, this.constructor.fields[name].type,
				    this.constructor._plural + '/' + this.id);
			    }
			    this.set(name, fns)
			} else if (this.constructor.fields[name].type == "string") {
			    if (this.constructor.fields[name].index) {
				this.INDEX_FIELDS.push(name);
			    }
			}
		    }
		},
	    });
	    model.reopenClass({
		'_singular': names[0],
		'_plural': names[1],
		'fields': fields,
	    });
	    var others = {};
	    for (var name in fields) {
		if (fields[name] instanceof Model.Field) {
		    continue;
		}
		others[name] = fields[name];
	    }
	    model.reopen(others);
	    var statics = {};
	    for (var key in Model.fn) {
		statics[key] = Model.fn[key].bind(null, model, null);
	    }
	    model.reopenClass(statics);
	    return model;
	},
	fn: {
	    sync: function(klass, ns) {
		return when.pipeline([
		    function() {
			if (!ns) {
			    return new Remote().get(klass._plural);
			} else {
			    return new Remote(ns)
				.get(klass._plural);
			}
		    },
		    function(data) {
			if (!ns) {
			    return new Persistent()
				.set(klass._plural, JSON.stringify(data));
			} else {
			    return new Persistent(ns)
				.set(klass._plural, JSON.stringify(data));
			}
		    },
		]);
	    },
	    new: function(klass, ns, data) {
		return when.pipeline([
		    function() {
			if (!ns) {
			    return new Remote().create(klass._plural, data);
			} else {
			    return new Remote(ns)
				.create(klass._plural, data);
			}
		    },
		    function(data) {
			return new Persistent(klass._plural)
			    .set(data.id, JSON.stringify(data))
			    .then(function() {
				return klass.create({id: data.id});
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
		    .get(klass._plural).then(JSON.parse)
		    .then(function(items) {
			return when.all(when.map(items, when.guard(when.guard.n(CONCURRENCY), function(item) {
			    if (load == true) {
				return klass.create({id: item.id}).load();
			    } else {
				return klass.create({id: item.id}).setProperties(item);
			    }
			})));
		    });
	    },
	    filter: function(klass, ns, conditions, load) {
		return new Persistent(ns)
		    .get(klass._plural).then(JSON.parse)
		    .then(function(items) {
			return when.reduce(when.map(
			    Object.keys(conditions),
			    function(key) {
				return new Index(klass._singular + '.' + key,
						 klass._singular + '.' + 'ids')
				    .smembers(conditions[key]);
			    }), array_joint_reduce, items.map(function(item) {
				return item.id;
			    }))
			    .then(function(ids) {
				var result = ids.map(function(id) {
				    return klass.create({id: id});
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
		    .get(klass._plural).then(JSON.parse)
		    .then(function(items) {
			return when.reduce(when.map(
			    Object.keys(conditions),
			    function(key) {
				return new Index(klass._singular + '.' + key,
						 klass._singular + '.' + 'ids')
				    .smembers(conditions[key]);
			    }), array_joint_reduce, items.map(function(item) {
				return item.id;
			    }))
			    .then(function(ids) {
				if (ids.length == 1) {
				    return klass.create({id: ids[0]}).load();
				} else {
				    console.log(sprintf("%s %s filtered",
							ids.length,
							klass._singular));
				    return null;
				}
			    });
		    });
	    }
	},
    })

    Model.reopenClass({
	test: function() {
	    QUnit.asyncTest('Model testing', function() {
		User = Model.extends(
		    ['user', 'users'], {
			name: new Model.Field("string", true),
			email: new Model.Field("string", true),
		    });
		Task = Model.extends(
		    ['task', 'tasks'], {
			name: new Model.Field("string", true),
		    });
		Workspace = Model.extends(
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
			var me = User.create({id: 'me'})
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
			return workspace.Task.new({
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
	},
    });

    return Model;
});
