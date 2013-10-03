define("asana/model", ["jquery", "when", "when/pipeline", "qunit", "persistent", "lock", "index", "underscore.string", "asana/remote"], function($, when, pipeline, QUnit, Persistent, Lock, Index, _, Remote) {
    when.pipeline = pipeline;

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
	    for (var name in fields) {
		if (fields[name].type instanceof Function) {
		    this[name] = {};
		    for (var key in Model.fn) {
			this[name][key] = Model.fn[key].bind(
			    null, fields[name].type, this._plural + '/' + this.id);
		    }
		} else if (fields[name].type == "string") {
		    if (fields[name].index) {
			this.INDEX_FIELDS.push(name);
		    }
		}
	    }
	}
	model.prototype = new Model();
	model.prototype.constructor = model;
	model.prototype._singular = names[0];
	model.prototype._plural = names[1];
	for (var key in Model.fn) {
	    model[key] = Model.fn[key].bind(null, model, null);
	}
	return model;
    };

    Model.prototype = {
	sync: function() {
	    return when.pipeline([
		function() {
		    return new Remote(this._plural).get(this.id);
		}.bind(this),
		function(data) {
		    return new Persistent(this._plural).set(this.id, JSON.stringify(data));
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
	find: function(load) {
	    return new Persistent(this._plural)
		.get(this.id).then(JSON.parse).then(function(items) {
		    return when.map(items, function(item) {
			if (load == true) {
			    return new this.constructor(item.id).load();
			} else {
			    return $.extend(new this.constructor(item.id), item);
			}
		    }.bind(this));
		}.bind(this));
	},
	index: function() {
	    return new Persistent(this._plural)
		.get(this.id).then(JSON.parse)
		.then(function(item) {
		    return when.all(when.map(Object.keys(item), function(key) {
			if (this.INDEX_FIELDS.indexOf(key) != -1) {
			    return new Index(this._singular + '.' + key,
					     this._singular + '.ids')
				.sadd(item[key], item.id);
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
	find: function(klass, ns, load) {
	    return new Persistent(ns)
		.get(klass.prototype._plural).then(JSON.parse)
		.then(function(items) {
		    return when.map(items, function(item) {
			if (load == true) {
			    return new klass(item.id).load();
			} else {
			    return $.extend(new klass(item.id), item);
			}
		    });
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
				return when.map(result, function(item) {
				    return item.load();
				});
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
				throw sprintf("multiple %s filtered",
					      klass.prototype._singular);
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
	    Workspace = Model.extend(
		['workspace', 'workspaces'], {
		    name: new Model.Field("string", true),
		    User: new Model.Field(User),
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
		function() {
		},
	    	start,
	    ]);
	});
    };

    return Model;
});
