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

function _(target, that) {
    var result = {};
    for (var key in target) {
	result[key] = target[key].bind(that);
    }
    return result;
}

Asana = function(ns) {
    this.ns = ns;
    this.Task = _(this.Task, this);
    this.Project = _(this.Project, this);
    this.Workspace = _(this.Workspace, this);
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
	var key = JSON.stringify([url, params]);
	var cached_value = locache.get(key);
	var promise = new RSVP.Promise(function(resolve, reject) {
	    if (cached_value) {
		resolve(cached_value);
	    } else {
		$.ajax({
		    url: url,
		    data: params,
		    type: method,
		})
		    .success(function(data) {
			locache.set(key, data.data);
			resolve(data.data);
		    })
		    .fail(function() {
			reject(this);
		    });
	    }
	});
	return promise;
    },
    Task: {
	find: function(conds) {
	    return this.request('/tasks', conds).then(function(data) {
		return data.map(function(elem) {
		    return new Asana.Task(elem.id);
		});
	    });
	},
    },
    Project: {
	find: function(conds) {
	    return this.request('/projects', conds).then(function(data) {
		return data.map(function(elem) {
		    return new Asana.Project(elem.id);
		});
	    });
	},
    },
    Workspace: {
	find: function(conds) {
	    return this.request('/workspaces', conds).then(function(data) {
		return data.map(function(elem) {
		    return new Asana.Workspace(elem.id);
		});
	    });
	},
    },
}

Asana.Workspace = function(id) {
    this.id = id;
    this.name = null;
}

Asana.Workspace.prototype = {
    load: function() {
	return asana.request('/workspaces/' + this.id).then(function(data) {
	    return $.extend(this, data);
	}.bind(this));
    },
}

Asana.Task = function(id) {
    this.id = id;
    this.Story = _(this.Story, this);
}

Asana.Task.prototype = {
    load: function() {
	return asana.request('/tasks/' + this.id).then(function(data) {
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

Asana.Story = function(target, target_type, id) {
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
