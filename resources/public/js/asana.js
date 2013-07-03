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
	if (typeof target[key] == 'function') {
	    result[key] = target[key].bind(that);
	}
    }
    return result;
}

function rejectHandler(error) {
    console.log(error);
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
    delay: function (timeout) {
	var p = RSVP.Promise(function(resolve, reject) {
	    setTimeout(resolve, timeout);
	});
	return p;
    },
    request: function(url, params, method) {
	var key = JSON.stringify({url: url, params: params, method: method});
	var cache = locache.get('req:' + key);
	full_url = this.ns + url;
	if (params == undefined) {
	    params = {};
	}
	if (method == undefined) {
	    method = 'GET';
	}
	var promise = new RSVP.Promise(function(resolve, reject) {
	    if (navigator.onLine && this.onLine) {
		$.ajax({
		    url: full_url,
		    data: params,
		    type: method,
		    timeout: 30000,
		})
		    .done(function(data, status, xhr) {
			locache.set('req:' + key, data.data, 86400);
			resolve(data.data);
		    })
		    .fail(function(xhr, status, error) {
			if (xhr.status == 429 || error == 'timeout') {
			    var timeout = 0;
			    if (xhr.status == 429) {
				timeout = JSON.parse(xhr.responseText).retry_after * 1000;
			    }
			    asana.delay(timeout).then(function() {
				console.log('retry:', url, params, method);
				asana.request(url, params, method)
				    .then(function(data) {
					this.resolve(data);
				    }.bind(this), function(error) {
					console.log('reject @ retry:', error);
					this.reject(error);
				    }.bind(this));
			    }.bind({resolve: resolve, reject: reject}))
			} else {
			    if (cache) {
				resolve(cache);
			    } else {
				console.log(xhr);
				console.log(error);
				reject(xhr.responseText);
			    }
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
	    return asana.request('/users', conds).then(function(data) {
		return data.map(function(elem) {
		    return $.extend(new Asana.User(elem.id), elem);
		});
	    }, rejectHandler);
	},
    },
    Task: {
	find: function(params) {
	    var conds = {};
	    if (params['assignee.id']) {
		conds.assignee = params['assignee.id'];
	    }
	    if (params['workspace.id']) {
		conds.workspace = params['workspace.id'];
	    }
	    if (params['opt_fields']) {
		conds.opt_fields = params['opt_fields'];
	    }
	    return asana.request('/tasks', conds).then(function(data) {
		return data.filter(function(task) {
		    for (var field in params) {
			if (field == 'opt_fields') {
			    continue;
			}
			var fields = field.split('.');
			var target = task;
			for (var i = 0; i < fields.length; i++) {
			    target = target[fields[i]];
			}
			if (! RegExp(params[field]).test(target)) {
			    return false;
			}
		    }
		    return true;
		}).map(function(task) {
		    return $.extend(new Asana.Task(task.id), task);
		});
	    }, rejectHandler);
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
	    if (params['assignee.id']) {
		conds.assignee = params['assignee.id'];
	    }
	    if (params['workspace.id']) {
		conds.workspace = params['workspace.id'];
	    }
	    if (params['opt_fields']) {
		conds.opt_fields = params['opt_fields'];
	    }
	    return asana.request('/tasks', conds).then(function(data) {
		var tasks = data.filter(function(task) {
		    for (var field in params) {
			if (field == 'opt_fields') {
			    continue;
			}
			var fields = field.split('.');
			var target = task;
			for (var i = 0; i < fields.length; i++) {
			    target = target[fields[i]];
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
			    'opt_fields': 'opt_fields',
			};
			var converted = {};
			for (var field in mapping) {
			    if (params[field]) {
				converted[mapping[field]] = params[field];
			    }
			}
			for (var i = 0; ; i++) {
			    if (params['projects.' + i + '.id']) {
				converted['projects[' + i + ']'] = params['projects.' + i + '.id'];
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
	    }.bind(this), rejectHandler);
	}
    },
    Project: {
	find: function(conds) {
	    return asana.request('/projects', conds).then(function(data) {
		return data.map(function(elem) {
		    return $.extend(new Asana.Project(elem.id), elem);
		});
	    }, rejectHandler);
	},
    },
    Workspace: {
	find: function(conds) {
	    return asana.request('/workspaces', conds).then(function(data) {
		return data.map(function(elem) {
		    return $.extend(new Asana.Workspace(elem.id), elem);
		});
	    }, rejectHandler);
	},
    },
}

Asana.Workspace = function(id) {
    this.lastUpdate = 0;
    this.id = id;
    this.name = null;
    this.Task = bindAll(this.Task, this);
    this.Project = bindAll(this.Project, this);
    this.Tag = bindAll(this.Tag, this);
}

Asana.Workspace.prototype = {
    load: function() {
	return asana.request(url).then(function(data) {
	    return $.extend(this, data);
	}.bind(this), rejectHandler);
    },
    Project: {
	find: function(conds) {
	    return asana.request('/workspaces/' + this.id + '/projects', conds)
		.then(function(data) {
		    return data.map(function(elem) {
			return $.extend(new Asana.Project(elem.id), elem);
		    });
		}, rejectHandler);
	},
    },
    Task: {
	create: function(data) {
	    return asana.request('/workspaces/' + this.id + '/tasks', data, 'POST')
		.then(function(data) {
		    new Persistent('tasks').set(data.id + '.json', JSON.stringify(data));
		    return data;
		})
		.then(function(data) {
		    return $.extend(new Asana.Task(data.id), data);
		}.bind(this), rejectHandler);
	},
	find: function(conds) {
	    return asana.request('/workspaces/' + this.id + '/tasks', conds)
		.then(function(data) {
		    return data.map(function(elem) {
			return $.extend(new Asana.Task(elem.id), elem);
		    });
		}, rejectHandler);
	},
    },
    Tag: {
	create: function(data) {
	    return asana.request('/workspaces/' + this.id + '/tags', data, 'POST')
		.then(function(data) {
		    return $.extend(new Asana.Tag(data.id), data);
		}.bind(this), rejectHandler);
	},
	find: function() {
	    return asana.request('/workspaces/' + this.id + '/tags')
		.then(function(data) {
		    return data.map(function(elem) {
			return $.extend(new Asana.Tag(elem.id), elem);
		    });
		}, rejectHandler);
	},
    },
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
	}.bind(this), rejectHandler);
    },
    Task: {
	getByName: function(name) {
	    if (this.id != asana.woodpecker.me.id) {
		console.log('cannot call Task.getByName');
	    }
	    var date = name.split('#')[0];
	    var index = name.split('#')[1];
	    var cache = locache.get(date);
	    if (date) {
		if (cache && cache[index]) {
		    return new Asana.Task(cache[index].id).load();
		} else {
		    return this.Task.create({
			name: name,
			assignee: 'me',
			assignee_status: 'today',
		    });
		}
	    }
	},
	create: function(data) {
	    data['projects[0]'] = this.id;
	    return asana.request('/workspaces/' + this.workspace.id + '/tasks', data, 'POST')
		.then(function(data) {
		    new Persistent('tasks').set(data.id + '.json', JSON.stringify(data));
		    return data;
		})
		.then(function(task) {
		    if (this.id == asana.woodpecker.me.id) {
			var date = data.name.split('#')[0];
			var index = data.name.split('#')[1];
			var cache = locache.get(date);
			if (!cache) {
			    cache = {}
			}
			cache[index] = {name: task.name, id: task.id};
			locache.set(date, cache);
		    }
		    return $.extend(new Asana.Task(task.id), task);
		}.bind(this), rejectHandler);
	},
	find: function(conds) {
	    return asana.request('/projects/' + this.id + '/tasks', conds)
		.then(function(data) {
		    return data.map(function(elem) {
			if (this.id == asana.woodpecker.me.id) {
			    if (!RegExp('.*#.*').test(elem.name)) {
				console.log('task is not a record');
				return;
			    }
			    var date = elem.name.split('#')[0];
			    var index = elem.name.split('#')[1];
			    var cache = locache.get(date);
			    if (!cache) {
				cache = {};
			    }
			    cache[index] = {name: elem.name, id: elem.id};
			    locache.set(date, cache);
			}
			var tasks = locache.get('tasks');
			if (!tasks) {
			    tasks = {};
			}
			if (!tasks[this.id]) {
			    tasks[this.id] = [];
			}
			if (tasks[this.id].indexOf(elem.id) == -1) {
			    tasks[this.id].push(elem.id);
			}
			locache.set('tasks', tasks);
			return $.extend(new Asana.Task(elem.id), elem);
		    }.bind(this));
		}.bind(this), rejectHandler)
	},
    }
}

Asana.Task = function(id) {
    this.id = id;
    this.Story = bindAll(this.Story, this);
    this.Tag = bindAll(this.Tag, this);
}

Asana.Task.prototype = {
    load: function() {
	var dataToTask = function(data) {
	    $.extend(this, data);
	    return this.Tag.find().then(function(tags) {
		this.tags = tags;
		return this;
	    }.bind(this), rejectHandler);
	};
	var tasks = locache.get('tasks');
	if (tasks &&
	    tasks[asana.woodpecker.me.id] &&
	    tasks[asana.woodpecker.me.id].indexOf(this.id) != -1) {
	    return new Persistent('tasks').get(this.id + '.json')
		.then(function(data) {
		    return JSON.parse(data);
		})
		.then(
		    dataToTask.bind(this),
		    function() {
			return asana.request('/tasks/' + this.id)
			    .then(function(data) {
				new Persistent('tasks').set(data.id + '.json', JSON.stringify(data));
				return data;
			    })
			    .then(dataToTask.bind(this), rejectHandler);
		    }.bind(this)
		);
	} else {
	    return asana.request('/tasks/' + this.id)
		.then(function(data) {
		    new Persistent('tasks').set(data.id + '.json', JSON.stringify(data));
		    return data;
		})
		.then(dataToTask.bind(this), rejectHandler);
	}
    },
    update: function(kvs) {
	return asana.request('/tasks/' + this.id, kvs, 'PUT')
	    .then(function(data) {
		new Persistent('tasks').set(data.id + '.json', JSON.stringify(data));
		return data;
	    })
	    .then(function(data) {
		return $.extend(this, data);
	    }.bind(this), rejectHandler);
    },
    addTag: function(tag) {
	return asana.request('/tasks/' + this.id + '/addTag', {tag: tag.id}, 'POST')
	    .then(function(data) {
		new Persistent('task-tags').get(this.id + '.json').then(
		    function(data) {
			var tags = JSON.parse(data);
			tags.push({id: tag.id, name: tag.name});
			return new Persistent('task-tags').set(
			    this.id + '.json', JSON.stringify(tags));
		    }.bind(this));
		return true;
	    }.bind(this), rejectHandler);
    },
    removeTag: function(tag) {
	return asana.request('/tasks/' + this.id + '/removeTag', {tag: tag.id}, 'POST')
	    .then(function(data) {
		new Persistent('task-tags').get(this.id + '.json')
		    .then(function(data) {
			var tags = JSON.parse(data);
			tags.removeObject({id: tag.id, name: tag.name});
			return new Persistent('task-tags').set(
			    this.id + '.json', JSON.stringify(tags));
		    }.bind(this), rejectHandler);
		return true;
	    }.bind(this), rejectHandler);
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
		}.bind(this), rejectHandler);
	},
	find: function(conds) {
	    return asana.request('/tasks/' + this.id + '/stories').map(function(elem) {
		return new Asana.Story(elem.id);
	    });
	},
    },
    Tag: {
	find: function() {
	    var dataToTags = function(data) {
		return data.map(function(tag) {
		    return $.extend(new Asana.Tag(tag.id), tag);
		});
	    };
	    return new Persistent('task-tags').get(this.id + '.json')
		.then(function(data) {
		    return JSON.parse(data);
		})
		.then(dataToTags,
		      function() {
			  return asana.request('/tasks/' + this.id + '/tags')
			      .then(function(data) {
				  new Persistent('task-tags')
				      .set(this.id + '.json', JSON.stringify(data));
				  return data;
			      }.bind(this))
			      .then(dataToTags, rejectHandler);
		      }.bind(this));
	},
    },
}

Asana.Story = function(id) {
    this.id = id;
}

Asana.Story.prototype = {
    load: function() {
	return asana.request('/stories/' + this.id)
	    .then(function(data) {
		return $.extend(this, data);
	    }.bind(this), rejectHandler);
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
	    }.bind(this), rejectHandler);
    },
}

Asana.Tag = function(id) {
    this.id = id;
    this.Task = bindAll(this.Task, this);
}

Asana.Tag.prototype = {
    load: function() {
	return asana.request('/tags/' + this.id)
	    .then(function(data) {
		return $.extend(this, data);
	    }.bind(this), rejectHandler);
    },
    Task: {
	find: function(conds) {
	    return asana.request('/tags/' + this.id + '/tasks').then(function(data) {
		return data.map(function(elem) {
		    return $.extend(new Asana.Task(elem.id), elem);
		}.bind(this));
	    }.bind(this), rejectHandler);
	},
    },
}
