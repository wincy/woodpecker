Function.prototype.partial = function() {
    var fn = this, args = Array.prototype.slice.call(arguments);
    return function(){
	var arg = 0;
	for ( var i = 0; i < args.length && arg < arguments.length; i++ )
            if ( args[i] === undefined )
		args[i] = arguments[arg++];
	return fn.apply(this, args);
    };
};

function bindAll(target, that) {
    var result = {};
    for (var key in target) {
	result[key] = target[key].bind(that);
    }
    return result;
}

Asana = function(ns) {
    this.ns = ns;
    this.onLine = true;
    this.User = bindAll(this.User, this);
    this.Task = bindAll(this.Task, this);
    this.Project = bindAll(this.Project, this);
    this.Workspace = bindAll(this.Workspace, this);
}

Asana.prototype = {
    request: function(url, params, method) {
	var key = JSON.stringify({url: url, params: params, method: method});
	var cache = locache.get('req:' + key);
	url = this.ns + url;
	if (typeof params === undefined) {
	    params = {};
	}
	if (typeof method === undefined) {
	    method = 'GET';
	}
	var promise = new RSVP.Promise(function(resolve, reject) {
	    if (navigator.onLine && this.onLine) {
		$.ajax({
		    url: url,
		    data: params,
		    type: method,
		    timeout: 10000,
		})
		    .success(function(data) {
			locache.set('req:' + key, data.data, 86400);
			resolve(data.data);
		    })
		    .fail(function() {
			if (cache) {
			    resolve(cache);
			} else {
			    reject(this);
			}
		    });
	    } else {
		if (cache) {
		    resolve(cache);
		} else {
		    console.log('cannot load resource when offline');
		    reject('offline now');
		}
	    }
	}.bind(this));
	return promise;
    },
    User: {
	find: function(conds) {
	    return this.request('/users', conds).then(function(data) {
		return data.map(function(elem) {
		    return $.extend(new Asana.User(elem.id), elem);
		});
	    });
	},
    },
    Task: {
	find: function(params) {
	    var conds = {};
	    if (params.assignee) {
		conds.assignee = params['assignee.id'];
	    }
	    if (params.workspace) {
		conds.workspace = params['workspace.id'];
	    }
	    return this.request('/tasks', conds).then(function(data) {
		return data.filter(function(task) {
		    for (var field in params) {
			var fields = field.split('.');
			var target = task;
			for (var i = 0; i < fields.length; i++) {
			    target = task[fields[i]];
			}
			if (! RegExp(params[field]).test(target)) {
			    return false;
			}
		    }
		    return true;
		}).map(function(task) {
		    return $.extend(new Asana.Task(task.id), task);
		});
	    });
	},
	get: function(params) {
	    // 
	    // Example: asana.Task.get({
	    //     'name': 'foobar',
	    //     'workspace.id': 123456789,
	    //     'assignee_status': 'today',
	    //     'project.0.id': 123456789,
	    // })
	    var conds = {};
	    if (params.assignee) {
		conds.assignee = params['assignee.id'];
	    }
	    if (params.workspace) {
		conds.workspace = params['workspace.id'];
	    }
	    return this.request('/tasks', conds).then(function(data) {
		var tasks = data.filter(function(task) {
		    for (var field in params) {
			var fields = field.split('.');
			var target = task;
			for (var i = 0; i < fields.length; i++) {
			    target = task[fields[i]];
			}
			if (! RegExp(params[field]).test(target)) {
			    return false;
			}
		    }
		    return true;
		});
		if (tasks.length > 0) {
		    return $.extend(new Asana.Task(tasks[0].id), tasks[0]);
		} else {
		    if (params['workspace.id']) {
			var mapping = {
			    'name': 'name',
			    'notes': 'notes',
			    'workspace.id': 'workspace',
			    'assignee.id': 'assignee',
			    'assignee_status': 'assignee_status',
			    'completed': 'completed',
			};
			var converted = {};
			for (var field in mapping) {
			    if (params[field]) {
				converted[mapping[field]] = params[field];
			    }
			}
			for (var i = 0; ; i++) {
			    if (params['project.' + i + '.id']) {
				converted['projects[' + i + ']'] = params['project.' + i + '.id'];
			    } else {
				break;
			    }
			}
			return asana.request('/tasks', converted, 'POST')
			    .then(function(data) {
				return $.extend(new Asana.Task(data.id), data);
			    });
		    } else {
			console.log('workspace.id is required when calling asana.Task.create');
		    }
		}
	    }.bind(this));
	}
    },
    Project: {
	find: function(conds) {
	    return this.request('/projects', conds).then(function(data) {
		return data.map(function(elem) {
		    return $.extend(new Asana.Project(elem.id), elem);
		});
	    });
	},
    },
    Workspace: {
	find: function(conds) {
	    return this.request('/workspaces', conds).then(function(data) {
		return data.map(function(elem) {
		    return $.extend(new Asana.Workspace(elem.id), elem);
		});
	    });
	},
    },
}

