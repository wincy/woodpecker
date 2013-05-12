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
    this.Task = bindAll(this.Task, this);
    this.Project = bindAll(this.Project, this);
    this.Workspace = bindAll(this.Workspace, this);
}

Asana.prototype = {
    request: function(url, params, method) {
	url = this.ns + url;
	if (typeof params === undefined) {
	    params = {};
	}
	if (typeof method === undefined) {
	    method = 'GET';
	}
	var promise = new RSVP.Promise(function(resolve, reject) {
	    $.ajax({
		url: url,
		data: params,
		type: method,
	    })
		.success(function(data) {
		    resolve(data.data);
		})
		.fail(function() {
		    reject(this);
		});
	});
	return promise;
    },
    Task: {
	find: function(conds) {
	    return this.request('/tasks', conds).then(function(data) {
		return data.map(function(elem) {
		    return $.extend(new Asana.Task(elem.id), elem);
		});
	    });
	},
    },
    Project: {
	find: function(conds) {
	    return this.request('/projects', conds).then(function(data) {
		console.log(data);
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