Asana.Workspace = function(id) {
    this.lastUpdate = 0;
    this.id = id;
    this.name = null;
    this.Task = bindAll(this.Task, this);
}

Asana.Workspace.prototype = {
    load: function() {
	return asana.request(url).then(function(data) {
	    return $.extend(this, data);
	}.bind(this));
    },
    Project: {
	find: function(conds) {
	    return this.request('/workspaces/' + this.id + '/projects', conds)
		.then(function(data) {
		    return data.map(function(elem) {
			return $.extend(new Asana.Project(elem.id), elem);
		    });
		});
	},
    },
    Task: {
	create: function(data) {
	    return asana.request('/workspaces/' + this.id + '/tasks', data, 'POST')
		.then(function(data) {
		    return $.extend(new Asana.Task(data.id), data);
		}.bind(this));
	},
	find: function(conds) {
	    return asana.request('/workspaces/' + this.id + '/tasks').map(function(elem) {
		return new Asana.Task(elem.id);
	    });
	},
    }
}

Asana.Project = function(id) {
    this.id = id;
    this.name = null;
    this.Task = bindAll(this.Task, this);
}

Asana.Project.prototype = {
    load: function() {
	return asana.request('/projects/' + this.id).then(function(data) {
	    return $.extend(this, data);
	}.bind(this));
    },
    Task: {
	create: function(data) {
	    return asana.request('/projects/' + this.id + '/tasks', data, 'POST')
		.then(function(data) {
		    return $.extend(new Asana.Task(data.id), data);
		}.bind(this));
	},
	find: function(conds) {
	    return asana.request('/projects/' + this.id + '/tasks').map(function(elem) {
		return new Asana.Task(elem.id);
	    });
	},
    }
}

Asana.Task = function(id) {
    this.id = id;
    this.Story = bindAll(this.Story, this);
}

Asana.Task.prototype = {
    load: function() {
	return asana.request('/tasks/' + this.id).then(function(data) {
	    return $.extend(this, data);
	}.bind(this));
    },
    update: function(kvs) {
	return asana.request('/tasks/' + this.id, kvs, 'PUT')
	    .then(function(data) {
		return $.extend(this, data);
	    }.bind(this));
    },
    Story: {
	create: function(content) {
	    return asana.request(
		'/tasks/' + this.id + '/stories',
		{text: content},
		'POST').then(function(data) {
		    var story = new Asana.Story(data.id);
		    $.extend(story, data);
		    return story;
		}.bind(this));
	},
	find: function(conds) {
	    return asana.request('/tasks/' + this.id + '/stories').map(function(elem) {
		return new Asana.Story(elem.id);
	    });
	},
    }
}

Asana.Story = function(id) {
    this.id = id;
}

Asana.Story.prototype = {
    load: function() {
	return asana.request('/stories/' + this.id)
	    .then(function(data) {
		return $.extend(this, data);
	    }.bind(this));
    },
}

Asana.User = function(id) {
    this.id = id;
}

Asana.User.prototype = {
    load: function() {
	return asana.request('/users/' + this.id)
	    .then(function(data) {
		return $.extend(this, data);
	    }.bind(this));
    },
}
